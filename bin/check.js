#!/usr/bin/env node

/**
 * dependency-obituary check — CLI health checker
 *
 * Usage:
 *   npx dependency-obituary check [file] [--threshold 60] [--api-url URL]
 *
 * Reads a dependency file, sends it to the Dependency Obituary API,
 * prints a health report, and exits with code 1 if any package
 * scores below the threshold.
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

// ─── Argument Parsing ──────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getFlag(name, defaultValue) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) return defaultValue;
  return args[idx + 1];
}

const threshold = parseInt(getFlag("threshold", "60"), 10);
const apiUrl =
  getFlag("api-url", process.env.DEPENDENCY_OBITUARY_URL) ||
  "https://dependency-obituary.orelsec.com";

// Find the file argument (first arg that doesn't start with --)
const fileArg = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1]?.startsWith("--") === false);

// ─── File Detection ────────────────────────────────────────────────────────

const KNOWN_FILES = [
  "package.json",
  "requirements.txt",
  "Cargo.toml",
  "go.mod",
  "Gemfile",
];

function findDepFile(explicit) {
  if (explicit && fs.existsSync(explicit)) {
    return explicit;
  }

  for (const f of KNOWN_FILES) {
    if (fs.existsSync(f)) return f;
  }

  return null;
}

// ─── Minimal Parser (mirrors lib/parser.ts logic) ──────────────────────────

function detectEcosystem(filename) {
  const lower = filename.toLowerCase();
  if (lower.includes("package.json")) return "npm";
  if (lower.includes("requirements")) return "pypi";
  if (lower.includes("cargo.toml")) return "cargo";
  if (lower.includes("go.mod")) return "go";
  if (lower.includes("gemfile")) return "rubygems";
  return "npm";
}

function parsePackageJson(content) {
  try {
    const json = JSON.parse(content);
    const pkgs = [];
    for (const field of ["dependencies", "devDependencies"]) {
      const deps = json[field];
      if (!deps || typeof deps !== "object") continue;
      for (const [name, ver] of Object.entries(deps)) {
        if (typeof ver === "string") {
          pkgs.push({ name, version: ver.replace(/^[\^~>=<*]*/, "") || "0.0.0" });
        }
      }
    }
    return pkgs;
  } catch {
    return [];
  }
}

function parseRequirementsTxt(content) {
  const pkgs = [];
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("-")) continue;
    const m = line.match(/^([A-Za-z0-9_][A-Za-z0-9._-]*)(?:\[.*?\])?\s*(?:[=~!<>]+\s*(.+?))?(?:\s*;.*)?(?:\s*#.*)?$/);
    if (m) pkgs.push({ name: m[1], version: m[2]?.split(",")[0]?.trim() ?? "0.0.0" });
  }
  return pkgs;
}

function parseCargoToml(content) {
  const pkgs = [];
  let inDeps = false;
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (/^\[(.+)\]$/.test(line)) {
      const s = line.slice(1, -1).trim();
      inDeps = s === "dependencies" || s === "dev-dependencies" || s === "build-dependencies";
      continue;
    }
    if (!inDeps || !line || line.startsWith("#")) continue;
    const simple = line.match(/^([A-Za-z0-9_-]+)\s*=\s*"([^"]+)"/);
    if (simple) { pkgs.push({ name: simple[1], version: simple[2].replace(/^[\^~>=<*]*/, "") || "0.0.0" }); continue; }
    const table = line.match(/^([A-Za-z0-9_-]+)\s*=\s*\{[^}]*version\s*=\s*"([^"]+)"/);
    if (table) pkgs.push({ name: table[1], version: table[2].replace(/^[\^~>=<*]*/, "") || "0.0.0" });
  }
  return pkgs;
}

