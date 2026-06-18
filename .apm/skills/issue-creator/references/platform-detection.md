# Platform Detection and CLI Reference

How to detect GitHub vs GitLab from the repository, and how to use each platform's CLI to create issues.

## Detecting Platform

```bash
git remote get-url origin
```

Match the URL against these patterns:

| URL pattern | Platform |
|---|---|
| `github.com` | GitHub |
| `gitlab.com` | GitLab.com |
| `gitlab.<company>.<tld>` | Self-hosted GitLab |
| `git@github.com:...` | GitHub (SSH) |
| `git@gitlab.<host>:...` | GitLab (SSH) |

If the remote does not match, ask the user which platform.

If the repository has multiple remotes (e.g., `origin` and `upstream`), prefer `origin`. If the user explicitly mentions another remote, use that.

## Extracting OWNER/REPO

For GitHub:
```bash
gh repo view --json nameWithOwner --jq .nameWithOwner
```

For GitLab:
```bash
glab repo view --output json | jq -r .path_with_namespace
```

If the CLI is not authenticated, fall back to parsing `git remote get-url origin` manually:
- `https://github.com/owner/repo.git` → `owner/repo`
- `git@github.com:owner/repo.git` → `owner/repo`
- `https://gitlab.example.com/group/subgroup/repo.git` → `group/subgroup/repo` (GitLab supports nested groups)

## Checking for Project Templates

### GitHub

```bash
ls .github/ISSUE_TEMPLATE/ 2>/dev/null
ls .github/issue_template.md 2>/dev/null
```

GitHub supports two template formats:
- **Markdown** (`.md`): Plain Markdown body shown when user clicks "New issue" with that template
- **Issue forms** (`.yml`): Structured form with typed fields

When a `.yml` issue form exists for the chosen type:
- Read it to understand the expected fields
- Render the body as Markdown matching those fields (since `gh issue create --body-file` writes Markdown, not form data)
- Section headers in Markdown should mirror the form's field labels

### GitLab

```bash
ls .gitlab/issue_templates/ 2>/dev/null
```

GitLab only supports Markdown templates. Filename without `.md` becomes the template name.

## Creating Issues

### GitHub

Always write the body to a file first to avoid shell-escaping issues:

```bash
cat > /tmp/issue-body.md <<'EOF'
## Description
...
EOF

gh issue create \
  --repo OWNER/REPO \
  --title "TITLE" \
  --body-file /tmp/issue-body.md
```

Optional flags (only add if the user explicitly requested):
- `--label LABEL` (repeat for multiple)
- `--assignee USERNAME` (or `@me`)
- `--milestone NUMBER`
- `--project PROJECT`

To set issue type (Bug/Feature/Task — org-level metadata, not labels), `gh issue create` does NOT support `--type`. Use `gh api` instead:

```bash
gh api repos/OWNER/REPO/issues \
  -X POST \
  -f title="TITLE" \
  -f body="$(cat /tmp/issue-body.md)" \
  -f type="Bug" \
  --jq '{number, html_url}'
```

### GitLab

```bash
cat > /tmp/issue-body.md <<'EOF'
## Description
...
EOF

glab issue create \
  --repo OWNER/REPO \
  --title "TITLE" \
  --description-file /tmp/issue-body.md
```

Optional flags:
- `--label LABEL` (comma-separated for multiple: `--label "bug,priority/high"`)
- `--assignee USERNAME`
- `--milestone TITLE`
- `--confidential` (for security issues — only if user requested)

GitLab does not have an "issue type" concept distinct from labels. Use labels for categorization.

## Searching Existing Issues

Always check for duplicates before creating.

### GitHub

```bash
gh issue list --repo OWNER/REPO --search "KEYWORDS" --state all --limit 10
```

For full-text search across closed issues use `--state all`.

### GitLab

```bash
glab issue list --repo OWNER/REPO --search "KEYWORDS" --all --per-page 10
```

If duplicates are found, present them to the user and ask whether to:
1. Add a comment to the existing issue
2. Create a new issue anyway (and link to the existing one)
3. Cancel

## Authentication Failures

If `gh` or `glab` returns an authentication error:

- `gh auth login`
- `glab auth login`

Do not try to use a token from environment variables silently — the user should be aware.
