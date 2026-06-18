---
name: issue-creator
description: Draft and create well-structured GitHub or GitLab issues with consistent formatting and zero implicit assumptions. Use when (1) user wants to file a bug report, feature request, improvement proposal, or task on GitHub or GitLab, (2) user pastes informal notes, error logs, or descriptions and asks to turn them into an issue, (3) user says things like "create an issue", "file a bug", "Issueを立てて", "バグ報告したい", "機能追加のIssueを書いて". Detects platform (GitHub/GitLab) from git remote, prefers project-local issue templates when present, falls back to bundled defaults. Always confirms issue type with user, asks for information that cannot be read from the codebase, and never invents reproduction steps or expected behavior.
compatibility: |
  Required: gh CLI (for GitHub), glab CLI (for GitLab), git
  No language runtime required. All logic is in the SKILL itself; no scripts.
---

# Issue Creator

Drafts and creates issues on GitHub or GitLab with consistent format and no implicit assumptions.

## Requirements

使用前に以下の依存を確認すること。ひとつでも欠けていれば進行を停止し、ユーザーへエスカレーションする。Agentは導入・修正・フォールバックを行わない。

### 外部ツール

| ツール | バージョン要件 |
| --- | --- |
| git | `>= 2.0` |
| gh | `>= 2.0`（GitHubの場合） |
| glab | `>= 1.0`（GitLabの場合） |

存在確認コマンドを次に示す。

```sh
command -v git >/dev/null 2>&1 || { echo "git not found." >&2; exit 1; }
# GitHubなら
command -v gh  >/dev/null 2>&1 || { echo "gh not found." >&2; exit 1; }
# GitLabなら
command -v glab >/dev/null 2>&1 || { echo "glab not found." >&2; exit 1; }
```

## Core Principles

1. **Never invent facts.** If a piece of information cannot be obtained by reading the codebase or by asking the user, leave it out — do not guess.
2. **Always read code first.** Before asking the user, check whether the information can be derived from the repository (file paths, function names, dependencies, configuration values, error message origins).
3. **Always ask for what code cannot tell you.** User-observed behavior, reproduction steps, environment, motivation, priority, business impact — these must come from the user.
4. **Always confirm intent with the user.** Before creating the issue, present the draft and the chosen issue type, and get explicit approval. Even if you are highly confident, do this confirmation.
5. **Reproduction steps are mandatory for bugs.** Never abbreviate, summarize, or skip steps. If the user did not provide them, ask.
6. **Strictly follow the chosen template.** The template defines the structure of the issue body. You MUST use exactly the section headings and ordering defined by the template. Do not omit sections, do not add sections, do not rename sections, do not reorder sections.
7. **Execute end-to-end after approval.** Once the user approves the draft, proceed straight to issue creation and report the resulting URL. Do not pause for additional confirmations (label selection, repo confirmation, etc.) between approval and creation.

## Workflow

### Step 1: Detect platform and repository context

Run these commands to gather context:

```bash
git remote get-url origin
git rev-parse --show-toplevel
```

Determine platform from the remote URL:
- Contains `github.com` → GitHub (use `gh` CLI)
- Contains `gitlab.` (any host) → GitLab (use `glab` CLI)
- Otherwise → ask the user which platform

For full CLI usage and platform-specific quirks, see [references/platform-detection.md](references/platform-detection.md).

### Step 2: Determine issue type

Infer the most likely type from the user's input. Map keywords to types:

| User says (examples) | Type |
|---|---|
| "壊れている", "動かない", "エラー", "broken", "crash", "doesn't work" | `bug` |
| "追加してほしい", "欲しい", "want to add", "feature", "support for" | `feature` |
| "改善したい", "もっと〜したい", "refactor", "improve", "better" | `improvement` |
| "タスク", "やる", "TODO", "chore", "update X", "remove Y" | `task` |

**Always confirm the type with the user before drafting**, regardless of confidence. Use a short prompt:

> このIssueは「バグ報告 / 機能追加 / 改善提案 / タスク」のどれに該当するか確認したい。推測では「機能追加」だが、合っているか？

If the user's input is in English, ask in English.

### Step 3: Check for project-local issue templates

Project templates take precedence over bundled defaults.

**GitHub**:
- `.github/ISSUE_TEMPLATE/*.md`
- `.github/ISSUE_TEMPLATE/*.yml` (issue forms — read the structure but you will write Markdown body)
- `.github/issue_template.md` (legacy single template)

**GitLab**:
- `.gitlab/issue_templates/*.md`

If multiple templates match the chosen type (e.g., `bug.md`, `bug_report.md`), prefer the one whose filename most closely matches the type name. If unsure which to pick, ask the user.

