// bun.lockのworkspaceルート定義からpackage.jsonを生成する。
// apmはフック配置時にpackage.jsonを深さを問わず除外するため、配置先ではpackage.jsonが残らない。
// 配置先で新鮮に残る唯一の依存ソースはbun.lockなので、bun installの前にここからmanifestを起こし、lockと必ず整合させる。
// 各フックの起動スクリプトから ../shared/gen-package-json.ts として共有し、対象フックのディレクトリを第1引数で受け取る。

interface WorkspaceRoot {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface Lockfile {
  workspaces?: Record<string, WorkspaceRoot>;
}

const dir = process.argv[2] ?? process.cwd();
const lockPath = `${dir}/bun.lock`;
const pkgPath = `${dir}/package.json`;

// bun.lockはJSONC(末尾カンマを許容)。JSON.parseの前に末尾カンマだけを除去する。
const source = await Bun.file(lockPath).text();
const lock = JSON.parse(source.replace(/,(\s*[}\]])/g, "$1")) as Lockfile;

const root = lock.workspaces?.[""];
if (root === undefined) {
  throw new Error("bun.lock has no workspace root entry");
}

const manifest = {
  name: root.name ?? "",
  private: true,
  type: "module",
  dependencies: root.dependencies ?? {},
  devDependencies: root.devDependencies ?? {},
};

await Bun.write(pkgPath, `${JSON.stringify(manifest, null, 2)}\n`);
