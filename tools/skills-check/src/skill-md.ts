import { readFileSync } from "node:fs";

import type { Result } from "@cffnpwr/result-ts";

import { Err, Ok } from "@cffnpwr/result-ts";
import { type } from "arktype";
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

/** メッセージから参照する仕様のURL。 */
const SPEC_URL = "[Specification - Agent Skills](https://agentskills.io/specification)";

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/**
 * Agent Skills仕様が定めるフロントマターの形。
 *
 * `name`に使える文字について、仕様は英小文字・数字に加えてハイフンを許すが、
 * 英小文字・数字の範囲を「unicode lowercase alphanumeric characters (`a-z`, `0-9`)」と書いており、
 * Unicode全体を許す読みと`a-z0-9`に限る読みの双方を含む。通す範囲が狭い後者を採る。
 * 文字種に加え、先頭と末尾がハイフンでないこと・ハイフンが連続しないことも同じパターンで表す。
 *
 * 仕様は列挙外のフィールドを禁じていないため、未知のキーは許す（`extra-fields`が別途報告する）。
 */
export const FrontmatterSchema = type({
  name: `0 < string <= ${MAX_NAME_LENGTH} & /^[a-z0-9]+(?:-[a-z0-9]+)*$/`,
  description: `0 < string <= ${MAX_DESCRIPTION_LENGTH} & /\\S/`,
  "license?": "string",
  "compatibility?": `string <= ${MAX_COMPATIBILITY_LENGTH}`,
  "metadata?": { "[string]": "string" },
  "allowed-tools?": "string",
});

const specViolation = (code: string, message: string): Finding => ({ code, source: "spec", level: "must", message });

/** arktypeが返す種別と、こちらの種別・メッセージの対応。 */
const VIOLATION_BY_FIELD: Record<string, Partial<Record<string, Finding>>> = {
  name: {
    required: specViolation("name-missing", "フロントマターに`name`を書いてください。"),
    domain: specViolation("name-not-string", "`name`に空でない文字列を書いてください。"),
    minLength: specViolation("name-not-string", "`name`に空でない文字列を書いてください。"),
    maxLength: specViolation(
      "name-too-long",
      `\`name\`を${MAX_NAME_LENGTH}文字以内にしてください。`,
    ),
    pattern: specViolation(
      "name-invalid-format",
      "`name`フィールドは英小文字・数字・連続しないハイフンのみが使用可能です。ハイフンを先頭と末尾に使用することはできません。",
    ),
  },
  description: {
    required: specViolation("description-missing", "フロントマターに`description`を書いてください。"),
    domain: specViolation(
      "description-not-string",
      "`description`に、何をするスキルでいつ使うかを書いてください。",
    ),
    minLength: specViolation(
      "description-not-string",
      "`description`に、何をするスキルでいつ使うかを書いてください。",
    ),
    pattern: specViolation(
      "description-not-string",
      "`description`に、何をするスキルでいつ使うかを書いてください。",
    ),
    maxLength: specViolation(
      "description-too-long",
      `\`description\`を${MAX_DESCRIPTION_LENGTH}文字以内にしてください。`,
    ),
  },
  compatibility: {
    domain: specViolation("compatibility-not-string", "`compatibility`に文字列を書いてください。"),
    maxLength: specViolation(
      "compatibility-too-long",
      `\`compatibility\`を${MAX_COMPATIBILITY_LENGTH}文字以内にしてください。`,
    ),
  },
  metadata: {
    domain: specViolation("metadata-not-mapping", "`metadata`を`キー: 値`のマッピングにしてください。"),
  },
};

const METADATA_VALUE_VIOLATION = specViolation(
  "metadata-not-string-map",
  "`metadata`の値をすべて文字列にしてください（数値や真偽値は引用符で囲みます）。",
);

type ArkError = { readonly code: string; readonly path: readonly PropertyKey[]; };

/** `intersection`は複数の制約が同時に外れたことを表す。内訳へ展開する。 */
const flatten = (error: ArkError): ArkError[] => {
  if (error.code !== "intersection") return [error];

  const nested = (error as { errors?: Iterable<ArkError>; }).errors;
  if (nested === undefined) return [error];

  return [...nested].flatMap((inner) => flatten({ code: inner.code, path: error.path }));
};

/** フロントマターを仕様の形に照らす。 */
export const checkFrontmatterSchema = (frontmatter: Record<string, unknown>): Finding[] => {
  const result = FrontmatterSchema(frontmatter);
  if (!(result instanceof type.errors)) return [];

  const byCode = new Map<string, Finding>();
  for (const raw of result) {
    for (const error of flatten(raw)) {
      const field = String(error.path[0] ?? "");
      // metadata の値が文字列でない場合、パスは ["metadata", <キー>] になる。
      if (field === "metadata" && error.path.length > 1) {
        byCode.set(METADATA_VALUE_VIOLATION.code, METADATA_VALUE_VIOLATION);
        continue;
      }
      const violation = VIOLATION_BY_FIELD[field]?.[error.code];
      if (violation !== undefined) byCode.set(violation.code, violation);
    }
  }

  // 値が空のときは空であることだけを報告する。
  if (byCode.has("name-not-string")) byCode.delete("name-invalid-format");
  if (byCode.has("description-not-string")) byCode.delete("description-too-long");

  return [...byCode.values()];
};

/** `SKILL.md`の内容からフロントマターを取り出し、キーと値のマッピングとして返す。 */
export const parseFrontmatter = (content: string): Result<Record<string, unknown>, Finding> => {
  const match = FRONTMATTER_PATTERN.exec(content);
  // 中身が空のフロントマターは match[1] が空文字列になる。真偽値で判定しない。
  if (match === null) {
    return Err(specViolation(
      "frontmatter-missing",
      `SKILL.mdの先頭にフロントマターがありません。${SPEC_URL}に従って記載してください。`,
    ));
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(match[1] ?? "");
  } catch (error) {
    return Err(specViolation(
      "frontmatter-invalid-yaml",
      `フロントマターが不正なYAMLです。error: ${String(error)}`,
    ));
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return Err(specViolation(
      "frontmatter-not-mapping",
      `不正な形式のフロントマターです。${SPEC_URL}に従って記載してください。`,
    ));
  }

  return Ok(parsed as Record<string, unknown>);
};

/**
 * `SKILL.md`を読み、フロントマターの解析とスキーマ検査まで済ませる。
 * ここを通らないスキルはルールの対象にしない。
 */
export const readSkillMd = (location: SkillLocation): Result<Skill, Finding[]> => {
  const content = readFileSync(location.skillMdPath, "utf8");

  const frontmatter = parseFrontmatter(content);
  if (frontmatter.isErr()) return Err([frontmatter.unwrapErr()]);

  const fields = frontmatter.unwrap();
  const schemaViolations = checkFrontmatterSchema(fields);
  if (schemaViolations.length > 0) return Err(schemaViolations);

  return Ok({ ...location, content, frontmatter: fields });
};
