import { asc, eq } from "drizzle-orm";
import type { Mistake } from "@mock-interview/shared";
import type { AppDb } from "../client.js";
import { mistakes } from "../schema.js";
import type { MistakeRepository } from "../../repositories/mistakeRepository.js";

export class SQLiteMistakeRepository implements MistakeRepository {
  constructor(private readonly db: AppDb) {}

  list(topic?: string): Mistake[] {
    const rows = topic
      ? this.db.select().from(mistakes).where(eq(mistakes.topic, topic)).orderBy(asc(mistakes.createdAt)).all()
      : this.db.select().from(mistakes).orderBy(asc(mistakes.createdAt)).all();

    return rows.map((r) => ({
      id: r.id,
      mistake: r.mistake,
      pattern: r.pattern,
      fix: r.fix,
      topic: r.topic ?? undefined,
      createdAt: r.createdAt,
      sourceAnswerId: r.sourceAnswerId ?? undefined,
      sourceFlashcardId: r.sourceFlashcardId ?? undefined,
      replacementFlashcardId: r.replacementFlashcardId ?? undefined,
    }));
  }

  insert(mistake: Mistake): void {
    this.db.insert(mistakes).values({
      id: mistake.id,
      mistake: mistake.mistake,
      pattern: mistake.pattern,
      fix: mistake.fix,
      topic: mistake.topic ?? null,
      createdAt: mistake.createdAt,
      sourceAnswerId: mistake.sourceAnswerId ?? null,
      sourceFlashcardId: mistake.sourceFlashcardId ?? null,
      replacementFlashcardId: mistake.replacementFlashcardId ?? null,
    }).run();
  }
}