function parseGoMod(content) {
  const pkgs = [];
  let inReq = false;
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    const single = line.match(/^require\s+(\S+)\s+(v[\d.]+(?:-[A-Za-z0-9.+-]*)?)/);
    if (single) { pkgs.push({ name: single[1], version: single[2].replace(/^v/, "") }); continue; }
    if (line === "require (") { inReq = true; continue; }
    if (line === ")" && inReq) { inReq = false; continue; }
    if (!inReq || !line || line.startsWith("//")) continue;
    const dep = line.match(/^(\S+)\s+(v[\d.]+(?:-[A-Za-z0-9.+-]*)?)/);
    if (dep) pkgs.push({ name: dep[1], version: dep[2].replace(/^v/, "") });
  }
  return pkgs;
}

function parseGemfile(content) {
  const pkgs = [];
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^gem\s+['"]([A-Za-z0-9_-]+)['"]\s*(?:,\s*['"][~>=<!\s]*([\d.]+)['"])?/);
    if (m) pkgs.push({ name: m[1], version: m[2] ?? "0.0.0" });
  }
  return pkgs;
}

function parseFile(filename, content) {
  const eco = detectEcosystem(filename);
  const parsers = { npm: parsePackageJson, pypi: parseRequirementsTxt, cargo: parseCargoToml, go: parseGoMod, rubygems: parseGemfile };
  return { ecosystem: eco, packages: (parsers[eco] || parsePackageJson)(content) };
}

// ─── API Call ──────────────────────────────────────────────────────────────

