/**
 * Fandom MediaWiki API crawler (dry-run scaffold).
 *
 * Per 需求-v2-资源索引.md §14:
 * - 不用 robots.txt crawl-delay
 * - 用 per-domain token bucket + circuit breaker
 * - 标识自己是 GameToolX-Bot
 *
 * Usage:
 *   pnpm tsx scripts/crawl-fandom.ts --source fandom-megamitensei --dry-run --limit 5
 *
 * 这个是骨架 — 不入生产，只在本地 dry-run 验证 MediaWiki API 解析逻辑。
 */
import { tryConsumeToken, canRequest, recordSuccess, recordFailure } from "../lib/breaker";
import { getSourceSite } from "../lib/resources";

const UA = "GameToolX-Bot/1.0 (+https://gametoolx.top/about)";

type PageSummary = {
  pageid: number;
  title: string;
  extract?: string;
  fullurl: string;
  lastrevid: number;
  touched: string;
};

type MediaWikiResponse = {
  query?: { pages?: Record<string, PageSummary> };
  error?: { code: string; info: string };
};

async function fetchPageSummary(
  apiBase: string,
  title: string,
  signal?: AbortSignal
): Promise<PageSummary | null> {
  const url = new URL(`${apiBase}/api.php`);
  url.searchParams.set("action", "query");
  url.searchParams.set("prop", "extracts|info");
  url.searchParams.set("exintro", "1");
  url.searchParams.set("explaintext", "1");
  url.searchParams.set("inprop", "url");
  url.searchParams.set("titles", title);
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("redirects", "1");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal,
  });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} ${res.statusText}`);
    (err as any).status = res.status;
    throw err;
  }
  const data = (await res.json()) as MediaWikiResponse;
  if (data.error) throw new Error(`MW error: ${data.error.code} ${data.error.info}`);
  const pages = data.query?.pages || {};
  const list = Object.values(pages);
  return list[0] || null;
}

async function listGameCategory(
  apiBase: string,
  categoryTitle: string,
  limit = 50,
  signal?: AbortSignal
): Promise<string[]> {
  const url = new URL(`${apiBase}/api.php`);
  url.searchParams.set("action", "query");
  url.searchParams.set("list", "categorymembers");
  url.searchParams.set("cmtitle", categoryTitle);
  url.searchParams.set("cmlimit", String(limit));
  url.searchParams.set("cmtype", "page");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal,
  });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} ${res.statusText}`);
    (err as any).status = res.status;
    throw err;
  }
  const data = (await res.json()) as any;
  if (data.error) throw new Error(`MW error: ${data.error.code} ${data.error.info}`);
  const members = (data.query?.categorymembers || []) as Array<{ title: string }>;
  return members.map((m) => m.title);
}

export async function crawlFandomSource(
  sourceId: string,
  opts: { categoryTitle?: string; limit?: number; dryRun?: boolean } = {}
): Promise<{ ok: number; skipped: number; failed: number; samples: PageSummary[] }> {
  const source = getSourceSite(sourceId);
  if (!source) throw new Error(`Unknown source: ${sourceId}`);
  if (source.sourceType !== "wiki") {
    throw new Error(`Not a wiki source: ${sourceId} (${source.sourceType})`);
  }

  const apiBase = `https://${source.domain}`;
  const category = opts.categoryTitle || "Category:Gameplay";
  const limit = opts.limit || 10;
  const dryRun = opts.dryRun !== false;

  console.log(`[crawl] source=${sourceId} api=${apiBase} category=${category} limit=${limit} dryRun=${dryRun}`);

  // Circuit breaker check
  const cb = canRequest(sourceId);
  if (!cb.allowed) {
    console.log(`[crawl] circuit ${cb.state}: ${cb.reason || "open"} — skipping`);
    return { ok: 0, skipped: 1, failed: 0, samples: [] };
  }

  // Token bucket
  const allowed = tryConsumeToken(sourceId, 5, 1 / source.crawlIntervalSec);
  if (!allowed) {
    console.log(`[crawl] token bucket empty (rate=${1 / source.crawlIntervalSec}/s) — skipping`);
    return { ok: 0, skipped: 1, failed: 0, samples: [] };
  }

  const stats = { ok: 0, skipped: 0, failed: 0, samples: [] as PageSummary[] };

  try {
    // 1. List pages in category
    const titles = await listGameCategory(apiBase, category, limit);
    console.log(`[crawl] found ${titles.length} titles`);

    // 2. Fetch each (one at a time, respecting bucket)
    for (const title of titles) {
      // Re-check circuit + token
      const cb2 = canRequest(sourceId);
      if (!cb2.allowed) {
        console.log(`[crawl] circuit open mid-batch at "${title}" — stopping`);
        stats.skipped++;
        break;
      }
      const tok = tryConsumeToken(sourceId, 5, 1 / source.crawlIntervalSec);
      if (!tok) {
        console.log(`[crawl] bucket empty mid-batch — stopping`);
        stats.skipped++;
        break;
      }

      try {
        const page = await fetchPageSummary(apiBase, title);
        if (page) {
          recordSuccess(sourceId);
          stats.ok++;
          stats.samples.push(page);
          if (dryRun) {
            console.log(`[crawl][dry-run]   ${page.pageid} ${page.title} → ${page.fullurl}`);
            console.log(`[crawl][dry-run]   extract: ${(page.extract || "").slice(0, 120)}…`);
          } else {
            // TODO: insert into resources table (P1b real path)
            console.log(`[crawl] would insert: ${page.title} (${page.pageid})`);
          }
        } else {
          stats.skipped++;
        }
      } catch (e: any) {
        recordFailure(sourceId, e.status || 0, e.message);
        stats.failed++;
        console.log(`[crawl] failed on "${title}": ${e.message}`);
      }
    }
  } catch (e: any) {
    recordFailure(sourceId, e.status || 0, e.message);
    stats.failed++;
    console.log(`[crawl] fatal: ${e.message}`);
  }

  console.log(`[crawl] done: ok=${stats.ok} skipped=${stats.skipped} failed=${stats.failed}`);
  return stats;
}

// CLI entry
if (process.argv[1] && process.argv[1].endsWith("crawl-fandom.ts")) {
  const args = process.argv.slice(2);
  const getArg = (k: string, d?: string) => {
    const i = args.indexOf(k);
    return i >= 0 ? args[i + 1] : d;
  };
  const sourceId = getArg("--source", "fandom-megamitensei");
  const limit = parseInt(getArg("--limit", "5")!, 10);
  const category = getArg("--category", "Category:Shin_Megami_Tensei_V_Demons");
  const dryRun = !args.includes("--commit");

  crawlFandomSource(sourceId, { categoryTitle: category, limit, dryRun })
    .then((r) => {
      console.log("\n=== summary ===");
      console.log(JSON.stringify(r, null, 2).slice(0, 2000));
      process.exit(0);
    })
    .catch((e) => {
      console.error("crawl failed:", e);
      process.exit(1);
    });
}
