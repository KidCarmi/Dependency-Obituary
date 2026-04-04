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

// ─── Cargo.toml Parser ─────────────────────────────────────────────────────

export function parseCargoToml(content: string): Package[] {
  const packages: Package[] = [];
  let inDeps = false;

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();

    // Detect section headers
    if (/^\[(.+)\]$/.test(line)) {
      const section = line.slice(1, -1).trim();
      inDeps =
        section === "dependencies" ||
        section === "dev-dependencies" ||
        section === "build-dependencies";
      continue;
    }

    if (!inDeps || !line || line.startsWith("#")) continue;

    // Simple: name = "version"
    const simple = line.match(/^([A-Za-z0-9_-]+)\s*=\s*"([^"]+)"/);
    if (simple) {
      packages.push({
        name: simple[1],
        version: simple[2].replace(/^[\^~>=<*]*/, "") || "0.0.0",
      });
      continue;
    }

    // Inline table: name = { version = "1.0", ... }
    const table = line.match(
      /^([A-Za-z0-9_-]+)\s*=\s*\{[^}]*version\s*=\s*"([^"]+)"/
    );
    if (table) {
      packages.push({
        name: table[1],
        version: table[2].replace(/^[\^~>=<*]*/, "") || "0.0.0",
      });
    }
  }

  return packages;
}

// ─── go.mod Parser ─────────────────────────────────────────────────────────

export function parseGoMod(content: string): Package[] {
  const packages: Package[] = [];
  let inRequire = false;

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();

    // Single-line require: require github.com/foo/bar v1.2.3
    const single = line.match(
      /^require\s+(\S+)\s+(v[\d.]+(?:-[A-Za-z0-9.+-]*)?)/
    );
    if (single) {
      packages.push({ name: single[1], version: single[2].replace(/^v/, "") });
      continue;
    }

    // Block require start/end
    if (line === "require (") {
      inRequire = true;
      continue;
    }
    if (line === ")" && inRequire) {
      inRequire = false;
      continue;
    }

    if (!inRequire || !line || line.startsWith("//")) continue;

    // Inside require block: github.com/foo/bar v1.2.3
    const dep = line.match(/^(\S+)\s+(v[\d.]+(?:-[A-Za-z0-9.+-]*)?)/);
    if (dep) {
      packages.push({ name: dep[1], version: dep[2].replace(/^v/, "") });
    }
  }

  return packages;
}

// ─── Gemfile Parser ────────────────────────────────────────────────────────

export function parseGemfile(content: string): Package[] {
  const packages: Package[] = [];

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    // gem 'name', '~> 1.0'  or  gem "name", ">= 1.0"
    const match = line.match(
      /^gem\s+['"]([A-Za-z0-9_-]+)['"]\s*(?:,\s*['"][~>=<!\s]*([\d.]+)['"])?/
    );
    if (match) {
      packages.push({
        name: match[1],
        version: match[2] ?? "0.0.0",
      });
    }
  }

  return packages;
}

// ─── composer.json Parser (PHP) ────────────────────────────────────────────

export function parseComposerJson(content: string): Package[] {
  try {
    const json: unknown = JSON.parse(content);
    if (typeof json !== "object" || json === null) return [];

    const pkg = json as Record<string, unknown>;
    const packages: Package[] = [];

    for (const field of ["require", "require-dev"] as const) {
      const deps = pkg[field];
      if (typeof deps !== "object" || deps === null) continue;

      for (const [name, version] of Object.entries(deps as Record<string, unknown>)) {
        if (typeof version === "string" && name !== "php" && !name.startsWith("ext-")) {
          packages.push({ name, version: version.replace(/^[\^~>=<*]*/, "") || "0.0.0" });
        }
      }
    }

    return packages;
  } catch {
    return [];
  }
}

// ─── build.gradle Parser (Java/Kotlin) ─────────────────────────────────────

