import type { Skill } from "../types.ts";

/**
 * フロントマターの`name`を NFKC 正規化して返す。
 * ルールが受け取るスキルはスキーマ検査を通っているため、`name`は空でない文字列である。
 */
export const normalizedName = (skill: Skill): string => String(skill.frontmatter.name).normalize("NFKC");
