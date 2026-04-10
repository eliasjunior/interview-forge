import fs from "fs";
import path from "path";
import type { KnowledgeStore, KnowledgeTopic, QuestionExerciseGuidance, WarmUpLevelContent, WarmUpQuestion } from "./port.js";
import type { Concept } from "@mock-interview/shared";

// ─────────────────────────────────────────────────────────────────────────────
// FileKnowledgeStore — adapter
//
// Reads knowledge files from a directory (data/knowledge/*.md).
// Each file follows a specific markdown structure — see jwt.md for the template.
//
// Matching is case-insensitive: "JWT", "jwt", "Json Web Token" all resolve
// to jwt.md because we normalise both the filename stem and the query.
// ─────────────────────────────────────────────────────────────────────────────

function normalise(s: string): string {
  return s.toLowerCase().replace(/[\s\-_]+/g, "");
}

// ─────────────────────────────────────────────────────────────────────────────
// Markdown parser
// Extracts sections delimited by ## headings
// ─────────────────────────────────────────────────────────────────────────────

function extractSection(md: string, heading: string): string {
  const regex = new RegExp(`##\\s+${heading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, "i");
  const match = md.match(regex);
  return match ? match[1].trim() : "";
}

function parseQuestionBlocks(section: string): string[] {
  return section.split(/(?=^\d+\.)/m).map((b) => b.trim()).filter(Boolean);
}

function parseQuestionExerciseGuidance(block: string): QuestionExerciseGuidance {
  const lines = block.split("\n");
  const guidance: QuestionExerciseGuidance = { fit: "none" };
  let activeList: "constraints" | "acceptance" | null = null;

  for (const rawLine of lines.slice(1)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/^Exercise fit:/i.test(line)) {
      const fit = line.replace(/^Exercise fit:\s*/i, "").trim().toLowerCase();
      guidance.fit = fit === "micro" || fit === "standard" || fit === "none" ? fit : "none";
      activeList = null;
      continue;
    }
    if (/^Exercise goal:/i.test(line)) {
      guidance.goal = line.replace(/^Exercise goal:\s*/i, "").trim();
      activeList = null;
      continue;
    }
    if (/^Exercise owner:/i.test(line)) {
      guidance.owner = line.replace(/^Exercise owner:\s*/i, "").trim();
      activeList = null;
      continue;
    }
    if (/^Exercise scope:/i.test(line)) {
      guidance.scope = line.replace(/^Exercise scope:\s*/i, "").trim();
      activeList = null;
      continue;
    }
    if (/^Exercise constraints:/i.test(line)) {
      guidance.constraints = [];
      activeList = "constraints";
      continue;
    }
    if (/^Exercise acceptance:/i.test(line)) {
      guidance.acceptance = [];
      activeList = "acceptance";
      continue;
    }
    if (/^Exercise seed:/i.test(line)) {
      guidance.seed = line.replace(/^Exercise seed:\s*/i, "").trim();
      activeList = null;
      continue;
    }
    if (/^-\s+/.test(line) && activeList) {
      const item = line.replace(/^-\s+/, "").trim();
      if (item) {
        if (activeList === "constraints") guidance.constraints?.push(item);
        if (activeList === "acceptance") guidance.acceptance?.push(item);
      }
      continue;
    }

    activeList = null;
  }

  return guidance;
}

function stripExerciseGuidanceFromBlock(block: string): string {
  const lines = block.split("\n");
  const kept: string[] = [];
  let skippingExerciseList = false;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (
      /^Exercise fit:/i.test(trimmed) ||
      /^Exercise goal:/i.test(trimmed) ||
      /^Exercise owner:/i.test(trimmed) ||
      /^Exercise scope:/i.test(trimmed) ||
      /^Exercise constraints:/i.test(trimmed) ||
      /^Exercise acceptance:/i.test(trimmed) ||
      /^Exercise seed:/i.test(trimmed)
    ) {
      skippingExerciseList = /^Exercise constraints:/i.test(trimmed) || /^Exercise acceptance:/i.test(trimmed);
      continue;
    }

    if (skippingExerciseList && /^-\s+/.test(trimmed)) {
      continue;
    }

    if (trimmed) skippingExerciseList = false;
    kept.push(rawLine);
  }

  return kept.join("\n").trim();
}

function parseQuestionExercises(section: string): QuestionExerciseGuidance[] {
  return parseQuestionBlocks(section).map((block) => parseQuestionExerciseGuidance(block));
}

function parseQuestionTexts(section: string): string[] {
  return parseQuestionBlocks(section)
    .map((block) => stripExerciseGuidanceFromBlock(block))
    .map((block) => {
      const lines = block.split("\n");
      const first = lines[0]?.replace(/^\d+\.\s*/, "").trim() ?? "";
      const rest = lines.slice(1).map((l) => l.trim());
      return [first, ...rest].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    })
    .filter(Boolean);
}

function parseCriteria(section: string): string[] {
  // Each line: "- Question N: <criteria>"  or  "- Q<N>: <criteria>"
  return section
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^-\s*(Question\s*\d+|Q\d+)\s*:/i.test(l))
    .map((l) => l.replace(/^-\s*(Question\s*\d+|Q\d+)\s*:\s*/i, "").trim())
    .filter(Boolean);
}

function parseDifficulties(section: string): string[] {
  // Each line: "- Question N: foundation|intermediate|advanced"
  return section
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^-\s*(Question\s*\d+|Q\d+)\s*:/i.test(l))
    .map((l) => l.replace(/^-\s*(Question\s*\d+|Q\d+)\s*:\s*/i, "").trim().toLowerCase())
    .filter(Boolean);
}

function parseConcepts(section: string): Concept[] {
  // Each line: "- <cluster>: word1, word2, word3"
  const VALID_CLUSTERS = ["core concepts", "practical usage", "tradeoffs", "best practices"];
  const concepts: Concept[] = [];

  for (const line of section.split("\n")) {
    const trimmed = line.replace(/^-\s*/, "").trim();
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;

    const cluster = trimmed.slice(0, colonIdx).trim().toLowerCase();
    if (!VALID_CLUSTERS.includes(cluster)) continue;

    const words = trimmed
      .slice(colonIdx + 1)
      .split(",")
      .map((w) => w.trim())
      .filter(Boolean);

    for (const word of words) {
      concepts.push({ word, cluster });
    }
  }

  return concepts;
}

// ─────────────────────────────────────────────────────────────────────────────
// Warm-up quest parsers
// ─────────────────────────────────────────────────────────────────────────────

/** Extract a ### sub-section from inside an already-extracted ## section body. */
function extractSubSection(sectionBody: string, heading: string): string {
  const regex = new RegExp(`###\\s+${heading}[^\\n]*\\n([\\s\\S]*?)(?=\\n###\\s|$)`, "i");
  const match = sectionBody.match(regex);
  return match ? match[1].trim() : "";
}

/** Split a section into blocks per numbered item (1. … 2. …). */
function splitIntoBlocks(section: string): string[] {
  return section.split(/(?=^\d+\.)/m).map((b) => b.trim()).filter(Boolean);
}

function parseMCQQuestions(section: string): WarmUpQuestion[] {
  return splitIntoBlocks(section).map((block): WarmUpQuestion | null => {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return null;
    const question = lines[0].replace(/^\d+\.\s*/, "").trim();
    const choices: string[] = [];
    let answer = "";
    for (const line of lines.slice(1)) {
      if (/^[A-Z]\)/.test(line)) choices.push(line.replace(/^[A-Z]\)\s*/, "").trim());
      else if (/^Answer:/i.test(line)) answer = line.replace(/^Answer:\s*/i, "").trim();
    }
    if (!question) return null;
    return { question, choices: choices.length ? choices : undefined, answer };
  }).filter((q): q is WarmUpQuestion => q !== null);
}