If no project template matches, use the bundled default in `references/templates/{type}.md`.

**MUST: Read the chosen template file in full before drafting.** Do not draft from memory of "what a bug template typically looks like". Open and read the file. Extract the exact section headings, their ordering, and any rules described in the template's "Section Rules" portion. The drafted issue body MUST mirror those headings exactly.

**MUST: For GitHub issue forms (`.yml`), parse the form to determine field labels and ordering.** Render the body as Markdown using `## <field label>` for each field, in the order defined by the form. Do not skip required fields.

### Step 4: Extract what the codebase can tell you

Before asking the user any question, read the codebase to fill in what you can.

**You SHOULD attempt to read from code:**
- File paths and function/class names mentioned by the user
- Dependency versions (from `package.json`, `Cargo.toml`, `pyproject.toml`, `flake.nix`, etc.)
- Build/runtime configuration
- Where an error message originates (grep the literal string)
- Existing similar issues (use `gh issue list --search` or `glab issue list --search`)

**You MUST NOT assume from code:**
- What the user actually saw or experienced
- What the user expected to happen
- What the user's environment was at the time
- The business or personal motivation
- Severity, priority, urgency

For the full checklist of what counts as implicit information, see [references/implicit-info-checklist.md](references/implicit-info-checklist.md).

### Step 5: Identify gaps and ask the user

Walk through the chosen template section by section. For each field:

1. Can it be filled from code? → Fill it.
2. Did the user already provide it? → Use what they provided verbatim.
3. Otherwise → Add to the question list.

**Ask all questions in a single round.** Do not pepper the user with one question at a time. Format:

> 以下の情報がIssue作成に必要だが、コードからは判断できない。回答してほしい。
>
> 1. 再現手順（具体的な操作を1ステップずつ）
> 2. 実行時のOS / ブラウザ / バージョン
> 3. 期待していた動作
> 4. 影響範囲（自分だけか / 他のユーザーにも影響するか）

For bugs, the question list MUST include reproduction steps if the user has not already given them step-by-step. Never write "再現手順は省略" or "詳細は不明" in the issue body.

### Step 6: Draft the issue

Render the chosen template with all gathered information. Follow these rules:

