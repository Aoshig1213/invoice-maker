// SQLite の接続と、テーブルの作成（初回起動時に自動で作る）
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  company_name TEXT NOT NULL DEFAULT '',
  registration_number TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  bank_info TEXT NOT NULL DEFAULT '',
  rounding TEXT NOT NULL DEFAULT 'floor' CHECK (rounding IN ('floor','round','ceil'))
);
INSERT OR IGNORE INTO settings (id) VALUES (1);

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  honorific TEXT NOT NULL DEFAULT '御中',
  contact_person TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('quote','invoice')),
  number TEXT NOT NULL UNIQUE,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  issue_date TEXT NOT NULL,
  due_date TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','paid')),
  -- 書類を作ったときの端数処理と自社情報を残す（あとで設定を変えても、発行済みの金額や記載が変わらないように）
  rounding TEXT NOT NULL,
  issuer_snapshot TEXT NOT NULL,
  source_quote_id INTEGER REFERENCES documents(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS document_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  description TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL DEFAULT '',
  unit_price INTEGER NOT NULL,
  tax_rate INTEGER NOT NULL CHECK (tax_rate IN (10, 8))
);
CREATE INDEX IF NOT EXISTS idx_lines_doc ON document_lines(document_id, position);
`;

export function openDb(file: string): Database.Database {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}

// 開発中の再読み込みで接続が増えないよう、1つを使い回す
const g = globalThis as unknown as { __invoiceDb?: Database.Database };
export function getDb(): Database.Database {
  if (!g.__invoiceDb) g.__invoiceDb = openDb(process.env.DB_PATH || path.join(process.cwd(), "data", "app.db"));
  return g.__invoiceDb;
}
