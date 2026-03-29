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

const GITHUB_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  Authorization: `Bearer ${GITHUB_TOKEN}`,
} as const;

const GITHUB_API = "https://api.github.com";
const TIMEOUT_MS = 8000;

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

async function githubFetch<T>(url: string): Promise<FetchResult<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: GITHUB_HEADERS,
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
  repo: string
): Promise<FetchResult<GitHubRepoMetadata>> {
  return githubFetch<GitHubRepoMetadata>(
    `${GITHUB_API}/repos/${owner}/${repo}`
  );
}

export async function fetchLastCommit(
  owner: string,
  repo: string
): Promise<FetchResult<GitHubCommit[]>> {
  return githubFetch<GitHubCommit[]>(
    `${GITHUB_API}/repos/${owner}/${repo}/commits?per_page=1`
  );
}

export async function fetchContributors(
  owner: string,
  repo: string
): Promise<FetchResult<GitHubContributor[]>> {
  return githubFetch<GitHubContributor[]>(
    `${GITHUB_API}/repos/${owner}/${repo}/stats/contributors`
  );
}

export async function fetchRecentPRs(
  owner: string,
  repo: string
): Promise<FetchResult<GitHubPullRequest[]>> {
  return githubFetch<GitHubPullRequest[]>(
    `${GITHUB_API}/repos/${owner}/${repo}/pulls?state=closed&per_page=20`
  );
}

export async function fetchSecurityAdvisories(
  owner: string,
  repo: string
): Promise<FetchResult<GitHubSecurityAdvisory[]>> {
  return githubFetch<GitHubSecurityAdvisory[]>(
    `${GITHUB_API}/repos/${owner}/${repo}/security-advisories`
  );
}
