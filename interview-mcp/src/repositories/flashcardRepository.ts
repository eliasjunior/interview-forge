import type { Flashcard } from "@mock-interview/shared";

export interface FlashcardRepository {
  list(): Flashcard[];
  getById(id: string): Flashcard | null;
  save(card: Flashcard): void;
  saveMany(cards: Flashcard[]): void;
  replaceAll(cards: Flashcard[]): void;
  deleteBySourceSessionId(sessionId: string): number;
}
