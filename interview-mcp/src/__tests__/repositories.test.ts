import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../db/schema.js";
import { createSqliteClient } from "../db/client.js";
import { createSqliteRepositories } from "../db/repositories/createRepositories.js";
import type { Flashcard, KnowledgeGraph, Session } from "@mock-interview/shared";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "../../drizzle");

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "session-1",
    topic: "Java concurrency",
    interviewType: "design",
    state: "ENDED",
    currentQuestionIndex: 2,
    questions: ["What is a thread pool?", "When does contention happen?"],
    messages: [
      {
        role: "interviewer",
        content: "What is a thread pool?",
        timestamp: "2026-03-01T10:00:00.000Z",
      },
      {
        role: "candidate",
        content: "A reusable set of worker threads.",
        timestamp: "2026-03-01T10:01:00.000Z",
      },
    ],
    evaluations: [
      {
        questionIndex: 0,
        question: "What is a thread pool?",
        answer: "A reusable set of worker threads.",
        score: 3,
        feedback: "Good start, but missing queueing and saturation details.",
        needsFollowUp: true,
        followUpQuestion: "How do you size a thread pool?",
        deeperDive: "- **sizing** -> understand CPU-bound vs IO-bound pools",
      },
    ],
    concepts: [
      { word: "thread pool", cluster: "core concepts" },
      { word: "Lock Contention", cluster: "tradeoffs" },
    ],
    summary: "Session summary",
    createdAt: "2026-03-01T09:59:00.000Z",
    endedAt: "2026-03-01T10:10:00.000Z",
    knowledgeSource: "ai",
    ...overrides,
  };
}

function makeFlashcard(overrides: Partial<Flashcard> = {}): Flashcard {
  return {
    id: "fc-session-1-q0",
    front: "What is a thread pool?",
    back: "A reusable set of worker threads that executes queued tasks.",
    topic: "Java concurrency",
    tags: ["java", "concurrency", "thread", "pool"],
    difficulty: "medium",
    source: {
      sessionId: "session-1",
      questionIndex: 0,
      originalScore: 3,
    },
    createdAt: "2026-03-01T10:11:00.000Z",
    dueDate: "2026-03-01T10:11:00.000Z",
    interval: 1,
    easeFactor: 2.5,
    repetitions: 0,
    ...overrides,
  };
}

function makeGraph(): KnowledgeGraph {
  return {
    nodes: [
      { id: "thread-pool", label: "thread pool", clusters: ["core concepts", "practical usage"] },
      { id: "contention", label: "contention", clusters: ["tradeoffs"] },
    ],
    edges: [
      {
        source: "thread-pool",
        target: "contention",
        weight: 2,
        kind: "cooccurrence",
        relation: "co-occurs-with",
      },
    ],
    sessions: ["session-1"],
  };
}

function normalizeSession(session: Session | null) {
  if (!session) return null;

  return {
    ...session,
    seeded: session.seeded ?? false,
    customContent: session.customContent,
    focusArea: session.focusArea,
    sessionKind: session.sessionKind,
    studyCategory: session.studyCategory,
    sourcePath: session.sourcePath,
    sourceType: session.sourceType,
    questLevel: session.questLevel,
    questFormat: session.questFormat,
    questChoices: session.questChoices,
    questAnswers: session.questAnswers,
    evaluations: session.evaluations.map((evaluation) => ({
      ...evaluation,
      strongAnswer: evaluation.strongAnswer,
      followUpQuestion: evaluation.followUpQuestion,
      deeperDive: evaluation.deeperDive,
    })),
    concepts: session.concepts && session.concepts.length > 0 ? session.concepts : undefined,
  };
}

function normalizeFlashcard(flashcard: Flashcard | null) {
  if (!flashcard) return null;

  return {
    ...flashcard,
    tags: [...flashcard.tags].sort((a, b) => a.localeCompare(b)),
    lastReviewedAt: flashcard.lastReviewedAt,
  };
}

function setupRepositories() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "first-mcp-db-test-"));
  tempDirs.push(tempDir);

  const dbPath = path.join(tempDir, "app.db");
  const sqlite = createSqliteClient(dbPath);
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder });

  return {
    sqlite,
    repositories: createSqliteRepositories(db),
  };
}

describe("sqlite repositories", () => {
  test("migrations create a usable database and repositories round-trip domain objects", () => {
    const { sqlite, repositories } = setupRepositories();

    try {
      const session = makeSession();
      const flashcard = makeFlashcard();
      const graph = makeGraph();

      repositories.sessions.save(session);
      repositories.flashcards.save(flashcard);
      repositories.graph.save(graph);

      assert.deepEqual(
        normalizeSession(repositories.sessions.getById(session.id)),
        normalizeSession(session)
      );
      assert.deepEqual(
        normalizeFlashcard(repositories.flashcards.getById(flashcard.id)),
        normalizeFlashcard(flashcard)
      );
      assert.deepEqual(repositories.graph.get(), graph);
    } finally {
      sqlite.close();
    }
  });

  test("session repository preserves ordering and replaceAll resets state cleanly", () => {
    const { sqlite, repositories } = setupRepositories();

    try {
      const first = makeSession({
        id: "session-a",
        questions: ["Q2", "Q1", "Q3"],
        messages: [
          { role: "candidate", content: "second", timestamp: "2026-03-01T10:02:00.000Z" },
          { role: "interviewer", content: "first", timestamp: "2026-03-01T10:01:00.000Z" },
        ],
        evaluations: [
          {
            questionIndex: 2,
            question: "Q3",
            answer: "A3",
            score: 2,
            feedback: "Needs work",
            needsFollowUp: true,
          },
          {
            questionIndex: 0,
            question: "Q1",
            answer: "A1",
            score: 4,
            feedback: "Good",
            needsFollowUp: false,
          },
        ],
      });

      const second = makeSession({
        id: "session-b",
        topic: "JVM internals",
        questions: ["Only one question"],
        messages: [],
        evaluations: [],
        concepts: [],
      });

      repositories.sessions.replaceAll({
        [first.id]: first,
        [second.id]: second,
      });

      assert.deepEqual(
        repositories.sessions.list().map((session) => normalizeSession(session)),
        [first, second].map((session) => normalizeSession(session))
      );
      assert.equal(repositories.sessions.getById("missing"), null);
    } finally {
      sqlite.close();
    }
  });

  test("flashcard repository replaceAll removes old rows and keeps source mapping intact", () => {
    const { sqlite, repositories } = setupRepositories();

    try {
      const session = makeSession();
      repositories.sessions.save(session);

      const oldCard = makeFlashcard({ id: "fc-old" });
      const newCard = makeFlashcard({
        id: "fc-new",
        front: "What causes contention?",
        source: {
          sessionId: session.id,
          questionIndex: 1,
          originalScore: 2,
        },
      });

      repositories.flashcards.save(oldCard);
      repositories.flashcards.replaceAll([newCard]);

      assert.equal(repositories.flashcards.getById(oldCard.id), null);
      assert.deepEqual(
        repositories.flashcards.list().map((flashcard) => normalizeFlashcard(flashcard)),
        [newCard].map((flashcard) => normalizeFlashcard(flashcard))
      );
    } finally {
      sqlite.close();
    }
  });
});
