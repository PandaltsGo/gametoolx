/**
 * /api/track/translate
 * Track "Translate this" button clicks.
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { logTranslateClick } from "@/lib/analytics";
import { newSessionId, upsertSession } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const COOKIE_NAME = "gtx_sid";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const resourceId = typeof body.resourceId === "string" ? body.resourceId : "";
    const targetLang = typeof body.targetLang === "string" ? body.targetLang : "";
    if (!resourceId || !targetLang) {
      return NextResponse.json({ ok: false, error: "missing fields" }, { status: 400 });
    }

    const cookieStore = await cookies();
    let sid = cookieStore.get(COOKIE_NAME)?.value;
    if (!sid) {
      sid = newSessionId();
      cookieStore.set(COOKIE_NAME, sid, { maxAge: 60 * 60 * 24 * 365, httpOnly: true, sameSite: "lax", path: "/" });
      upsertSession(sid, req.headers.get("user-agent") || undefined, body.lang);
    }

    logTranslateClick({
      resourceId,
      targetLang,
      sessionId: sid,
      lang: typeof body.lang === "string" ? body.lang : null,
      referrerPath: req.headers.get("referer") || null,
    });

    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
