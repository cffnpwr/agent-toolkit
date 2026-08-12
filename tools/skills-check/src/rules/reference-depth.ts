import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

import type { Finding, Rule } from "../types.ts";

const LINK_PATTERN = /\[[^\]]*\]\(([^)\s]+)\)/g;

const isExternal = (target: string): boolean => (/^[a-z][a-z0-9+.-]*:/i).test(target) || target.startsWith("#");

export const referencedDocumentPaths = (filePath: string, skillDir: string): string[] => {
  const content = readFileSync(filePath, "utf8");
  const out = new Set<string>();

  for (const match of content.matchAll(LINK_PATTERN)) {
    const raw = match[1];
    if (raw === undefined || isExternal(raw)) continue;

    const target = raw.split("#")[0]?.split("?")[0];
    if (target === undefined || target === "" || !target.endsWith(".md")) continue;

    const resolved = resolve(dirname(filePath), target);
    if (relative(skillDir, resolved).startsWith("..")) continue;
    if (!existsSync(resolved)) continue;

    out.add(resolved);
  }

  return [...out];
};

const violation = (detail: string): Finding => ({
  code: "reference-too-deep",
  source: "spec",
  level: "should",
  message: `参照が2階層になっています: ${detail}。SKILL.mdから直接参照することが推奨されます。`,
});

/**
 * 仕様は「Keep file references one level deep from SKILL.md.
 * Avoid deeply nested reference chains.」と推奨しているだけなので`should`とする。
 */
export const referenceDepthRule: Rule = (skill) => {
  const findings: Finding[] = [];
  const firstLevel = referencedDocumentPaths(skill.skillMdPath, skill.dir);
  const seen = new Set<string>([skill.skillMdPath, ...firstLevel]);

  for (const doc of firstLevel) {
    for (const nested of referencedDocumentPaths(doc, skill.dir)) {
      if (seen.has(nested)) continue;
      seen.add(nested);
      findings.push(
        violation(`${relative(skill.dir, doc)} → ${relative(skill.dir, nested)}`),
      );
    }
  }

  return findings;
};
