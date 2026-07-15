import { afterEach, describe, expect, it } from "bun:test";

import type { Collect, Cwd } from "./types.ts";

import { foldCwd, resolveBaseCwd } from "./cdfold.ts";
import { parseCommands } from "./test-support.ts";

const collectFoldCwd = (src: string, baseCwd: Cwd): Array<[string | undefined, Cwd]> => {
  const out: Array<[string | undefined, Cwd]> = [];
  const collect: Collect = (cmd, cwd) => out.push([cmd.name?.value, cwd]);
  foldCwd(parseCommands(src), baseCwd, collect);
  return out;
};

describe("foldCwd", () => {
  const savedProjectDir = process.env.CLAUDE_PROJECT_DIR;
  const savedTestVar = process.env.CDFOLD_TEST_DIR;

  afterEach(() => {
    if (savedProjectDir === undefined) delete process.env.CLAUDE_PROJECT_DIR;
    else process.env.CLAUDE_PROJECT_DIR = savedProjectDir;
    if (savedTestVar === undefined) delete process.env.CDFOLD_TEST_DIR;
    else process.env.CDFOLD_TEST_DIR = savedTestVar;
  });

  it("[positive] baseCwd基準でcd後の有効CWDを引き回す", () => {
    expect(collectFoldCwd("cd /a; git status", "/base")).toEqual([
      ["cd", "/base"],
      ["git", "/a"],
    ]);
  });

  it("[positive] process.envの変数をcdの移動先展開に使う", () => {
    process.env.CDFOLD_TEST_DIR = "/env/x";
    expect(collectFoldCwd("cd $CDFOLD_TEST_DIR; git status", "/base")).toEqual([
      ["cd", "/base"],
      ["git", "/env/x"],
    ]);
  });
});

describe("resolveBaseCwd", () => {
  const savedProjectDir = process.env.CLAUDE_PROJECT_DIR;

  afterEach(() => {
    if (savedProjectDir === undefined) delete process.env.CLAUDE_PROJECT_DIR;
    else process.env.CLAUDE_PROJECT_DIR = savedProjectDir;
  });

  it("[positive] input.cwdが非空stringのときそれを返す", () => {
    process.env.CLAUDE_PROJECT_DIR = "/proj";
    expect(resolveBaseCwd("/input")).toBe("/input");
  });

  it("[positive] input.cwdが空/非stringのときCLAUDE_PROJECT_DIRを返す", () => {
    process.env.CLAUDE_PROJECT_DIR = "/proj";
    expect(resolveBaseCwd("")).toBe("/proj");
    expect(resolveBaseCwd(undefined)).toBe("/proj");
  });

  it("[positive] 双方が無いときprocess.cwd()を返す", () => {
    delete process.env.CLAUDE_PROJECT_DIR;
    expect(resolveBaseCwd(undefined)).toBe(process.cwd());
  });
});
