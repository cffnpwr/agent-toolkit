import { describe, expect, test } from "bun:test";

import { runCommitlint } from "./lint.ts";

describe("runCommitlint", () => {
  test("[positive] breaking change記法(!)を含むheaderは違反にしない", async () => {
    const result = await runCommitlint("feat!: :sparkles: add breaking feature");
    expect(result).toEqual({ ok: true, report: "", unavailable: false });
  });

  test("[negative] 許可されていないtypeは違反として報告する", async () => {
    const result = await runCommitlint("unknown: :sparkles: do something");
    expect(result.ok).toBe(false);
    expect(result.unavailable).toBe(false);
  });
});
