// hookが扱うJSONオブジェクトの最小型。
export type Json = Record<string, unknown>;

// lint対象の解析結果。jj describe/commitの呼び出しごとに1件。
export interface Target {
  // -m/--message値を静的に解決し、jjの適用挙動どおり"\n\n"で連結したメッセージ。
  // null=メッセージを静的に特定できない(-m無し・--stdin・変数展開等)。lint対象外。
  message: string | null;
  // この呼び出しが実行される有効CWD(cd畳み込みで解決)。commitlint設定の解決に使う。null=不明。
  cwd: string | null;
}

// commitlint実行の結果。
export interface LintResult {
  ok: boolean;
  report: string;
  // lintを実行できなかった(インフラ失敗)。
  unavailable: boolean;
}
