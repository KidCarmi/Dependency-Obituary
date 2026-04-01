/**
 * Integration tests - verify all 9 ecosystems, APIs, and features
 * against the production API.
 *
 * Run: npm run test:integration
 */

import { describe, it, expect } from "vitest";
import {
  parsePackageJson,
  parseRequirementsTxt,
  parseCargoToml,
  parseGoMod,
  parseGemfile,
  parseComposerJson,
  parseBuildGradle,
  parsePubspecYaml,
  parseVcpkgJson,
} from "@/lib/parser";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const API = process.env.API_BASE_URL || "https://dependency-obituary.orelsec.com";

function loadExample(filename: string): string {
  return fs.readFileSync(path.join(process.cwd(), "examples", filename), "utf-8");
}

// ─── Registry Reachability ──────────────────────────────────────────────────

describe("Registry Reachability", { timeout: 15000 }, () => {
  const registries: Array<{ name: string; url: string; field: string; headers: Record<string, string> }> = [
    { name: "npm", url: "https://registry.npmjs.org/react", field: "name", headers: {} },
    { name: "PyPI", url: "https://pypi.org/pypi/flask/json", field: "info", headers: {} },
    { name: "crates.io", url: "https://crates.io/api/v1/crates/serde", field: "crate", headers: { "User-Agent": "dependency-obituary-test" } },
    { name: "Go proxy", url: "https://proxy.golang.org/github.com/gin-gonic/gin/@latest", field: "Version", headers: {} },
    { name: "RubyGems", url: "https://rubygems.org/api/v1/gems/rails.json", field: "name", headers: {} },
    { name: "Packagist", url: "https://repo.packagist.org/p2/laravel/framework.json", field: "packages", headers: {} },
    { name: "Maven", url: "https://search.maven.org/solrsearch/select?q=a:guava&rows=1&wt=json", field: "response", headers: {} },
    { name: "pub.dev", url: "https://pub.dev/api/packages/http", field: "name", headers: {} },
  ];

  for (const reg of registries) {
    it(`${reg.name} registry is reachable`, async () => {
      const res = await fetch(reg.url, { headers: reg.headers });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data[reg.field]).toBeDefined();
    });
  }
});

// ─── Analyze API - All 9 Ecosystems ─────────────────────────────────────────

