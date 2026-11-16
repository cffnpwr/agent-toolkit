import { describe, expect, it } from "bun:test";

import { firstCommand } from "../test-support.ts";

import { isDisabledByPrefix } from "./disable.ts";

const VARIABLE = "GUARD_DISABLE";

describe("isDisabledByPrefix", () => {
  it.each([
    "GUARD_DISABLE=1 git push",
    "GUARD_DISABLE=true git push",
    "GUARD_DISABLE=YES git push",
    "GUARD_DISABLE=on git push",
    "GUARD_DISABLE=2 git push",
    "GUARD_DISABLE='1' git push",
    "A=1 GUARD_DISABLE=1 git push",
  ])("[positive] 「%s」のとき無効化とみなす", (command) => {
    expect(isDisabledByPrefix(firstCommand(command), VARIABLE)).toBe(true);
  });

  it.each([
    "git push",
    "GUARD_DISABLE= git push",
    "GUARD_DISABLE=0 git push",
    "GUARD_DISABLE=false git push",
    "GUARD_DISABLE=FALSE git push",
    "GUARD_DISABLE=no git push",
    "GUARD_DISABLE=off git push",
    "GUARD_DISABLE=$X git push",
    "OTHER_DISABLE=1 git push",
  ])("[negative] 「%s」のとき無効化とみなさない", (command) => {
    expect(isDisabledByPrefix(firstCommand(command), VARIABLE)).toBe(false);
  });
});
