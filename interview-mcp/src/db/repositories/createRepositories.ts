import type { AppDb } from "../client.js";
import { SQLiteFlashcardRepository } from "./sqliteFlashcardRepository.js";
import { SQLiteGraphRepository } from "./sqliteGraphRepository.js";
import { SQLiteSessionRepository } from "./sqliteSessionRepository.js";
import type { AppRepositories } from "../../repositories/index.js";

export function createSqliteRepositories(db: AppDb): AppRepositories {
  return {
    sessions: new SQLiteSessionRepository(db),
    flashcards: new SQLiteFlashcardRepository(db),
    graph: new SQLiteGraphRepository(db),
  };
}
