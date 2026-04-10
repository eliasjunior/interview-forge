import fs from "fs";
import path from "path";
import { FileKnowledgeStore } from "../knowledge/file.js";
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

export function listKnowledgeTopics(knowledgeDir: string): KnowledgeTopicListItem[] {
  if (!fs.existsSync(knowledgeDir)) return [];

  return fs.readdirSync(knowledgeDir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const content = fs.readFileSync(path.join(knowledgeDir, file), "utf8");
      const match = content.match(/^#\s+(.+)/m);
      return {
        file: file.replace(".md", ""),
        displayName: match ? match[1].trim() : file.replace(".md", ""),
      };
    });
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
