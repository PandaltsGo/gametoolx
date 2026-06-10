/**
 * Resource Index DB API (v2)
 *
 * Replaces/extends the v1 tool-based architecture with a SourceSite + Resource
 * model focused on aggregated, multi-source, license-aware indexing.
 *
 * Compliance invariants (do not break):
 * 1. NO content_snapshot / full_text storage on Resource — only summaries + excerpts.
 * 2. DisplayPolicy cascades: resource.displayPolicyOverride > source.displayPolicy.
 * 3. full_translation is only allowed when source.licenseType is cc-by-sa | permission.
 * 4. Outbound link to source is ALWAYS shown — never rely on canonical to solve attribution.
 */
import { dbReady } from "./db";
import type { Resource, SourceSite, ResourceView, DisplayPolicy } from "./data";

// ===== SourceSite =====

const SOURCE_COLS = `
  id, domain, source_name as sourceName, source_type as sourceType, default_lang as defaultLang,
  robots_url as robotsUrl, tos_url as tosUrl, license_type as licenseType,
  crawl_allowed as crawlAllowed, crawl_interval_sec as crawlIntervalSec, daily_limit as dailyLimit,
  contact_email as contactEmail, last_reviewed_at as lastReviewedAt,
  display_policy as displayPolicy, takedown_status as takedownStatus, notes, created_at as createdAt
`;

function rowToSource(r: any): SourceSite {
  return {
    ...r,
    crawlAllowed: !!r.crawlAllowed,
  };
}

export function upsertSourceSite(s: SourceSite): void {
  const d = dbReady();
  d.prepare(`
    INSERT INTO source_sites (
      id, domain, source_name, source_type, default_lang,
      robots_url, tos_url, license_type, crawl_allowed, crawl_interval_sec, daily_limit,
      contact_email, last_reviewed_at, display_policy, takedown_status, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      domain = excluded.domain,
      source_name = excluded.source_name,
      source_type = excluded.source_type,
      default_lang = excluded.default_lang,
      robots_url = excluded.robots_url,
      tos_url = excluded.tos_url,
      license_type = excluded.license_type,
      crawl_allowed = excluded.crawl_allowed,
      crawl_interval_sec = excluded.crawl_interval_sec,
      daily_limit = excluded.daily_limit,
      contact_email = excluded.contact_email,
      last_reviewed_at = excluded.last_reviewed_at,
      display_policy = excluded.display_policy,
      takedown_status = excluded.takedown_status,
      notes = excluded.notes
  `).run(
    s.id, s.domain, s.sourceName, s.sourceType, s.defaultLang,
    s.robotsUrl || null, s.tosUrl || null, s.licenseType,
    s.crawlAllowed ? 1 : 0, s.crawlIntervalSec, s.dailyLimit,
    s.contactEmail || null, s.lastReviewedAt || null,
    s.displayPolicy, s.takedownStatus, s.notes || null, s.createdAt || Date.now()
  );
}

export function getSourceSite(id: string): SourceSite | null {
  const d = dbReady();
  const r = d.prepare(`SELECT ${SOURCE_COLS} FROM source_sites WHERE id = ?`).get(id) as any;
  return r ? rowToSource(r) : null;
}

export function listSourceSites(activeOnly = true): SourceSite[] {
  const d = dbReady();
  const where = activeOnly ? "WHERE takedown_status = 'active'" : "";
  const rows = d.prepare(`SELECT ${SOURCE_COLS} FROM source_sites ${where} ORDER BY source_name`).all() as any[];
  return rows.map(rowToSource);
}

// ===== Resource =====

type ResourceRow = {
  id: string;
  sourceId: string;
  gameSlug: string;
  sourceUrl: string;
  sourceLang: string;
  author: string | null;
  publishedAt: number | null;
  fetchedAt: number;
  topicTags: string;
  reliabilityScore: number;
  titleEn: string;
  titleJa: string | null;
  titleKo: string | null;
  titleZh: string | null;
  summaryEn: string;
  summaryJa: string | null;
  summaryKo: string | null;
  summaryZh: string | null;
  excerptEn: string | null;
  excerptJa: string | null;
  excerptKo: string | null;
  excerptZh: string | null;
  keyTimestamps: string | null;
  displayPolicyOverride: string | null;
  status: string;
  reviewedAt: number | null;
  reviewedBy: string | null;
  internalHash: string | null;
  internalCanonicalUrl: string | null;
  createdAt: number;
};

const RESOURCE_COLS = `
  r.id, r.source_id as sourceId, r.game_slug as gameSlug, r.source_url as sourceUrl,
  r.source_lang as sourceLang, r.author, r.published_at as publishedAt, r.fetched_at as fetchedAt,
  r.topic_tags as topicTags, r.reliability_score as reliabilityScore,
  r.title_en as titleEn, r.title_ja as titleJa, r.title_ko as titleKo, r.title_zh as titleZh,
  r.summary_en as summaryEn, r.summary_ja as summaryJa, r.summary_ko as summaryKo, r.summary_zh as summaryZh,
  r.excerpt_en as excerptEn, r.excerpt_ja as excerptJa, r.excerpt_ko as excerptKo, r.excerpt_zh as excerptZh,
  r.key_timestamps as keyTimestamps, r.display_policy_override as displayPolicyOverride,
  r.status, r.reviewed_at as reviewedAt, r.reviewed_by as reviewedBy,
  r.internal_hash as internalHash, r.internal_canonical_url as internalCanonicalUrl,
  r.created_at as createdAt
`;

