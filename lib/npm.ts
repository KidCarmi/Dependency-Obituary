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
} from "@/types";

const TIMEOUT_MS = 8000;

const NO_RATE_LIMIT: RateLimitState = {
  remaining: Infinity,
  used: 0,
  resetAt: "",
};

// ─── Fetch Helper ───────────────────────────────────────────────────────────

async function registryFetch<T>(url: string): Promise<FetchResult<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });

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

export function extractGitHubUrl(
  registryData: NpmPackageData | PyPIPackageData
): string | null {
  // npm: repository.url field
  if ("repository" in registryData && registryData.repository?.url) {
    const url = registryData.repository.url
      .replace(/^git\+/, "")
      .replace(/\.git$/, "")
      .replace(/^git:\/\//, "https://")
      .replace(/^ssh:\/\/git@github\.com/, "https://github.com");

    if (url.includes("github.com")) return url;
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
      if (url && url.includes("github.com")) return url;
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
