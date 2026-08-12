import { readFileSync } from "node:fs";

import type { Result } from "@cffnpwr/result-ts";

import { Err, Ok } from "@cffnpwr/result-ts";
import { scope, type } from "arktype";
import { parse as parseYaml } from "yaml";

import type { SkillLocation } from "./loader.ts";
import type { Finding, Skill } from "./types.ts";

/**
 * 文字数は UTF-16 符号単位で数える。仕様は単位を定めていないため、
 * コードポイント数を下回らないこちらを採り、通す範囲が狭い側へ倒す。
 */
export const MAX_NAME_LENGTH = 64;
export const MAX_DESCRIPTION_LENGTH = 1024;
export const MAX_COMPATIBILITY_LENGTH = 500;

const SPEC_URL = "[Specification - Agent Skills](https://agentskills.io/specification)";

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/**
 * `parseFrontmatter`が`resolveKnownTags: false`でパースするため、フロントマターの値域はこれに限られる。
 *
 * arktypeのインデックスシグネチャは宣言済みキーにも適用される。この型を将来狭める場合も
 * オブジェクト・配列を含めたままにする必要がある。
 */
const yaml = scope({
  yamlValue: ["string | number | boolean | null | yamlValue[]", "|", { "[string]": "yamlValue" }],
}).export();

type YamlValue = typeof yaml.yamlValue.infer;

/**
 * `name`に使える文字について、仕様は英小文字・数字に加えてハイフンを許すが、
 * 英小文字・数字の範囲を「unicode lowercase alphanumeric characters (`a-z`, `0-9`)」と書いており、
 * Unicode全体を許す読みと`a-z0-9`に限る読みの双方を含む。通す範囲が狭い後者を採る。
 */
export const declaredSchema = type({
  name: `0 < string <= ${MAX_NAME_LENGTH} & /^[a-z0-9]+(?:-[a-z0-9]+)*$/`,
  description: `0 < string <= ${MAX_DESCRIPTION_LENGTH} & /\\S/`,
  "license?": "string",
  "compatibility?": `string <= ${MAX_COMPATIBILITY_LENGTH}`,
  "metadata?": { "[string]": "string" },
  "allowed-tools?": "string",
});

type FrontmatterField = keyof typeof declaredSchema.infer;

const specViolation = (code: string, message: string): Finding => ({ code, source: "spec", level: "must", message });

const VIOLATION_BY_FIELD: Record<FrontmatterField, Partial<Record<string, Finding>>> = {
  name: {
    required: specViolation("name-missing", "`name`フィールドが指定されていません。"),
    domain: specViolation("name-not-string", "`name`フィールドは空でない文字列である必要があります。"),
    minLength: specViolation("name-not-string", "`name`フィールドは空でない文字列である必要があります。"),
    maxLength: specViolation(
      "name-too-long",
      `\`name\`フィールドは${MAX_NAME_LENGTH}文字以内である必要があります。`,
    ),
    pattern: specViolation(
      "name-invalid-format",
      "`name`フィールドは英小文字・数字・連続しないハイフンのみで構成される必要があります。ハイフンを先頭と末尾に使用することはできません。",
    ),
  },
  description: {
    required: specViolation("description-missing", "`description`フィールドが指定されていません。"),
    domain: specViolation(
      "description-not-string",
      "`description`フィールドは空でない文字列である必要があります。",
    ),
    minLength: specViolation(
      "description-not-string",
      "`description`フィールドは空でない文字列である必要があります。",
    ),
    pattern: specViolation(
      "description-not-string",
      "`description`フィールドは空でない文字列である必要があります。",
    ),
    maxLength: specViolation(
      "description-too-long",
      `\`description\`フィールドは${MAX_DESCRIPTION_LENGTH}文字以内である必要があります。`,
    ),
  },
  compatibility: {
    domain: specViolation("compatibility-not-string", "`compatibility`フィールドが文字列ではありません。"),
    maxLength: specViolation(
      "compatibility-too-long",
      `\`compatibility\`フィールドは${MAX_COMPATIBILITY_LENGTH}文字以内である必要があります。`,
    ),
  },
  metadata: {
    domain: specViolation("metadata-not-mapping", "`metadata`フィールドが`キー: 値`のマッピングではありません。"),
  },
  license: {
    domain: specViolation("license-not-string", "`license`フィールドが文字列ではありません。"),
  },
  "allowed-tools": {
    domain: specViolation("allowed-tools-not-string", "`allowed-tools`フィールドは空白区切りの文字列である必要があります。"),
  },
};

