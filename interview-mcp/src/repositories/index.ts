import type { FlashcardRepository } from "./flashcardRepository.js";
import type { GraphRepository } from "./graphRepository.js";
import type { MistakeRepository } from "./mistakeRepository.js";
import type { SessionRepository } from "./sessionRepository.js";

export type { SessionRepository } from "./sessionRepository.js";
export type { FlashcardRepository } from "./flashcardRepository.js";
export type { GraphRepository } from "./graphRepository.js";
export type { MistakeRepository } from "./mistakeRepository.js";

export interface AppRepositories {
  sessions: SessionRepository;
  flashcards: FlashcardRepository;
  graph: GraphRepository;
  mistakes: MistakeRepository;
}
