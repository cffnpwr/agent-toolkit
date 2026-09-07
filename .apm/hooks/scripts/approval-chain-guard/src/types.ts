// hookが扱うJSONオブジェクトの最小型。
export type Json = Record<string, unknown>;

// 検知したコマンド連結の1件。
// label: 検知理由の表示用ラベル(例: "&&"・"&&/||"・"; or newline")。
export interface ChainViolation {
  label: string;
  snippet: string;
}

// 1つのコマンド文字列の解析結果。
export interface ChainAnalysis {
  violations: ChainViolation[];
  // 1呼び出しずつに分けたコマンド列。連結がトップレベルの1箇所だけで、各セグメントが単純コマンドかpipelineのときだけ埋まる。
  split: string[] | undefined;
}
