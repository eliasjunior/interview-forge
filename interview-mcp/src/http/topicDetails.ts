import { eq } from "drizzle-orm";
import type { AppDb } from "../db/client.js";
import { topicQuestions, topics } from "../db/schema.js";
import type { QuestionExerciseGuidance } from "../knowledge/port.js";

export interface KnowledgeTopicListItem {
  file: string;
  displayName: string;
  category: string;
}

export interface KnowledgeTopicQuestionDetail {
  index: number;
  text: string;
  difficulty: string | null;
  exercise: QuestionExerciseGuidance;
}

export interface KnowledgeTopicDetails {
  file: string;
  topic: string;
  summary: string;
  questions: KnowledgeTopicQuestionDetail[];
}

function normalizeTopicLookupKey(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function listKnowledgeTopicsFromDb(db: AppDb): KnowledgeTopicListItem[] {
  return db
    .select({ file: topics.id, displayName: topics.title, category: topics.category })
    .from(topics)
    .orderBy(topics.title)
    .all();
}

export function normalizeTopicPlanKeyFromDb(db: AppDb, topic: unknown) {
  const normalizedTopic = normalizeTopicLookupKey(topic);
  if (!normalizedTopic) return typeof topic === "string" ? topic : "";
  const match = listKnowledgeTopicsFromDb(db).find((entry) =>
    normalizeTopicLookupKey(entry.file) === normalizedTopic ||
    normalizeTopicLookupKey(entry.displayName) === normalizedTopic
  );
  return match?.file ?? normalizedTopic;
}

export function getKnowledgeTopicDetailsFromDb(db: AppDb, topic: unknown): KnowledgeTopicDetails | null {
  const normalizedTopic = normalizeTopicLookupKey(topic);
  if (!normalizedTopic) return null;

  const topicEntry = listKnowledgeTopicsFromDb(db).find((entry) =>
    normalizeTopicLookupKey(entry.file) === normalizedTopic ||
    normalizeTopicLookupKey(entry.displayName) === normalizedTopic
  );
  if (!topicEntry) return null;

  const topicRow = db.select().from(topics).where(eq(topics.id, topicEntry.file)).get();
  if (!topicRow) return null;

  const questionRows = db
    .select()
    .from(topicQuestions)
    .where(eq(topicQuestions.topicId, topicRow.id))
    .orderBy(topicQuestions.order)
    .all();

  return {
    file: topicRow.id,
    topic: topicRow.title,
    summary: topicRow.summary,
    questions: questionRows.map((question, index) => ({
      index,
      text: question.text,
      difficulty: question.difficulty,
      exercise: { fit: "none" },
    })),
  };
}
