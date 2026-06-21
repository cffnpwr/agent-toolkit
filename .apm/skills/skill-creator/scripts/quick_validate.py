#!/usr/bin/env python3
"""
スキルの簡易検証スクリプト。

検証内容:
- SKILL.md が存在し、整形式のYAMLフロントマターを持つ
- 必須フィールド: name, description（常時）。compatibility（依存シグナルがある場合）
- フィールド制約: 命名・長さ・形式
- 依存宣言の整合: 依存シグナルがある場合、compatibility フィールドと
  ## Requirements セクションの両方が存在しなければならない
- ロックファイルの同梱: 依存定義ファイルがあれば対応するロックファイルが要る

依存検出は確実に観測可能なファイル存在に基づく（言語横断で堅牢でないimport解析は
行わない）。次のいずれかが存在する場合にスキルは依存を持つとみなす。
- 依存定義ファイル（pyproject.toml / package.json / Gemfile / composer.json）
- ロックファイル（uv.lock / pnpm-lock.yaml / Gemfile.lock / composer.lock）
- scripts/ 配下の任意のスクリプト言語ファイル

Requires: Python 3.11+, PyYAML
"""

import sys
import re
from pathlib import Path

# Pythonバージョンの確認
if sys.version_info < (3, 11):
    print("Error: Python 3.11+ required")
    print(f"Current version: {sys.version_info.major}.{sys.version_info.minor}")
    sys.exit(1)

try:
    import yaml
except ImportError:
    print("Error: PyYAML is required (declared in pyproject.toml). Run 'uv sync --frozen'.")
    sys.exit(1)


# 依存定義ファイル -> 必要なロックファイル
DEFINITION_LOCKFILES = {
    "pyproject.toml": "uv.lock",
    "package.json": "pnpm-lock.yaml",
    "Gemfile": "Gemfile.lock",
    "composer.json": "composer.lock",
}

LOCKFILES = set(DEFINITION_LOCKFILES.values())

SCRIPT_EXTENSIONS = {
    ".py": "Python",
    ".js": "Node.js",
    ".ts": "TypeScript",
    ".sh": "Bash",
    ".rb": "Ruby",
    ".pl": "Perl",
    ".php": "PHP",
    ".ps1": "PowerShell",
    ".r": "R",
    ".lua": "Lua",
}


def find_script_languages(skill_dir):
    """scripts/ 配下のスクリプトファイルを {言語: [ファイル名]} で返す。"""
    scripts_dir = skill_dir / "scripts"
    found = {}
    if scripts_dir.exists() and scripts_dir.is_dir():
        for path in sorted(scripts_dir.rglob("*")):
            if path.is_file() and path.suffix.lower() in SCRIPT_EXTENSIONS:
                lang = SCRIPT_EXTENSIONS[path.suffix.lower()]
                found.setdefault(lang, []).append(path.name)
    return found


def find_definition_files(skill_dir):
    """スキルに存在する依存定義ファイル名のリストを返す。"""
    return [name for name in DEFINITION_LOCKFILES if (skill_dir / name).exists()]


def find_lockfiles(skill_dir):
    """スキルに存在するロックファイル名のリストを返す。"""
    return [name for name in LOCKFILES if (skill_dir / name).exists()]


