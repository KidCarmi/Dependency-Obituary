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

  await redis.set(settingsKey(githubId), JSON.stringify(body));
  return NextResponse.json({ ok: true });
}