/** 仕様は列挙外のフィールドを禁じていないため、未知のキーは許容する。 */
export const frontmatterSchema = declaredSchema.and({ "[string]": yaml.yamlValue });

const METADATA_VALUE_VIOLATION = specViolation(
  "metadata-not-string-map",
  "`metadata`フィールドの値に文字列でないものが含まれています。",
);

/**
 * 対応表の抜けによってfindingが1件も無いまま`Err`を返すと、`readSkillMd`がゲートとして
 * 打ち切るにもかかわらず理由を報告できない。
 *
 * 現在の入力域と`VIOLATION_BY_FIELD`の対応状況では、この経路には到達しない。
 */
const unknownFieldViolation = (field: string, description: string): Finding => specViolation(
  "frontmatter-field-invalid",
  `\`${field}\`の値が不正です。error: ${description}`,
);

const isFrontmatterField = (field: string): field is FrontmatterField => field in VIOLATION_BY_FIELD;

const readFrontmatterYaml = (content: string): Result<Record<string, YamlValue>, Finding> => {
  const match = FRONTMATTER_PATTERN.exec(content);
  // 中身が空のフロントマターは match[1] が空文字列になる。真偽値で判定しない。
  if (match === null) {
    return Err(specViolation(
      "frontmatter-missing",
      `SKILL.mdの先頭にフロントマターがありません（${SPEC_URL}）。`,
    ));
  }

  let parsed: unknown;
  try {
    // 既定はYAML 1.1のタグを解決し、Date・Uint8Array・Set・Mapを返しうる。
    // フロントマターの値域をYAML 1.2 coreスキーマ（null・真偽値・数値・文字列・配列・マップ）に限るため無効化する。
    parsed = parseYaml(match[1] ?? "", { resolveKnownTags: false });
  } catch (error) {
    return Err(specViolation(
      "frontmatter-invalid-yaml",
      `フロントマターが不正なYAMLです。error: ${String(error)}`,
    ));
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return Err(specViolation(
      "frontmatter-not-mapping",
      `フロントマターの形式が不正です（${SPEC_URL}）。`,
    ));
  }

  // resolveKnownTags: false により値域はYAML 1.2 coreスキーマに限られる。
  // 値が実際にYamlValueの範囲へ収まるかは、後続のスキーマ検査が全値を検証する。
  return Ok(parsed as Record<string, YamlValue>);
};

export const parseFrontmatter = (content: string): Result<typeof frontmatterSchema.infer, Finding[]> => {
  const yamlResult = readFrontmatterYaml(content);
  if (yamlResult.isErr()) return Err([yamlResult.unwrapErr()]);

  const result = frontmatterSchema(yamlResult.unwrap());
  if (!(result instanceof type.errors)) return Ok(result);

  const byCode = new Map<string, Finding>();
  for (const raw of result) {
    for (const error of raw.flat) {
      const field = String(error.path[0] ?? "");
      // metadata の値が文字列でない場合、パスは ["metadata", <キー>] になる。
      if (field === "metadata" && error.path.length > 1) {
        byCode.set(METADATA_VALUE_VIOLATION.code, METADATA_VALUE_VIOLATION);
        continue;
      }
      const violation = isFrontmatterField(field) ? VIOLATION_BY_FIELD[field][error.code] : undefined;
      if (violation !== undefined) {
        byCode.set(violation.code, violation);
        continue;
      }
      // 対応表に無い組み合わせでも、フィールドごとに1件は必ず報告する。
      const fallback = unknownFieldViolation(field, error.message);
      byCode.set(`${fallback.code}:${field}`, fallback);
    }
  }

  // 値が空のときは空であることだけを報告する。
  if (byCode.has("name-not-string")) byCode.delete("name-invalid-format");
  if (byCode.has("description-not-string")) byCode.delete("description-too-long");

  return Err([...byCode.values()]);
};

export const readSkillMd = (location: SkillLocation): Result<Skill, Finding[]> => {
  const content = readFileSync(location.skillMdPath, "utf8");

  const frontmatter = parseFrontmatter(content);
  if (frontmatter.isErr()) return Err(frontmatter.unwrapErr());

  return Ok({ ...location, content, frontmatter: frontmatter.unwrap() });
};
