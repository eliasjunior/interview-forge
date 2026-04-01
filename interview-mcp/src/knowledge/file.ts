import fs from "fs";
import path from "path";
import type { KnowledgeStore, KnowledgeTopic, WarmUpLevelContent, WarmUpQuestion } from "./port.js";
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

function parseQuestions(section: string): string[] {
  const questions: string[] = [];
  let current: string[] = [];

  for (const line of section.split("\n")) {
    if (/^\d+\./.test(line)) {
      // Start of a new numbered item — flush the previous one
      if (current.length) questions.push(current.join(" ").replace(/\s+/g, " ").trim());
      current = [line.replace(/^\d+\.\s*/, "").trim()];
    } else if (current.length > 0) {
      // Continuation line (indented bullets, extra text) — belongs to current question
      const trimmed = line.trim();
      if (trimmed) current.push(trimmed);
    }
  }
  if (current.length) questions.push(current.join(" ").replace(/\s+/g, " ").trim());

  return questions.filter(Boolean);
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

function parseFile(filePath: string): KnowledgeTopic | null {
  try {
    const md = fs.readFileSync(filePath, "utf-8");

    // Title: first # heading
    const titleMatch = md.match(/^#\s+(.+)/m);
    const topic = titleMatch ? titleMatch[1].trim() : path.basename(filePath, ".md");

    const summary              = extractSection(md, "Summary");
    const questionsSection     = extractSection(md, "Questions");
    const criteriaSection      = extractSection(md, "Evaluation Criteria");
    const conceptsSection      = extractSection(md, "Concepts");
    const difficultySection    = extractSection(md, "Difficulty");

    const questions            = parseQuestions(questionsSection);
    const evaluationCriteria   = parseCriteria(criteriaSection);
    const concepts             = parseConcepts(conceptsSection);
    const questionDifficulties = parseDifficulties(difficultySection);
    const warmupLevels         = parseWarmupLevels(md);

    if (questions.length === 0) {
      console.error(`[knowledge] ${path.basename(filePath)}: no questions found — skipping`);
      return null;
    }

    return { topic, summary, questions, evaluationCriteria, concepts, questionDifficulties, warmupLevels };
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
      const parsed = parseFile(path.join(dir, file));
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
