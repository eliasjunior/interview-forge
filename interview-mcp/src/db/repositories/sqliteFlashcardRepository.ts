import { asc, eq, isNull, isNotNull } from "drizzle-orm";
import type { Flashcard } from "@mock-interview/shared";
import type { FlashcardPage, FlashcardRepository } from "../../repositories/flashcardRepository.js";
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
          parentFlashcardId: record.flashcard.parentFlashcardId,
          replacedByFlashcardId: record.flashcard.replacedByFlashcardId,
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
            parentFlashcardId: record.flashcard.parentFlashcardId,
            replacedByFlashcardId: record.flashcard.replacedByFlashcardId,
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

  listPaginated(opts: { status: 'active' | 'archived'; topic?: string; limit: number; cursor?: string }): FlashcardPage {
    // Pull all rows matching status + optional topic, then apply cursor-based window in memory.
    // The table is small enough that this is acceptable; a DB-level query would require
    // dynamic sort columns that don't map cleanly to Drizzle's typed API.
    let query = this.db.select().from(flashcards).$dynamic();
    if (opts.status === 'active') {
      query = query.where(isNull(flashcards.archivedAt));
    } else {
      query = query.where(isNotNull(flashcards.archivedAt));
    }

    const allRows = query.all();
    let all = allRows
      .filter((row) => !opts.topic || row.topic === opts.topic)
      .map((row) => this.hydrate(row.id));

    // Sort by dueDate asc for active, archivedAt desc for archived.
    if (opts.status === 'active') {
      all.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id));
    } else {
      all.sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? '') || b.id.localeCompare(a.id));
    }

    const total = all.length;

    if (opts.cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(opts.cursor, 'base64url').toString('utf8')) as { id?: string; dueDate?: string; archivedAt?: string };
        if (opts.status === 'active' && decoded.dueDate && decoded.id) {
          all = all.filter((c) => c.dueDate > decoded.dueDate! || (c.dueDate === decoded.dueDate && c.id > decoded.id!));
        } else if (opts.status === 'archived' && decoded.archivedAt !== undefined && decoded.id) {
          all = all.filter((c) => (c.archivedAt ?? '') < decoded.archivedAt! || ((c.archivedAt ?? '') === decoded.archivedAt && c.id < decoded.id!));
        }
      } catch {
        // invalid cursor — ignore
      }
    }

    const window = all.slice(0, opts.limit + 1);
    const items = window.slice(0, opts.limit);
    const hasMore = window.length > opts.limit;

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1]!;
      if (opts.status === 'active') {
        nextCursor = Buffer.from(JSON.stringify({ dueDate: last.dueDate, id: last.id }), 'utf8').toString('base64url');
      } else {
        nextCursor = Buffer.from(JSON.stringify({ archivedAt: last.archivedAt ?? '', id: last.id }), 'utf8').toString('base64url');
      }
    }

    return { items, total, hasMore, nextCursor };
  }

  getChain(id: string): Flashcard[] {
    const all = this.list();
    const byId = new Map(all.map((c) => [c.id, c]));
    const card = byId.get(id);
    if (!card) return [];

    // Walk to root via parentFlashcardId.
    let root = card;
    const seenParents = new Set<string>([root.id]);
    while (root.parentFlashcardId) {
      const parent = byId.get(root.parentFlashcardId);
      if (!parent || seenParents.has(parent.id)) break;
      root = parent;
      seenParents.add(parent.id);
    }

    // Walk forward via replacedByFlashcardId.
    const chain: Flashcard[] = [];
    const seen = new Set<string>();
    let current: Flashcard | undefined = root;
    while (current && !seen.has(current.id)) {
      chain.push(current);
      seen.add(current.id);
      current = current.replacedByFlashcardId ? byId.get(current.replacedByFlashcardId) : undefined;
    }
    return chain;
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