function callApi(ecosystem, packages) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ ecosystem, packages });
    const url = new URL(`${apiUrl}/api/analyze`);
    const transport = url.protocol === "https:" ? https : http;

    const req = transport.request(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
        timeout: 60000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error(`Invalid API response: ${data.slice(0, 200)}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("API timeout")); });
    req.write(body);
    req.end();
  });
}

// ─── Output Formatting ────────────────────────────────────────────────────

const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  gray: "\x1b[90m",
  bold: "\x1b[1m",
  orange: "\x1b[38;5;208m",
};

const RISK_DISPLAY = { healthy: "healthy", stable: "stable", at_risk: "at_risk", critical: "critical", abandoned: "unmaintained", unknown: "unknown" };

function riskColor(risk) {
  const map = { healthy: COLORS.green, stable: COLORS.blue, at_risk: COLORS.yellow, critical: COLORS.orange, abandoned: COLORS.red, unknown: COLORS.gray };
  return map[risk] || COLORS.gray;
}

function scoreColor(score) {
  if (score === null) return COLORS.gray;
  if (score >= 80) return COLORS.green;
  if (score >= 60) return COLORS.blue;
  if (score >= 40) return COLORS.yellow;
  if (score >= 20) return COLORS.orange;
  return COLORS.red;
}

function padRight(str, len) {
  return str.length >= len ? str.slice(0, len) : str + " ".repeat(len - str.length);
}

function printReport(results, belowThreshold) {
  console.log("");
  console.log(`${COLORS.bold}  Dependency Obituary — Health Report${COLORS.reset}`);
  console.log(`${COLORS.gray}  Threshold: ${threshold} | Packages: ${results.length}${COLORS.reset}`);
  console.log("");

  // Header
  console.log(
    `  ${COLORS.gray}${padRight("Package", 30)} ${padRight("Version", 12)} ${padRight("Score", 8)} Status${COLORS.reset}`
  );
  console.log(`  ${COLORS.gray}${"─".repeat(70)}${COLORS.reset}`);

  for (const r of results) {
    const score = r.health_score !== null ? String(r.health_score) : "—";
    const sc = scoreColor(r.health_score);
    const rc = riskColor(r.risk_level);
    const fail = r._ignored
      ? ` ${COLORS.gray}IGNORED${COLORS.reset}`
      : r.health_score !== null && r.health_score < threshold ? ` ${COLORS.red}FAIL${COLORS.reset}` : "";

    console.log(
      `  ${padRight(r.name, 30)} ${COLORS.gray}${padRight(r.version, 12)}${COLORS.reset} ${sc}${padRight(score, 8)}${COLORS.reset} ${rc}${RISK_DISPLAY[r.risk_level] || r.risk_level}${COLORS.reset}${fail}`
    );
  }

  console.log("");

  if (belowThreshold.length > 0) {
    console.log(
      `  ${COLORS.red}${COLORS.bold}FAILED:${COLORS.reset} ${belowThreshold.length} package(s) scored below ${threshold}`
    );
    console.log("");
  } else {
    console.log(
      `  ${COLORS.green}${COLORS.bold}PASSED:${COLORS.reset} All packages scored >= ${threshold}`
    );
    console.log("");
  }
}

// ─── Allowlist ─────────────────────────────────────────────────────────────

function loadAllowlist() {
  // Try .dependency-obituary.yml, .dependency-obituary.json, or .depobituaryignore
  const configFiles = [
    ".dependency-obituary.json",
    ".depobituaryignore",
  ];

  for (const file of configFiles) {
    if (!fs.existsSync(file)) continue;

    if (file.endsWith(".json")) {
      try {
        const config = JSON.parse(fs.readFileSync(file, "utf-8"));
        return config.ignore || config.allowlist || [];
      } catch { return []; }
    }

    // .depobituaryignore - one package per line (like .gitignore)
    if (file === ".depobituaryignore") {
      return fs.readFileSync(file, "utf-8")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"));
    }
  }

  return [];
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  // Help
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
  dependency-obituary check — Health check your dependencies

  Usage:
    npx dependency-obituary check [file] [options]

  Options:
    --threshold <n>    Minimum passing score (default: 60)
    --api-url <url>    API base URL (default: https://dependency-obituary.orelsec.com)
    -h, --help         Show this help

  Allowlist:
    Create .depobituaryignore (one package per line) or
    .dependency-obituary.json ({"ignore": ["pkg1", "pkg2"]})
    Supports wildcards: "github.com/Azure/*"

  Auto-detects: package.json, requirements.txt, Cargo.toml, go.mod, Gemfile
`);
    process.exit(0);
  }

  // Find file
  const filePath = findDepFile(fileArg);
  if (!filePath) {
    console.error("  Error: No dependency file found. Provide a path or run from a project root.");
    process.exit(1);
  }

  console.log(`${COLORS.gray}  Reading ${filePath}...${COLORS.reset}`);

  const content = fs.readFileSync(filePath, "utf-8");
  const { ecosystem, packages } = parseFile(path.basename(filePath), content);

  if (packages.length === 0) {
    console.error("  Error: No dependencies found in file.");
    process.exit(1);
  }

  console.log(`${COLORS.gray}  Found ${packages.length} ${ecosystem} dependencies. Analyzing...${COLORS.reset}`);

  const response = await callApi(ecosystem, packages);
  const results = response.results || [];

  if (results.length === 0) {
    console.error("  Error: API returned no results.");
    process.exit(1);
  }

  // Load allowlist from .dependency-obituary.yml or .dependency-obituary.json
  const allowlist = loadAllowlist();
  if (allowlist.length > 0) {
    console.log(`${COLORS.gray}  Allowlist: ${allowlist.length} package(s) ignored${COLORS.reset}`);
  }

  // Sort by score ascending
  results.sort((a, b) => (a.health_score ?? -1) - (b.health_score ?? -1));

  // Mark allowlisted packages
  for (const r of results) {
    r._ignored = allowlist.some((pattern) => {
      if (pattern.endsWith("*")) return r.name.startsWith(pattern.slice(0, -1));
      return r.name === pattern;
    });
  }

  const belowThreshold = results.filter(
    (r) => r.health_score !== null && r.health_score < threshold && !r._ignored
  );

  printReport(results, belowThreshold);

  process.exit(belowThreshold.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`  Error: ${err.message}`);
  process.exit(1);
});
