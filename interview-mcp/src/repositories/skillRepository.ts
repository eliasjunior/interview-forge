import type { Skill } from "@mock-interview/shared";

export interface SkillRepository {
  list(maxConfidence?: number): Skill[];
  findByName(name: string): Skill | null;
  insert(skill: Skill): void;
  update(skill: Skill): void;
}
