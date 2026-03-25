import fs from "fs";
import path from "path";
import type { KnowledgeStore, KnowledgeTopic } from "./port.js";
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
  return section
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^\d+\./.test(l))           // lines starting with "1.", "2.", …
    .map((l) => l.replace(/^\d+\.\s*/, "").trim())
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

    if (questions.length === 0) {
      console.error(`[knowledge] ${path.basename(filePath)}: no questions found — skipping`);
      return null;
    }

    return { topic, summary, questions, evaluationCriteria, concepts, questionDifficulties };
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
