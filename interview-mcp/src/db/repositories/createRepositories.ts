import type { AppDb } from "../client.js";
import { SQLiteFlashcardRepository } from "./sqliteFlashcardRepository.js";
import { SQLiteGraphRepository } from "./sqliteGraphRepository.js";
import { SQLiteMistakeRepository } from "./sqliteMistakeRepository.js";
import { SQLiteSessionRepository } from "./sqliteSessionRepository.js";
import { SQLiteSkillRepository } from "./sqliteSkillRepository.js";
import { SQLiteExerciseRepository } from "./sqliteExerciseRepository.js";
import type { AppRepositories } from "../../repositories/index.js";

export function createSqliteRepositories(db: AppDb): AppRepositories {
  return {
    sessions: new SQLiteSessionRepository(db),
    flashcards: new SQLiteFlashcardRepository(db),
    graph: new SQLiteGraphRepository(db),
    mistakes: new SQLiteMistakeRepository(db),
    skills: new SQLiteSkillRepository(db),
    exercises: new SQLiteExerciseRepository(db),
  };
}