function parseFillBlankQuestions(section: string): WarmUpQuestion[] {
  return splitIntoBlocks(section).map((block): WarmUpQuestion | null => {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return null;
    const question = lines[0].replace(/^\d+\.\s*/, "").trim();
    let answer = "";
    for (const line of lines.slice(1)) {
      if (/^Answer:/i.test(line)) answer = line.replace(/^Answer:\s*/i, "").trim();
    }
    if (!question) return null;
    return { question, answer };
  }).filter((q): q is WarmUpQuestion => q !== null);
}

function parseGuidedQuestions(section: string): WarmUpQuestion[] {
  return splitIntoBlocks(section).map((block): WarmUpQuestion | null => {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return null;
    const question = lines[0].replace(/^\d+\.\s*/, "").trim();
    const hints: string[] = [];
    let answer = "";
    for (const line of lines.slice(1)) {
      if (/^Hint:/i.test(line)) hints.push(line.replace(/^Hint:\s*/i, "").trim());
      else if (/^Answer:/i.test(line)) answer = line.replace(/^Answer:\s*/i, "").trim();
    }
    if (!question) return null;
    return { question, hint: hints.length ? hints.join(" | ") : undefined, answer };
  }).filter((q): q is WarmUpQuestion => q !== null);
}

function parseWarmupLevels(md: string): Partial<Record<0 | 1 | 2, WarmUpLevelContent>> | undefined {
  const sectionBody = extractSection(md, "Warm-up Quests");
  if (!sectionBody) return undefined;

  const result: Partial<Record<0 | 1 | 2, WarmUpLevelContent>> = {};

  const l0 = extractSubSection(sectionBody, "Level 0");
  if (l0) result[0] = { questions: parseMCQQuestions(l0) };

  const l1 = extractSubSection(sectionBody, "Level 1");
  if (l1) result[1] = { questions: parseMCQQuestions(l1) };

  const l2 = extractSubSection(sectionBody, "Level 2");
  if (l2) result[2] = { questions: parseGuidedQuestions(l2) };

  return Object.keys(result).length ? result : undefined;
}

