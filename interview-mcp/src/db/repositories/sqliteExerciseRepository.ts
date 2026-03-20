import { asc, eq, lte, and } from "drizzle-orm";
import type { Exercise, ExercisePrerequisite } from "@mock-interview/shared";
import type { AppDb } from "../client.js";
import { exercises } from "../schema.js";
import type { ExerciseRepository } from "../../repositories/exerciseRepository.js";

export class SQLiteExerciseRepository implements ExerciseRepository {
  constructor(private readonly db: AppDb) {}

  list(topic?: string, maxDifficulty?: number, tags?: string[]): Exercise[] {
    let query = this.db.select().from(exercises).$dynamic();

    if (topic && maxDifficulty !== undefined) {
      query = query.where(and(eq(exercises.topic, topic), lte(exercises.difficulty, maxDifficulty)));
    } else if (topic) {
      query = query.where(eq(exercises.topic, topic));
    } else if (maxDifficulty !== undefined) {
      query = query.where(lte(exercises.difficulty, maxDifficulty));
    }

    const requestedTags = (tags ?? []).map((tag) => tag.trim()).filter(Boolean);

    return query
      .orderBy(asc(exercises.difficulty))
      .all()
      .map((r) => this.hydrate(r))
      .filter((exercise) => {
        if (requestedTags.length === 0) return true;
        return requestedTags.every((tag) => exercise.tags.includes(tag));
      });
  }

  findByName(name: string): Exercise | null {
    const row = this.db.select().from(exercises).where(eq(exercises.name, name)).get();
    return row ? this.hydrate(row) : null;
  }

  findBySlug(slug: string): Exercise | null {
    const row = this.db.select().from(exercises).where(eq(exercises.slug, slug)).get();
    return row ? this.hydrate(row) : null;
  }

  insert(exercise: Exercise): void {
    this.db.insert(exercises).values(this.dehydrate(exercise)).run();
  }

  private hydrate(row: typeof exercises.$inferSelect): Exercise {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      topic: row.topic,
      language: row.language,
      difficulty: row.difficulty as Exercise["difficulty"],
      description: row.description,
      scenario: row.scenario,
      problemMeaning: JSON.parse(row.problemMeaning) as string[],
      tags: JSON.parse(row.tags) as string[],
      prerequisites: JSON.parse(row.prerequisites) as ExercisePrerequisite[],
      filePath: row.filePath,
      createdAt: row.createdAt,
    };
  }

  private dehydrate(exercise: Exercise) {
    return {
      id: exercise.id,
      name: exercise.name,
      slug: exercise.slug,
      topic: exercise.topic,
      language: exercise.language,
      difficulty: exercise.difficulty,
      description: exercise.description,
      scenario: exercise.scenario,
      problemMeaning: JSON.stringify(exercise.problemMeaning),
      tags: JSON.stringify(exercise.tags),
      prerequisites: JSON.stringify(exercise.prerequisites),
      filePath: exercise.filePath,
      createdAt: exercise.createdAt,
    };
  }
}