function rowToResource(r: ResourceRow): Resource {
  return {
    id: r.id,
    sourceId: r.sourceId,
    gameSlug: r.gameSlug,
    sourceUrl: r.sourceUrl,
    sourceLang: r.sourceLang as "en" | "ja" | "ko" | "zh",
    author: r.author || undefined,
    publishedAt: r.publishedAt || undefined,
    fetchedAt: r.fetchedAt,
    topicTags: r.topicTags ? (JSON.parse(r.topicTags) as string[]) : [],
    reliabilityScore: r.reliabilityScore as 1 | 2 | 3 | 4 | 5,
    title: {
      en: r.titleEn,
      ja: r.titleJa || undefined,
      ko: r.titleKo || undefined,
      zh: r.titleZh || undefined,
    },
    summary: {
      en: r.summaryEn,
      ja: r.summaryJa || undefined,
      ko: r.summaryKo || undefined,
      zh: r.summaryZh || undefined,
    },
    excerpt: r.excerptEn || r.excerptJa || r.excerptKo || r.excerptZh ? {
      en: r.excerptEn || undefined,
      ja: r.excerptJa || undefined,
      ko: r.excerptKo || undefined,
      zh: r.excerptZh || undefined,
    } : undefined,
    keyTimestamps: r.keyTimestamps ? (JSON.parse(r.keyTimestamps) as Array<{ time: number; label: string }>) : undefined,
    displayPolicyOverride: r.displayPolicyOverride as DisplayPolicy | undefined,
    status: r.status as "active" | "pending_review" | "removed",
    reviewedAt: r.reviewedAt || undefined,
    reviewedBy: r.reviewedBy || undefined,
    internalHash: r.internalHash || undefined,
    internalCanonicalUrl: r.internalCanonicalUrl || undefined,
    createdAt: r.createdAt,
  };
}

/**
 * Resolve effective DisplayPolicy:
 * - resource.displayPolicyOverride wins
 * - otherwise source.displayPolicy
 * - if licenseType is restricted, force metadata_only (defense in depth)
 */
export function effectivePolicy(r: Resource, s: SourceSite): DisplayPolicy {
  if (s.licenseType === "restricted") return "metadata_only";
  return r.displayPolicyOverride || s.displayPolicy;
}

export function upsertResource(r: Resource): void {
  const d = dbReady();
  // Check if a resource with same (source_id, source_url) exists — treat that as a dedup hit
  // (same source, same page → update). Otherwise insert new.
  const existing = d.prepare(`
    SELECT id FROM resources
    WHERE source_id = ? AND source_url = ? AND id != ?
  `).get(r.sourceId, r.sourceUrl, r.id) as { id: string } | undefined;

  const targetId = existing ? existing.id : r.id;
  const isReplace = !!existing;

  d.prepare(`
    INSERT INTO resources (
      id, source_id, game_slug, source_url, source_lang, author, published_at, fetched_at,
      topic_tags, reliability_score,
      title_en, title_ja, title_ko, title_zh,
      summary_en, summary_ja, summary_ko, summary_zh,
      excerpt_en, excerpt_ja, excerpt_ko, excerpt_zh,
      key_timestamps, display_policy_override, status, reviewed_at, reviewed_by,
      internal_hash, internal_canonical_url, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      source_id = excluded.source_id,
      game_slug = excluded.game_slug,
      source_url = excluded.source_url,
      source_lang = excluded.source_lang,
      author = excluded.author,
      published_at = excluded.published_at,
      fetched_at = excluded.fetched_at,
      topic_tags = excluded.topic_tags,
      reliability_score = excluded.reliability_score,
      title_en = excluded.title_en, title_ja = excluded.title_ja, title_ko = excluded.title_ko, title_zh = excluded.title_zh,
      summary_en = excluded.summary_en, summary_ja = excluded.summary_ja, summary_ko = excluded.summary_ko, summary_zh = excluded.summary_zh,
      excerpt_en = excluded.excerpt_en, excerpt_ja = excluded.excerpt_ja, excerpt_ko = excluded.excerpt_ko, excerpt_zh = excluded.excerpt_zh,
      key_timestamps = excluded.key_timestamps,
      display_policy_override = excluded.display_policy_override,
      status = excluded.status,
      reviewed_at = excluded.reviewed_at,
      reviewed_by = excluded.reviewed_by,
      internal_hash = excluded.internal_hash,
      internal_canonical_url = excluded.internal_canonical_url
  `).run(
    targetId, r.sourceId, r.gameSlug, r.sourceUrl, r.sourceLang, r.author || null, r.publishedAt || null, r.fetchedAt,
    JSON.stringify(r.topicTags || []), r.reliabilityScore,
    r.title.en, r.title.ja || null, r.title.ko || null, r.title.zh || null,
    r.summary.en, r.summary.ja || null, r.summary.ko || null, r.summary.zh || null,
    r.excerpt?.en || null, r.excerpt?.ja || null, r.excerpt?.ko || null, r.excerpt?.zh || null,
    r.keyTimestamps ? JSON.stringify(r.keyTimestamps) : null,
    r.displayPolicyOverride || null, r.status || "active",
    r.reviewedAt || null, r.reviewedBy || null,
    r.internalHash || null, r.internalCanonicalUrl || null, r.createdAt || Date.now()
  );

  // Mirror topic tags to resource_topics for fast lookup
  if (r.topicTags && r.topicTags.length > 0) {
    const d2 = dbReady();
    const insert = d2.prepare(`
      INSERT OR REPLACE INTO resource_topics (resource_id, topic_slug, game_slug, rank_score, is_featured)
      VALUES (?, ?, ?, ?, 0)
    `);
    d2.transaction(() => {
      for (const topic of r.topicTags) {
        insert.run(targetId, topic, r.gameSlug, 0);
      }
    })();
  }
}

