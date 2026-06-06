import { NextRequest, NextResponse } from "next/server";
import { getOrCreateSessionId } from "@/lib/session";
import { getProgress, setProgress, deleteProgress } from "@/lib/db";

type Params = Promise<{ tool: string; key: string }>;

/** GET — load all progress entries for a tool. */
export async function GET(_req: NextRequest, ctx: { params: Params }) {
  const { tool, key } = await ctx.params;
  const sid = await getOrCreateSessionId();
  if (key === "_all") {
    const all = getProgress(sid, tool);
    return NextResponse.json({ progress: all });
  }
  const all = getProgress(sid, tool);
  const found = all.find((p) => p.key === key);
  return NextResponse.json({ value: found?.value ?? null });
}

/** POST — set a value. */
export async function POST(req: NextRequest, ctx: { params: Params }) {
  const { tool, key } = await ctx.params;
  const sid = await getOrCreateSessionId();
  const body = await req.json();
  const value = typeof body.value === "string" ? body.value : JSON.stringify(body.value);
  setProgress(sid, tool, key, value);
  return NextResponse.json({ ok: true });
}

/** DELETE — remove a value. */
export async function DELETE(_req: NextRequest, ctx: { params: Params }) {
  const { tool, key } = await ctx.params;
  const sid = await getOrCreateSessionId();
  deleteProgress(sid, tool, key);
  return NextResponse.json({ ok: true });
}
