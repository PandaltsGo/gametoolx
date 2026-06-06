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

/** Close the DB (for cleanup; usually not needed). */
export function closeDb() {
  if (db) {
    db.close();
    db = null;
    globalThis.__gametoolx_db = undefined;
  }
}
