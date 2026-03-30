/**
 * npm.ts — npm Registry + PyPI API Clients
 *
 * RULES (enforced by CLAUDE.md):
 *  - All functions return FetchResult<T>
 *  - 8s timeout on all fetches
 *  - No auth required for npm/PyPI
 *  - parser.ts handles client-side parsing; this is server-side only
 */

import type {
  FetchResult,
  RateLimitState,
  NpmPackageData,
  NpmDownloadsData,
  PyPIPackageData,
  PyPIDownloadsData,
  CratesIoPackageData,
  CratesIoDownloadsData,
  GoModuleData,
  RubyGemData,
  RubyGemVersionData,
  PackagistPackageData,
  PubPackageData,
} from "@/types";

const TIMEOUT_MS = 8000;

const NO_RATE_LIMIT: RateLimitState = {
  remaining: Infinity,
  used: 0,
  resetAt: "",
};

// ─── URL Allowlist ──────────────────────────────────────────────────────────

// Map of allowed hostnames to their hardcoded origins
const ALLOWED_REGISTRY_ORIGINS: ReadonlyMap<string, string> = new Map([
  ["registry.npmjs.org", "https://registry.npmjs.org"],
  ["api.npmjs.org", "https://api.npmjs.org"],
  ["pypi.org", "https://pypi.org"],
  ["pypistats.org", "https://pypistats.org"],
  ["crates.io", "https://crates.io"],
  ["proxy.golang.org", "https://proxy.golang.org"],
  ["rubygems.org", "https://rubygems.org"],
  ["repo.packagist.org", "https://repo.packagist.org"],
  ["search.maven.org", "https://search.maven.org"],
  ["pub.dev", "https://pub.dev"],
]);

function buildSafeRegistryUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const origin = ALLOWED_REGISTRY_ORIGINS.get(parsed.hostname);
    if (!origin) return null;
    // Construct from hardcoded origin + parsed path/search (no user-controlled origin)
    return origin + parsed.pathname + parsed.search;
  } catch {
    return null;
  }
}

// ─── Fetch Helper ───────────────────────────────────────────────────────────

async function registryFetch<T>(url: string): Promise<FetchResult<T>> {
  const safeUrl = buildSafeRegistryUrl(url);
  if (!safeUrl) {
    return { success: false, error: "network_error" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(safeUrl, { signal: controller.signal });

    if (res.status === 404) {
      return { success: false, error: "not_found" };
    }

    if (!res.ok) {
      return { success: false, error: "network_error" };
    }

    const data = (await res.json()) as T;
    return { success: true, data, cached: false, rateLimit: NO_RATE_LIMIT };
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { success: false, error: "timeout" };
    }
    return { success: false, error: "network_error" };
  } finally {
    clearTimeout(timeout);
  }
}

// ─── GitHub URL Extraction ──────────────────────────────────────────────────

function isGitHubHostname(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "github.com" || parsed.hostname.endsWith(".github.com");
  } catch {
    return false;
  }
}