export function parseBuildGradle(content: string): Package[] {
  const packages: Package[] = [];

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("//")) continue;

    // implementation 'group:artifact:version'
    const match = line.match(
      /(?:implementation|api|compileOnly|runtimeOnly|testImplementation|testRuntimeOnly)\s+['"]([^:]+):([^:]+):([^'"]+)['"]/
    );
    if (match) {
      packages.push({
        name: `${match[1]}:${match[2]}`,
        version: match[3],
      });
    }
  }

  return packages;
}

// ─── pubspec.yaml Parser (Dart/Flutter) ─────────────────────────────────────

export function parsePubspecYaml(content: string): Package[] {
  const packages: Package[] = [];
  let inDeps = false;

  for (const rawLine of content.split("\n")) {
    const line = rawLine;
    const trimmed = line.trimStart();

    // Detect top-level sections (no indentation)
    if (!line.startsWith(" ") && !line.startsWith("\t") && trimmed.endsWith(":")) {
      const section = trimmed.slice(0, -1);
      inDeps = section === "dependencies" || section === "dev_dependencies";
      continue;
    }

    if (!inDeps) continue;

    // Skip flutter SDK deps, empty lines, comments
    if (!trimmed || trimmed.startsWith("#") || trimmed.includes("sdk:")) continue;

    // "  package_name: ^1.0.0" or "  package_name: any"
    const match = trimmed.match(/^([a-z_][a-z0-9_]*):\s*[\^~>=<]*([\d.]+)/);
    if (match) {
      packages.push({ name: match[1], version: match[2] });
    }
  }

  return packages;
}

// ─── vcpkg.json Parser (C++) ────────────────────────────────────────────────

export function parseVcpkgJson(content: string): Package[] {
  try {
    const json: unknown = JSON.parse(content);
    if (typeof json !== "object" || json === null) return [];

    const pkg = json as Record<string, unknown>;
    const packages: Package[] = [];

    const deps = pkg.dependencies;
    if (!Array.isArray(deps)) return [];

    for (const dep of deps) {
      if (typeof dep === "string") {
        packages.push({ name: dep, version: "0.0.0" });
      } else if (typeof dep === "object" && dep !== null) {
        const obj = dep as Record<string, unknown>;
        if (typeof obj.name === "string") {
          const version = typeof obj["version>="] === "string" ? obj["version>="] as string : "0.0.0";
          packages.push({ name: obj.name, version });
        }
      }
    }

    return packages;
  } catch {
    return [];
  }
}

// ─── package-lock.json Parser (npm - with direct/transitive detection) ──────

