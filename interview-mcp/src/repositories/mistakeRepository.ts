import type { Mistake } from "@mock-interview/shared";

export interface MistakeRepository {
  list(topic?: string): Mistake[];
  insert(mistake: Mistake): void;
}
