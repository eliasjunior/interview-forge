import path from "path";
import { fileURLToPath } from "url";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createDb, resolveDbPath } from "./client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "../../drizzle");

const dbPath = resolveDbPath();
const db = createDb(dbPath);

migrate(db, { migrationsFolder });

console.log(`Applied migrations to ${dbPath}`);
