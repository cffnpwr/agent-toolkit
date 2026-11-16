import { describe, expect, it } from "bun:test";

import type { Word } from "unbash";

import { parse } from "unbash";

import type { ConfigClassification } from "./classify.ts";

import { classifyConfigArgs, isSingleField } from "./classify.ts";

// `echo <args>`をパースし、echoに続く語を返す
const wordsOf = (args: string): Word[] => {
  const node = parse(`echo ${args}`).commands[0]?.command;
  if (node?.type !== "Command") {
    throw new Error(`not a simple command: ${args}`);
  }

  return node.suffix;
};

const wordOf = (arg: string): Word => {
  const word = wordsOf(arg)[0];
  if (word === undefined) {
    throw new Error(`no word: ${arg}`);
  }

  return word;
};

describe("isSingleField", () => {
  it.each([
    "abc",
    "'a b'",
    "\"$X\"",
    "\"a$(cmd)b\"",
    "$'\\n'",
    "\"$*\"",
    "~user",
  ])("[positive] 「%s」のとき1語とみなす", (arg) => {
    expect(isSingleField(wordOf(arg))).toBe(true);
  });

  it.each([
    "$X",
    "\"$@\"",
    "\"${a[@]}\"",
    "$(cmd)",
    "*\"$X\"",
    "{a,b}",
  ])("[negative] 「%s」のとき1語とみなさない", (arg) => {
    expect(isSingleField(wordOf(arg))).toBe(false);
  });
});

describe("classifyConfigArgs", () => {
  it.each([
    "set user.name x",
    "unset user.name",
    "rename-section a b",
    "remove-section a",
    "edit",
    "user.name x",
    "user.name x '^y$'",
    "--global user.name \"$NAME\"",
    "-f f a.b 1",
    "--file=f a.b 1",
    "--type bool a.b true",
    "--no-file a.b 1",
    "--comment hi a.b 7",
    "a.b --add 8",
    "a.b 8 --get",
    "-- a.b 9",
    "--end-of-options a.b 9",
    "--add a.b 4",
    "--ad a.b 4",
    "--replace-all a.b 5",
    "--replace a.b 5",
    "--unset a.b",
    "--unset-all a.b",
    "--unset-a a.b",
    "--rename-section s t",
    "--remove-section s",
    "--rem s",
    "-e",
    "--edit",
    "-ze",
    "--add --add a.b 3",
  ])("[positive] 「git config %s」のとき書き込むと判定する", (args) => {
    expect(classifyConfigArgs(wordsOf(args))).toBe("writes");
  });

  it.each([
    "",
    "list",
    "get user.name",
    "user.name",
    "--get user.name",
    "--get-all user.name",
    "--get-regexp user",
    "--get-urlmatch http http://x",
    "--get-color color.ui",
    "--get-colorbool color.ui",
    "-l",
    "--list",
    "--list --name-only",
    "--bool a.b",
    "--type bool a.b",
    "--default x a.b",
    "-fe",
    "a.b 1 2 3",
    "--get --unset a.b",
  ])("[negative] 「git config %s」のとき書き込まないと判定する", (args) => {
    expect(classifyConfigArgs(wordsOf(args))).toBe("no-write");
  });

  it.each<{ args: string; want: ConfigClassification; }>([
    { args: "$SUB a.b 1", want: "unknown" },
    { args: "\"$OPT\" a.b 1", want: "unknown" },
    { args: "--unse a.b", want: "unknown" },
    { args: "--re a.b 1", want: "unknown" },
    { args: "--nonsense a.b 1", want: "unknown" },
    { args: "a.b $VALUE", want: "unknown" },
    { args: "a.b \"$@\"", want: "unknown" },
  ])("[negative] 「git config $args」のとき判定できないとする", ({ args, want }) => {
    expect(classifyConfigArgs(wordsOf(args))).toBe(want);
  });
});
