import { describe, expect, it } from "bun:test";
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

// 合成PermissionRequest入力を組み立てる。
const permissionRequest = (command: string): string => JSON.stringify({
  hook_event_name: "PermissionRequest",
  tool_name: "Bash",
  tool_input: { command },
});

// stdoutをJSONとして解釈した形にする(拒否出力を期待値全体と突き合わせるため)。
const withParsedStdout = (res: HookResult): { exitCode: number; stdout: unknown; stderr: string; } => ({
  exitCode: res.exitCode,
  stdout: JSON.parse(res.stdout) as unknown,
  stderr: res.stderr,
});

const PASS: HookResult = { exitCode: 0, stdout: "", stderr: "" };

// 拒否の期待出力。messageは人間向けの文言のため、文字列であることだけを見る。
const DENY = {
  exitCode: 0,
  stdout: {
    hookSpecificOutput: {
      hookEventName: "PermissionRequest",
      decision: { behavior: "deny", message: expect.any(String) },
    },
  },
  stderr: "",
};

describe("main", () => {
  it.each<[string, string]>([
    ["連結を分けられる", "cd /tmp && git fetch && git push origin main"],
    ["複合構文の内部に連結がある", "for f in *; do a && b; done"],
  ])("[positive] %s呼び出しのとき、拒否decisionをexit 0で返す", (_label, command) => {
    // Given
    const input = permissionRequest(command);

    // When
    const res = runRaw(input);

    // Then
    expect(withParsedStdout(res)).toEqual(DENY);
  }, TIMEOUT);

  it.each<[string]>([
    ["git push origin main"],
    ["cd /tmp && npm run build"],
    ["git log | head -20"],
  ])("[negative] 連結の無い呼び出し(%s)のとき、無出力でexit 0にする", (command) => {
    // Given
    const input = permissionRequest(command);

    // When
    const res = runRaw(input);

    // Then
    expect(res).toEqual(PASS);
  }, TIMEOUT);

  it.each<[string, string]>([
    ["オブジェクトでない", "42"],
    ["tool_inputの無い", JSON.stringify({ hook_event_name: "PermissionRequest" })],
    ["commandの無い", JSON.stringify({ hook_event_name: "PermissionRequest", tool_input: {} })],
    ["commandが空文字列の", JSON.stringify({ hook_event_name: "PermissionRequest", tool_input: { command: "" } })],
  ])("[negative] JSONとしては正しいが%s入力のとき、コマンドを抽出できない入力として無出力でexit 0にする", (_label, input) => {
    // Given: inputがそのままstdinになる

    // When
    const res = runRaw(input);

    // Then
    expect(res).toEqual(PASS);
  }, TIMEOUT);

  it("[negative] JSONとして解析できない入力のとき、exit 1の非ブロック警告になる", () => {
    // Given
    const input = "not json";

    // When
    const res = runRaw(input);

    // Then
    expect(res).toEqual({ exitCode: 1, stdout: "", stderr: expect.stringMatching(/\S/) });
  }, TIMEOUT);
});
