// ─────────────────────────────────────────────────────────────────────────────
// Composition root for the knowledge layer
//
// To switch storage backends (database, remote API …):
//   1. Implement KnowledgeStore in a new adapter file
//   2. Change the import below — nothing else in the codebase changes
// ─────────────────────────────────────────────────────────────────────────────

export type { KnowledgeStore, KnowledgeTopic } from "./port.js";

import path from "path";
import { fileURLToPath } from "url";
import { FileKnowledgeStore } from "./file.js";
import type { KnowledgeStore } from "./port.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = path.resolve(__dirname, "../../data/knowledge");

export function createKnowledgeStore(): KnowledgeStore {
  return new FileKnowledgeStore(KNOWLEDGE_DIR);
}