export function parseKnowledgeMarkdown(md: string, fallbackTopic: string): KnowledgeTopic | null {
  try {
    // Title: first # heading
    const titleMatch = md.match(/^#\s+(.+)/m);
    const topic = titleMatch ? titleMatch[1].trim() : fallbackTopic;

    const summary              = extractSection(md, "Summary");
    const questionsSection     = extractSection(md, "Questions");
    const criteriaSection      = extractSection(md, "Evaluation Criteria");
    const conceptsSection      = extractSection(md, "Concepts");
    const difficultySection    = extractSection(md, "Difficulty");

    const questions            = parseQuestionTexts(questionsSection);
    const questionExercises    = parseQuestionExercises(questionsSection);
    const evaluationCriteria   = parseCriteria(criteriaSection);
    const concepts             = parseConcepts(conceptsSection);
    const questionDifficulties = parseDifficulties(difficultySection);
    const warmupLevels         = parseWarmupLevels(md);

    if (questions.length === 0) {
      return null;
    }

    return { topic, summary, questions, questionExercises, evaluationCriteria, concepts, questionDifficulties, warmupLevels };
  } catch (err) {
    console.error(`[knowledge] failed to parse markdown for ${fallbackTopic}:`, err);
    return null;
  }
}

export function parseKnowledgeFile(filePath: string): KnowledgeTopic | null {
  try {
    const md = fs.readFileSync(filePath, "utf-8");
    const parsed = parseKnowledgeMarkdown(md, path.basename(filePath, ".md"));
    if (!parsed) {
      console.error(`[knowledge] ${path.basename(filePath)}: no questions found — skipping`);
      return null;
    }
    return parsed;
  } catch (err) {
    console.error(`[knowledge] failed to parse ${filePath}:`, err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FileKnowledgeStore
// ─────────────────────────────────────────────────────────────────────────────

export class FileKnowledgeStore implements KnowledgeStore {
  /** topic normalised key → parsed entry */
  private readonly cache: Map<string, KnowledgeTopic>;

  /** original topic names for listTopics() */
  private readonly topicNames: string[];

  constructor(dir: string) {
    this.cache = new Map();
    this.topicNames = [];

    if (!fs.existsSync(dir)) return;

    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".md"))) {
      const parsed = parseKnowledgeFile(path.join(dir, file));
      if (!parsed) continue;

      // Index by normalised filename stem AND normalised topic title
      // so both "jwt" (filename) and "JSON Web Token" (title) match
      const stemKey  = normalise(path.basename(file, ".md"));
      const titleKey = normalise(parsed.topic);

      this.cache.set(stemKey, parsed);
      if (titleKey !== stemKey) this.cache.set(titleKey, parsed);

      this.topicNames.push(parsed.topic);
      console.error(`[knowledge] loaded "${parsed.topic}" (${parsed.questions.length} questions)`);
    }
  }

  findByTopic(topic: string): KnowledgeTopic | null {
    return this.cache.get(normalise(topic)) ?? null;
  }

  listTopics(): string[] {
    return [...this.topicNames];
  }
}