export function parsePackageLockJson(content: string, packageJsonContent?: string): Package[] {
  try {
    const lock: unknown = JSON.parse(content);
    if (typeof lock !== "object" || lock === null) return [];

    const lockObj = lock as Record<string, unknown>;
    const packages: Package[] = [];

    // Determine which packages are direct deps from package.json
    const directDeps = new Set<string>();
    if (packageJsonContent) {
      try {
        const pkgJson = JSON.parse(packageJsonContent) as Record<string, unknown>;
        for (const field of ["dependencies", "devDependencies"] as const) {
          const deps = pkgJson[field];
          if (typeof deps === "object" && deps !== null) {
            for (const name of Object.keys(deps as Record<string, unknown>)) {
              directDeps.add(name);
            }
          }
        }
      } catch { /* ignore parse errors */ }
    }

    // package-lock.json v2/v3 uses "packages" with path keys
    const pkgs = lockObj.packages;
    if (typeof pkgs === "object" && pkgs !== null) {
      for (const [path, info] of Object.entries(pkgs as Record<string, unknown>)) {
        if (!path || path === "") continue; // skip root entry
        if (typeof info !== "object" || info === null) continue;

        const infoObj = info as Record<string, unknown>;
        const version = typeof infoObj.version === "string" ? infoObj.version : "0.0.0";

        // Extract package name from path: "node_modules/@scope/pkg" → "@scope/pkg"
        const name = path.replace(/^node_modules\//, "").replace(/.*node_modules\//, "");
        if (!name || name.includes("node_modules")) continue;

        const isDirect = directDeps.size > 0 ? directDeps.has(name) : undefined;

        // For transitive deps, find which direct dep pulls them in
        let dependedBy: string | undefined;
        if (isDirect === false && directDeps.size > 0) {
          // Check if any direct dep has this as a nested dependency
          // Simple heuristic: check the path structure
          const parts = path.split("node_modules/");
          if (parts.length >= 3) {
            dependedBy = parts[1].replace(/\/$/, "");
          }
        }

        packages.push({ name, version, isDirect, dependedBy });
      }
    }

    // package-lock.json v1 uses "dependencies" with nested structure
    if (packages.length === 0 && lockObj.dependencies) {
      const deps = lockObj.dependencies as Record<string, unknown>;
      for (const [name, info] of Object.entries(deps)) {
        if (typeof info !== "object" || info === null) continue;
        const infoObj = info as Record<string, unknown>;
        const version = typeof infoObj.version === "string" ? infoObj.version : "0.0.0";
        const isDirect = directDeps.size > 0 ? directDeps.has(name) : undefined;
        packages.push({ name, version, isDirect });
      }
    }

    return packages;
  } catch {
    return [];
  }
}

// ─── Auto-Detect Parser ────────────────────────────────────────────────────

export function parseFile(
  filename: string,
  content: string,
  auxiliaryContent?: string
): { ecosystem: Ecosystem; packages: Package[] } {
  const lower = filename.toLowerCase();

  if (lower === "package.json" || lower.endsWith("/package.json")) {
    return { ecosystem: "npm", packages: parsePackageJson(content) };
  }

  if (lower === "package-lock.json" || lower.endsWith("/package-lock.json")) {
    return { ecosystem: "npm", packages: parsePackageLockJson(content, auxiliaryContent) };
  }

  if (
    lower === "requirements.txt" ||
    lower.endsWith("/requirements.txt")
  ) {
    return { ecosystem: "pypi", packages: parseRequirementsTxt(content) };
  }

  if (lower === "cargo.toml" || lower.endsWith("/cargo.toml")) {
    return { ecosystem: "cargo", packages: parseCargoToml(content) };
  }

  if (lower === "go.mod" || lower.endsWith("/go.mod")) {
    return { ecosystem: "go", packages: parseGoMod(content) };
  }

  if (lower === "gemfile" || lower.endsWith("/gemfile")) {
    return { ecosystem: "rubygems", packages: parseGemfile(content) };
  }

  if (lower === "composer.json" || lower.endsWith("/composer.json")) {
    return { ecosystem: "packagist", packages: parseComposerJson(content) };
  }

  if (
    lower === "build.gradle" ||
    lower === "build.gradle.kts" ||
    lower.endsWith("/build.gradle") ||
    lower.endsWith("/build.gradle.kts")
  ) {
    return { ecosystem: "maven", packages: parseBuildGradle(content) };
  }

  if (lower === "pubspec.yaml" || lower.endsWith("/pubspec.yaml")) {
    return { ecosystem: "pub", packages: parsePubspecYaml(content) };
  }

  if (lower === "vcpkg.json" || lower.endsWith("/vcpkg.json")) {
    return { ecosystem: "vcpkg", packages: parseVcpkgJson(content) };
  }

  // Default: try each format by content
  const jsonResult = parsePackageJson(content);
  if (jsonResult.length > 0) {
    return { ecosystem: "npm", packages: jsonResult };
  }

  const cargoResult = parseCargoToml(content);
  if (cargoResult.length > 0) {
    return { ecosystem: "cargo", packages: cargoResult };
  }

  const goResult = parseGoMod(content);
  if (goResult.length > 0) {
    return { ecosystem: "go", packages: goResult };
  }

  const gemResult = parseGemfile(content);
  if (gemResult.length > 0) {
    return { ecosystem: "rubygems", packages: gemResult };
  }

  const txtResult = parseRequirementsTxt(content);
  if (txtResult.length > 0) {
    return { ecosystem: "pypi", packages: txtResult };
  }

  return { ecosystem: "npm", packages: [] };
}