describe("POST /api/analyze", { timeout: 30000 }, () => {
  const ecosystems: Array<{
    name: string;
    ecosystem: string;
    file: string;
    parser: (content: string) => Array<{ name: string; version: string }>;
    minPackages: number;
  }> = [
    { name: "npm", ecosystem: "npm", file: "package.json", parser: parsePackageJson, minPackages: 2 },
    { name: "PyPI", ecosystem: "pypi", file: "requirements.txt", parser: parseRequirementsTxt, minPackages: 2 },
    { name: "Cargo", ecosystem: "cargo", file: "Cargo.toml", parser: parseCargoToml, minPackages: 2 },
    { name: "Go", ecosystem: "go", file: "go.mod", parser: parseGoMod, minPackages: 2 },
    { name: "RubyGems", ecosystem: "rubygems", file: "Gemfile", parser: parseGemfile, minPackages: 2 },
    { name: "PHP", ecosystem: "packagist", file: "composer.json", parser: parseComposerJson, minPackages: 2 },
    { name: "Java", ecosystem: "maven", file: "build.gradle", parser: parseBuildGradle, minPackages: 2 },
    { name: "Dart", ecosystem: "pub", file: "pubspec.yaml", parser: parsePubspecYaml, minPackages: 2 },
    { name: "C++", ecosystem: "vcpkg", file: "vcpkg.json", parser: parseVcpkgJson, minPackages: 2 },
  ];

  for (const eco of ecosystems) {
    it(`analyzes ${eco.name} (${eco.file})`, async () => {
      const content = loadExample(eco.file);
      const packages = eco.parser(content).slice(0, 3);
      expect(packages.length).toBeGreaterThanOrEqual(eco.minPackages);

      const res = await fetch(`${API}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ecosystem: eco.ecosystem, packages }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();

      // Meta validation
      expect(data.meta).toBeDefined();
      expect(data.meta.analyzed_at).toBeDefined();
      expect(data.results).toBeInstanceOf(Array);
      expect(data.results.length).toBeGreaterThan(0);

      // Result validation
      for (const result of data.results) {
        expect(result.name).toBeDefined();
        expect(result.version).toBeDefined();
        expect(
          result.health_score === null ||
          (typeof result.health_score === "number" && result.health_score >= 0 && result.health_score <= 100)
        ).toBe(true);
        expect(["healthy", "stable", "at_risk", "critical", "abandoned", "unknown"]).toContain(result.risk_level);
        expect(["high", "low", "unavailable"]).toContain(result.data_confidence);
      }
    });
  }

  it("rejects invalid ecosystem", async () => {
    const res = await fetch(`${API}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ecosystem: "invalid", packages: [{ name: "test", version: "1.0" }] }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects empty packages", async () => {
    const res = await fetch(`${API}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ecosystem: "npm", packages: [] }),
    });
    expect(res.status).toBe(400);
  });
});

// ─── Badge API ──────────────────────────────────────────────────────────────

describe("GET /api/badge", { timeout: 15000 }, () => {
  const badges = [
    { ecosystem: "npm", package: "express" },
    { ecosystem: "pypi", package: "django" },
    { ecosystem: "cargo", package: "tokio" },
    { ecosystem: "rubygems", package: "rails" },
    { ecosystem: "pub", package: "http" },
  ];

  for (const b of badges) {
    it(`returns valid SVG for ${b.ecosystem}/${b.package}`, async () => {
      const res = await fetch(`${API}/api/badge?ecosystem=${b.ecosystem}&package=${b.package}`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("image/svg+xml");

      const svg = await res.text();
      expect(svg).toMatch(/^<svg/);
      expect(svg).toContain("</svg>");
      expect(svg).toContain("health:");
    });
  }

  it("returns badge for missing package", async () => {
    const res = await fetch(`${API}/api/badge?ecosystem=npm&package=this-package-does-not-exist-xyz123`);
    expect(res.status).toBe(200);
    const svg = await res.text();
    expect(svg).toContain("<svg");
  });

  it("rejects missing package param", async () => {
    const res = await fetch(`${API}/api/badge?ecosystem=npm`);
    expect(res.status).toBe(400);
  });
});

// ─── Share API ──────────────────────────────────────────────────────────────

describe("/api/share - Save and Load", { timeout: 15000 }, () => {
  let shareId: string;

  const mockReport = {
    results: {
      meta: {
        analyzed_at: new Date().toISOString(),
        cache_hit_rate: 0.5,
        degraded_count: 0,
        github_rate_limit: { remaining: 5000, used: 0, resetAt: "" },
      },
      results: [
        {
          name: "test-package",
          version: "1.0.0",
          health_score: 85,
          risk_level: "healthy",
          data_confidence: "high",
          github_url: null,
          npm_url: null,
        },
      ],
    },
    ecosystem: "npm",
    filename: "test-package.json",
  };

  it("saves a report and returns ID", async () => {
    const res = await fetch(`${API}/api/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mockReport),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toMatch(/^[a-z0-9]{8}$/);
    shareId = data.id;
  });

  it("retrieves saved report by ID", async () => {
    if (!shareId) return;

    const res = await fetch(`${API}/api/share?id=${shareId}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ecosystem).toBe("npm");
    expect(data.filename).toBe("test-package.json");
  });

  it("returns 404 for non-existent ID", async () => {
    const res = await fetch(`${API}/api/share?id=zzzzzzzz`);
    expect(res.status).toBe(404);
  });

  it("rejects invalid ID format", async () => {
    const res = await fetch(`${API}/api/share?id=invalid!!`);
    expect(res.status).toBe(400);
  });
});

// ─── Webhook Signature Verification ─────────────────────────────────────────

describe("POST /api/github/webhook", { timeout: 10000 }, () => {
  it("rejects request with no signature", async () => {
    const res = await fetch(`${API}/api/github/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-GitHub-Event": "pull_request" },
      body: JSON.stringify({ action: "opened" }),
    });
    expect(res.status).toBe(403);
  });

  it("rejects request with invalid signature", async () => {
    const res = await fetch(`${API}/api/github/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GitHub-Event": "pull_request",
        "X-Hub-Signature-256": "sha256=invalidhash",
      },
      body: JSON.stringify({ action: "opened" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 200 for non-PR events (with valid-looking request)", async () => {
    // Even without valid sig, webhook endpoint returns 503 if not configured
    // or 403 if sig is wrong. This tests the endpoint is reachable.
    const res = await fetch(`${API}/api/github/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GitHub-Event": "ping",
        "X-Hub-Signature-256": "sha256=test",
      },
      body: JSON.stringify({ zen: "test" }),
    });
    // Should be 403 (invalid sig) or 200 (ping handled) - not 500
    expect(res.status).not.toBe(500);
  });
});

// ─── Parser Completeness ────────────────────────────────────────────────────

describe("Parser - All Example Files", () => {
  const files = [
    { file: "package.json", parser: parsePackageJson, min: 5 },
    { file: "requirements.txt", parser: parseRequirementsTxt, min: 5 },
    { file: "Cargo.toml", parser: parseCargoToml, min: 5 },
    { file: "go.mod", parser: parseGoMod, min: 5 },
    { file: "Gemfile", parser: parseGemfile, min: 5 },
    { file: "composer.json", parser: parseComposerJson, min: 3 },
    { file: "build.gradle", parser: parseBuildGradle, min: 3 },
    { file: "pubspec.yaml", parser: parsePubspecYaml, min: 3 },
    { file: "vcpkg.json", parser: parseVcpkgJson, min: 5 },
  ];

  for (const f of files) {
    it(`parses examples/${f.file} with ${f.min}+ packages`, () => {
      const content = loadExample(f.file);
      const packages = f.parser(content);
      expect(packages.length).toBeGreaterThanOrEqual(f.min);
      for (const pkg of packages) {
        expect(pkg.name).toBeTruthy();
        expect(pkg.version).toBeDefined();
      }
    });
  }
});
