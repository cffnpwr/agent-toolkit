# グローバルモードの配置・symlink・ツール検出

グローバルAGENTS.mdは**ツール中立な実体ファイルを1つだけ持ち**、各ツールのネイティブ設定をそこへの symlink で一本化する。実体ファイルの配置先決定、ツール検出、symlink提案ポリシーを定める。

## 前提: グローバルは標準外のツール拡張

AGENTS.md標準（agents.md）はスコープを**プロジェクト相対の祖先ディレクトリ階層のみ**（リポジトリルート＋ネスト、closest-wins）と定義し、ホーム/XDG配下のグローバルAGENTS.mdは対象外としている。グローバル（ユーザーレベル・全プロジェクト共通）の指示は、各ツールが独自に実装する拡張（Claude `~/.claude/CLAUDE.md`、Codex `~/.codex/AGENTS.md`、Cursor User Rules 等）であり、AGENTS.md標準が定めた概念ではない。

本スキルのツール中立な実体ファイル `~/.config/agents/AGENTS.md` も標準準拠ではなく、複数ツール設定を symlink で一本化するための独自の運用上の選択である。ユーザーに標準準拠と誤認させないこと。

## ツール検出

実行環境で使われているエージェントツールを検出する。検出結果は「どのツール設定を symlink するか」と「既存設定の取り込み元」を決めるために使う（実体ファイルの置き場所そのものは下記の配置先決定で決まる）。

- ディレクトリ存在で検出: `~/.claude/`（Claude）、`~/.codex/`（Codex）等。
- 実行中のエージェントの自己認識: 自身がどのツール（Claude/Codex 等）かを認識していればそれを主に扱う。**自己認識の根拠が無い／曖昧な場合は推測せず、どのツールで実行しているかをユーザーに確認する**（symlink提案の対象決定に必要。要件・前提情報の確認に該当）。
- 各ツールのネイティブ設定ファイルの対応:
  - Claude → `~/.claude/CLAUDE.md`
  - Codex → `~/.codex/AGENTS.md`
- 検出した設定ファイルが symlink の場合、`readlink -f` 等でリンク先（実体）を解決する。

## 実体ファイルの配置先決定

ツール中立な実体ファイルの置き場所を、dotfiles管理の有無で分岐して決める。

1. **dotfiles管理を検出**: 検出したツール設定（`~/.claude/CLAUDE.md` 等）が既に symlink なら、`readlink -f` でリンク先を辿って dotfiles リポジトリを特定する。実体ファイルは**その dotfiles リポジトリ内**に置く（ツール設定と同じ管理下に揃える）。
   - 既存のリンク先がそのままグローバル設定の中身（例: dotfiles 内の `CLAUDE.md`）である場合は、**それをそのまま実体ファイルとして使う**（中立名 `AGENTS.md` へリネームし、ネイティブ設定の symlink を新しいファイル名へ張り替える）。別の実体ファイルを新規作成して二重管理にしない。
   - **symlink が symlink を指す二重 symlink を作らない**。ネイティブ設定の symlink は必ず実体ファイルを直接指すようにする。
2. **dotfiles管理が無い**: 既定の配置先 `~/.config/agents/AGENTS.md`（XDG準拠）に実体ファイルを置く。
3. **配置先が曖昧**: dotfiles の構造から一意に決められない場合は、配置先をユーザーに確認する。推測で決めない。

## docs（段階的開示）の配置

切り出す `docs/` は**実体ファイルと同じディレクトリ直下**に置く（例: 実体ファイルが `~/.config/agents/AGENTS.md` なら `~/.config/agents/docs/`、dotfiles 内なら実体ファイルと同階層の `docs/`）。本体からの誘導はデフォルトでプレーン参照（[progressive-disclosure.md](progressive-disclosure.md) 参照）。

## symlink提案ポリシー（保守的）

リポジトリモードと同じ保守ルールを適用する。

- **実行中のエージェントが自身として認識するツールの設定のみ** symlink 化を提案する。
  - 例: Claude が実行している場合 → `~/.claude/CLAUDE.md` → 実体ファイルへの symlink を提案。
