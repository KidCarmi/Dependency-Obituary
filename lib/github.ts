/**
 * github.ts — GitHub API Client
 *
 * RULES (enforced by CLAUDE.md):
 *  - GITHUB_TOKEN is required — throws at startup if missing
 *  - Read x-ratelimit-remaining on EVERY response
 *  - Never let remaining drop below 100
 *  - Only approved endpoints (see CLAUDE.md)
 *  - All functions return FetchResult<T>
 *  - 8s timeout on all fetches
 *  - Per-user token override: when a signed-in user's OAuth token is
 *    available, use it instead of the shared token for better rate limits
 */

import type {
  FetchResult,
  RateLimitState,
  GitHubRepoMetadata,
  GitHubCommit,
  GitHubContributor,
  GitHubPullRequest,
  GitHubSecurityAdvisory,
} from "@/types";

// ─── Token Validation ────────────────────────────────────────────────────────

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
  throw new Error(
    "[Dependency Obituary] GITHUB_TOKEN is not set. " +
      "Set it in Vercel environment variables or .env.local."
  );
}

// Base URL removed - githubFetch now takes path only, origin is hardcoded inside
const TIMEOUT_MS = 8000;

// Safe path pattern for GitHub API paths
const SAFE_GITHUB_PATH = /^\/[a-zA-Z0-9._\-/?=&%@:+~]+$/;

function buildHeaders(token?: string): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    Authorization: `Bearer ${token || GITHUB_TOKEN}`,
  };
}

// ─── Rate Limit Extraction ──────────────────────────────────────────────────

export function extractRateLimitState(headers: Headers): RateLimitState {
  const remaining = parseInt(headers.get("x-ratelimit-remaining") ?? "0", 10);
  const used = parseInt(headers.get("x-ratelimit-used") ?? "0", 10);
  const resetEpoch = parseInt(headers.get("x-ratelimit-reset") ?? "0", 10);
  const resetAt = new Date(resetEpoch * 1000).toISOString();
  return { remaining, used, resetAt };
}

// ─── GitHub URL Parser ──────────────────────────────────────────────────────

export function parseGitHubUrl(
  repoUrl: string
): { owner: string; repo: string } | null {
  let url = repoUrl
    .replace(/^git\+/, "")
    .replace(/\.git$/, "")
    .replace(/^git:\/\//, "https://")
    .replace(/^ssh:\/\/git@github\.com/, "https://github.com");

  if (url.startsWith("git@github.com:")) {
    url = "https://github.com/" + url.slice("git@github.com:".length);
  }

  const match = url.match(
    /(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/\s#?]+)/
  );
  if (!match) return null;

  return { owner: match[1], repo: match[2] };
}

// ─── Fetch Helper ───────────────────────────────────────────────────────────

async function githubFetch<T>(path: string, token?: string): Promise<FetchResult<T>> {
  if (!SAFE_GITHUB_PATH.test(path)) {
    return { success: false, error: "network_error" };
  }
  // Origin is always hardcoded - never from user input
  const url = "https://api.github.com" + path;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: buildHeaders(token),
      signal: controller.signal,
    });

    const rateLimit = extractRateLimitState(res.headers);

    if (res.status === 403 && rateLimit.remaining === 0) {
      return {
        success: false,
        error: "rate_limited",
        retryAfter: rateLimit.resetAt,
      };
    }

    if (res.status === 202) {
      // GitHub is computing stats asynchronously — treat as no data
      return { success: false, error: "not_found" };
    }

    if (res.status === 404) {
      return { success: false, error: "not_found" };
    }

    if (!res.ok) {
      return { success: false, error: "network_error" };
    }

    const data = (await res.json()) as T;
    return { success: true, data, cached: false, rateLimit };
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { success: false, error: "timeout" };
    }
    return { success: false, error: "network_error" };
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Approved Endpoints ─────────────────────────────────────────────────────

export async function fetchRepoMetadata(
  owner: string,
  repo: string,
  token?: string
): Promise<FetchResult<GitHubRepoMetadata>> {
  return githubFetch<GitHubRepoMetadata>(
    `/repos/${owner}/${repo}`,
    token
  );
}

export async function fetchLastCommit(
  owner: string,
  repo: string,
  token?: string
): Promise<FetchResult<GitHubCommit[]>> {
  return githubFetch<GitHubCommit[]>(
    `/repos/${owner}/${repo}/commits?per_page=1`,
    token
  );
}

export async function fetchContributors(
  owner: string,
  repo: string,
  token?: string
): Promise<FetchResult<GitHubContributor[]>> {
  const result = await githubFetch<GitHubContributor[]>(
    `/repos/${owner}/${repo}/stats/contributors`,
    token
  );

  // GitHub returns 202 when computing stats asynchronously.
  // Retry once after 1s — the data is usually ready on second attempt.
  if (!result.success && result.error === "not_found") {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return githubFetch<GitHubContributor[]>(
      `/repos/${owner}/${repo}/stats/contributors`,
      token
    );
  }

  return result;
}

export async function fetchRecentPRs(
  owner: string,
  repo: string,
  token?: string
): Promise<FetchResult<GitHubPullRequest[]>> {
  return githubFetch<GitHubPullRequest[]>(
    `/repos/${owner}/${repo}/pulls?state=closed&per_page=20`,
    token
  );
}

export async function fetchSecurityAdvisories(
  owner: string,
  repo: string,
  token?: string
): Promise<FetchResult<GitHubSecurityAdvisory[]>> {
  return githubFetch<GitHubSecurityAdvisory[]>(
    `/repos/${owner}/${repo}/security-advisories`,
    token
  );
}
