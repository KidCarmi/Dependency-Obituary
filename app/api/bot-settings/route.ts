/**
 * /api/bot-settings — Read/write bot configuration
 *
 * GET:  Load settings for the signed-in user
 * POST: Save settings
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { redis } from "@/lib/cache";

function settingsKey(githubId: number): string {
  return `bot-settings:${githubId}`;
}

async function getGithubId(): Promise<number | null> {
  const session = await auth();
  if (!session?.user) return null;
  return (session.user as unknown as Record<string, unknown>).githubId as number ?? null;
}

export async function GET(): Promise<NextResponse> {
  const githubId = await getGithubId();
  if (!githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await redis.get(settingsKey(githubId));
  return NextResponse.json({ settings: raw ?? null });
}

export async function POST(request: Request): Promise<NextResponse> {
  const githubId = await getGithubId();
  if (!githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: unknown = await request.json();
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // Validate settings structure
  const obj = body as Record<string, unknown>;
  const sanitized = {
    warning_threshold: Math.max(10, Math.min(90, Number(obj.warning_threshold) || 60)),
    critical_threshold: Math.max(5, Math.min(80, Number(obj.critical_threshold) || 40)),
    max_packages: Math.max(5, Math.min(200, Number(obj.max_packages) || 50)),
    comment_behavior: ["always", "warnings_only", "silent"].includes(obj.comment_behavior as string)
      ? obj.comment_behavior
      : "always",
  };

  await redis.set(settingsKey(githubId), JSON.stringify(sanitized));
  return NextResponse.json({ ok: true });
}
