import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const env = process.env;

// 設定の取得元と保存先。環境変数で上書きできる。
const CONFIG_REPO = env.JJ_COMMITLINT_CONFIG_REPO ?? "cffnpwr/actions";
const CONFIG_PATH = env.JJ_COMMITLINT_CONFIG_PATH ?? ".github/commitlint/default.config.ts";
const CONFIG_REF = env.JJ_COMMITLINT_CONFIG_REF ?? "main";
const CACHE_DIR = env.JJ_COMMITLINT_CACHE_DIR
  ?? join(env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "jj-commitlint");
const CACHE_TTL = Number(env.JJ_COMMITLINT_CACHE_TTL ?? "3600");

// 取得元を切り替えても stale を掴まないよう、キャッシュ名に repo/ref/path を反映する。
const CACHE_KEY = `${CONFIG_REPO}/${CONFIG_REF}/${CONFIG_PATH}`.replace(/[^a-zA-Z0-9._-]/g, "_");
const CONFIG_CACHE_FILE = join(CACHE_DIR, CACHE_KEY);

// キャッシュの経過秒を返す。
// 未取得ならnull、statSyncの失敗は呼び出し元へ伝播する。
const cacheAgeSeconds = (): number | null => {
  if (!existsSync(CONFIG_CACHE_FILE)) return null;
  return (Date.now() - statSync(CONFIG_CACHE_FILE).mtimeMs) / 1000;
};

// raw.githubusercontent.comから設定を取得してキャッシュへ書く。
// 無認証取得のため、取得元リポジトリは公開されている必要がある。
const fetchConfig = async (): Promise<void> => {
  const url = `https://raw.githubusercontent.com/${CONFIG_REPO}/${CONFIG_REF}/${CONFIG_PATH}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} -> HTTP ${res.status}`);
  const body = await res.text();
  if (!body.trim()) throw new Error(`fetch ${url} -> empty body`);
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(CONFIG_CACHE_FILE, body);
};

// 設定取得の結果。
export type ConfigResult = | { ok: true; path: string; }
  | { ok: false; reason: string; };

/**
 * 設定ファイルのパスを返す。
 * TTL内はキャッシュを使い、超過時のみ取得する。
 * 取得失敗時は期限切れキャッシュへフォールバックし、それも無ければ失敗を返す。
 */
export const loadCommitlintConfig = async (): Promise<ConfigResult> => {
  const age = cacheAgeSeconds();
  if (age !== null && Number.isFinite(CACHE_TTL) && CACHE_TTL > 0 && age < CACHE_TTL) {
    return { ok: true, path: CONFIG_CACHE_FILE };
  }
  try {
    await fetchConfig();
    return { ok: true, path: CONFIG_CACHE_FILE };
  } catch (err) {
    if (existsSync(CONFIG_CACHE_FILE)) return { ok: true, path: CONFIG_CACHE_FILE };
    return { ok: false, reason: String(err) };
  }
};
