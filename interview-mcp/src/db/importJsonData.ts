import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createDb } from "./client.js";
import { createSqliteRepositories } from "./repositories/createRepositories.js";
import { importLegacyJsonData } from "../import/legacyJson.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const archivedLegacyDataDir = path.resolve(__dirname, "../../data/legacy-json");
const defaultDataDir = fs.existsSync(archivedLegacyDataDir)
  ? archivedLegacyDataDir
  : path.resolve(__dirname, "../../data");

function parseArgs(argv: string[]) {
  let dataDir = defaultDataDir;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--data-dir") {
      dataDir = path.resolve(argv[i + 1] ?? dataDir);
      i += 1;
    }
  }

  return { dataDir };
}

const { dataDir } = parseArgs(process.argv.slice(2));
const db = createDb();
const repositories = createSqliteRepositories(db);

const result = importLegacyJsonData({
  dataDir,
  repositories,
  fsLike: fs,
  logger: console,
});

console.log(JSON.stringify(result, null, 2));
