/**
 * skills-check のコマンドラインインターフェース。
 *
 * データはstdout、診断はstderrへ出す。終了コードは失敗種別で分ける。
 *   0: error なし（warning のみの場合を含む）
 *   1: error あり、または --warnings-as-errors 指定時に warning あり
 *   2: 使い方の誤り
 */

import { existsSync } from "node:fs";
import { parseArgs } from "node:util";

import type { Problem } from "./types.ts";

import { checkSkill, checkSkillsRoot } from "./check.ts";
import { severityOf } from "./types.ts";

const EXIT_OK = 0;
const EXIT_PROBLEMS = 1;
const EXIT_USAGE = 2;

const USAGE = `使い方: skills-check [オプション] <path>...

  --root                 引数をスキルの親ディレクトリとして扱い、直下の各ディレクトリを検査する
  --json                 結果をJSONで出す
  --warnings-as-errors   warning も失敗として扱う
`;

const renderText = (problems: readonly Problem[]): string => problems
  .map((problem) => `${severityOf(problem.level).toUpperCase()} `
    + `[${problem.source}/${problem.code}] `
    + `${problem.skill}: ${problem.message}`)
  .join("\n");

const renderJson = (problems: readonly Problem[]): string => JSON.stringify(
  problems.map((problem) => ({ ...problem, severity: severityOf(problem.level) })),
  null,
  2,
);

const main = (): number => {
  let values: { root?: boolean; json?: boolean; "warnings-as-errors"?: boolean; };
  let positionals: string[];
  try {
    ({ values, positionals } = parseArgs({
      args: process.argv.slice(2),
      options: {
        root: { type: "boolean", default: false },
        json: { type: "boolean", default: false },
        "warnings-as-errors": { type: "boolean", default: false },
      },
      allowPositionals: true,
    }));
  } catch (error) {
    process.stderr.write(`${String(error)}\n${USAGE}`);

    return EXIT_USAGE;
  }

  if (positionals.length === 0) {
    process.stderr.write(USAGE);

    return EXIT_USAGE;
  }

  const missing = positionals.filter((path) => !existsSync(path));
  if (missing.length > 0) {
    for (const path of missing) process.stderr.write(`パスが存在しない: ${path}\n`);

    return EXIT_USAGE;
  }

  const problems = positionals.flatMap((path) => (values.root === true ? checkSkillsRoot(path) : checkSkill(path)));

  if (values.json === true) {
    process.stdout.write(`${renderJson(problems)}\n`);
  } else if (problems.length > 0) {
    process.stdout.write(`${renderText(problems)}\n`);
  }

  const errors = problems.filter((problem) => problem.level === "must");
  const warnings = problems.filter((problem) => problem.level === "should");
  process.stderr.write(`error ${errors.length}件 / warning ${warnings.length}件\n`);

  if (errors.length > 0) return EXIT_PROBLEMS;
  if (warnings.length > 0 && values["warnings-as-errors"] === true) return EXIT_PROBLEMS;

  return EXIT_OK;
};

process.exit(main());
