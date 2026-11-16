import { describe, expect, it } from "bun:test";

import type { OptionSpec, ScannedArg } from "./parse-options.ts";

import { resolveLongOption, scanOptions } from "./parse-options.ts";

const ALL: OptionSpec = { short: "a", long: "all", argument: "none", negatable: true };
const MESSAGE: OptionSpec = { short: "m", long: "message", argument: "required", negatable: true };
const NO_VERIFY: OptionSpec = { short: "n", long: "no-verify", argument: "none", negatable: true };
const GPG_SIGN: OptionSpec = { short: "S", long: "gpg-sign", argument: "optional", negatable: true };
const VERBOSE: OptionSpec = { long: "verbose", argument: "none", negatable: true };
const GET: OptionSpec = { long: "get", argument: "none", negatable: false };
const GET_ALL: OptionSpec = { long: "get-all", argument: "none", negatable: false };

const SPECS = [ALL, MESSAGE, NO_VERIFY, GPG_SIGN, VERBOSE, GET, GET_ALL];

interface ScanCase {
  label: string;
  args: (string | null)[];
  want: ScannedArg<OptionSpec>[];
}

const option = (spec: OptionSpec, negated = false): ScannedArg<OptionSpec> => ({
  type: "option",
  spec,
  negated,
});

describe("resolveLongOption", () => {
  it.each([
    { arg: "no-verify", want: { type: "match", spec: NO_VERIFY, negated: false, hasInlineValue: false } },
    { arg: "no-veri", want: { type: "match", spec: NO_VERIFY, negated: false, hasInlineValue: false } },
    { arg: "verify", want: { type: "match", spec: NO_VERIFY, negated: true, hasInlineValue: false } },
    { arg: "veri", want: { type: "match", spec: NO_VERIFY, negated: true, hasInlineValue: false } },
    { arg: "no-no-verify", want: { type: "match", spec: NO_VERIFY, negated: true, hasInlineValue: false } },
    { arg: "get", want: { type: "match", spec: GET, negated: false, hasInlineValue: false } },
    { arg: "message=x", want: { type: "match", spec: MESSAGE, negated: false, hasInlineValue: true } },
    { arg: "mess", want: { type: "match", spec: MESSAGE, negated: false, hasInlineValue: false } },
    { arg: "no-mess=x", want: { type: "match", spec: MESSAGE, negated: true, hasInlineValue: true } },
  ])("[positive] 「--$arg」のとき一意なオプションへ解決する", ({ arg, want }) => {
    const result = resolveLongOption(arg, SPECS);

    expect(result).toEqual(want);
  });

  it.each([
    { arg: "no-ver", want: { type: "ambiguous" } },
    { arg: "ver", want: { type: "ambiguous" } },
    { arg: "n", want: { type: "ambiguous" } },
    { arg: "no-get", want: { type: "unknown" } },
    { arg: "xyz", want: { type: "unknown" } },
    { arg: "no-verifyx", want: { type: "unknown" } },
  ])("[negative] 「--$arg」のとき曖昧または未知として扱う", ({ arg, want }) => {
    const result = resolveLongOption(arg, SPECS);

    expect(result).toEqual(want);
  });
});

describe("scanOptions", () => {
  it.each<ScanCase>([
    { label: "-anm msg", args: ["-anm", "msg"], want: [option(ALL), option(NO_VERIFY), option(MESSAGE)] },
    { label: "-mn", args: ["-mn"], want: [option(MESSAGE)] },
    { label: "-m --no-verify", args: ["-m", "--no-verify"], want: [option(MESSAGE)] },
    { label: "-Snm a", args: ["-Snm", "a"], want: [option(GPG_SIGN), { type: "positional", index: 1 }] },
    { label: "--gpg-sign x", args: ["--gpg-sign", "x"], want: [option(GPG_SIGN), { type: "positional", index: 1 }] },
    { label: "--message x -n", args: ["--message", "x", "-n"], want: [option(MESSAGE), option(NO_VERIFY)] },
    { label: "--message=x -n", args: ["--message=x", "-n"], want: [option(MESSAGE), option(NO_VERIFY)] },
    { label: "--no-message -n", args: ["--no-message", "-n"], want: [option(MESSAGE, true), option(NO_VERIFY)] },
    { label: "file -n", args: ["file", "-n"], want: [{ type: "positional", index: 0 }, option(NO_VERIFY)] },
    { label: "- -n", args: ["-", "-n"], want: [{ type: "positional", index: 0 }, option(NO_VERIFY)] },
    { label: "-- -n", args: ["--", "-n"], want: [{ type: "positional", index: 1 }] },
    { label: "--end-of-options -n", args: ["--end-of-options", "-n"], want: [{ type: "positional", index: 1 }] },
    { label: "<未解決> -n", args: [null, "-n"], want: [{ type: "unresolved", index: 0 }, option(NO_VERIFY)] },
    { label: "-m <未解決> -n", args: ["-m", null, "-n"], want: [option(MESSAGE), option(NO_VERIFY)] },
    { label: "-xn", args: ["-xn"], want: [{ type: "unknown-option" }, option(NO_VERIFY)] },
    { label: "--no-ver -n", args: ["--no-ver", "-n"], want: [{ type: "unknown-option" }, option(NO_VERIFY)] },
  ])("[positive] permuteで「$label」のとき各語を解釈する", ({ args, want }) => {
    const result = scanOptions(args, SPECS, "permute");

    expect(result).toEqual(want);
  });

  it.each<ScanCase>([
    {
      label: "a.b --get",
      args: ["a.b", "--get"],
      want: [{ type: "positional", index: 0 }, { type: "positional", index: 1 }],
    },
    {
      label: "--get a.b <未解決>",
      args: ["--get", "a.b", null],
      want: [option(GET), { type: "positional", index: 1 }, { type: "positional", index: 2 }],
    },
  ])("[positive] stop-at-non-optionで「$label」のとき最初の位置引数以降を位置引数とする", ({ args, want }) => {
    const result = scanOptions(args, SPECS, "stop-at-non-option");

    expect(result).toEqual(want);
  });
});
