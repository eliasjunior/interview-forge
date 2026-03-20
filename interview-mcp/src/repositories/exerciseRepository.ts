import type { Exercise } from "@mock-interview/shared";

export interface ExerciseRepository {
  list(topic?: string, maxDifficulty?: number, tags?: string[]): Exercise[];
  findByName(name: string): Exercise | null;
  findBySlug(slug: string): Exercise | null;
  insert(exercise: Exercise): void;
}
