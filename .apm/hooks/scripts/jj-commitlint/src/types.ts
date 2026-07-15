// hookが扱うJSONオブジェクトの最小型。
export type Json = Record<string, unknown>;

// lint対象の解析結果。
// jj describe/commitごとに対象revと有効CWDを持つ。
// cwdはこの呼び出しが実行される有効CWD(cd畳み込みで解決)。null=不明。
export interface Target {
  subcommand: "describe" | "commit";
  revs: string[];
  cwd: string | null;
}

// commitlint実行の結果。
export interface LintResult {
  ok: boolean;
  report: string;
  // lintを実行できなかった(インフラ失敗)。
  unavailable: boolean;
}
