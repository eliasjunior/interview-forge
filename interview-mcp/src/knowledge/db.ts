import { eq } from "drizzle-orm";
import type { AppDb } from "../db/client.js";
import { topics, topicQuestions, topicConcepts, warmupQuestions } from "../db/schema.js";
import type { KnowledgeStore, KnowledgeTopic, WarmUpLevelContent } from "./port.js";
import type { Concept } from "@mock-interview/shared";

// ─────────────────────────────────────────────────────────────────────────────
// DbKnowledgeStore — reads curated topic data from SQLite instead of .md files
// ─────────────────────────────────────────────────────────────────────────────

function normalise(s: string): string {
  return s.toLowerCase().replace(/[\s\-_]+/g, "");
}

export class DbKnowledgeStore implements KnowledgeStore {
  private readonly cache: Map<string, KnowledgeTopic> = new Map();
  private readonly topicNames: string[] = [];

  constructor(db: AppDb) {
    const rows = db.select().from(topics).all();

    for (const row of rows) {
      const questions = db
        .select()
        .from(topicQuestions)
        .where(eq(topicQuestions.topicId, row.id))
        .orderBy(topicQuestions.order)
        .all();

      const conceptRows = db
        .select()
        .from(topicConcepts)
        .where(eq(topicConcepts.topicId, row.id))
        .all();

      const mcqRows = db
        .select()
        .from(warmupQuestions)
        .where(eq(warmupQuestions.topicId, row.id))
        .all();

      const concepts: Concept[] = conceptRows.map((c) => ({ word: c.term, cluster: c.cluster }));

      const level0Questions = mcqRows
        .filter((m) => m.level === 0)
        .map((m) => ({
          question: m.stem,
          choices: [m.choiceA, m.choiceB, m.choiceC, m.choiceD],
          answer: m.correctAnswer,
        }));

      const warmupLevels: Partial<Record<0 | 1 | 2, WarmUpLevelContent>> = {};
      if (level0Questions.length > 0) warmupLevels[0] = { questions: level0Questions };

      const entry: KnowledgeTopic = {
        topic: row.title,
        summary: row.summary,
        questions: questions.map((q) => q.text),
        evaluationCriteria: questions.map((q) => q.evaluationCriteria),
        questionDifficulties: questions.map((q) => q.difficulty),
        concepts,
        warmupLevels: Object.keys(warmupLevels).length ? warmupLevels : undefined,
      };

      const slugKey  = normalise(row.id);
      const titleKey = normalise(row.title);

      this.cache.set(slugKey, entry);
      if (titleKey !== slugKey) this.cache.set(titleKey, entry);

      this.topicNames.push(row.title);
      console.error(`[knowledge:db] loaded "${row.title}" (${questions.length} questions, ${mcqRows.length} MCQs)`);
    }
  }

  findByTopic(topic: string): KnowledgeTopic | null {
    return this.cache.get(normalise(topic)) ?? null;
  }

  listTopics(): string[] {
    return [...this.topicNames];
  }
}