def validate_dependencies(skill_dir, frontmatter, content):
    """
    観測可能なファイル存在シグナルに基づき依存宣言を検証する。

    (errors, warnings) を返す。
    """
    errors = []
    warnings = []

    script_langs = find_script_languages(skill_dir)
    definition_files = find_definition_files(skill_dir)
    lockfiles = find_lockfiles(skill_dir)

    has_dependency_signal = bool(script_langs or definition_files or lockfiles)

    compat = frontmatter.get("compatibility")
    compat_str = str(compat).strip() if compat else ""
    has_requirements_section = bool(
        re.search(r"^##\s+Requirements\s*$", content, re.MULTILINE)
    )

    # compatibility の TODO プレースホルダ
    if compat_str and "TODO" in compat_str:
        errors.append(
            "'compatibility' フィールドに TODO プレースホルダが残っている。"
            "検証前に依存宣言を完成させること。"
        )

    # compatibility の長さ（最大500文字）
    if len(compat_str) > 500:
        errors.append(
            f"'compatibility' が長すぎる（{len(compat_str)} 文字）。最大500文字。"
        )

    if has_dependency_signal:
        if not compat_str:
            signals = []
            if script_langs:
                signals.append(f"scripts ({', '.join(script_langs)})")
            if definition_files:
                signals.append(f"definition files ({', '.join(definition_files)})")
            if lockfiles:
                signals.append(f"lockfiles ({', '.join(lockfiles)})")
            errors.append(
                "依存シグナル "
                f"[{'; '.join(signals)}] があるが 'compatibility' フロントマター"
                "フィールドが無い。依存を宣言すること"
                "（references/compatibility-guide.md を参照）。"
            )

        if not has_requirements_section:
            errors.append(
                "依存シグナルがあるが SKILL.md に '## Requirements' セクションが無い。"
                "そこで依存を宣言すること（定義ファイル + ロックファイル + 確認コマンド、"
                "または外部ツール + 存在確認）。"
            )

    # ロックファイルの同梱: 依存定義ファイルには対応するロックファイルが要る
    for definition in definition_files:
        lockfile = DEFINITION_LOCKFILES[definition]
        if not (skill_dir / lockfile).exists():
            errors.append(
                f"'{definition}' があるが対応するロックファイル '{lockfile}' が無い。"
                "依存解決の再現性のためロックファイルを同梱すること。"
            )

    # 非ブロックの注意: compatibility は存在する言語に言及すべき
    if compat_str:
        compat_lower = compat_str.lower()
        language_hints = {
            "Python": ["python"],
            "Node.js": ["node", "javascript"],
            "TypeScript": ["typescript", "node"],
            "Bash": ["bash", "shell"],
            "Ruby": ["ruby"],
            "Perl": ["perl"],
            "PHP": ["php"],
            "PowerShell": ["powershell"],
            "R": [" r ", "rscript"],
            "Lua": ["lua"],
        }
        for lang, files in script_langs.items():
            hints = language_hints.get(lang, [lang.lower()])
            if not any(h in compat_lower for h in hints):
                shown = ", ".join(files[:3]) + (" ..." if len(files) > 3 else "")
                warnings.append(
                    f"scripts/ に {lang} ファイルが {len(files)} 件ある "
                    f"({shown}) が 'compatibility' が {lang} に言及していない。"
                )

    return errors, warnings


