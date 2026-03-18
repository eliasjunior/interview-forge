import path from "path";
import { z } from "zod";
import type { Flashcard, KnowledgeGraph, Session } from "@mock-interview/shared";
import type { AppRepositories } from "../repositories/index.js";

export interface LegacyJsonFs {
  existsSync(path: string): boolean;
  readFileSync(path: string, encoding: "utf8"): string;
}

export interface ImportLegacyJsonDeps {
  dataDir: string;
  repositories: AppRepositories;
  fsLike: LegacyJsonFs;
  logger?: Pick<Console, "log" | "warn">;
}

export interface ImportLegacyJsonResult {
  sessionsImported: number;
  flashcardsImported: number;
  graphNodesImported: number;
  graphEdgesImported: number;
  graphSessionsImported: number;
}

const sessionSchema = z.custom<Session>();
const flashcardSchema = z.custom<Flashcard>();
const graphSchema = z.custom<KnowledgeGraph>();

function normalizeLegacySession(session: Session): Session {
  return {
    ...session,
    interviewType: session.interviewType ?? "design",
    knowledgeSource: session.knowledgeSource ?? (session.sourcePath ? "file" : "ai"),
    questions: session.questions ?? [],
    messages: session.messages ?? [],
    evaluations: session.evaluations ?? [],
  };
}

function normalizeLegacyFlashcard(flashcard: Flashcard): Flashcard {
  return {
    ...flashcard,
    tags: flashcard.tags ?? [],
  };
}

function readJsonFile<T>(deps: ImportLegacyJsonDeps, filename: string, schema: z.ZodType<T>, fallback: T): T {
  const filePath = path.join(deps.dataDir, filename);
  if (!deps.fsLike.existsSync(filePath)) return fallback;

  const raw = JSON.parse(deps.fsLike.readFileSync(filePath, "utf8"));
  return schema.parse(raw);
}

function loadSessions(deps: ImportLegacyJsonDeps): Record<string, Session> {
  const sessions = readJsonFile(
    deps,
    "sessions.json",
    z.record(z.string(), sessionSchema),
    {}
  );

  return Object.fromEntries(
    Object.entries(sessions).map(([id, session]) => [id, normalizeLegacySession(session)])
  );
}

function loadFlashcards(deps: ImportLegacyJsonDeps): Flashcard[] {
  const filePath = path.join(deps.dataDir, "flashcards.json");
  if (!deps.fsLike.existsSync(filePath)) return [];

  const raw = JSON.parse(deps.fsLike.readFileSync(filePath, "utf8")) as unknown;
  const normalized = Array.isArray(raw)
    ? raw
    : z.object({ flashcards: z.array(flashcardSchema).default([]) }).parse(raw).flashcards;

  return z.array(flashcardSchema).parse(normalized).map(normalizeLegacyFlashcard);
}

function loadGraph(deps: ImportLegacyJsonDeps): KnowledgeGraph {
  return readJsonFile(
    deps,
    "graph.json",
    graphSchema,
    { nodes: [], edges: [], sessions: [] }
  );
}

export function importLegacyJsonData(deps: ImportLegacyJsonDeps): ImportLegacyJsonResult {
  const logger = deps.logger ?? console;

  const sessionsById = loadSessions(deps);
  const sessions = Object.values(sessionsById);
  const flashcards = loadFlashcards(deps);
  const graph = loadGraph(deps);

  deps.repositories.sessions.replaceAll(sessionsById);
  deps.repositories.flashcards.replaceAll(flashcards);
  deps.repositories.graph.save(graph);

  const result: ImportLegacyJsonResult = {
    sessionsImported: sessions.length,
    flashcardsImported: flashcards.length,
    graphNodesImported: graph.nodes.length,
    graphEdgesImported: graph.edges.length,
    graphSessionsImported: graph.sessions.length,
  };

  logger.log(
    [
      "Legacy JSON import completed.",
      `sessions=${result.sessionsImported}`,
      `flashcards=${result.flashcardsImported}`,
      `graphNodes=${result.graphNodesImported}`,
      `graphEdges=${result.graphEdgesImported}`,
      `graphSessions=${result.graphSessionsImported}`,
    ].join(" ")
  );

  return result;
}
