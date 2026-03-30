/**
 * github-app.ts — GitHub App Authentication & Utilities
 *
 * Handles JWT creation, installation token exchange, and webhook
 * signature verification for the GitHub App integration.
 */

import crypto from "crypto";

// ─── Webhook Signature Verification ────────────────────────────────────────

export function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false;

  const expected = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(payload, "utf-8")
    .digest("hex")}`;

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}

// ─── JWT Creation (RS256) ──────────────────────────────────────────────────

export function createAppJwt(appId: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT" })
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ iss: appId, iat: now - 60, exp: now + 600 })
  ).toString("base64url");

  const signingInput = `${header}.${payload}`;
  const key = privateKey.replace(/\\n/g, "\n");
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(signingInput);
  const signature = sign.sign(key, "base64url");

  return `${signingInput}.${signature}`;
}

// ─── Installation Access Token ─────────────────────────────────────────────

let cachedToken: { token: string; expiresAt: number; installationId: number } | null = null;

export async function getInstallationToken(
  installationId: number
): Promise<string> {
  // Return cached token if still valid (5-min buffer)
  if (
    cachedToken &&
    cachedToken.installationId === installationId &&
    cachedToken.expiresAt > Date.now() + 5 * 60 * 1000
  ) {
    return cachedToken.token;
  }

  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || !privateKey) {
    throw new Error("GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY not set");
  }

  const jwt = createAppJwt(appId, privateKey);

  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${jwt}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to get installation token: ${res.status}`);
  }

  const data = (await res.json()) as { token: string; expires_at: string };

  cachedToken = {
    token: data.token,
    expiresAt: new Date(data.expires_at).getTime(),
    installationId,
  };

  return data.token;
}

// ─── GitHub API Helpers (using installation token) ─────────────────────────

interface PrFile {
  filename: string;
  status: string;
  raw_url: string;
  contents_url: string;
}

export async function getPrChangedFiles(
  owner: string,
  repo: string,
  prNumber: number,
  token: string
): Promise<PrFile[]> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );

  if (!res.ok) return [];
  return (await res.json()) as PrFile[];
}

export async function getFileContent(
  contentsUrl: string,
  token: string
): Promise<string | null> {
  // contents_url has {?ref} template — strip it
  const url = contentsUrl.replace(/\{.*\}$/, "");
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github.raw+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!res.ok) return null;
  return res.text();
}

interface PrComment {
  id: number;
  body: string;
  user: { login: string } | null;
}

export async function findBotComment(
  owner: string,
  repo: string,
  prNumber: number,
  token: string,
  botMarker: string
): Promise<number | null> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments?per_page=100`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );

  if (!res.ok) return null;

  const comments = (await res.json()) as PrComment[];
  const existing = comments.find((c) => c.body.includes(botMarker));
  return existing?.id ?? null;
}

export async function postOrUpdateComment(
  owner: string,
  repo: string,
  prNumber: number,
  token: string,
  body: string,
  existingCommentId: number | null
): Promise<void> {
  if (existingCommentId) {
    await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/comments/${existingCommentId}`,
      {
        method: "PATCH",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body }),
      }
    );
  } else {
    await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body }),
      }
    );
  }
}
