import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MAIN = join(import.meta.dir, "main.ts");
const TIMEOUT = 30000;

interface HookResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

// 任意のstdin入力でhook本体を実行し、終了コードと出力を返す。
const runRaw = (input: string): HookResult => {
  const res = Bun.spawnSync({
    cmd: ["bun", MAIN],
    stdin: Buffer.from(input),
    stdout: "pipe",
    stderr: "pipe",
  });
  return { exitCode: res.exitCode, stdout: res.stdout.toString(), stderr: res.stderr.toString() };
};

// 合成PreToolUse入力でhook本体を実行する。
const runHook = (command: string, cwd: string): HookResult => runRaw(JSON.stringify({
  hook_event_name: "PreToolUse",
  tool_name: "Bash",
  tool_input: { command },
  cwd,
}));

const PASS: HookResult = { exitCode: 0, stdout: "", stderr: "" };

describe("main", () => {
  // customのみ許可するcommitlint設定を持つcwd。lint結果を決定的にする。
  let repoDir: string;

  beforeAll(() => {
    repoDir = mkdtempSync(join(tmpdir(), "jj-commitlint-main-"));
    writeFileSync(
      join(repoDir, ".commitlintrc.json"),
      JSON.stringify({ rules: { "type-enum": [2, "always", ["custom"]] } }),
    );
  });

  afterAll(() => {
    rmSync(repoDir, { recursive: true, force: true });
  });

  it("[positive] 正当なメッセージのとき、exit 0で通す", () => {
    expect(runHook("jj describe -m \"custom: do something\"", repoDir)).toEqual(PASS);
  }, TIMEOUT);

  it("[positive] describeの後段で@が動くチェーンでも、-m値で判定して通す", () => {
    expect(runHook("jj describe -m \"custom: ok\" && jj new", repoDir)).toEqual(PASS);
  }, TIMEOUT);

  it.each<[string]>([
    ["jj describe"],
    ["echo \"unknown: x\" | jj describe --stdin"],
    ["jj describe -m \"$msg\""],
    ["cd - && jj describe -m \"unknown: x\""],
    ["ls -la"],
  ])("[positive] lint対象を特定できないコマンド(%s)のとき、exit 0で通す", (command) => {
    expect(runHook(command, repoDir)).toEqual(PASS);
  }, TIMEOUT);

  it("[negative] 違反メッセージのとき、exit 2 + stderrでブロックする", () => {
    const res = runHook("jj commit -m \"unknown: do something\"", repoDir);
    expect(res.exitCode).toBe(2);
    expect(res.stdout).toBe("");
    expect(res.stderr).toContain("violates commitlint");
  }, TIMEOUT);

  it.each<[string]>([
    ["jj new -m \"unknown: do something\""],
    ["jj split -m \"unknown: do something\""],
    ["jj squash -m \"unknown: do something\""],
    ["jj metaedit -m \"unknown: do something\""],
  ])("[negative] describe/commit以外で説明を設定するコマンド(%s)でも、違反をブロックする", (command) => {
    const res = runHook(command, repoDir);
    expect(res.exitCode).toBe(2);
    expect(res.stdout).toBe("");
    expect(res.stderr).toContain("violates commitlint");
  }, TIMEOUT);

  it("[negative] 複数-mのとき、連結したメッセージをlintする", () => {
    const res = runHook("jj describe -m \"unknown: a\" -m \"body b\"", repoDir);
    expect(res.exitCode).toBe(2);
    expect(res.stderr).toContain("unknown: a\n\nbody b");
  }, TIMEOUT);

  it("[negative] 空メッセージのとき、exit 2でブロックする", () => {
    const res = runHook("jj describe -m \"\"", repoDir);
    expect(res.exitCode).toBe(2);
    expect(res.stdout).toBe("");
    expect(res.stderr).toContain("empty");
  }, TIMEOUT);

  it("[negative] 同一の違反呼び出しが重複するとき、1件に集約して報告する", () => {
    const res = runHook("jj describe -m \"unknown: x\" || jj describe -m \"unknown: x\"", repoDir);
    expect(res.exitCode).toBe(2);
    expect(res.stderr.match(/violates commitlint/g)).toHaveLength(1);
  }, TIMEOUT);

  it("[positive] 入力がJSONオブジェクトでないとき、exit 0で通す", () => {
    expect(runRaw("42")).toEqual(PASS);
  }, TIMEOUT);

  it.each<[string, object]>([
    ["tool_inputが無い", { hook_event_name: "PreToolUse" }],
    ["commandが無い", { hook_event_name: "PreToolUse", tool_input: {} }],
    ["commandが空文字列", { hook_event_name: "PreToolUse", tool_input: { command: "" } }],
  ])("[positive] %s とき、exit 0で通す", (_label, input) => {
    expect(runRaw(JSON.stringify(input))).toEqual(PASS);
  }, TIMEOUT);

  it("[negative] 入力が不正JSONのとき、exit 1の非ブロック警告になる", () => {
    const res = runRaw("not json");
    expect(res.exitCode).toBe(1);
    expect(res.stdout).toBe("");
    expect(res.stderr).not.toBe("");
  }, TIMEOUT);
});
