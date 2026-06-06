/**
 * Session helpers — server side.
 * Reads/writes the anonymous session ID cookie.
 */
import { cookies } from "next/headers";
import { newSessionId, upsertSession, type Progress, type SystemCheck } from "./db";

const COOKIE_NAME = "gtx_sid";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export async function getOrCreateSessionId(): Promise<string> {
  const c = await cookies();
  let sid = c.get(COOKIE_NAME)?.value;
  if (!sid) {
    sid = newSessionId();
    c.set(COOKIE_NAME, sid, {
      maxAge: COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    // We don't have user agent / lang here, will be set on next request
    upsertSession(sid);
  }
  return sid;
}

export async function getSessionId(): Promise<string | null> {
  const c = await cookies();
  return c.get(COOKIE_NAME)?.value || null;
}

export async function touchSession(lang: string): Promise<void> {
  const sid = await getSessionId();
  if (sid) {
    const { headers } = await import("next/headers");
    const h = await headers();
    const ua = h.get("user-agent") || undefined;
    upsertSession(sid, ua, lang);
  }
}

export { type Progress, type SystemCheck };
