import { asc, eq, lte } from "drizzle-orm";
import type { Skill, SkillSubSkill } from "@mock-interview/shared";
import type { AppDb } from "../client.js";
import { skills } from "../schema.js";
import type { SkillRepository } from "../../repositories/skillRepository.js";

export class SQLiteSkillRepository implements SkillRepository {
  constructor(private readonly db: AppDb) {}

  list(maxConfidence?: number): Skill[] {
    const rows = maxConfidence !== undefined
      ? this.db.select().from(skills).where(lte(skills.confidence, maxConfidence)).orderBy(asc(skills.confidence)).all()
      : this.db.select().from(skills).orderBy(asc(skills.confidence)).all();

    return rows.map((r) => this.hydrate(r));
  }

  findByName(name: string): Skill | null {
    const row = this.db.select().from(skills).where(eq(skills.name, name)).get();
    return row ? this.hydrate(row) : null;
  }

  insert(skill: Skill): void {
    this.db.insert(skills).values(this.dehydrate(skill)).run();
  }

  update(skill: Skill): void {
    this.db.update(skills)
      .set({
        confidence: skill.confidence,
        subSkills: JSON.stringify(skill.subSkills),
        relatedProblems: JSON.stringify(skill.relatedProblems),
        updatedAt: skill.updatedAt,
      })
      .where(eq(skills.id, skill.id))
      .run();
  }

  private hydrate(row: typeof skills.$inferSelect): Skill {
    return {
      id: row.id,
      name: row.name,
      confidence: row.confidence,
      subSkills: JSON.parse(row.subSkills) as SkillSubSkill[],
      relatedProblems: JSON.parse(row.relatedProblems) as string[],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private dehydrate(skill: Skill) {
    return {
      id: skill.id,
      name: skill.name,
      confidence: skill.confidence,
      subSkills: JSON.stringify(skill.subSkills),
      relatedProblems: JSON.stringify(skill.relatedProblems),
      createdAt: skill.createdAt,
      updatedAt: skill.updatedAt,
    };
  }
}
