import { asc, eq } from "drizzle-orm";
import type { Flashcard } from "@mock-interview/shared";
import type { FlashcardRepository } from "../../repositories/flashcardRepository.js";
import type { AppDb } from "../client.js";
import { flashcardConcepts, flashcards, flashcardTags } from "../schema.js";
import {
  mapFlashcardAggregateToDomain,
  mapFlashcardToNormalizedRecord,
} from "../../repositories/mappers.js";

export class SQLiteFlashcardRepository implements FlashcardRepository {
  constructor(private readonly db: AppDb) {}

  list(): Flashcard[] {
    const rows = this.db.select().from(flashcards).orderBy(asc(flashcards.createdAt)).all();
    return rows.map((row) => this.hydrate(row.id));
  }

  getById(id: string): Flashcard | null {
    const row = this.db.select().from(flashcards).where(eq(flashcards.id, id)).get();
    return row ? this.hydrate(row.id) : null;
  }

  save(card: Flashcard): void {
    const record = mapFlashcardToNormalizedRecord(card);

    this.db.transaction((tx) => {
      tx.insert(flashcards).values(record.flashcard).onConflictDoUpdate({
        target: flashcards.id,
        set: {
          front: record.flashcard.front,
          back: record.flashcard.back,
          topic: record.flashcard.topic,
          difficulty: record.flashcard.difficulty,
          createdAt: record.flashcard.createdAt,
          dueDate: record.flashcard.dueDate,
          interval: record.flashcard.interval,
          easeFactor: record.flashcard.easeFactor,
          repetitions: record.flashcard.repetitions,
          lastReviewedAt: record.flashcard.lastReviewedAt,
          archivedAt: record.flashcard.archivedAt,
          sourceSessionId: record.flashcard.sourceSessionId,
          sourceQuestionIndex: record.flashcard.sourceQuestionIndex,
          sourceOriginalScore: record.flashcard.sourceOriginalScore,
          title: record.flashcard.title,
          focusItem: record.flashcard.focusItem,
          studyNotes: record.flashcard.studyNotes,
        },
      }).run();

      tx.delete(flashcardTags).where(eq(flashcardTags.flashcardId, card.id)).run();
      tx.delete(flashcardConcepts).where(eq(flashcardConcepts.flashcardId, card.id)).run();

      if (record.tags.length) tx.insert(flashcardTags).values(record.tags).run();
      if (record.concepts.length) tx.insert(flashcardConcepts).values(record.concepts).run();
    });
  }

  saveMany(cards: Flashcard[]): void {
    this.db.transaction((tx) => {
      for (const card of cards) {
        const record = mapFlashcardToNormalizedRecord(card);
        tx.insert(flashcards).values(record.flashcard).onConflictDoUpdate({
          target: flashcards.id,
          set: {
            front: record.flashcard.front,
            back: record.flashcard.back,
            topic: record.flashcard.topic,
            difficulty: record.flashcard.difficulty,
            createdAt: record.flashcard.createdAt,
            dueDate: record.flashcard.dueDate,
            interval: record.flashcard.interval,
            easeFactor: record.flashcard.easeFactor,
            repetitions: record.flashcard.repetitions,
            lastReviewedAt: record.flashcard.lastReviewedAt,
            archivedAt: record.flashcard.archivedAt,
            sourceSessionId: record.flashcard.sourceSessionId,
            sourceQuestionIndex: record.flashcard.sourceQuestionIndex,
            sourceOriginalScore: record.flashcard.sourceOriginalScore,
            title: record.flashcard.title,
            focusItem: record.flashcard.focusItem,
            studyNotes: record.flashcard.studyNotes,
          },
        }).run();

        tx.delete(flashcardTags).where(eq(flashcardTags.flashcardId, card.id)).run();
        tx.delete(flashcardConcepts).where(eq(flashcardConcepts.flashcardId, card.id)).run();

        if (record.tags.length) tx.insert(flashcardTags).values(record.tags).run();
        if (record.concepts.length) tx.insert(flashcardConcepts).values(record.concepts).run();
      }
    });
  }

  replaceAll(cards: Flashcard[]): void {
    this.db.transaction((tx) => {
      tx.delete(flashcardTags).run();
      tx.delete(flashcardConcepts).run();
      tx.delete(flashcards).run();

      for (const card of cards) {
        const record = mapFlashcardToNormalizedRecord(card);
        tx.insert(flashcards).values(record.flashcard).run();
        if (record.tags.length) tx.insert(flashcardTags).values(record.tags).run();
        if (record.concepts.length) tx.insert(flashcardConcepts).values(record.concepts).run();
      }
    });
  }

  deleteBySourceSessionId(sessionId: string): number {
    const ids = this.db
      .select({ id: flashcards.id })
      .from(flashcards)
      .where(eq(flashcards.sourceSessionId, sessionId))
      .all()
      .map((row) => row.id);

    if (ids.length === 0) return 0;

    this.db.transaction((tx) => {
      for (const id of ids) {
        tx.delete(flashcardTags).where(eq(flashcardTags.flashcardId, id)).run();
        tx.delete(flashcardConcepts).where(eq(flashcardConcepts.flashcardId, id)).run();
        tx.delete(flashcards).where(eq(flashcards.id, id)).run();
      }
    });

    return ids.length;
  }

  private hydrate(id: string): Flashcard {
    const flashcardRow = this.db.select().from(flashcards).where(eq(flashcards.id, id)).get();
    if (!flashcardRow) throw new Error(`Flashcard not found: ${id}`);

    return mapFlashcardAggregateToDomain({
      flashcard: flashcardRow,
      tags: this.db
        .select()
        .from(flashcardTags)
        .where(eq(flashcardTags.flashcardId, id))
        .all(),
      concepts: this.db
        .select()
        .from(flashcardConcepts)
        .where(eq(flashcardConcepts.flashcardId, id))
        .orderBy(asc(flashcardConcepts.position))
        .all(),
    });
  }
}
