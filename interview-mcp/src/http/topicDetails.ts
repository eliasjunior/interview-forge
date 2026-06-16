import fs from "fs";
import path from "path";
import { eq } from "drizzle-orm";
import type { AppDb } from "../db/client.js";
import { topicQuestions, topics } from "../db/schema.js";
import { FileKnowledgeStore, parseKnowledgeFile } from "../knowledge/file.js";
import type { QuestionExerciseGuidance } from "../knowledge/port.js";

export interface KnowledgeTopicListItem {
  file: string;
  displayName: string;
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

function collectKnowledgeMarkdownFiles(dir: string): string[] {
  const files: string[] = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "exercises") continue;
      files.push(...collectKnowledgeMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files;
}

export function listKnowledgeTopics(knowledgeDir: string): KnowledgeTopicListItem[] {
  if (!fs.existsSync(knowledgeDir)) return [];

  return collectKnowledgeMarkdownFiles(knowledgeDir)
    .map((filePath) => {
      const parsed = parseKnowledgeFile(filePath);
      if (!parsed) return null;

      return {
        file: path.basename(filePath, ".md"),
        displayName: parsed.topic,
      };
    })
    .filter((entry): entry is KnowledgeTopicListItem => entry != null)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function listKnowledgeTopicsFromDb(db: AppDb): KnowledgeTopicListItem[] {
  return db
    .select({ file: topics.id, displayName: topics.title })
    .from(topics)
    .orderBy(topics.title)
    .all();
}

export function normalizeTopicPlanKey(knowledgeDir: string, topic: unknown) {
  const normalizedTopic = normalizeTopicLookupKey(topic);
  if (!normalizedTopic) return typeof topic === "string" ? topic : "";
  const match = listKnowledgeTopics(knowledgeDir).find((entry) =>
    normalizeTopicLookupKey(entry.file) === normalizedTopic ||
    normalizeTopicLookupKey(entry.displayName) === normalizedTopic
  );
  return match?.file ?? normalizedTopic;
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

export function getKnowledgeTopicDetails(knowledgeDir: string, topic: unknown): KnowledgeTopicDetails | null {
  const normalizedTopic = normalizeTopicLookupKey(topic);
  if (!normalizedTopic) return null;
  const topicEntry = listKnowledgeTopics(knowledgeDir).find((entry) =>
    normalizeTopicLookupKey(entry.file) === normalizedTopic ||
    normalizeTopicLookupKey(entry.displayName) === normalizedTopic
  );

  if (!topicEntry) return null;

  const store = new FileKnowledgeStore(knowledgeDir);
  const knowledgeTopic = store.findByTopic(topicEntry.displayName);
  if (!knowledgeTopic) return null;

  return {
    file: topicEntry.file,
    topic: knowledgeTopic.topic,
    summary: knowledgeTopic.summary,
    questions: knowledgeTopic.questions.map((text, index) => ({
      index,
      text,
      difficulty: knowledgeTopic.questionDifficulties[index] ?? null,
      exercise: knowledgeTopic.questionExercises?.[index] ?? { fit: "none" },
    })),
  };
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
