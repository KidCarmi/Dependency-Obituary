/**
 * parser.ts — Client-Side File Parser
 *
 * RULES (enforced by CLAUDE.md):
 *  - Client-side only. No network requests. No Node.js APIs.
 *  - Must handle: valid JSON, devDependencies, monorepo, malformed input
 *  - Never throw — return empty array on failure
 */

import type { Ecosystem, Package } from "@/types";

// ─── package.json Parser ────────────────────────────────────────────────────

export function parsePackageJson(content: string): Package[] {
  try {
    const json: unknown = JSON.parse(content);
    if (typeof json !== "object" || json === null) return [];

    const pkg = json as Record<string, unknown>;
    const packages: Package[] = [];

    const depFields = ["dependencies", "devDependencies"] as const;

    for (const field of depFields) {
      const deps = pkg[field];
      if (typeof deps !== "object" || deps === null) continue;

      for (const [name, version] of Object.entries(
        deps as Record<string, unknown>
      )) {
        if (typeof version === "string") {
          packages.push({ name, version: version.replace(/^[\^~>=<*]*/,  "") || "0.0.0" });
        }
      }
    }

    return packages;
  } catch {
    return [];
  }
}

// ─── requirements.txt Parser ────────────────────────────────────────────────

export function parseRequirementsTxt(content: string): Package[] {
  const packages: Package[] = [];

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();

    // Skip empty lines, comments, flags (-r, -e, --index-url, etc.)
    if (!line || line.startsWith("#") || line.startsWith("-")) continue;

    // Parse version specifiers: package==1.0, package>=1.0, package~=1.0
    const match = line.match(
      /^([A-Za-z0-9_][A-Za-z0-9._-]*)(?:\[.*?\])?\s*(?:[=~!<>]+\s*(.+?))?(?:\s*;.*)?(?:\s*#.*)?$/
    );

    if (match) {
      const name = match[1];
      const version = match[2]?.split(",")[0]?.trim() ?? "0.0.0";
      packages.push({ name, version });
    }
  }

  return packages;
}

// ─── Auto-Detect Parser ────────────────────────────────────────────────────

export function parseFile(
  filename: string,
  content: string
): { ecosystem: Ecosystem; packages: Package[] } {
  const lower = filename.toLowerCase();

  if (lower === "package.json" || lower.endsWith("/package.json")) {
    return { ecosystem: "npm", packages: parsePackageJson(content) };
  }

  if (
    lower === "requirements.txt" ||
    lower.endsWith("/requirements.txt") ||
    lower.endsWith(".txt")
  ) {
    return { ecosystem: "pypi", packages: parseRequirementsTxt(content) };
  }

  // Default: try JSON first, then requirements.txt format
  const jsonResult = parsePackageJson(content);
  if (jsonResult.length > 0) {
    return { ecosystem: "npm", packages: jsonResult };
  }

  const txtResult = parseRequirementsTxt(content);
  if (txtResult.length > 0) {
    return { ecosystem: "pypi", packages: txtResult };
  }

  return { ecosystem: "npm", packages: [] };
}
