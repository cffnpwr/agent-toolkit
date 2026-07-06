// hookが扱うJSONオブジェクトの最小型。
export type Json = Record<string, unknown>;

// 検知したコマンド連結の1件。
// label: 検知理由の表示用ラベル(例: "&&"・"&&/||"・"; or newline")。
export interface ChainViolation {
  label: string;
  snippet: string;
}
