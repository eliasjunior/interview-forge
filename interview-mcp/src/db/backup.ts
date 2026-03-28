import fs from "fs";
import path from "path";
import { createSqliteClient, ensureDbParentDir, resolveDbPath } from "./client.js";

const DEFAULT_KEEP_COUNT = 10;

function formatTimestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function parseKeepCount() {
  const raw = process.env.DB_BACKUP_KEEP?.trim();
  if (!raw) return DEFAULT_KEEP_COUNT;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`DB_BACKUP_KEEP must be a positive integer. Received: ${raw}`);
  }

  return parsed;
}

function resolveBackupDir(dbPath: string) {
  return path.join(path.dirname(dbPath), "backups");
}

function pruneBackups(backupDir: string, keepCount: number, latestBackupPath: string) {
  const backups = fs
    .readdirSync(backupDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".db"))
    .map((entry) => {
      const fullPath = path.join(backupDir, entry.name);
      return {
        fullPath,
        mtimeMs: fs.statSync(fullPath).mtimeMs,
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  const toDelete = backups
    .filter((backup) => backup.fullPath !== latestBackupPath)
    .slice(Math.max(keepCount - 1, 0));

  for (const backup of toDelete) {
    fs.unlinkSync(backup.fullPath);
  }
}

async function main() {
  const dbPath = resolveDbPath();
  const keepCount = parseKeepCount();
  const backupDir = resolveBackupDir(dbPath);
  const backupPath = path.join(backupDir, `app.${formatTimestamp()}.backup.db`);

  ensureDbParentDir(backupPath);

  const sqlite = createSqliteClient(dbPath);

  try {
    sqlite.pragma("busy_timeout = 5000");
    await sqlite.backup(backupPath);
  } finally {
    sqlite.close();
  }

  pruneBackups(backupDir, keepCount, backupPath);

  console.log(`Created backup at ${backupPath}`);
  console.log(`Retention: keeping the latest ${keepCount} backup(s) in ${backupDir}`);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`DB backup failed: ${message}`);
  process.exit(1);
});
