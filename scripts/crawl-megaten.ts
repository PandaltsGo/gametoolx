/**
 * MegaTen Wiki crawler via Fandom MediaWiki API.
 * Use: npx tsx scripts/crawl-megaten.ts
 */
import * as cheerio from "cheerio";
import { createHash } from "node:crypto";
import {
  upsertCrawledSource,
  upsertCrawledDocument,
  insertCrawledChunks,
  startCrawlJob,
  finishCrawlJob,
  updateSourceCrawledAt,
} from "../lib/db";

const SOURCE_ID = "megaten-wiki";
const GAME_SLUG = "shin-megami-tensei-5-vengeance";
const API = "https://megamitensei.fandom.com/api.php";
const UA = "GameToolX-Crawler/1.0 (+https://gametoolx.cc) SMT5V guide indexing";

const PAGES_TO_CRAWL: { page: string; contentType: string; title?: string }[] = [
  // Game overview + mechanics
  { page: "Shin_Megami_Tensei_V:_Vengeance", contentType: "guide" },
  { page: "Shin_Megami_Tensei_V", contentType: "guide" },
  { page: "Press_Turn", contentType: "mechanic" },
  { page: "Magatsuhi", contentType: "mechanic" },
  { page: "Da%27at_(Shin_Megami_Tensei_V)", contentType: "world" },
  { page: "Nahobino_(character)", contentType: "character" },
  { page: "Masakado", contentType: "boss" },

  // ★ Big "List of" pages — Fandom-specific bulk content
  { page: "List_of_Shin_Megami_Tensei_V:_Vengeance_Demons", contentType: "demon_list" },
  { page: "List_of_Shin_Megami_Tensei_V_Demons", contentType: "demon_list" },
  { page: "List_of_Shin_Megami_Tensei_V:_Vengeance_Quests", contentType: "quest_list" },
  { page: "List_of_Shin_Megami_Tensei_V_Quests", contentType: "quest_list" },
  { page: "List_of_Shin_Megami_Tensei_V_Bosses", contentType: "boss_list" },
  { page: "List_of_Shin_Megami_Tensei_V_Items", contentType: "item_list" },
  { page: "List_of_Shin_Megami_Tensei_V_Characters", contentType: "character_list" },
  { page: "List_of_Shin_Megami_Tensei_V:_Vengeance_Trophies", contentType: "trophy_list" },
  { page: "Shin_Megami_Tensei_V:_Vengeance_Daily_Demon", contentType: "guide" },
  { page: "Shin_Megami_Tensei_V:_Vengeance_Soundtrack", contentType: "media" },
];

async function fetchPage(page: string): Promise<{ html: string; page: string; title: string } | null> {
  const url = `${API}?action=parse&page=${encodeURIComponent(page)}&format=json&prop=text&redirects=1`;
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!r.ok) {
      console.warn(`  HTTP ${r.status} for ${page}`);
      return null;
    }
    const data = (await r.json()) as { parse?: { title: string; text: { "*": string } } };
    if (!data.parse) {
      console.warn(`  No parse result for ${page}`);
      return null;
    }
    return { html: data.parse.text["*"], page, title: data.parse.title };
  } catch (e) {
    console.warn(`  fetch failed: ${page} — ${(e as Error).message}`);
    return null;
  }
}

function extractSections(html: string, fallbackTitle: string): { title: string; content: string }[] {
  const $ = cheerio.load(html);
  // Remove noise but keep content-bearing elements
  $("script, style, aside.portable-infobox, .reference, .reference-list, .navbox, .metadata, .noprint, sup.reference, .mw-editsection, .reference-list").remove();

  // Find content root
  const contentRoot = $(".mw-parser-output, .mw-body-content, article, body").first();
  if (contentRoot.length === 0) return [];

  // Title from first h1/h2/h3
  let bodyTitle = "";
  contentRoot.find("h1, h2, h3").each((_, el) => {
    if (!bodyTitle) {
      const t = $(el).text().trim();
      if (t && t.length < 200 && !t.startsWith("Contents")) bodyTitle = t;
    }
  });

  const sections: { title: string; content: string }[] = [];
  let current = { title: bodyTitle || fallbackTitle, content: "" };

  function flush() {
    if (current.content.trim().length > 0) sections.push(current);
    current = { title: "", content: "" };
  }

  // Process ALL descendants, in document order
  contentRoot.find("*").each((_, el) => {
    if (!el || !el.tagName) return;
    const tag = el.tagName.toLowerCase();
    const $el = $(el);
    const txt = $el.text().replace(/\s+/g, " ").trim();
    if (!txt) return;

    if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4") {
      const h = $el.text().trim();
      if (h && h.length < 200) {
        flush();
        current.title = h;
      }
    } else if (tag === "p" && txt.length > 20) {
      current.content += txt + "\n\n";
    } else if ((tag === "ul" || tag === "ol") && $el.children("li").length > 0) {
      // Only the outer list (skip nested ones which are children of <li>)
      const items: string[] = [];
      $el.children("li").each((_, li) => {
        const t = $(li).clone().children("ul, ol").remove().end().text().trim();
        if (t && t.length > 1) items.push(`- ${t}`);
      });
      if (items.length) current.content += items.join("\n") + "\n\n";
    } else if (tag === "table" && $el.find("tr").length > 0) {
      // Convert table to rows, but only direct <tr> children (not nested in td)
      const rows: string[] = [];
      $el.find("> tbody > tr, > tr").each((_, tr) => {
        const cells: string[] = [];
        $(tr).find("> th, > td").each((_, td) => {
          const t = $(td).text().trim().replace(/\s+/g, " ");
          if (t) cells.push(t);
        });
        if (cells.length) rows.push("| " + cells.join(" | ") + " |");
      });
      if (rows.length) current.content += rows.join("\n") + "\n\n";
    } else if (tag === "dl") {
      $el.find("dt").each((_, dt) => {
        const term = $(dt).text().trim();
        const dd = $(dt).next("dd").text().trim();
        if (term && dd) current.content += `${term}: ${dd}\n\n`;
      });
    }
  });

  flush();
  return sections.filter((s) => s.content.trim().length > 0);
}

