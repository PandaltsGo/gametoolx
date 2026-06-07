/**
 * Translate crawled chunks to target languages using LLM.
 *
 * Env vars (any one OpenAI-compatible endpoint works):
 *   LLM_BASE_URL   e.g. https://api.minimaxi.com/v1
 *   LLM_API_KEY    your token-plan key
 *   LLM_MODEL      e.g. MiniMax-Text-01
 *
 * Run:
 *   npx tsx scripts/translate.ts                  # translate all to all target langs
 *   npx tsx scripts/translate.ts --lang ja        # only one target lang
 *   npx tsx scripts/translate.ts --lang ja zh     # multiple
 *   npx tsx scripts/translate.ts --limit 50       # batch size per run
 *   npx tsx scripts/translate.ts --game shin-megami-tensei-5-vengeance
 */
import {
  startCrawlJob,
  upsertCrawledDocument,
} from "../lib/db";
import Database from "better-sqlite3";
import path from "node:path";

const TARGET_LANGS = ["ja", "ko", "zh"] as const;
type Lang = (typeof TARGET_LANGS)[number];

const LANG_NAME: Record<Lang, string> = {
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese (Simplified)",
};

interface TranslateJob {
  id?: number;
  started_at: number;
  finished_at?: number;
  target_languages: string;
  chunks_processed: number;
  chunks_skipped: number;
  chunks_failed: number;
  model?: string;
  cost_tokens: number;
  status: "running" | "success" | "failed" | "partial";
  error_message?: string;
}

const LANG_MAP: Record<string, string> = {
  en: "English",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
};

function getRawDb(): Database.Database {
  const db = new Database(path.join(process.cwd(), "data", "gametoolx.db"));
  return db;
}

function getConfig() {
  return {
    baseUrl: process.env.LLM_BASE_URL || "https://api.openai.com/v1",
    apiKey: process.env.LLM_API_KEY || "",
    model: process.env.LLM_MODEL || "gpt-4o-mini",
  };
}

async function translate(text: string, targetLang: Lang, gameSlug: string, sectionTitle?: string): Promise<string | null> {
  const { baseUrl, apiKey, model } = getConfig();
  if (!apiKey) {
    console.warn("  LLM_API_KEY not set; skipping (configure in .env.local)");
    return null;
  }
  const systemPrompt = `You are a professional game-guide translator. Translate the content inside <content> tags to ${LANG_NAME[targetLang]}.

STRICT RULES:
1. Translate ONLY the text inside <content>...</content>. Do NOT translate, repeat, or echo the instructions.
2. Game terminology (demon/skill/item names) stays in their canonical form but written in ${LANG_NAME[targetLang]} script.
3. Keep markdown / table formatting intact.
4. Keep proper nouns (YHVH, Masakado, Da'at) untranslated.
5. Output ONLY the translation. No preamble, no explanation, no labels.`;
  const userPrompt = `Game: ${gameSlug}${sectionTitle ? `\nSection: ${sectionTitle}` : ""}

<content>
${text}
</content>

Translate the content above. Reply with the translation only.`;

  try {
    const r = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 1500,
      }),
    });
    if (!r.ok) {
      console.warn(`  LLM API error: ${r.status} ${r.statusText}`);
      return null;
    }
    const data = (await r.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    let out = data.choices?.[0]?.message?.content?.trim() || null;
    if (!out) return null;
    // Strip any leaked <content> tags (defensive — model shouldn't add them, but just in case)
    out = out.replace(/<\/?content>/g, "").trim();
    // Detect the "model echoed the prompt" anti-pattern: starts with a label that
    // looks like "Game:" / "ゲーム：" / "게임：" / "Translation:" — these are what
    // the model produces when it translates the instructions. Plain "ゲーム" or
    // "게임" (no colon) is normal content and must NOT be rejected.
    if (/^(ゲーム：|ゲーム:|Game：|Game:|게임：|게임:|\s*Translation\s*:|번역\s*:|번역:)/i.test(out)) {
      console.warn(`  [guard] rejected output that looks like echoed instructions (len=${out.length})`);
      console.warn(`  [guard-preview] first 400 chars: ${out.slice(0, 400).replace(/\n/g, "\\n")}`);
      return null;
    }
    return out;
  } catch (e) {
    console.warn(`  LLM call failed: ${(e as Error).message}`);
    return null;
  }
}

interface ChunkRow {
  id: number;
  document_id: number;
  section_title: string | null;
  content: string;
  source_language: string | null;
  game_slug: string | null;
  translations: string | null;
  document_title: string;
}

function listChunksNeedingTranslation(db: Database.Database, targetLang: Lang, gameSlug?: string, limit: number = 50): ChunkRow[] {
  const params: any[] = [`"${targetLang}":`];
  let gameFilter = "";
  if (gameSlug) {
    gameFilter = "AND d.game_slug = ?";
    params.push(gameSlug);
  }
  params.push(limit);

  return db
    .prepare(`
      SELECT
        c.id, c.document_id, c.section_title, c.content, c.translations,
        d.title as document_title, d.source_language, d.game_slug
      FROM crawled_chunks c
      JOIN crawled_documents d ON d.id = c.document_id
      WHERE
        c.content IS NOT NULL AND length(c.content) > 20
        AND (d.source_language IS NULL OR d.source_language != ?)
        AND (c.translations IS NULL OR c.translations = '{}'
             OR instr(c.translations, ?) = 0)
        ${gameFilter}
      ORDER BY c.id
      LIMIT ?
    `)
    .all([targetLang, ...params]) as ChunkRow[];
}

