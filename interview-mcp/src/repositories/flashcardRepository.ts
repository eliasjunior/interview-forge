import type { Flashcard } from "@mock-interview/shared";

export interface FlashcardPage {
  items: Flashcard[];
  total: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export interface FlashcardRepository {
  list(): Flashcard[];
  listPaginated(opts: { status: 'active' | 'archived'; topic?: string; limit: number; cursor?: string }): FlashcardPage;
  getById(id: string): Flashcard | null;
  /** Walk the lineage chain for any card in the chain — returns all versions oldest→newest */
  getChain(id: string): Flashcard[];
  save(card: Flashcard): void;
  saveMany(cards: Flashcard[]): void;
  replaceAll(cards: Flashcard[]): void;
  deleteBySourceSessionId(sessionId: string): number;
}
