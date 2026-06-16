// ─────────────────────────────────────────────────────────────────────────────
// Composition root for the knowledge layer
//
// To switch storage backends (database, remote API …):
//   1. Implement KnowledgeStore in a new adapter file
//   2. Change the import below — nothing else in the codebase changes
// ─────────────────────────────────────────────────────────────────────────────

export type { KnowledgeStore, KnowledgeTopic } from "./port.js";

import type { AppDb } from "../db/client.js";
import { DbKnowledgeStore } from "./db.js";
import type { KnowledgeStore } from "./port.js";

export function createKnowledgeStore(db: AppDb): KnowledgeStore {
  return new DbKnowledgeStore(db);
}
