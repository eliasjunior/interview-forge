import dotenv from "dotenv";
dotenv.config();

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import type { AIProvider } from "./ai/index.js";
import { createKnowledgeStore, type KnowledgeStore } from "./knowledge/index.js";
import type { Session, Concept, KnowledgeGraph, Flashcard, Mistake, Skill, Exercise } from "@mock-interview/shared";
import {
  assertState,
  generateId,
  findLast,
  calcAvgScore,
  buildSummary,
  buildReport,
  buildTranscript,
  mergeConceptsIntoGraph,
  generateFlashcards,
} from "./interviewUtils.js";
import { persistFlashcard } from "./tools/createFlashcard.js";
import { registerAllTools } from "./tools/registerAllTools.js";
import type { ToolDeps } from "./tools/deps.js";
import { createDb } from "./db/client.js";
import { createSqliteRepositories } from "./db/repositories/createRepositories.js";
import { normalizeConcepts } from "./graph/concepts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ai: AIProvider | null = null;
const knowledge: KnowledgeStore = createKnowledgeStore();

function stateError(msg: string) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }],
  };
}

const DATA_DIR = path.resolve(__dirname, "../data");
const REPORTS_DIR      = path.join(DATA_DIR, "reports");
const EXERCISES_DIR    = path.join(DATA_DIR, "knowledge", "exercises");
const SCOPES_DIR       = path.join(DATA_DIR, "knowledge", "scopes");
const UI_PORT = process.env.PORT ?? "3001";
const db = createDb();
const repositories = createSqliteRepositories(db);

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(EXERCISES_DIR)) fs.mkdirSync(EXERCISES_DIR, { recursive: true });
}

function loadSessions(): Record<string, Session> {
  return Object.fromEntries(
    repositories.sessions.list().map((session) => [session.id, session])
  );
}

function saveSessions(sessions: Record<string, Session>) {
  repositories.sessions.replaceAll(sessions);
}

function loadGraph(): KnowledgeGraph {
  return repositories.graph.get();
}

function saveGraph(graph: KnowledgeGraph) {
  repositories.graph.save(graph);
}

function loadFlashcards(): Flashcard[] {
  return repositories.flashcards.list();
}

function saveFlashcard(card: Flashcard) {
  repositories.flashcards.save(card);
}

function saveFlashcards(cards: Flashcard[]) {
  repositories.flashcards.replaceAll(cards);
}

function loadMistakes(topic?: string): Mistake[] {
  return repositories.mistakes.list(topic);
}

function saveMistake(mistake: Mistake) {
  repositories.mistakes.insert(mistake);
}

function loadSkills(maxConfidence?: number): Skill[] {
  return repositories.skills.list(maxConfidence);
}

function findSkillByName(name: string): Skill | null {
  return repositories.skills.findByName(name);
}

function saveSkill(skill: Skill): void {
  repositories.skills.insert(skill);
}

function updateSkill(skill: Skill): void {
  repositories.skills.update(skill);
}

function loadExercises(topic?: string, maxDifficulty?: number, tags?: string[]): Exercise[] {
  return repositories.exercises.list(topic, maxDifficulty, tags);
}

function findExerciseByName(name: string): Exercise | null {
  return repositories.exercises.findByName(name);
}

function saveExercise(exercise: Exercise): void {
  repositories.exercises.insert(exercise);
}

function saveReport(session: Session) {
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const filename = path.join(REPORTS_DIR, `${session.id}.md`);
  fs.writeFileSync(filename, buildReport(session));
  return filename;
}

async function extractConcepts(session: Session): Promise<Concept[]> {
  const entry = knowledge.findByTopic(session.topic);
  if (entry && entry.concepts.length > 0) {
    console.error(`[knowledge] using pre-defined concepts for "${session.topic}"`);
    return entry.concepts;
  }
  if (ai) {
    return ai.extractConcepts(session.topic, buildTranscript(session));
  }
  console.error(`[knowledge] no concepts found for "${session.topic}" and AI is disabled — returning empty`);
  return [];
}

async function finalizeSession(session: Session, sessions: Record<string, Session>) {
  const concepts = normalizeConcepts(await extractConcepts(session)).map(({ word, cluster }) => ({
    word,
    cluster,
  }));

  const summary = buildSummary(session);
  const avgScore = calcAvgScore(session.evaluations);

  session.state = "ENDED";
  session.summary = summary;
  session.concepts = concepts;
  session.endedAt = new Date().toISOString();
  saveSessions(sessions);

  const graph = loadGraph();
  saveGraph(mergeConceptsIntoGraph(graph, concepts, session.id));
  const reportFile = saveReport(session);

  // Generate flashcards for any question scored below the threshold.
  // Delegates to persistFlashcard (create_flashcard tool) — single place that
  // knows how to save a card idempotently.
  const newCards = generateFlashcards(session);
  let savedCount = 0;
  for (const card of newCards) {
    if (persistFlashcard(deps, card)) savedCount++;
  }
  if (savedCount > 0) {
    console.error(`[flashcards] added ${savedCount} card(s) for session ${session.id}`);
  }

  return { summary, avgScore, concepts, reportFile, flashcardsGenerated: newCards.length };
}

const server = new McpServer({
  name: "interview-mcp",
  version: "0.2.0",
});

const deps: ToolDeps = {
  ai,
  knowledge,
  uiPort: UI_PORT,
  stateError,
  loadSessions,
  saveSessions,
  loadGraph,
  saveGraph,
  saveReport,
  loadFlashcards,
  saveFlashcard,
  saveFlashcards,
  loadMistakes,
  saveMistake,
  loadSkills,
  findSkillByName,
  saveSkill,
  updateSkill,
  loadExercises,
  findExerciseByName,
  saveExercise,
  exercisesDir: EXERCISES_DIR,
  scopesDir: SCOPES_DIR,
  generateId,
  assertState,
  findLast,
  calcAvgScore,
  buildSummary,
  finalizeSession,
};

registerAllTools(server, deps);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("interview-mcp v0.2.0 — mode: knowledge files only — running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
