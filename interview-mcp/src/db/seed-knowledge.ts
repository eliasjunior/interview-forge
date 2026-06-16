/**
 * Seed script: parse all knowledge .md files → insert into DB tables.
 * Idempotent — deletes and re-inserts rows for each topic on every run.
 *
 * Run: npx tsx src/db/seed-knowledge.ts
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { eq } from "drizzle-orm";
import { createDb } from "./client.js";
import { topics, topicQuestions, topicConcepts, warmupQuestions } from "./schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = path.resolve(__dirname, "../../data/knowledge/design-interview");

const db = createDb();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractSection(md: string, heading: string): string {
  const regex = new RegExp(`##\\s+${heading}[^\n]*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, "i");
  const match = md.match(regex);
  return match ? match[1].trim() : "";
}

function extractSubSection(md: string, heading: string): string {
  const regex = new RegExp(`###\\s+${heading}[^\n]*\\n([\\s\\S]*?)(?=\\n###\\s|\\n##\\s|$)`, "i");
  const match = md.match(regex);
  return match ? match[1].trim() : "";
}

function parseQuestions(section: string): string[] {
  return section
    .split(/(?=^\d+\.)/m)
    .map((b) => b.replace(/^\d+\.\s*/, "").trim())
    .filter(Boolean);
}

function parseDifficulty(section: string): Record<number, string> {
  const map: Record<number, string> = {};
  for (const line of section.split("\n")) {
    const m = line.match(/Question\s+(\d+):\s*(\w+)/i);
    if (m) map[parseInt(m[1])] = m[2].toLowerCase();
  }
  return map;
}

function parseEvalCriteria(section: string): Record<number, string> {
  const map: Record<number, string> = {};
  const blocks = section.split(/(?=^-\s+Question\s+\d+:)/m).filter(Boolean);
  for (const block of blocks) {
    const m = block.match(/^-\s+Question\s+(\d+):\s*([\s\S]*)/i);
    if (m) map[parseInt(m[1])] = m[2].trim();
  }
  return map;
}

function parseConcepts(section: string): Array<{ cluster: string; term: string }> {
  const result: Array<{ cluster: string; term: string }> = [];
  for (const line of section.split("\n")) {
    const m = line.match(/^-\s+([\w\s]+):\s*(.+)/);
    if (!m) continue;
    const cluster = m[1].trim();
    const terms = m[2].split(",").map((t) => t.trim()).filter(Boolean);
    for (const term of terms) result.push({ cluster, term });
  }
  return result;
}

interface MCQ {
  stem: string;
  choiceA: string;
  choiceB: string;
  choiceC: string;
  choiceD: string;
  correctAnswer: string;
}

function parseMCQs(section: string): MCQ[] {
  const mcqs: MCQ[] = [];
  // split on numbered question starts
  const blocks = section.split(/(?=^\d+\.)/m).filter(Boolean);

  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 6) continue;

    const stem = lines[0].replace(/^\d+\.\s*/, "").trim();
    const choiceA = (lines[1].match(/^A\)\s*(.+)/) ?? [])[1]?.trim();
    const choiceB = (lines[2].match(/^B\)\s*(.+)/) ?? [])[1]?.trim();
    const choiceC = (lines[3].match(/^C\)\s*(.+)/) ?? [])[1]?.trim();
    const choiceD = (lines[4].match(/^D\)\s*(.+)/) ?? [])[1]?.trim();
    const answerLine = lines.find((l) => /^Answer:/i.test(l));
    const correctAnswer = answerLine?.replace(/^Answer:\s*/i, "").trim().toUpperCase();

    if (!choiceA || !choiceB || !choiceC || !choiceD || !correctAnswer) continue;
    mcqs.push({ stem, choiceA, choiceB, choiceC, choiceD, correctAnswer });
  }

  return mcqs;
}

// ─── File collector ───────────────────────────────────────────────────────────

function collectMdFiles(dir: string): Array<{ filePath: string; category: string }> {
  const results: Array<{ filePath: string; category: string }> = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      for (const child of fs.readdirSync(full, { withFileTypes: true })) {
        if (child.isFile() && child.name.endsWith(".md") && child.name !== "CLAUDE.md") {
          results.push({ filePath: path.join(full, child.name), category: entry.name });
        }
      }
    }
  }
  return results;
}

// ─── Seed one file ────────────────────────────────────────────────────────────

function seedFile(filePath: string, category: string) {
  const md = fs.readFileSync(filePath, "utf-8");
  const slug = path.basename(filePath, ".md");
  const now = new Date().toISOString();

  const titleMatch = md.match(/^#\s+(.+)/m);
  const title = titleMatch ? titleMatch[1].trim() : slug;
  const summary = extractSection(md, "Summary");

  if (!summary) {
    console.warn(`  [skip] ${slug} — no Summary section`);
    return;
  }

  // Delete existing rows (cascades to child tables)
  db.delete(topics).where(eq(topics.id, slug)).run();

  // Insert topic
  db.insert(topics).values({ id: slug, category, title, summary, updatedAt: now }).run();

  // Questions + difficulty + eval criteria
  const questionSection = extractSection(md, "Questions");
  const difficultySection = extractSection(md, "Difficulty");
  const evalSection = extractSection(md, "Evaluation Criteria");

  const questions = parseQuestions(questionSection);
  const difficulty = parseDifficulty(difficultySection);
  const evalCriteria = parseEvalCriteria(evalSection);

  for (let i = 0; i < questions.length; i++) {
    const order = i + 1;
    db.insert(topicQuestions).values({
      topicId: slug,
      order,
      text: questions[i],
      difficulty: difficulty[order] ?? "foundation",
      evaluationCriteria: evalCriteria[order] ?? "",
    }).run();
  }

  // Concepts
  const conceptSection = extractSection(md, "Concepts");
  const concepts = parseConcepts(conceptSection);
  for (const { cluster, term } of concepts) {
    db.insert(topicConcepts).values({ topicId: slug, cluster, term }).run();
  }

  // Warm-up MCQs (Level 0 only)
  const warmupSection = extractSection(md, "Warm-up Quests");
  const level0Section = extractSubSection(warmupSection, "Level 0");
  const mcqs = parseMCQs(level0Section);

  for (const mcq of mcqs) {
    db.insert(warmupQuestions).values({
      topicId: slug,
      level: 0,
      stem: mcq.stem,
      choiceA: mcq.choiceA,
      choiceB: mcq.choiceB,
      choiceC: mcq.choiceC,
      choiceD: mcq.choiceD,
      correctAnswer: mcq.correctAnswer,
      weight: 3,
      linkedQuestionOrder: null,
    }).run();
  }

  console.log(`  [ok] ${slug} — ${questions.length} questions, ${concepts.length} concepts, ${mcqs.length} MCQs`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const files = collectMdFiles(KNOWLEDGE_DIR);
console.log(`Seeding ${files.length} knowledge files…\n`);

for (const { filePath, category } of files) {
  seedFile(filePath, category);
}

console.log("\nDone.");
