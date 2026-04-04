/**
 * POST /api/github/webhook
 *
 * GitHub App webhook handler. Listens for pull_request events,
 * checks if dependency files changed, analyzes them, and posts
 * a health report comment on the PR.
 */

import { NextResponse } from "next/server";
import { redis } from "@/lib/cache";
import {
  verifyWebhookSignature,
  getInstallationToken,
  getPrChangedFiles,
  getFileContent,
  findBotComment,
  postOrUpdateComment,
} from "@/lib/github-app";
import { parseFile } from "@/lib/parser";
import { fetchBatched } from "@/lib/fetcher";
import type { HealthResult, RiskLevel } from "@/types";

const BOT_MARKER = "<!-- dependency-obituary-bot -->";

const DEP_FILES = new Set([
  "package.json",
  "requirements.txt",
  "cargo.toml",
  "go.mod",
  "gemfile",
  "composer.json",
  "build.gradle",
  "build.gradle.kts",
  "pubspec.yaml",
]);

function isDependencyFile(filename: string): boolean {
  const base = filename.split("/").pop()?.toLowerCase() ?? "";
  return DEP_FILES.has(base);
}

// ─── Comment Formatter ─────────────────────────────────────────────────────

const RISK_EMOJI: Record<RiskLevel, string> = {
  healthy: "🟢",
  stable: "🔵",
  at_risk: "🟡",
  critical: "🟠",
  abandoned: "🔴",
  unknown: "⚪",
};

const RISK_DISPLAY: Record<RiskLevel, string> = {
  healthy: "healthy",
  stable: "stable",
  at_risk: "at_risk",
  critical: "critical",
  abandoned: "unmaintained",
  unknown: "unknown",
};

function formatComment(
  results: HealthResult[],
  filename: string
): string {
  const sorted = [...results].sort(
    (a, b) => (a.health_score ?? -1) - (b.health_score ?? -1)
  );

  const critical = results.filter(
    (r) => r.risk_level === "critical" || r.risk_level === "abandoned"
  );
  const atRisk = results.filter((r) => r.risk_level === "at_risk");

  let summary: string;
  if (critical.length > 0) {
    summary = `⚠️ **${critical.length} critical/unmaintained** package${critical.length > 1 ? "s" : ""} detected`;
  } else if (atRisk.length > 0) {
    summary = `⚡ ${atRisk.length} package${atRisk.length > 1 ? "s" : ""} at risk`;
  } else {
    summary = `✅ All ${results.length} packages look healthy`;
  }

  const rows = sorted
    .map((r) => {
      const score =
        r.health_score !== null ? String(r.health_score) : "—";
      const emoji = RISK_EMOJI[r.risk_level];
      return `| ${r.name} | ${r.version} | ${score} | ${emoji} ${RISK_DISPLAY[r.risk_level]} |`;
    })
    .join("\n");

  return `${BOT_MARKER}
## 🪦 Dependency Obituary

${summary}

| Package | Version | Score | Status |
|---|---|---|---|
${rows}

<sub>Analyzed \`${filename}\` · ${results.length} packages · [View full report](https://dependency-obituary.orelsec.com)</sub>`;
}

// ─── Webhook Handler ───────────────────────────────────────────────────────

interface WebhookPayload {
  action: string;
  pull_request: {
    number: number;
    head: { sha: string };
  };
  repository: {
    owner: { login: string };
    name: string;
  };
  installation?: { id: number };
}

export async function POST(request: Request): Promise<NextResponse> {
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  // Read raw body for signature verification
  const rawBody = await request.text();

  // Verify signature
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  // Parse event
  const event = request.headers.get("x-github-event");
  if (event !== "pull_request") {
    return NextResponse.json({ ok: true, skipped: "not a PR event" });
  }

  const payload = JSON.parse(rawBody) as WebhookPayload;

  if (payload.action !== "opened" && payload.action !== "synchronize") {
    return NextResponse.json({ ok: true, skipped: "action not relevant" });
  }

  if (!payload.installation?.id) {
    return NextResponse.json({ error: "No installation ID" }, { status: 400 });
  }

  // Get installation token
  let token: string;
  try {
    token = await getInstallationToken(payload.installation.id);
  } catch {
    return NextResponse.json({ error: "Token exchange failed" }, { status: 500 });
  }

  const { owner, name: repo } = payload.repository;
  const prNumber = payload.pull_request.number;

  // Fetch changed files
  const files = await getPrChangedFiles(owner.login, repo, prNumber, token);

  // Find dependency files that changed
  const depFiles = files.filter(
    (f) => isDependencyFile(f.filename) && f.status !== "removed"
  );

  if (depFiles.length === 0) {
    return NextResponse.json({ ok: true, skipped: "no dependency files changed" });
  }

  // Analyze the first dependency file found
  const depFile = depFiles[0];
  const content = await getFileContent(depFile.contents_url, token);

  if (!content) {
    return NextResponse.json({ ok: true, skipped: "could not read file" });
  }

  const basename = depFile.filename.split("/").pop() ?? depFile.filename;
  const { ecosystem, packages } = parseFile(basename, content);

  if (packages.length === 0) {
    return NextResponse.json({ ok: true, skipped: "no packages parsed" });
  }

  // Run analysis (use installation token for GitHub API calls)
  const results = await fetchBatched(
    packages.slice(0, 50), // Limit to 50 for PR comments
    ecosystem,
    5,
    200,
    token
  );

  // Format comment
  const commentBody = formatComment(results, depFile.filename);

  // Find existing bot comment (to update instead of creating duplicate)
  const existingId = await findBotComment(
    owner.login,
    repo,
    prNumber,
    token,
    BOT_MARKER
  );

  // Post or update comment
  await postOrUpdateComment(
    owner.login,
    repo,
    prNumber,
    token,
    commentBody,
    existingId
  );

  // Log event for activity feed
  const critical = results.filter(
    (r) => r.risk_level === "critical" || r.risk_level === "abandoned"
  ).length;
  const healthy = results.filter((r) => r.risk_level === "healthy").length;

  const activityEvent = {
    type: "pr_analyzed",
    repo: `${owner.login}/${repo}`,
    pr_number: prNumber,
    file: depFile.filename,
    packages_total: results.length,
    packages_critical: critical,
    packages_healthy: healthy,
    timestamp: new Date().toISOString(),
  };

  // Store in a capped list per installation (last 100 events)
  const feedKey = `feed:${payload.installation?.id ?? "global"}`;
  await redis.lpush(feedKey, JSON.stringify(activityEvent)).catch(() => {});
  await redis.ltrim(feedKey, 0, 99).catch(() => {});

  return NextResponse.json({
    ok: true,
    analyzed: packages.length,
    file: depFile.filename,
    updated: existingId !== null,
  });
}
