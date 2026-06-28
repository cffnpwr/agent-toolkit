// hookが扱うJSONオブジェクトの最小型。
export type Json = Record<string, unknown>;

// lint対象の解析結果。
// jj describe/commitごとに対象revを持つ。
export interface Target {
  subcommand: "describe" | "commit";
  revs: string[];
}

// commitlint実行の結果。
export interface LintResult {
  ok: boolean;
  report: string;
  // lintを実行できなかった(インフラ失敗)。
  unavailable: boolean;
}
