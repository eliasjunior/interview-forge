import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB_PATH = path.resolve(__dirname, "../../data/app.db");

function ensureParentDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function resolveDbPath() {
  return process.env.DATABASE_URL?.trim() || DEFAULT_DB_PATH;
}

export function createSqliteClient(dbPath = resolveDbPath()) {
  ensureParentDir(dbPath);
  return new Database(dbPath);
}

export function createDb(dbPath = resolveDbPath()) {
  const sqlite = createSqliteClient(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  return drizzle(sqlite, { schema });
}

export type AppDb = ReturnType<typeof createDb>;
