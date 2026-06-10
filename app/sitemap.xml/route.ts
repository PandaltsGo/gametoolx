import { listGames, listTools } from "@/lib/data";
import { listResourcesByGame } from "@/lib/resources";
import { getOutboundStats } from "@/lib/analytics";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://gametoolx.top";
const LANGS = ["ja", "ko", "zh", "en"] as const;
const TOPIC_SLUGS = [
  "ending", "boss", "quest", "build", "item", "map",
  "system", "lore", "character", "mechanic", "walkthrough",
];

export const revalidate = 3600; // 1h

type Entry = {
  url: string;
  lastModified?: Date;
  changeFrequency?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
  alternates?: { languages: Record<string, string> };
};

function urlEntry(path: string, priority: number, freq: Entry["changeFrequency"]): Entry {
  const fullUrl = `${BASE_URL}${path}`;
  const alternates: Record<string, string> = {};
  const altPaths = path.match(/^\/([a-z]{2})(\/.*)$/);
  if (altPaths) {
    for (const l of LANGS) {
      alternates[l] = `${BASE_URL}/${l}${altPaths[2]}`;
    }
  }
  return {
    url: fullUrl,
    lastModified: new Date(),
    changeFrequency: freq,
    priority,
    alternates: { languages: alternates },
  };
}

function toXml(entry: Entry): string {
  const parts = [
    `    <url>`,
    `        <loc>${entry.url}</loc>`,
  ];
  if (entry.lastModified) {
    parts.push(`        <lastmod>${entry.lastModified.toISOString()}</lastmod>`);
  }
  if (entry.changeFrequency) {
    parts.push(`        <changefreq>${entry.changeFrequency}</changefreq>`);
  }
  if (entry.priority !== undefined) {
    parts.push(`        <priority>${entry.priority.toFixed(1)}</priority>`);
  }
  if (entry.alternates?.languages) {
    for (const [lang, url] of Object.entries(entry.alternates.languages)) {
      parts.push(`        <xhtml:link rel="alternate" hreflang="${lang}" href="${url}"/>`);
    }
  }
  parts.push(`    </url>`);
  return parts.join("\n");
}

export async function GET() {
  const games = await listGames();
  const tools = await listTools();
  void getOutboundStats; // warm analytics

  const entries: Entry[] = [];

  // Home pages
  for (const lang of LANGS) {
    entries.push(urlEntry(`/${lang}`, 1.0, "daily"));
  }

  // Game pages
  for (const g of games) {
    for (const lang of LANGS) {
      entries.push(urlEntry(`/${lang}/games/${g.slug}`, 0.8, "weekly"));
    }
  }

  // Tool pages
  for (const t of tools) {
    for (const lang of LANGS) {
      const priority = t.type === "system-checker" ? 0.9 : 0.7;
      entries.push(urlEntry(`/${lang}/tools/${t.slug}`, priority, "monthly"));
    }
  }

  // Topic pages (v2)
  for (const g of games) {
    let topicsForGame: string[] = [];
    try {
      const r = listResourcesByGame(g.slug, { limit: 1000 });
      const set = new Set<string>();
      r.forEach((x) => x.topicTags.forEach((t) => set.add(t)));
      topicsForGame = Array.from(set);
    } catch {}
    if (topicsForGame.length === 0) topicsForGame = TOPIC_SLUGS.slice(0, 5);
    for (const topic of topicsForGame) {
      for (const lang of LANGS) {
        entries.push(urlEntry(`/${lang}/games/${g.slug}/${topic}`, 0.7, "weekly"));
      }
    }
  }

  // Resource pages (v2) — only if DB ready
  try {
    for (const g of games) {
      const r = listResourcesByGame(g.slug, { limit: 1000 });
      for (const res of r) {
        for (const lang of LANGS) {
          entries.push(urlEntry(`/${lang}/resource/${res.id}`, 0.6, "monthly"));
        }
      }
    }
  } catch {
    // DB not ready yet — skip resource pages
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.map(toXml).join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
