// hookが扱うJSONオブジェクトの最小型。
export type Json = Record<string, unknown>;

// simple commandから抽出したgit呼び出し。
// subcommandはグローバルフラグを読み飛ばした最初の非フラグ語、argsはその後続語。
// cwdはこの呼び出しが実行される有効CWD(cd畳み込みで解決)。null=不明。
export interface GitCall {
  subcommand: string;
  args: string[];
  cwd: string | null;
}