- **他ツールの設定**（Codex 等）の symlink 化は、ユーザーが明示的に依頼した場合のみ行う。能動的に提案しない。
- 作成するかは常にユーザーの判断。

## 作成手順

実体ファイルを作成・更新した後、提案が承諾されたら symlink を張る。`ln -s` は対象が既存だと失敗し、`ln -sf` は無確認で実体ファイルを破壊するため、既存ファイルがある場合は退避してから張る。

```sh
# 例: Claude のネイティブ設定を実体ファイルへ symlink 化
TARGET="$HOME/.claude/CLAUDE.md"
REAL_ABS="$HOME/.config/agents/AGENTS.md"      # 実体ファイルの絶対パス（実際の配置先に合わせる）
REL="<実体ファイル(AGENTS.md)への相対パス>"     # TARGET のあるディレクトリからの相対パス（symlink本体に書く値）

if [ -L "$TARGET" ]; then
    # 既に symlink。指す先が実体ファイルでなければ、その中身が統合済みか確認してから張り替え
    cur=$(readlink -f "$TARGET" || true)
    if [ "$cur" != "$REAL_ABS" ]; then
        diff -u "$cur" "$REAL_ABS" || echo "existing link target has unmerged content; merge before continuing"
    fi
    ln -sfn "$REL" "$TARGET"             # 実体ファイルを指すよう張り替え（二重symlink防止）
elif [ -e "$TARGET" ]; then
    # 中身を持つ実体ファイルが別に存在。統合済みか diff で確認 → 退避 → 張る
    diff -u "$TARGET" "$REAL_ABS" || echo "unmerged differences remain; merge before continuing"
    mv "$TARGET" "$TARGET.bak"           # 退避（無確認破壊を避ける）
    ln -s "$REL" "$TARGET"
else
    ln -s "$REL" "$TARGET"
fi
```

- **相対パスの symlink** にする（symlink本体には `REL` を書く。dotfiles リポジトリを移動・clone してもリンクが保たれる）。`diff` など内容比較には絶対パス `REAL_ABS` を使い、同じ実体ファイルを2つの表現で取り違えないようにする。
- 既存のネイティブ設定が中身を持つ実体ファイルの場合、その内容が統合済みであることを diff で確認し、退避（`.bak`）してから張り替える。**既存が別の対象を指す symlink の場合も、そのリンク先の中身が統合済みかを確認してから張り替える**（無確認で切り捨てない）。統合が未確認なら止めてユーザーに確認する。ドリフト防止のため中身のコピーは残さない。

## 実体ファイルへの到達経路の確保（必須）

実体ファイル `~/.config/agents/AGENTS.md`（dotfiles 管理時はその中）は、**どのツールも標準では自動で読まない**。少なくとも1つのツールのネイティブ設定が実体ファイルを指す symlink になって初めて、グローバル指示が実効を持つ。

- 新規作成の完了条件として、**実体ファイルへ到達する symlink が最低1つ存在する**ことを満たす（保守ポリシーにより、通常は実行エージェントのツール設定）。
- symlink提案をユーザーが断った、または実行エージェントが自己認識を持たず提案対象が無い場合、実体ファイルは**どのツールからも読まれない死蔵ファイル**になる。この状態を完了とせず、「現状ではどのツールも実体ファイルを読まない。どのツールに symlink を張るか」をユーザーに明示する。

## 改善ユースケースでの確認

既存グローバル設定の監査時:

- ネイティブ設定（`~/.claude/CLAUDE.md` 等）が、symlink でなく中身を持つ実体ファイルとして同じ内容を二重に保持している → symlink 化を提案（二重管理の解消、保守ポリシーに従い実行エージェントのツールのみ）。
- ネイティブ設定が壊れた symlink・誤った対象を指している → 修正を提案。
- 実体ファイルが未作成でネイティブ設定だけが存在する → 実体ファイルを作り、ネイティブ設定を symlink 化する構成へ移行を提案（保守ポリシーに従う）。
