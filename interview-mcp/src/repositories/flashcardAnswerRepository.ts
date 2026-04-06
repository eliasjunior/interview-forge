import type { FlashcardAnswer, AnswerState } from "@mock-interview/shared";

export interface FlashcardAnswerRepository {
  insert(answer: FlashcardAnswer): void;
  getById(id: string): FlashcardAnswer | null;
  listByFlashcardId(flashcardId: string): FlashcardAnswer[];
  listByState(state: AnswerState): FlashcardAnswer[];
  updateState(id: string, state: AnswerState): void;
  update(answer: FlashcardAnswer): void;
}