export function getResource(id: string): Resource | null {
  const d = dbReady();
  const r = d.prepare(`SELECT ${RESOURCE_COLS} FROM resources r WHERE r.id = ? AND r.status != 'removed'`).get(id) as ResourceRow | undefined;
  return r ? rowToResource(r) : null;
}

export function getResourceView(id: string): ResourceView | null {
  const r = getResource(id);
  if (!r) return null;
  const s = getSourceSite(r.sourceId);
  if (!s) return null;
  return { ...r, source: s, effectiveDisplayPolicy: effectivePolicy(r, s) };
}

export function listResourcesByGame(
  gameSlug: string,
  opts: { topic?: string; lang?: string; limit?: number; status?: string } = {}
): ResourceView[] {
  const d = dbReady();
  const limit = opts.limit || 50;
  const status = opts.status || "active";

  let sql = `
    SELECT ${RESOURCE_COLS}
    FROM resources r
    INNER JOIN source_sites s ON s.id = r.source_id
    WHERE r.game_slug = ? AND r.status = ? AND s.takedown_status = 'active'
  `;
  const params: any[] = [gameSlug, status];

  if (opts.topic) {
    sql += ` AND EXISTS (SELECT 1 FROM resource_topics t WHERE t.resource_id = r.id AND t.topic_slug = ?)`;
    params.push(opts.topic);
  }
  if (opts.lang) {
    sql += ` AND r.source_lang = ?`;
    params.push(opts.lang);
  }

  sql += ` ORDER BY r.reliability_score DESC, r.fetched_at DESC LIMIT ?`;
  params.push(limit);

  const rows = d.prepare(sql).all(...params) as any[];

  // Source join (small set; cache per sourceId)
  const sourceCache = new Map<string, SourceSite>();
  return rows.map((r) => {
    const resource = rowToResource(r);
    let source = sourceCache.get(resource.sourceId);
    if (!source) {
      source = getSourceSite(resource.sourceId)!;
      sourceCache.set(resource.sourceId, source);
    }
    return {
      ...resource,
      source,
      effectiveDisplayPolicy: effectivePolicy(resource, source),
    };
  });
}

/** Get all distinct topics for a game (for navigation). */
export function listTopicsByGame(gameSlug: string): { topic: string; count: number }[] {
  const d = dbReady();
  return d.prepare(`
    SELECT t.topic_slug as topic, COUNT(*) as count
    FROM resource_topics t
    JOIN resources r ON r.id = t.resource_id
    WHERE t.game_slug = ? AND r.status = 'active'
    GROUP BY t.topic_slug
    ORDER BY count DESC
  `).all(gameSlug) as { topic: string; count: number }[];
}

/** Stats for /admin (or future dashboard). */
export function getResourceStats(): { sources: number; resources: number; byGame: { game: string; count: number }[]; byLang: { lang: string; count: number }[] } {
  const d = dbReady();
  const sources = (d.prepare("SELECT COUNT(*) as c FROM source_sites WHERE takedown_status = 'active'").get() as { c: number }).c;
  const resources = (d.prepare("SELECT COUNT(*) as c FROM resources WHERE status = 'active'").get() as { c: number }).c;
  const byGame = d
    .prepare(`SELECT game_slug as game, COUNT(*) as count FROM resources WHERE status = 'active' GROUP BY game_slug ORDER BY count DESC`)
    .all() as { game: string; count: number }[];
  const byLang = d
    .prepare(`SELECT source_lang as lang, COUNT(*) as count FROM resources WHERE status = 'active' GROUP BY source_lang ORDER BY count DESC`)
    .all() as { lang: string; count: number }[];
  return { sources, resources, byGame, byLang };
}