function chunkText(text: string, target = 480, max = 700): string[] {
  const paragraphs = text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let cur = "";
  for (const p of paragraphs) {
    if (p.length > max) {
      if (cur) {
        chunks.push(cur);
        cur = "";
      }
      for (let i = 0; i < p.length; i += target) chunks.push(p.slice(i, i + target));
      continue;
    }
    if (cur.length + p.length + 2 > target && cur) {
      chunks.push(cur);
      cur = p;
    } else {
      cur = cur ? cur + "\n\n" + p : p;
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

function chunkBySection(sections: { title: string; content: string }[]): { sectionTitle: string; content: string }[] {
  const out: { sectionTitle: string; content: string }[] = [];
  for (const s of sections) {
    const sub = chunkText(s.content);
    if (sub.length === 0) continue;
    if (sub.length === 1) {
      out.push({ sectionTitle: s.title, content: sub[0] });
    } else {
      for (let i = 0; i < sub.length; i++) {
        out.push({ sectionTitle: `${s.title} (${i + 1}/${sub.length})`, content: sub[i] });
      }
    }
  }
  return out;
}

function approxTokenCount(s: string): number {
  return Math.ceil(s.length / 1.5);
}

async function main() {
  const startedAt = Date.now();

  upsertCrawledSource({
    id: SOURCE_ID,
    domain: "megamitensei.fandom.com",
    name: "MegaTen Wiki (Fandom)",
    urlPattern: "https://megamitensei.fandom.com/wiki/*",
    language: "en",
    contentType: "wiki",
    enabled: true,
    createdAt: startedAt,
  });

  const jobId = startCrawlJob(SOURCE_ID);
  console.log(`[crawl] Job ${jobId} started for ${SOURCE_ID}`);

  let pagesCrawled = 0;
  let pagesUpdated = 0;
  let pagesSkipped = 0;
  let totalChunks = 0;

  for (const p of PAGES_TO_CRAWL) {
    const fetched = await fetchPage(p.page);
    if (!fetched) continue;
    pagesCrawled++;

    const sections = extractSections(fetched.html, p.title || fetched.title);
    if (sections.length === 0 || !sections.some((s) => s.content.length > 50)) {
      console.warn(`  [skip] no content extracted from ${p.page}`);
      continue;
    }

    const allText = sections.map((s) => `${s.title}\n${s.content}`).join("\n\n");
    const bodyText = allText.replace(/\s+/g, " ").trim();
    const bodyMd = sections
      .map((s) => (s.title ? `## ${s.title}\n\n${s.content}` : s.content))
      .join("\n\n")
      .trim();
    const contentHash = createHash("sha256").update(bodyText).digest("hex").slice(0, 16);

    const result = upsertCrawledDocument({
      sourceId: SOURCE_ID,
      gameSlug: GAME_SLUG,
      url: `https://megamitensei.fandom.com/wiki/${p.page}`,
      title: p.title || fetched.title,
      bodyMd,
      bodyText,
      contentType: p.contentType,
      language: "en",
      sourceLanguage: "en",
      metaJson: JSON.stringify({ sourceTitle: fetched.title }),
      contentHash,
      fetchedAt: Date.now(),
    });

    if (!result.updated) {
      pagesSkipped++;
      console.log(`  · unchanged ${p.page}`);
    } else {
      pagesUpdated++;
      const chunked = chunkBySection(sections);
      insertCrawledChunks(
        chunked.map((c, i) => ({
          documentId: result.id,
          chunkIndex: i,
          sectionTitle: c.sectionTitle,
          content: c.content,
          tokenCount: approxTokenCount(c.content),
        })),
      );
      totalChunks += chunked.length;
      console.log(`  +1 ${p.page} (${chunked.length} chunks, ${bodyText.length} chars)`);
    }

    // Politeness
    await new Promise((r) => setTimeout(r, 200));
  }

  updateSourceCrawledAt(SOURCE_ID);
  finishCrawlJob(jobId, {
    finishedAt: Date.now(),
    status: "success",
    pagesCrawled,
    pagesUpdated,
    pagesSkipped,
    statsJson: JSON.stringify({ totalChunks, total: PAGES_TO_CRAWL.length }),
  });

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `\n[crawl] ✅ Done in ${elapsed}s. pages=${pagesCrawled} updated=${pagesUpdated} skipped=${pagesSkipped} chunks=${totalChunks}`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error("[crawl] Fatal:", e);
  process.exit(1);
});