function getTranslationsMap(translations: string | null): Record<string, string> {
  if (!translations) return {};
  try {
    return JSON.parse(translations) as Record<string, string>;
  } catch {
    return {};
  }
}

function setChunkTranslationsBatch(db: Database.Database, updates: { id: number; translations: Record<string, string> }[]): void {
  if (updates.length === 0) return;
  // Use SQLite json_set for safe per-key merge (avoids race when two processes
  // translate different langs of the same chunk concurrently).
  // Each update row is a single {id, translations:{lang:text}} — we issue one UPDATE
  // per (chunk, lang) so concurrent writers don't clobber each other.
  const upsertOne = db.prepare(`
    UPDATE crawled_chunks
    SET translations = json_set(COALESCE(NULLIF(translations, ''), '{}'), '$.' || ?, ?),
        translated_at = ?
    WHERE id = ?
  `);
  const tx = db.transaction((rows: typeof updates) => {
    const now = Date.now();
    for (const u of rows) {
      for (const [lang, text] of Object.entries(u.translations)) {
        upsertOne.run(lang, text, now, u.id);
      }
    }
  });
  tx(updates);
}

function startTranslateJob(db: Database.Database, targetLangs: Lang[]): number {
  const result = db
    .prepare(`
      INSERT INTO translate_jobs (started_at, target_languages, status, chunks_processed, chunks_skipped, chunks_failed, cost_tokens)
      VALUES (?, ?, 'running', 0, 0, 0, 0)
    `)
    .run(Date.now(), JSON.stringify(targetLangs));
  return Number(result.lastInsertRowid);
}

function finishTranslateJob(db: Database.Database, id: number, job: Partial<TranslateJob>): void {
  db.prepare(`
    UPDATE translate_jobs
    SET finished_at = ?, status = ?, chunks_processed = ?, chunks_skipped = ?, chunks_failed = ?, model = ?, cost_tokens = ?, error_message = ?
    WHERE id = ?
  `).run(
    job.finished_at || Date.now(),
    job.status || "success",
    job.chunks_processed || 0,
    job.chunks_skipped || 0,
    job.chunks_failed || 0,
    job.model || null,
    job.cost_tokens || 0,
    job.error_message || null,
    id,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const args = process.argv.slice(2);
  const langArgIdx = args.indexOf("--lang");
  const langs: Lang[] = langArgIdx >= 0
    ? (args[langArgIdx + 1].split(/\s+/).filter((x) => TARGET_LANGS.includes(x as Lang)) as Lang[])
    : [...TARGET_LANGS];
  const limitArgIdx = args.indexOf("--limit");
  const limit = limitArgIdx >= 0 ? parseInt(args[limitArgIdx + 1], 10) : 50;
  const gameArgIdx = args.indexOf("--game");
  const gameSlug = gameArgIdx >= 0 ? args[gameArgIdx + 1] : undefined;

  if (langs.length === 0) {
    console.error("No valid --lang values. Use --lang ja ko zh");
    process.exit(1);
  }

  console.log(`[translate] langs=${langs.join(",")} game=${gameSlug || "(all)"} limit=${limit}`);
  const db = getRawDb();
  const cfg = getConfig();
  if (!cfg.apiKey) {
    console.error("✗ LLM_API_KEY not set. Set it in .env.local or shell before running.");
    process.exit(1);
  }
  console.log(`[translate] model=${cfg.model} baseUrl=${cfg.baseUrl}`);

  const jobId = startTranslateJob(db, langs);
  let totalProcessed = 0;
  let totalSkipped = 0;
  let totalFailed = 0;
  let totalCost = 0;
  const startedAt = Date.now();

  for (const targetLang of langs) {
    console.log(`\n[translate] → ${LANG_NAME[targetLang]} (${targetLang})`);

    let processed = 0;
    let skipped = 0;
    let failed = 0;
    let offset = 0;
    const batchSize = Math.max(5, Math.floor(limit / langs.length));

    while (processed < batchSize) {
      const remaining = batchSize - processed;
      const chunks = listChunksNeedingTranslation(db, targetLang, gameSlug, remaining);
      if (chunks.length === 0) break;

      for (const c of chunks) {
        const existing = getTranslationsMap(c.translations);
        if (existing[targetLang]) {
          skipped++;
          continue;
        }

        const t = await translate(c.content, targetLang, c.game_slug || "", c.section_title || undefined);
        if (!t) {
          failed++;
          await sleep(500);
          continue;
        }
        existing[targetLang] = t;
        setChunkTranslationsBatch(db, [{ id: c.id, translations: existing }]);
        processed++;

        // 200ms polite pause between LLM calls
        await sleep(200);
      }

      offset += chunks.length;
      if (chunks.length < remaining) break;
    }

    console.log(`  → ${targetLang}: processed=${processed} skipped=${skipped} failed=${failed}`);
    totalProcessed += processed;
    totalSkipped += skipped;
    totalFailed += failed;
  }

  finishTranslateJob(db, jobId, {
    finished_at: Date.now(),
    status: totalFailed > 0 && totalProcessed > 0 ? "partial" : "success",
    chunks_processed: totalProcessed,
    chunks_skipped: totalSkipped,
    chunks_failed: totalFailed,
    model: cfg.model,
    cost_tokens: totalCost,
  });

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `\n[translate] ✅ Done in ${elapsed}s. processed=${totalProcessed} skipped=${totalSkipped} failed=${totalFailed}`,
  );
  db.close();
  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("[translate] Fatal:", e);
  process.exit(1);
});