export function extractGitHubUrl(
  registryData: NpmPackageData | PyPIPackageData | CratesIoPackageData | RubyGemData | PackagistPackageData | PubPackageData
): string | null {
  // npm: repository.url field
  if ("repository" in registryData && typeof registryData.repository === "object" && registryData.repository?.url) {
    const url = registryData.repository.url
      .replace(/^git\+/, "")
      .replace(/\.git$/, "")
      .replace(/^git:\/\//, "https://")
      .replace(/^ssh:\/\/git@github\.com/, "https://github.com");

    if (isGitHubHostname(url)) return url;
  }

  // PyPI: project_urls field
  if ("info" in registryData && registryData.info.project_urls) {
    const urls = registryData.info.project_urls;
    for (const key of [
      "Source",
      "Source Code",
      "Repository",
      "Homepage",
      "Code",
    ]) {
      const url = urls[key];
      if (url && isGitHubHostname(url)) return url;
    }
  }

  // crates.io: repository string field on crate object
  if ("crate" in registryData && registryData.crate.repository) {
    const url = registryData.crate.repository
      .replace(/\.git$/, "");
    if (isGitHubHostname(url)) return url;
  }

  // RubyGems: source_code_uri or homepage_uri
  if ("source_code_uri" in registryData) {
    if (registryData.source_code_uri && isGitHubHostname(registryData.source_code_uri)) {
      return registryData.source_code_uri;
    }
    if (registryData.homepage_uri && isGitHubHostname(registryData.homepage_uri)) {
      return registryData.homepage_uri;
    }
  }

  // Packagist: repository field
  if ("package" in registryData && "repository" in (registryData as PackagistPackageData).package) {
    const repo = (registryData as PackagistPackageData).package.repository;
    if (repo && isGitHubHostname(repo)) return repo.replace(/\.git$/, "");
  }

  // pub.dev: repository or homepage in pubspec
  if ("latest" in registryData) {
    const pubspec = (registryData as PubPackageData).latest.pubspec;
    if (pubspec.repository && isGitHubHostname(pubspec.repository)) return pubspec.repository;
    if (pubspec.homepage && isGitHubHostname(pubspec.homepage)) return pubspec.homepage;
  }

  return null;
}

// ─── GitHub URL from Go module path ────────────────────────────────────────

export function extractGitHubUrlFromGoModule(modulePath: string): string | null {
  if (modulePath.startsWith("github.com/")) {
    // github.com/owner/repo or github.com/owner/repo/subpath
    const parts = modulePath.split("/");
    if (parts.length >= 3) {
      return `https://github.com/${parts[1]}/${parts[2]}`;
    }
  }
  return null;
}

// ─── npm Endpoints ──────────────────────────────────────────────────────────

export async function fetchNpmPackage(
  name: string
): Promise<FetchResult<NpmPackageData>> {
  return registryFetch<NpmPackageData>(
    `https://registry.npmjs.org/${encodeURIComponent(name)}`
  );
}

export async function fetchNpmDownloads(
  name: string
): Promise<FetchResult<NpmDownloadsData>> {
  return registryFetch<NpmDownloadsData>(
    `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(name)}`
  );
}

export async function fetchNpmDownloads12wAgo(
  name: string
): Promise<FetchResult<NpmDownloadsData>> {
  const now = new Date();
  const end = new Date(now.getTime() - 12 * 7 * 24 * 3600 * 1000);
  const start = new Date(end.getTime() - 7 * 24 * 3600 * 1000);

  const fmt = (d: Date): string => d.toISOString().split("T")[0];

  return registryFetch<NpmDownloadsData>(
    `https://api.npmjs.org/downloads/point/${fmt(start)}:${fmt(end)}/${encodeURIComponent(name)}`
  );
}

// ─── PyPI Endpoints ─────────────────────────────────────────────────────────

export async function fetchPyPIPackage(
  name: string
): Promise<FetchResult<PyPIPackageData>> {
  return registryFetch<PyPIPackageData>(
    `https://pypi.org/pypi/${encodeURIComponent(name)}/json`
  );
}

export async function fetchPyPIDownloads(
  name: string
): Promise<FetchResult<PyPIDownloadsData>> {
  return registryFetch<PyPIDownloadsData>(
    `https://pypistats.org/api/packages/${encodeURIComponent(name)}/recent`
  );
}

// ─── crates.io Endpoints ───────────────────────────────────────────────────

export async function fetchCratesIoPackage(
  name: string
): Promise<FetchResult<CratesIoPackageData>> {
  return registryFetch<CratesIoPackageData>(
    `https://crates.io/api/v1/crates/${encodeURIComponent(name)}`
  );
}

export async function fetchCratesIoDownloads(
  name: string
): Promise<FetchResult<CratesIoDownloadsData>> {
  return registryFetch<CratesIoDownloadsData>(
    `https://crates.io/api/v1/crates/${encodeURIComponent(name)}/downloads`
  );
}

// ─── Go Module Proxy Endpoints ─────────────────────────────────────────────

export async function fetchGoModule(
  modulePath: string
): Promise<FetchResult<GoModuleData>> {
  return registryFetch<GoModuleData>(
    `https://proxy.golang.org/${encodeURIComponent(modulePath)}/@latest`
  );
}

// ─── RubyGems Endpoints ────────────────────────────────────────────────────

export async function fetchRubyGem(
  name: string
): Promise<FetchResult<RubyGemData>> {
  return registryFetch<RubyGemData>(
    `https://rubygems.org/api/v1/gems/${encodeURIComponent(name)}.json`
  );
}

export async function fetchRubyGemVersions(
  name: string
): Promise<FetchResult<RubyGemVersionData[]>> {
  return registryFetch<RubyGemVersionData[]>(
    `https://rubygems.org/api/v1/versions/${encodeURIComponent(name)}.json`
  );
}

// ─── Packagist (PHP/Composer) Endpoints ────────────────────────────────────

export async function fetchPackagistPackage(
  name: string
): Promise<FetchResult<PackagistPackageData>> {
  return registryFetch<PackagistPackageData>(
    `https://repo.packagist.org/packages/${name}.json`
  );
}

// ─── Maven Central (Java/Kotlin) — no direct API, use search ───────────────

export interface MavenSearchResult {
  response: {
    docs: Array<{
      g: string;
      a: string;
      latestVersion: string;
      timestamp: number;
    }>;
  };
}

export async function fetchMavenPackage(
  groupArtifact: string
): Promise<FetchResult<MavenSearchResult>> {
  const [group, artifact] = groupArtifact.split(":");
  if (!group || !artifact) return { success: false, error: "not_found" };
  return registryFetch<MavenSearchResult>(
    `https://search.maven.org/solrsearch/select?q=g:${encodeURIComponent(group)}+AND+a:${encodeURIComponent(artifact)}&rows=1&wt=json`
  );
}

// ─── pub.dev (Dart/Flutter) Endpoints ──────────────────────────────────────

export async function fetchPubPackage(
  name: string
): Promise<FetchResult<PubPackageData>> {
  return registryFetch<PubPackageData>(
    `https://pub.dev/api/packages/${encodeURIComponent(name)}`
  );
}
