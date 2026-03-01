import Database from "better-sqlite3";
import path from "path";

// Reuse the same connection across hot reloads in dev
const globalForDb = globalThis as unknown as { db: Database.Database | undefined };

function getDb(): Database.Database {
  if (!globalForDb.db) {
    globalForDb.db = new Database(
      path.join(process.cwd(), "chainalpha.db")
    );
    globalForDb.db.pragma("journal_mode = WAL");
    globalForDb.db.pragma("foreign_keys = ON");
    initSchema(globalForDb.db);
  }
  return globalForDb.db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS theses (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      thesis_text    TEXT    NOT NULL,
      title          TEXT    NOT NULL DEFAULT '',
      created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
      last_mapped_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chain_results (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      thesis_id         INTEGER NOT NULL REFERENCES theses(id) ON DELETE CASCADE,
      tier              INTEGER NOT NULL,
      company_name      TEXT    NOT NULL,
      ticker            TEXT    NOT NULL,
      market_cap        TEXT    NOT NULL,
      description       TEXT    NOT NULL,
      chain_reasoning   TEXT    NOT NULL,
      bottleneck        INTEGER NOT NULL DEFAULT 0,
      analyst_coverage  TEXT    NOT NULL,
      alpha_score       TEXT    NOT NULL,
      created_at        TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migration: add title column to existing databases
  const cols = db.prepare("PRAGMA table_info(theses)").all() as Array<{
    name: string;
  }>;
  if (!cols.find((c) => c.name === "title")) {
    db.exec("ALTER TABLE theses ADD COLUMN title TEXT NOT NULL DEFAULT ''");
  }
}

export default getDb;
