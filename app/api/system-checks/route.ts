import { NextRequest, NextResponse } from "next/server";
import { getOrCreateSessionId } from "@/lib/session";
import { logSystemCheck, getSystemChecks } from "@/lib/db";

/** GET — list recent system checks for this session. */
export async function GET() {
  const sid = await getOrCreateSessionId();
  const checks = getSystemChecks(sid, 20);
  return NextResponse.json({ checks });
}

/** POST — log a new system check. */
export async function POST(req: NextRequest) {
  const sid = await getOrCreateSessionId();
  const body = await req.json();
  const id = logSystemCheck({
    sessionId: sid,
    gameSlug: String(body.gameSlug || "unknown"),
    cpu: body.cpu,
    gpu: body.gpu,
    ramGb: typeof body.ramGb === "number" ? body.ramGb : undefined,
    storage: body.storage,
    score: typeof body.score === "number" ? body.score : undefined,
    result: body.result,
    createdAt: Date.now(),
  });
  return NextResponse.json({ ok: true, id });
}
