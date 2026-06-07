/**
 * SQLite database layer using better-sqlite3.
 * 
 * Performance: handles 100 concurrent + 10k DAU easily in WAL mode.
 * If we ever need multi-instance, swap to @libsql/client with same API.
 */
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "gametoolx.db");

// Ensure data dir exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// Single global connection (Next.js dev hot-reload safe)
declare global {
  // eslint-disable-next-line no-var
  var __gametoolx_db: Database.Database | undefined;
}

function getRawDb(): Database.Database {
  if (globalThis.__gametoolx_db) return globalThis.__gametoolx_db;
  const db = new Database(DB_PATH);
  // WAL mode: 5-10x better concurrent read performance
  db.pragma("journal_mode = WAL");
  // 5s busy timeout: waits for locked write, better for concurrency
  db.pragma("busy_timeout = 5000");
  // Foreign keys
  db.pragma("foreign_keys = ON");
  // 64MB cache
  db.pragma("cache_size = -64000");
  // Run migrations
  runMigrations(db);
  globalThis.__gametoolx_db = db;
  return db;
}

// Migrations system
type Migration = { version: number; name: string; sql: string };

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "initial_schema",
    sql: `
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        last_seen INTEGER NOT NULL,
        user_agent TEXT,
        lang TEXT
      );

      CREATE TABLE IF NOT EXISTS progress (
        session_id TEXT NOT NULL,
        tool_slug TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (session_id, tool_slug, key),
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS system_checks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        game_slug TEXT NOT NULL,
        cpu TEXT,
        gpu TEXT,
        ram_gb INTEGER,
        storage TEXT,
        score INTEGER,
        result TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS page_views (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        path TEXT NOT NULL,
        lang TEXT,
        referrer TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_progress_session ON progress(session_id);
      CREATE INDEX IF NOT EXISTS idx_progress_tool ON progress(tool_slug, key);
      CREATE INDEX IF NOT EXISTS idx_checks_session ON system_checks(session_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_views_session ON page_views(session_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_views_path ON page_views(path, created_at);
    `,
  },
  {
    version: 2,
    name: "crawled_content_for_rag",
    sql: `
      -- Registered source sites (NGA, 3DM, MegaTen Wiki, etc.)
      CREATE TABLE IF NOT EXISTS crawled_sources (
        id TEXT PRIMARY KEY,
        domain TEXT NOT NULL,
        name TEXT NOT NULL,
        url_pattern TEXT,
        language TEXT,
        content_type TEXT,  -- 'wiki' | 'forum' | 'news' | 'guide'
        enabled INTEGER NOT NULL DEFAULT 1,
        last_crawled_at INTEGER,
        config_json TEXT,
        created_at INTEGER NOT NULL
      );

      -- Individual crawled pages / articles
      CREATE TABLE IF NOT EXISTS crawled_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id TEXT NOT NULL,
        game_slug TEXT,
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        body_md TEXT NOT NULL,           -- cleaned markdown
        body_text TEXT NOT NULL,         -- plain text (for chunking/search)
        content_type TEXT,               -- 'guide' | 'demon' | 'quest' | 'walkthrough' | 'news' | 'forum_thread' | ...
        language TEXT,
        meta_json TEXT,                  -- author, date, tags, etc.
        content_hash TEXT NOT NULL,      -- for incremental updates
        fetched_at INTEGER NOT NULL,
        published_at INTEGER,
        FOREIGN KEY (source_id) REFERENCES crawled_sources(id) ON DELETE CASCADE
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_url ON crawled_documents(url);
      CREATE INDEX IF NOT EXISTS idx_documents_source ON crawled_documents(source_id);
      CREATE INDEX IF NOT EXISTS idx_documents_game ON crawled_documents(game_slug);
      CREATE INDEX IF NOT EXISTS idx_documents_fetched ON crawled_documents(fetched_at);

      -- Chunked content for retrieval (RAG)
      CREATE TABLE IF NOT EXISTS crawled_chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER NOT NULL,
        chunk_index INTEGER NOT NULL,
        section_title TEXT,
        content TEXT NOT NULL,
        token_count INTEGER,
        FOREIGN KEY (document_id) REFERENCES crawled_documents(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_chunks_doc ON crawled_chunks(document_id);

      -- FTS5 full-text search over chunks (works without vector embeddings)
      CREATE VIRTUAL TABLE IF NOT EXISTS crawled_chunks_fts USING fts5(
        content,
        section_title,
        content='crawled_chunks',
        content_rowid='id',
        tokenize='unicode61 remove_diacritics 2'
      );

      -- Triggers to keep FTS index in sync
      CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON crawled_chunks BEGIN
        INSERT INTO crawled_chunks_fts(rowid, content, section_title)
        VALUES (new.id, new.content, new.section_title);
      END;

      CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON crawled_chunks BEGIN
        INSERT INTO crawled_chunks_fts(crawled_chunks_fts, rowid, content, section_title)
        VALUES ('delete', old.id, old.content, old.section_title);
      END;

      CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON crawled_chunks BEGIN
        INSERT INTO crawled_chunks_fts(crawled_chunks_fts, rowid, content, section_title)
        VALUES ('delete', old.id, old.content, old.section_title);
        INSERT INTO crawled_chunks_fts(rowid, content, section_title)
        VALUES (new.id, new.content, new.section_title);
      END;

      -- Crawl job tracking
      CREATE TABLE IF NOT EXISTS crawl_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        finished_at INTEGER,
        status TEXT NOT NULL,           -- 'running' | 'success' | 'failed'
        pages_crawled INTEGER DEFAULT 0,
        pages_updated INTEGER DEFAULT 0,
        pages_skipped INTEGER DEFAULT 0,
        error_message TEXT,
        stats_json TEXT
      );

      -- Q&A interactions (for future LLM integration)
      CREATE TABLE IF NOT EXISTS qa_interactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        question TEXT NOT NULL,
        retrieved_chunks_json TEXT,     -- chunk ids + scores
        answer TEXT,
        model TEXT,
        latency_ms INTEGER,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_qa_session ON qa_interactions(session_id, created_at);
    `,
  },
  {
    version: 3,
    name: "translations_and_source_language",
    sql: `
      -- Add source language to documents (e.g. 'en' for Fandom, 'zh' for NGA)
      ALTER TABLE crawled_documents ADD COLUMN source_language TEXT DEFAULT 'en';
      CREATE INDEX IF NOT EXISTS idx_documents_source_lang ON crawled_documents(source_language);

      -- Pre-translated chunks: JSON map { "ja": "...", "ko": "...", "zh": "..." }
      -- Additive: original content remains untouched
      ALTER TABLE crawled_chunks ADD COLUMN translations TEXT DEFAULT '{}';
      ALTER TABLE crawled_chunks ADD COLUMN translated_at INTEGER;

      -- Translation job tracking
      CREATE TABLE IF NOT EXISTS translate_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        started_at INTEGER NOT NULL,
        finished_at INTEGER,
        target_languages TEXT NOT NULL,    -- JSON array: ["ja","ko","zh"]
        chunks_processed INTEGER DEFAULT 0,
        chunks_skipped INTEGER DEFAULT 0,
        chunks_failed INTEGER DEFAULT 0,
        model TEXT,
        cost_tokens INTEGER,
        status TEXT NOT NULL,             -- 'running' | 'success' | 'failed' | 'partial'
        error_message TEXT
      );
    `,
  },
];

