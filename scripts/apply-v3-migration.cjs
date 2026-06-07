/**
 * Apply DB v3 migration manually (idempotent).
 * - Adds source_language to crawled_documents
 * - Adds translations + translated_at to crawled_chunks
 * - Creates translate_jobs table
 * - Records in schema_version
 */
const Database = require("better-sqlite3");
const path = require("node:path");

const dbPath = path.join("D:/Idea Project/gametoolx/data/gametoolx.db");
const db = new Database(dbPath);

const sv = db.prepare("SELECT MAX(version) as v FROM schema_version").get().v || 0;
console.log("Current schema_version:", sv);

if (sv >= 3) {
  console.log("Already at v3 or later. Nothing to do.");
  process.exit(0);
}

const docCols = db.prepare("PRAGMA table_info(crawled_documents)").all().map(c => c.name);
const chunkCols = db.prepare("PRAGMA table_info(crawled_chunks)").all().map(c => c.name);
const hasTable = (name) => db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name);

const tx = db.transaction(() => {
  if (!docCols.includes("source_language")) {
    db.exec(`ALTER TABLE crawled_documents ADD COLUMN source_language TEXT DEFAULT 'en'`);
    console.log("✓ added crawled_documents.source_language");
  } else {
    console.log("• source_language already exists");
  }
  db.exec(`CREATE INDEX IF NOT EXISTS idx_documents_source_lang ON crawled_documents(source_language)`);

  if (!chunkCols.includes("translations")) {
    db.exec(`ALTER TABLE crawled_chunks ADD COLUMN translations TEXT DEFAULT '{}'`);
    console.log("✓ added crawled_chunks.translations");
  } else {
    console.log("• translations already exists");
  }
  if (!chunkCols.includes("translated_at")) {
    db.exec(`ALTER TABLE crawled_chunks ADD COLUMN translated_at INTEGER`);
    console.log("✓ added crawled_chunks.translated_at");
  } else {
    console.log("• translated_at already exists");
  }

  if (!hasTable("translate_jobs")) {
    db.exec(`
      CREATE TABLE translate_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        started_at INTEGER NOT NULL,
        finished_at INTEGER,
        target_languages TEXT NOT NULL,
        chunks_processed INTEGER DEFAULT 0,
        chunks_skipped INTEGER DEFAULT 0,
        chunks_failed INTEGER DEFAULT 0,
        model TEXT,
        cost_tokens INTEGER,
        status TEXT NOT NULL,
        error_message TEXT
      )
    `);
    console.log("✓ created translate_jobs table");
  } else {
    console.log("• translate_jobs already exists");
  }

  db.prepare("INSERT INTO schema_version (version, applied_at) VALUES (?, ?)").run(3, Date.now());
  console.log("✓ recorded schema_version = 3");
});

tx();
console.log("\nMigration complete. New schema_version:", db.prepare("SELECT MAX(version) as v FROM schema_version").get().v);

// Backfill source_language='en' for existing docs (default already set, but explicit)
const updated = db.prepare("UPDATE crawled_documents SET source_language='en' WHERE source_language IS NULL").run();
console.log(`Backfilled source_language='en' for ${updated.changes} docs`);

// Initialize translations='{}' for existing chunks (default already set, but explicit)
const updChunks = db.prepare("UPDATE crawled_chunks SET translations='{}' WHERE translations IS NULL").run();
console.log(`Initialized translations='{{}}' for ${updChunks.changes} chunks`);

db.close();
