/**
 * /api/track/outbound
 * Fire-and-forget tracker for "View Original" clicks.
 * Returns 204 No Content.
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { logOutboundClick } from "@/lib/analytics";
import { newSessionId, upsertSession } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const COOKIE_NAME = "gtx_sid";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const targetUrl = typeof body.targetUrl === "string" ? body.targetUrl : "";
    if (!targetUrl || !/^https?:\/\//.test(targetUrl)) {
      return NextResponse.json({ ok: false, error: "invalid targetUrl" }, { status: 400 });
    }

    const cookieStore = await cookies();
    let sid = cookieStore.get(COOKIE_NAME)?.value;
    if (!sid) {
      sid = newSessionId();
      cookieStore.set(COOKIE_NAME, sid, {
        maxAge: 60 * 60 * 24 * 365,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
      upsertSession(sid, req.headers.get("user-agent") || undefined, body.lang);
    }

    logOutboundClick({
      resourceId: typeof body.resourceId === "string" ? body.resourceId : null,
      sourceId: typeof body.sourceId === "string" ? body.sourceId : null,
      targetUrl,
      sessionId: sid,
      lang: typeof body.lang === "string" ? body.lang : null,
      referrerPath: req.headers.get("referer") || null,
      userAgent: req.headers.get("user-agent") || null,
    });

    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
