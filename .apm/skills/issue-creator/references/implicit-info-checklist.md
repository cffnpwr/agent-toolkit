# Implicit Information Checklist

Definition: **implicit information** is anything that is not derivable from the codebase (source files, configuration, dependency manifests, build scripts, version control history). Implicit information must be obtained from the user, never invented.

This checklist helps decide for each piece of information whether it can be read from code or must be asked.

## Decision Rule

For every field in an issue template:

```
Can this be obtained by reading source files, config, deps, or git log?
  YES → Read the code, do not ask the user
  NO  → Ask the user, do not guess
```

## Fields That Code CAN Tell You

These should be filled by reading the repository, not asked:

| Field | How to derive |
|---|---|
| File paths involved | Grep / read the files mentioned by the user |
| Function or class names | Read the file the user pointed to |
| Dependency versions | `package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`, `flake.nix`, `flake.lock` |
| Language / runtime version | Same files as above, or `.tool-versions`, `.nvmrc`, `mise.toml` |
| Build commands | `package.json` scripts, `Makefile`, `justfile`, `flake.nix` apps |
| CI configuration | `.github/workflows/*`, `.gitlab-ci.yml` |
| Where an error message text comes from | Grep the literal string |
| Existing related issues | `gh issue list --search` / `glab issue list --search` |
| Recent changes to a file | `git log -p <file>` |
| Public API surface of a module | Read the module's exports |
| Default config values | Read the config defaults file |

If the user mentions a symbol or path you have not yet read, **read it before asking the user**. Do not ask "where is the login function?" if grep can find it.

## Fields That Code CANNOT Tell You

These MUST be asked. Never write a guess into the issue body.

### For all issue types

| Field | Why code cannot tell you |
|---|---|
| Motivation / why this matters | Business or personal context, not in code |
| Priority / urgency | Reflects external constraints |
| Severity / business impact | Depends on user base, SLA, deadlines |
| Affected users (self only / team / all users) | Not encoded |
| Workaround availability | User experience knowledge |
| Deadline | External |

### For bugs specifically (MANDATORY — do not skip)

| Field | Why mandatory |
|---|---|
| **Reproduction steps** | Code shows what the function does, not what the user did to trigger it. Step-by-step, do NOT abbreviate. |
| **Expected behavior** | The user's expectation may differ from what the spec says. Ask the user, do not infer from spec. |
| **Actual behavior** | What the user actually saw — error message, blank screen, wrong value, crash. Be specific. |
| **Frequency** | Always / sometimes / once |
| **Environment at time of bug** | OS, browser, app version, locale, network condition. Code cannot tell you what the user was running. |
| **First time observed** | New regression vs longstanding bug |
| **Recent changes by user** | Did the user upgrade, change config, switch network? |

If the user did not provide reproduction steps, **stop and ask**. Do not write the issue with reproduction steps marked as "TBD" or "省略".

### For features specifically

| Field | Why mandatory |
|---|---|
| Use case / who benefits | Not in code |
| Acceptance criteria | What "done" looks like from the user's view |
| Alternatives the user considered | Why this approach over others |

### For improvements specifically

| Field | Why mandatory |
|---|---|
| What is unsatisfactory about current behavior | "It works but..." — the "but" is the user's experience |
| Desired outcome (qualitative) | What success looks like |
| Measurable target if any | e.g., "load time under 2 seconds" |

### For tasks specifically

| Field | Why mandatory |
|---|---|
| Why now | Tasks are often not urgent, so the trigger matters |
| Definition of done | What state the codebase should be in afterward |

## Common Mistakes to Avoid

- **Inferring expected behavior from the spec.** The spec describes intent, the bug report describes the gap between intent and what the user saw. Ask the user what they expected — they may have misunderstood the spec, which is itself useful information.
- **Filling in environment from your own context.** Your `uname` is not the user's environment. Ask.
- **Writing "see code" instead of describing the actual reproduction.** A reader of the issue should not need to read the code to reproduce the bug.
- **Combining multiple symptoms into one issue.** If the user describes two distinct problems, ask which to file first, or whether to file separately.
- **Marking severity yourself.** Severity is the user's call, not yours.

## When the User Refuses to Provide Information

If the user explicitly says "I don't know" or "skip that":

- For **non-mandatory** fields → omit the section entirely (do not write "不明" — just leave it out)
- For **mandatory bug fields** (reproduction steps, expected, actual) → push back once:

  > 再現手順なしのバグ報告は対応が困難になる。覚えている範囲でよいので、最後に行った操作を順に教えてほしい。「ログインボタンを押したら画面が固まった」程度でも構わない。

  If the user still refuses, write the issue with a clearly marked `[要確認: 再現手順]` placeholder section AND surface this to the user explicitly so they know the issue is incomplete.