- **Title**: Concise, specific, under 72 characters. No prefixes like `[Bug]` if the platform supports labels or types.
- **Body — template fidelity (strict)**:
  - Use exactly the section headings defined by the template (same wording, same heading level, same order).
  - Do not omit any section that the template defines, even if you have no content for it. If a section truly has no content and the template's own "Section Rules" allows omission, you may omit it; otherwise leave it with content gathered from the user.
  - Do not invent new sections that the template does not define.
  - Do not rename sections (e.g., do not change "Reproduction Steps" to "再現手順" unless the template uses Japanese headings).
  - Before submitting the draft to the user for confirmation, perform a self-check: list the headings in your draft and compare them to the headings in the template file. If they do not match exactly (excluding sections legitimately omitted per the template's rules), regenerate the draft.
- **Code blocks**: Wrap error messages, logs, commands, and code in fenced blocks with language hints.
- **No fluff**: No phrases like "I think", "おそらく", "たぶん". State facts. If something is uncertain, mark it with `[要確認]` and surface it to the user, do not write it as if it were known.
- **Sensitive data**: Replace tokens, credentials, internal hostnames, personal paths with placeholders like `[TOKEN]`, `[INTERNAL_HOST]`, `[USER_HOME]`.
- **Language**: Match the repository's existing issue language. If unclear, match the user's input language.

### Step 7: Confirm and create

Present the draft to the user **exactly once**, including everything needed for them to decide:

> 以下の内容でIssueを作成する。問題なければ「OK」と返答してほしい。修正が必要なら指摘してほしい。
>
> - リポジトリ: OWNER/REPO
> - ラベル: [使用するラベル一覧、なしなら「なし」]
> - タイトル: TITLE
>
> ---
> (本文)

This single confirmation must contain the repository, the labels (if any), the title, and the full body. After this point, the user only sees the resulting URL or a fix request.

**After explicit approval ("OK", "yes", 「はい」, 「OK」, etc.), proceed straight through to issue creation without any further questions or confirmations.** Specifically:

1. Write the body to a temporary file (`/tmp/issue-body.md` or similar).
2. Run the create command.
3. Report the URL.

Do all three in one continuous flow. Do not ask "ラベルはこれでいいか？" or "本当に作成するか？" after approval — those should have been included in the single confirmation in step 7.

If the user requests fixes instead of approving, apply the fixes and re-present the draft (back to single-confirmation format).

**GitHub**:
```bash
gh issue create \
  --repo OWNER/REPO \
  --title "TITLE" \
  --body-file /tmp/issue-body.md \
  --label "bug"   # if applicable
```

**GitLab**:
```bash
glab issue create \
  --repo OWNER/REPO \
  --title "TITLE" \
  --description-file /tmp/issue-body.md \
  --label "bug"   # if applicable
```

Use `--body-file` / `--description-file` (not inline `--body`) to preserve formatting and avoid shell escaping issues. Write the body to a temporary file first.

Report the resulting URL to the user as the final message.

## Issue Type Selection

| Type | When to use | Template |
|---|---|---|
| `bug` | Existing functionality is broken, produces wrong output, crashes, or behaves unexpectedly | [references/templates/bug.md](references/templates/bug.md) |
| `feature` | A new capability that does not exist yet | [references/templates/feature.md](references/templates/feature.md) |
| `improvement` | Existing functionality works but should be enhanced (performance, UX, code quality) | [references/templates/improvement.md](references/templates/improvement.md) |
| `task` | Concrete unit of work that is not user-facing (refactor, dependency update, cleanup, docs) | [references/templates/task.md](references/templates/task.md) |

When the boundary is fuzzy:
- Bug vs Improvement → If current behavior is "documented or obviously intended" but suboptimal → improvement. If current behavior is "clearly wrong or unintended" → bug.
- Feature vs Improvement → If the capability does not exist at all → feature. If it exists but should be better → improvement.
- Improvement vs Task → If the change is user-visible → improvement. If it is internal-only → task.

When in doubt, present the choice to the user.

## Anti-patterns

Things this skill must NOT do:

- ❌ Write "再現手順は不明" or "TBD" or "後で追記" in a bug report
- ❌ Guess the user's environment from `uname` or git config
- ❌ Combine multiple bugs into one issue
- ❌ Skip the user confirmation step
- ❌ Create the issue before getting user approval on the draft
- ❌ Invent "Expected Behavior" by reading the spec — the user's expectation may differ from the spec
- ❌ Mark issues with severity/priority labels without asking the user
- ❌ Add `gh` / `glab` flags the user did not request (assignee, milestone, project)
- ❌ Draft the body without reading the chosen template file first
- ❌ Use section headings that differ from the template (different wording, different order, extra sections, missing sections)
- ❌ Pause after user approval to ask additional questions before running `gh`/`glab issue create`
- ❌ Split the confirmation into multiple turns ("ラベルはこれでいいか？" → wait → "本当に作成するか？" → wait → create)

## Examples

### Example 1: Bug from informal description

**User input**:
> ログイン後にダッシュボードが表示されないことがある

**Skill response**:

1. Read `git remote -v` → GitHub repo `acme/web`.
2. Confirm: "これはバグ報告でよいか？" → User: "はい"
3. Check `.github/ISSUE_TEMPLATE/` → no bug template found, use bundled `bug.md`. **Read the file in full** to get the exact section headings.
4. Grep "dashboard" in code, find `src/pages/Dashboard.tsx` and related router config.
5. Ask the user (single round):
   > 以下を回答してほしい。
   > 1. 再現手順（ログイン直後か / 特定の操作後か / どのアカウントで起きるか）
   > 2. 「表示されない」とは具体的にどう見えるか（白画面 / エラー画面 / 旧画面のまま等）
   > 3. ブラウザのコンソールにエラーは出ているか
   > 4. OS / ブラウザ / バージョン
   > 5. 毎回起きるか、たまに起きるか
6. Draft using user answers, mirroring `bug.md` headings exactly. Verify headings match the template. Show draft for confirmation, including repo, labels, title, and full body in one message.
7. After "OK" → write body to `/tmp/issue-body.md` → `gh issue create` → report URL. All in one continuous flow without re-confirming.

### Example 2: Feature request with code context

**User input**:
> 設定画面にダークモード切り替えを追加したい

**Skill response**:

1. Detect GitHub.
2. Confirm: "機能追加のIssueでよいか？" → "はい"
3. No project template → use bundled `feature.md`. Read it in full.
4. Read `src/pages/Settings.tsx` to confirm current settings structure. Read `tailwind.config.js` for theming setup.
5. Ask:
   > 以下を回答してほしい。
   > 1. ダークモードを追加する動機（個人的な好み / アクセシビリティ / ユーザー要望 など）
   > 2. システム設定に追従するべきか、手動切り替えのみか、両方か
   > 3. 優先度
6. Draft mirroring `feature.md` headings exactly. Show draft (repo + labels + title + body) for single confirmation.
7. After "OK" → create issue → report URL, without further questions.
