import { eq } from "drizzle-orm";
import type { FlashcardAnswer, AnswerState } from "@mock-interview/shared";
import type { AppDb } from "../client.js";
import { flashcardAnswers } from "../schema.js";
import type { FlashcardAnswerRepository } from "../../repositories/flashcardAnswerRepository.js";

function rowToAnswer(r: typeof flashcardAnswers.$inferSelect): FlashcardAnswer {
  return {
    id: r.id,
    flashcardId: r.flashcardId,
    content: r.content,
    state: r.state as AnswerState,
    smRating: (r.smRating as FlashcardAnswer["smRating"]) ?? undefined,
    evaluatedAt: r.evaluatedAt ?? undefined,
    evaluationResult: r.evaluationResult ?? undefined,
    llmVerdict: (r.llmVerdict as FlashcardAnswer["llmVerdict"]) ?? undefined,
    mistakeId: r.mistakeId ?? undefined,
    newFlashcardId: r.newFlashcardId ?? undefined,
    createdAt: r.createdAt,
  };
}

export class SQLiteFlashcardAnswerRepository implements FlashcardAnswerRepository {
  constructor(private readonly db: AppDb) {}

  insert(answer: FlashcardAnswer): void {
    this.db.insert(flashcardAnswers).values({
      id: answer.id,
      flashcardId: answer.flashcardId,
      content: answer.content,
      state: answer.state,
      smRating: answer.smRating ?? null,
      evaluatedAt: answer.evaluatedAt ?? null,
      evaluationResult: answer.evaluationResult ?? null,
      llmVerdict: answer.llmVerdict ?? null,
      mistakeId: answer.mistakeId ?? null,
      newFlashcardId: answer.newFlashcardId ?? null,
      createdAt: answer.createdAt,
    }).run();
  }

  getById(id: string): FlashcardAnswer | null {
    const row = this.db.select().from(flashcardAnswers).where(eq(flashcardAnswers.id, id)).get();
    return row ? rowToAnswer(row) : null;
  }

  listByFlashcardId(flashcardId: string): FlashcardAnswer[] {
    return this.db
      .select()
      .from(flashcardAnswers)
      .where(eq(flashcardAnswers.flashcardId, flashcardId))
      .all()
      .map(rowToAnswer);
  }

  listByState(state: AnswerState): FlashcardAnswer[] {
    return this.db
      .select()
      .from(flashcardAnswers)
      .where(eq(flashcardAnswers.state, state))
      .all()
      .map(rowToAnswer);
  }

  updateState(id: string, state: AnswerState): void {
    this.db.update(flashcardAnswers).set({ state }).where(eq(flashcardAnswers.id, id)).run();
  }

  update(answer: FlashcardAnswer): void {
    this.db.update(flashcardAnswers).set({
      state: answer.state,
      smRating: answer.smRating ?? null,
      evaluatedAt: answer.evaluatedAt ?? null,
      evaluationResult: answer.evaluationResult ?? null,
      llmVerdict: answer.llmVerdict ?? null,
      mistakeId: answer.mistakeId ?? null,
      newFlashcardId: answer.newFlashcardId ?? null,
    }).where(eq(flashcardAnswers.id, answer.id)).run();
  }
}