def validate_skill(skill_path):
    """
    スキルの SKILL.md を検証する。

    Returns:
        (success: bool, errors: list, warnings: list)
    """
    skill_path = Path(skill_path)
    errors = []
    warnings = []

    # SKILL.md の存在確認
    skill_md = skill_path / "SKILL.md"
    if not skill_md.exists():
        return False, ["SKILL.md not found"], []

    # 内容を読む
    try:
        content = skill_md.read_text()
    except Exception as e:
        return False, [f"Could not read SKILL.md: {e}"], []

    # フロントマター形式の確認
    if not content.startswith("---"):
        return False, ["No YAML frontmatter found (must start with ---)"], []

    # フロントマターを抽出
    match = re.match(r"^---\n(.*?)\n---", content, re.DOTALL)
    if not match:
        return (
            False,
            ["Invalid frontmatter format (must be enclosed in --- markers)"],
            [],
        )

    frontmatter_text = match.group(1)

    # YAML をパース
    try:
        frontmatter = yaml.safe_load(frontmatter_text)
        if not isinstance(frontmatter, dict):
            return False, ["Frontmatter must be a YAML dictionary"], []
    except yaml.YAMLError as e:
        return False, [f"Invalid YAML in frontmatter: {e}"], []

    # 許可するプロパティ
    ALLOWED_PROPERTIES = {
        "name",
        "description",
        "compatibility",
        "license",
        "allowed-tools",
        "metadata",
    }

    # 仕様外のプロパティ（仕様は metadata での拡張を認めるため、警告にとどめる）
    unexpected_keys = set(frontmatter.keys()) - ALLOWED_PROPERTIES
    if unexpected_keys:
        warnings.append(
            f"Unexpected key(s) in frontmatter: {', '.join(sorted(unexpected_keys))}. "
            f"Defined properties are: {', '.join(sorted(ALLOWED_PROPERTIES))}. "
            "Put non-spec properties under 'metadata' (possible typo?)."
        )

    # 必須フィールドの確認: name, description
    if "name" not in frontmatter:
        errors.append("Missing required 'name' field in frontmatter")

    if "description" not in frontmatter:
        errors.append("Missing required 'description' field in frontmatter")

    # name の検証
    if "name" in frontmatter:
        name = frontmatter["name"]
        if not isinstance(name, str):
            errors.append(f"'name' must be a string, got {type(name).__name__}")
        else:
            name = name.strip()
            if not name:
                errors.append("'name' field cannot be empty")
            else:
                # 命名規約（ケバブケース）
                if not re.match(r"^[a-z0-9-]+$", name):
                    errors.append(
                        f"'name' should be kebab-case "
                        "(lowercase letters, digits, and hyphens only). "
                        f"Got: '{name}'"
                    )
                if name.startswith("-") or name.endswith("-") or "--" in name:
                    errors.append(
                        f"'name' cannot start/end with hyphen or contain "
                        f"consecutive hyphens. Got: '{name}'"
                    )
                # 長さ
                if len(name) > 64:
                    errors.append(
                        f"'name' is too long ({len(name)} characters). "
                        "Maximum is 64 characters."
                    )
                # 親ディレクトリ名と一致（仕様要件）
                expected = skill_path.resolve().name
                if name != expected:
                    errors.append(
                        "'name' must match the parent directory name. "
                        f"name='{name}', directory='{expected}'"
                    )

    # description の検証
    if "description" in frontmatter:
        description = frontmatter["description"]
        if not isinstance(description, str):
            errors.append(
                f"'description' must be a string, got {type(description).__name__}"
            )
        else:
            description = description.strip()
            if not description:
                errors.append("'description' field cannot be empty")
            else:
                # TODO プレースホルダの確認
                if "TODO" in description:
                    errors.append(
                        "'description' field contains a TODO placeholder. "
                        "Complete the description before validation."
                    )
                # 長さ
                if len(description) > 1024:
                    errors.append(
                        f"'description' is too long ({len(description)} characters). "
                        "Maximum is 1024 characters."
                    )
                # 短すぎる場合の注意
                if len(description) < 50:
                    warnings.append(
                        f"'description' is quite short ({len(description)} characters). "
                        "Consider adding more detail about when to use this skill."
                    )

    # 依存宣言の検証
    dep_errors, dep_warnings = validate_dependencies(
        skill_path, frontmatter, content
    )
    errors.extend(dep_errors)
    warnings.extend(dep_warnings)

    # 成否の判定
    success = len(errors) == 0

    return success, errors, warnings


def main():
    if len(sys.argv) != 2:
        print("Usage: uv run python quick_validate.py <skill_directory>")
        print("\nSKILL.md の構造と依存宣言を検証する。")
        print("Requires: Python 3.11+, PyYAML")
        sys.exit(1)

    skill_dir = sys.argv[1]

    print(f"🔍 Validating skill at: {skill_dir}")
    print()

    success, errors, warnings = validate_skill(skill_dir)

    # エラーを出力
    if errors:
        print("❌ Validation Errors:")
        for i, error in enumerate(errors, 1):
            print(f"   {i}. {error}")
        print()

    # 注意を出力
    if warnings:
        print("⚠️  Warnings:")
        for i, warning in enumerate(warnings, 1):
            print(f"   {i}. {warning}")
        print()

    # 結果を出力
    if success:
        if warnings:
            print("✅ Validation passed with warnings")
            print("   Address warnings to improve skill quality.")
        else:
            print("✅ Skill is valid!")
        sys.exit(0)
    else:
        print("❌ Validation failed")
        print("   Fix the errors above before publishing.")
        sys.exit(1)


if __name__ == "__main__":
    main()
