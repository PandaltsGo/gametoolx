/**
 * Outbound click + translate click tracker
 *
 * Fire-and-forget; never throws. Best-effort insert with try/catch wrapper.
 * Single-row insert (no transaction overhead, ~1µs per call).
 */
import { dbReady } from "./db";

function extractDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "(invalid)";
  }
}

export function logOutboundClick(opts: {
  resourceId?: string | null;
  sourceId?: string | null;
  targetUrl: string;
  sessionId?: string | null;
  lang?: string | null;
  referrerPath?: string | null;
  userAgent?: string | null;
}): void {
  try {
    const d = dbReady();
    d.prepare(`
      INSERT INTO outbound_clicks (
        resource_id, source_id, target_url, target_domain, session_id, lang, referrer_path, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      opts.resourceId || null,
      opts.sourceId || null,
      opts.targetUrl.slice(0, 1024),        // 防御性截断
      extractDomain(opts.targetUrl),
      opts.sessionId || null,
      opts.lang || null,
      opts.referrerPath?.slice(0, 512) || null,
      opts.userAgent?.slice(0, 512) || null,
      Date.now()
    );
  } catch {
    // swallow — analytics must never break the page
  }
}

export function logTranslateClick(opts: {
  resourceId: string;
  targetLang: string;
  sessionId?: string | null;
  lang?: string | null;
  referrerPath?: string | null;
}): void {
  try {
    const d = dbReady();
    d.prepare(`
      INSERT INTO translate_clicks (
        resource_id, target_lang, session_id, lang, referrer_path, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      opts.resourceId,
      opts.targetLang,
      opts.sessionId || null,
      opts.lang || null,
      opts.referrerPath?.slice(0, 512) || null,
      Date.now()
    );
  } catch {
    // swallow
  }
}

// ===== Stats (for /admin or future dashboard) =====

export type OutboundStats = {
  total: number;
  last24h: number;
  byDomain: { domain: string; clicks: number }[];
  topResources: { resourceId: string; clicks: number }[];
  translateClicks: number;
};

export function getOutboundStats(sinceMs?: number): OutboundStats {
  const d = dbReady();
  const since = sinceMs || 0;
  const total = (d.prepare(`SELECT COUNT(*) as c FROM outbound_clicks WHERE created_at >= ?`).get(since) as { c: number }).c;
  const last24h = (d.prepare(`SELECT COUNT(*) as c FROM outbound_clicks WHERE created_at >= ?`).get(Date.now() - 86_400_000) as { c: number }).c;
  const byDomain = d
    .prepare(`SELECT target_domain as domain, COUNT(*) as clicks FROM outbound_clicks WHERE created_at >= ? GROUP BY target_domain ORDER BY clicks DESC LIMIT 20`)
    .all(since) as { domain: string; clicks: number }[];
  const topResources = d
    .prepare(`SELECT resource_id as resourceId, COUNT(*) as clicks FROM outbound_clicks WHERE created_at >= ? AND resource_id IS NOT NULL GROUP BY resource_id ORDER BY clicks DESC LIMIT 20`)
    .all(since) as { resourceId: string; clicks: number }[];
  const translateClicks = (d.prepare(`SELECT COUNT(*) as c FROM translate_clicks WHERE created_at >= ?`).get(since) as { c: number }).c;
  return { total, last24h, byDomain, topResources, translateClicks };
}