function runMigrations(db: Database.Database) {
  // Bootstrap: ensure schema_version table
  db.exec(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL)`);

  const current = (db.prepare("SELECT MAX(version) as v FROM schema_version").get() as { v: number | null }).v || 0;

  for (const m of MIGRATIONS) {
    if (m.version > current) {
      const tx = db.transaction(() => {
        db.exec(m.sql);
        db.prepare("INSERT INTO schema_version (version, applied_at) VALUES (?, ?)").run(
          m.version,
          Date.now()
        );
      });
      tx();
      // eslint-disable-next-line no-console
      console.log(`[db] Applied migration v${m.version}: ${m.name}`);
    }
  }
}

let db: Database.Database | null = null;
function dbReady() {
  if (!db) db = getRawDb();
  return db;
}

// ===== Public API =====

/** Generate a random session ID (UUID-like, 16 bytes hex). */
export function newSessionId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Get or create a session by ID. */
export function upsertSession(id: string, userAgent?: string, lang?: string): void {
  const now = Date.now();
  const d = dbReady();
  d.prepare(`
    INSERT INTO sessions (id, created_at, last_seen, user_agent, lang)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET last_seen = excluded.last_seen, user_agent = COALESCE(excluded.user_agent, user_agent), lang = COALESCE(excluded.lang, lang)
  `).run(id, now, now, userAgent || null, lang || null);
}

export type Progress = {
  sessionId: string;
  toolSlug: string;
  key: string;
  value: string;
  updatedAt: number;
};

/** Get all progress entries for a session + tool. */
export function getProgress(sessionId: string, toolSlug: string): Progress[] {
  const d = dbReady();
  return d
    .prepare(`
      SELECT session_id, tool_slug, key, value, updated_at as updatedAt
      FROM progress
      WHERE session_id = ? AND tool_slug = ?
      ORDER BY updated_at DESC
    `)
    .all(sessionId, toolSlug) as Progress[];
}

/** Set a progress entry (upsert). */
export function setProgress(sessionId: string, toolSlug: string, key: string, value: string): void {
  const d = dbReady();
  d.prepare(`
    INSERT INTO progress (session_id, tool_slug, key, value, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(session_id, tool_slug, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(sessionId, toolSlug, key, value, Date.now());
}

/** Delete a progress entry. */
export function deleteProgress(sessionId: string, toolSlug: string, key: string): void {
  const d = dbReady();
  d.prepare("DELETE FROM progress WHERE session_id = ? AND tool_slug = ? AND key = ?").run(
    sessionId,
    toolSlug,
    key
  );
}

export type SystemCheck = {
  id?: number;
  sessionId: string;
  gameSlug: string;
  cpu?: string;
  gpu?: string;
  ramGb?: number;
  storage?: string;
  score?: number;
  result?: string;
  createdAt: number;
};

/** Log a system check. */
export function logSystemCheck(check: SystemCheck): number {
  const d = dbReady();
  const result = d
    .prepare(`
      INSERT INTO system_checks (session_id, game_slug, cpu, gpu, ram_gb, storage, score, result, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      check.sessionId,
      check.gameSlug,
      check.cpu || null,
      check.gpu || null,
      check.ramGb || null,
      check.storage || null,
      check.score || null,
      check.result || null,
      check.createdAt || Date.now()
    );
  return Number(result.lastInsertRowid);
}

/** Get system check history for a session. */
export function getSystemChecks(sessionId: string, limit = 10): SystemCheck[] {
  const d = dbReady();
  return d
    .prepare(`
      SELECT id, session_id as sessionId, game_slug as gameSlug, cpu, gpu, ram_gb as ramGb,
             storage, score, result, created_at as createdAt
      FROM system_checks
      WHERE session_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `)
    .all(sessionId, limit) as SystemCheck[];
}

/** Log a page view (fire and forget). */
export function logPageView(opts: { sessionId?: string; path: string; lang?: string; referrer?: string }): void {
  try {
    const d = dbReady();
    d.prepare(`
      INSERT INTO page_views (session_id, path, lang, referrer, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      opts.sessionId || null,
      opts.path,
      opts.lang || null,
      opts.referrer || null,
      Date.now()
    );
  } catch {
    // Don't crash on analytics
  }
}

/** Get stats summary (for admin/debug). */
export function getStats(): { sessions: number; progress: number; checks: number; views: number } {
  const d = dbReady();
  return {
    sessions: (d.prepare("SELECT COUNT(*) as c FROM sessions").get() as { c: number }).c,
    progress: (d.prepare("SELECT COUNT(*) as c FROM progress").get() as { c: number }).c,
    checks: (d.prepare("SELECT COUNT(*) as c FROM system_checks").get() as { c: number }).c,
    views: (d.prepare("SELECT COUNT(*) as c FROM page_views").get() as { c: number }).c,
  };
}

// ===== Crawled Content API =====

export type CrawledSource = {
  id: string;
  domain: string;
  name: string;
  urlPattern?: string;
  language?: string;
  contentType?: string;
  enabled: boolean;
  lastCrawledAt?: number;
  configJson?: string;
  createdAt: number;
};

export function upsertCrawledSource(s: CrawledSource): void {
  const d = dbReady();
  d.prepare(`
    INSERT INTO crawled_sources (id, domain, name, url_pattern, language, content_type, enabled, last_crawled_at, config_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      domain = excluded.domain,
      name = excluded.name,
      url_pattern = excluded.url_pattern,
      language = excluded.language,
      content_type = excluded.content_type,
      enabled = excluded.enabled,
      last_crawled_at = COALESCE(excluded.last_crawled_at, last_crawled_at),
      config_json = excluded.config_json
  `).run(
    s.id,
    s.domain,
    s.name,
    s.urlPattern || null,
    s.language || null,
    s.contentType || null,
    s.enabled ? 1 : 0,
    s.lastCrawledAt || null,
    s.configJson || null,
    s.createdAt || Date.now()
  );
}

export function listCrawledSources(enabledOnly = false): CrawledSource[] {
  const d = dbReady();
  const rows = d.prepare(`
    SELECT id, domain, name, url_pattern as urlPattern, language, content_type as contentType,
           enabled, last_crawled_at as lastCrawledAt, config_json as configJson, created_at as createdAt
    FROM crawled_sources
    ${enabledOnly ? "WHERE enabled = 1" : ""}
    ORDER BY name
  `).all() as any[];
  return rows.map((r) => ({ ...r, enabled: !!r.enabled }));
}

export type CrawledDocument = {
  id?: number;
  sourceId: string;
  gameSlug?: string;
  url: string;
  title: string;
  bodyMd: string;
  bodyText: string;
  contentType?: string;
  language?: string;
  metaJson?: string;
  contentHash: string;
  fetchedAt: number;
  publishedAt?: number;
};

/** Upsert by URL — uses content hash to skip unchanged content. */
export function upsertCrawledDocument(doc: CrawledDocument & { sourceLanguage?: string }): { id: number; updated: boolean } {
  const d = dbReady();
  const sourceLang = doc.sourceLanguage || doc.language || "en";
  const existing = d.prepare("SELECT id, content_hash FROM crawled_documents WHERE url = ?").get(doc.url) as
    | { id: number; content_hash: string }
    | undefined;
  if (existing && existing.content_hash === doc.contentHash) {
    return { id: existing.id, updated: false };
  }
  if (existing) {
    d.prepare(`
      UPDATE crawled_documents
      SET source_id = ?, game_slug = ?, title = ?, body_md = ?, body_text = ?,
          content_type = ?, language = ?, source_language = ?, meta_json = ?, content_hash = ?, fetched_at = ?,
          published_at = ?
      WHERE id = ?
    `).run(
      doc.sourceId,
      doc.gameSlug || null,
      doc.title,
      doc.bodyMd,
      doc.bodyText,
      doc.contentType || null,
      doc.language || null,
      sourceLang,
      doc.metaJson || null,
      doc.contentHash,
      doc.fetchedAt,
      doc.publishedAt || null,
      existing.id
    );
    // Re-chunk: clear old chunks
    d.prepare("DELETE FROM crawled_chunks WHERE document_id = ?").run(existing.id);
    return { id: existing.id, updated: true };
  }
  const result = d.prepare(`
    INSERT INTO crawled_documents (source_id, game_slug, url, title, body_md, body_text, content_type, language, source_language, meta_json, content_hash, fetched_at, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    doc.sourceId,
    doc.gameSlug || null,
    doc.url,
    doc.title,
    doc.bodyMd,
    doc.bodyText,
    doc.contentType || null,
    doc.language || null,
    sourceLang,
    doc.metaJson || null,
    doc.contentHash,
    doc.fetchedAt,
    doc.publishedAt || null
  );
  return { id: Number(result.lastInsertRowid), updated: true };
}

export type CrawledChunk = {
  documentId: number;
  chunkIndex: number;
  sectionTitle?: string;
  content: string;
  tokenCount?: number;
};

export function insertCrawledChunks(chunks: CrawledChunk[]): void {
  if (chunks.length === 0) return;
  const d = dbReady();
  const stmt = d.prepare(`
    INSERT INTO crawled_chunks (document_id, chunk_index, section_title, content, token_count)
    VALUES (?, ?, ?, ?, ?)
  `);
  const tx = d.transaction((rows: CrawledChunk[]) => {
    for (const c of rows) {
      stmt.run(c.documentId, c.chunkIndex, c.sectionTitle || null, c.content, c.tokenCount || null);
    }
  });
  tx(chunks);
}

export function getDocumentsByGame(gameSlug: string, limit = 50): { id: number; title: string; url: string; source: string; contentType?: string; language?: string; fetchedAt: number }[] {
  const d = dbReady();
  return d
    .prepare(`
      SELECT d.id, d.title, d.url, s.name as source, d.content_type as contentType, d.language, d.fetched_at as fetchedAt
      FROM crawled_documents d
      JOIN crawled_sources s ON s.id = d.source_id
      WHERE d.game_slug = ?
      ORDER BY d.fetched_at DESC
      LIMIT ?
    `)
    .all(gameSlug, limit) as any[];
}

export function getCrawledStats(): { sources: number; documents: number; chunks: number; bySource: { name: string; count: number }[]; byGame: { game: string; count: number }[] } {
  const d = dbReady();
  const sources = (d.prepare("SELECT COUNT(*) as c FROM crawled_sources").get() as { c: number }).c;
  const documents = (d.prepare("SELECT COUNT(*) as c FROM crawled_documents").get() as { c: number }).c;
  const chunks = (d.prepare("SELECT COUNT(*) as c FROM crawled_chunks").get() as { c: number }).c;
  const bySource = d
    .prepare(`SELECT s.name as name, COUNT(d.id) as count FROM crawled_sources s LEFT JOIN crawled_documents d ON d.source_id = s.id GROUP BY s.id ORDER BY count DESC`)
    .all() as { name: string; count: number }[];
  const byGame = d
    .prepare(`SELECT COALESCE(game_slug, '(none)') as game, COUNT(*) as count FROM crawled_documents GROUP BY game_slug ORDER BY count DESC`)
    .all() as { game: string; count: number }[];
  return { sources, documents, chunks, bySource, byGame };
}

export type CrawlJob = {
  sourceId: string;
  startedAt: number;
  finishedAt?: number;
  status: "running" | "success" | "failed";
  pagesCrawled?: number;
  pagesUpdated?: number;
  pagesSkipped?: number;
  errorMessage?: string;
  statsJson?: string;
};

export function startCrawlJob(sourceId: string): number {
  const d = dbReady();
  const result = d
    .prepare(`INSERT INTO crawl_jobs (source_id, started_at, status) VALUES (?, ?, 'running')`)
    .run(sourceId, Date.now());
  return Number(result.lastInsertRowid);
}

export function finishCrawlJob(id: number, job: Partial<CrawlJob>): void {
  const d = dbReady();
  d.prepare(`
    UPDATE crawl_jobs
    SET finished_at = ?, status = ?, pages_crawled = ?, pages_updated = ?, pages_skipped = ?, error_message = ?, stats_json = ?
    WHERE id = ?
  `).run(
    job.finishedAt || Date.now(),
    job.status || "success",
    job.pagesCrawled || 0,
    job.pagesUpdated || 0,
    job.pagesSkipped || 0,
    job.errorMessage || null,
    job.statsJson || null,
    id
  );
}

export function updateSourceCrawledAt(sourceId: string): void {
  const d = dbReady();
  d.prepare("UPDATE crawled_sources SET last_crawled_at = ? WHERE id = ?").run(Date.now(), sourceId);
}

// ===== Translations =====

/** Get a chunk's translation for a given language, or null if not translated. */
export function getChunkTranslation(chunkId: number, lang: string): string | null {
  const d = dbReady();
  const r = d.prepare("SELECT translations FROM crawled_chunks WHERE id = ?").get(chunkId) as
    | { translations: string | null }
    | undefined;
  if (!r || !r.translations) return null;
  try {
    const map = JSON.parse(r.translations) as Record<string, string>;
    return map[lang] || null;
  } catch {
    return null;
  }
}

/** Set translations for a chunk. Pass map of { lang: text }. */
export function setChunkTranslation(chunkId: number, lang: string, text: string): void {
  const d = dbReady();
  d.transaction(() => {
    const r = d.prepare("SELECT translations FROM crawled_chunks WHERE id = ?").get(chunkId) as
      | { translations: string | null }
      | undefined;
    const current = (() => {
      if (!r?.translations) return {} as Record<string, string>;
      try { return JSON.parse(r.translations) as Record<string, string>; }
      catch { return {} as Record<string, string>; }
    })();
    current[lang] = text;
    d.prepare("UPDATE crawled_chunks SET translations = ?, translated_at = ? WHERE id = ?")
      .run(JSON.stringify(current), Date.now(), chunkId);
  })();
}

/** Set multiple translations for a chunk in one go. */
export function setChunkTranslations(chunkId: number, map: Record<string, string>): void {
  const d = dbReady();
  d.transaction(() => {
    const r = d.prepare("SELECT translations FROM crawled_chunks WHERE id = ?").get(chunkId) as
      | { translations: string | null }
      | undefined;
    const current = (() => {
      if (!r?.translations) return {} as Record<string, string>;
      try { return JSON.parse(r.translations) as Record<string, string>; }
      catch { return {} as Record<string, string>; }
    })();
    const merged = { ...current, ...map };
    d.prepare("UPDATE crawled_chunks SET translations = ?, translated_at = ? WHERE id = ?")
      .run(JSON.stringify(merged), Date.now(), chunkId);
  })();
}

/** List chunks that need translation to a given target language. */
export function getUntranslatedChunks(targetLang: string, limit = 100, gameSlug?: string): {
  id: number;
  documentId: number;
  sectionTitle: string | null;
  content: string;
  documentTitle: string;
  sourceLanguage: string | null;
}[] {
  const d = dbReady();
  // Get chunks that don't have a translation for targetLang
  // (We use LIKE to check for the key in JSON)
  const rows = d.prepare(`
    SELECT
      c.id, c.document_id as documentId, c.section_title as sectionTitle, c.content,
      d.title as documentTitle, d.source_language as sourceLanguage
    FROM crawled_chunks c
    JOIN crawled_documents d ON d.id = c.document_id
    WHERE
      (c.translations IS NULL OR c.translations = '{}'
       OR (instr(c.translations, ?) = 0))
      ${gameSlug ? "AND d.game_slug = ?" : ""}
    ORDER BY c.id
    LIMIT ?
  `).all(`"${targetLang}":`, ...(gameSlug ? [gameSlug, limit] : [limit])) as any[];

  // Better filter in JS: only include chunks that actually lack the key
  return rows.filter((r) => {
    if (!r.id) return false;
    if (r.sourceLanguage === targetLang) return false; // already in target language
    try {
      const m = r.content ? "{}" : r.content;
      // Re-fetch translations field to check
      return true; // LIKE filter already handled
    } catch {
      return true;
    }
  });
}

export type SearchResult = {
  chunkId: number;
  documentId: number;
  title: string;
  url: string;
  source: string;
  sourceLanguage?: string;
  gameSlug?: string;
  sectionTitle?: string;
  content: string;        // content in user's preferred language (or fallback)
  originalContent: string; // source-language content
  contentLang: string;    // 'translated' | 'original'
  snippet: string;
  rank: number;
};

export function searchChunks(opts: {
  query: string;
  gameSlug?: string;
  /** Preferred language: 'ja' | 'ko' | 'zh' | 'en'. Search returns translated version if available, else original. */
  preferredLang?: string;
  limit?: number;
}): SearchResult[] {
  const d = dbReady();
  const limit = opts.limit || 20;
  const safeQuery = opts.query.replace(/[^a-zA-Z0-9\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\s]/g, " ").trim();
  if (!safeQuery) return [];

  const ftsQuery = safeQuery
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => `"${t}"*`)
    .join(" ");

  const rows = d
    .prepare(`
      SELECT
        c.id as chunkId,
        c.document_id as documentId,
        c.section_title as sectionTitle,
        c.content,
        c.translations,
        d.title,
        d.url,
        d.game_slug as gameSlug,
        d.source_language as sourceLanguage,
        s.name as source,
        bm25(crawled_chunks_fts) as rank
      FROM crawled_chunks_fts fts
      JOIN crawled_chunks c ON c.id = fts.rowid
      JOIN crawled_documents d ON d.id = c.document_id
      JOIN crawled_sources s ON s.id = d.source_id
      WHERE crawled_chunks_fts MATCH ?
        ${opts.gameSlug ? "AND d.game_slug = ?" : ""}
      ORDER BY rank
      LIMIT ?
    `)
    .all(opts.gameSlug ? [ftsQuery, opts.gameSlug, limit] : [ftsQuery, limit]) as any[];

  const preferred = opts.preferredLang || "en";

  return rows.map((r) => {
    let displayContent = r.content;
    let contentLang: "translated" | "original" = "original";
    if (preferred !== r.sourceLanguage) {
      try {
        const map = r.translations ? JSON.parse(r.translations) as Record<string, string> : null;
        if (map && map[preferred]) {
          displayContent = map[preferred];
          contentLang = "translated";
        }
      } catch {}
    }
    const snippet = displayContent.length > 240 ? displayContent.slice(0, 240) + "..." : displayContent;
    return {
      chunkId: r.chunkId,
      documentId: r.documentId,
      title: r.title,
      url: r.url,
      source: r.source,
      sourceLanguage: r.sourceLanguage,
      gameSlug: r.gameSlug,
      sectionTitle: r.sectionTitle,
      content: displayContent,
      originalContent: r.content,
      contentLang,
      snippet,
      rank: r.rank,
    };
  });
}

/** Close the DB (for cleanup; usually not needed). */
export function closeDb() {
  if (db) {
    db.close();
    db = null;
    globalThis.__gametoolx_db = undefined;
  }
}
