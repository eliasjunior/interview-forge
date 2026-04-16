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
import type { Exercise, Flashcard, KnowledgeGraph, Mistake, Session, Skill } from "@mock-interview/shared";

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
    parentFlashcardId: undefined,
    replacedByFlashcardId: undefined,
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

function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "skill-1",
    name: "Thread Pool Sizing",
    confidence: 2,
    subSkills: [
      { name: "CPU-bound sizing", confidence: 2 },
      { name: "IO-bound sizing", confidence: 1 },
    ],
    relatedProblems: ["job queue saturation", "worker starvation"],
    createdAt: "2026-03-01T10:12:00.000Z",
    updatedAt: "2026-03-01T10:12:00.000Z",
    ...overrides,
  };
}

function makeMistake(overrides: Partial<Mistake> = {}): Mistake {
  return {
    id: "mistake-1",
    mistake: "Explained concurrency without separating CPU-bound and IO-bound work.",
    pattern: "Happens when discussing thread pools or async throughput tuning.",
    fix: "Classify the workload first, then size workers and queues with that model.",
    topic: "Java concurrency",
    createdAt: "2026-03-01T10:13:00.000Z",
    sourceAnswerId: undefined,
    sourceFlashcardId: undefined,
    replacementFlashcardId: undefined,
    ...overrides,
  };
}

function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: "exercise-1",
    name: "Thread Pool Capacity Lab",
    slug: "thread-pool-capacity-lab",
    topic: "java-concurrency",
    language: "java",
    difficulty: 3,
    description: "Tune worker and queue settings for a background job processor.",
    scenario: "A service processes email jobs under bursty traffic.",
    problemMeaning: [
      "Avoid throughput collapse under bursts.",
      "Balance latency against queue growth.",
    ],
    tags: ["concurrency", "thread-pool", "capacity"],
    prerequisites: [
      {
        name: "Producer Consumer Basics",
        reason: "You need queue semantics before tuning throughput.",
      },
    ],
    filePath: "java-concurrency/thread-pool-capacity-lab.md",
    createdAt: "2026-03-01T10:14:00.000Z",
    ...overrides,
  };
}

function normalizeSession(session: Session | null) {
  if (!session) return null;

  return {
    ...session,
    seeded: session.seeded ?? false,
    customContent: session.customContent,
    problemTitle: session.problemTitle,
    focusArea: session.focusArea,
    pendingAnswerMode: session.pendingAnswerMode,
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
      answerMode: evaluation.answerMode,
      strongAnswer: evaluation.strongAnswer,
      followUpQuestion: evaluation.followUpQuestion,
      followUpType: evaluation.followUpType ?? undefined,
      followUpFocus: evaluation.followUpFocus ?? undefined,
      followUpRationale: evaluation.followUpRationale ?? undefined,
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
    archivedAt: flashcard.archivedAt,
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
      const session = makeSession({
        topic: "Linked Lists",
        problemTitle: "Delete Middle Node",
      });
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

  test("session repository saveMany upserts nested records and deleteById removes a session", () => {
    const { sqlite, repositories } = setupRepositories();

    try {
      const original = makeSession({
        id: "session-save-many-a",
        topic: "Java concurrency",
        questions: ["Original question"],
        messages: [
          { role: "interviewer", content: "Original prompt", timestamp: "2026-03-01T10:00:00.000Z" },
        ],
        evaluations: [
          {
            questionIndex: 0,
            question: "Original question",
            answer: "Original answer",
            score: 2,
            feedback: "Needs more detail.",
            needsFollowUp: true,
            followUpQuestion: "What would you change?",
          },
        ],
        concepts: [{ word: "throughput", cluster: "performance" }],
      });
      const secondary = makeSession({
        id: "session-save-many-b",
        topic: "JVM internals",
        createdAt: "2026-03-02T09:00:00.000Z",
        endedAt: "2026-03-02T09:20:00.000Z",
        messages: [],
        evaluations: [],
        concepts: [],
      });

      repositories.sessions.saveMany([original, secondary]);

      const updatedOriginal = makeSession({
        ...original,
        topic: "Advanced Java concurrency",
        currentQuestionIndex: 1,
        questions: ["Updated question 1", "Updated question 2"],
        messages: [
          { role: "interviewer", content: "Updated prompt", timestamp: "2026-03-01T10:03:00.000Z" },
          { role: "candidate", content: "Updated answer", timestamp: "2026-03-01T10:04:00.000Z" },
        ],
        evaluations: [
          {
            questionIndex: 1,
            question: "Updated question 2",
            answer: "Updated answer",
            score: 4,
            feedback: "Much clearer.",
            needsFollowUp: false,
            strongAnswer: "Tie sizing to workload characteristics.",
          },
        ],
        concepts: [{ word: "backpressure", cluster: "reliability" }],
        summary: "Updated summary",
      });

      repositories.sessions.saveMany([updatedOriginal]);

      assert.deepEqual(
        normalizeSession(repositories.sessions.getById(updatedOriginal.id)),
        normalizeSession(updatedOriginal)
      );
      assert.deepEqual(
        repositories.sessions.list().map((session) => normalizeSession(session)),
        [updatedOriginal, secondary].map((session) => normalizeSession(session))
      );
      assert.equal(repositories.sessions.deleteById("missing-session"), false);
      assert.equal(repositories.sessions.deleteById(secondary.id), true);
      assert.equal(repositories.sessions.getById(secondary.id), null);
      assert.deepEqual(
        repositories.sessions.list().map((session) => normalizeSession(session)),
        [updatedOriginal].map((session) => normalizeSession(session))
      );
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

  test("flashcard repository saveMany upserts cards and deleteBySourceSessionId removes related rows", () => {
    const { sqlite, repositories } = setupRepositories();

    try {
      const firstSession = makeSession({ id: "session-source-a" });
      const secondSession = makeSession({
        id: "session-source-b",
        topic: "JVM internals",
        createdAt: "2026-03-02T09:59:00.000Z",
        endedAt: "2026-03-02T10:10:00.000Z",
      });

      repositories.sessions.save(firstSession);
      repositories.sessions.save(secondSession);

      const firstCard = makeFlashcard({
        id: "fc-many-a",
        tags: ["queues", "throughput"],
        source: {
          sessionId: firstSession.id,
          questionIndex: 0,
          originalScore: 2,
        },
      });
      const secondCard = makeFlashcard({
        id: "fc-many-b",
        createdAt: "2026-03-01T10:12:00.000Z",
        dueDate: "2026-03-03T10:12:00.000Z",
        topic: "JVM internals",
        tags: ["jvm", "memory"],
        source: {
          sessionId: secondSession.id,
          questionIndex: 1,
          originalScore: 3,
        },
      });

      repositories.flashcards.saveMany([firstCard, secondCard]);

      const updatedFirstCard = {
        ...firstCard,
        back: "Updated explanation with queue saturation details.",
        tags: ["queues", "saturation"],
        lastReviewedAt: "2026-03-02T08:00:00.000Z",
      };

      repositories.flashcards.saveMany([updatedFirstCard]);

      assert.deepEqual(
        normalizeFlashcard(repositories.flashcards.getById(updatedFirstCard.id)),
        normalizeFlashcard(updatedFirstCard)
      );
      assert.equal(repositories.flashcards.deleteBySourceSessionId("missing-session"), 0);
      assert.equal(repositories.flashcards.deleteBySourceSessionId(firstSession.id), 1);
      assert.equal(repositories.flashcards.getById(updatedFirstCard.id), null);
      assert.deepEqual(
        repositories.flashcards.list().map((flashcard) => normalizeFlashcard(flashcard)),
        [secondCard].map((flashcard) => normalizeFlashcard(flashcard))
      );
    } finally {
      sqlite.close();
    }
  });

  test("skill repository lists, filters, finds, and updates persisted skills", () => {
    const { sqlite, repositories } = setupRepositories();

    try {
      const lowerConfidence = makeSkill();
      const higherConfidence = makeSkill({
        id: "skill-2",
        name: "Lock Contention Diagnostics",
        confidence: 4,
        subSkills: [{ name: "contention tracing", confidence: 4 }],
        relatedProblems: ["deadlock debugging"],
        createdAt: "2026-03-01T10:15:00.000Z",
        updatedAt: "2026-03-01T10:15:00.000Z",
      });

      repositories.skills.insert(higherConfidence);
      repositories.skills.insert(lowerConfidence);

      assert.deepEqual(repositories.skills.list(), [lowerConfidence, higherConfidence]);
      assert.deepEqual(repositories.skills.list(2), [lowerConfidence]);
      assert.equal(repositories.skills.findByName("missing"), null);
      assert.deepEqual(repositories.skills.findByName(lowerConfidence.name), lowerConfidence);

      const updated = {
        ...lowerConfidence,
        confidence: 5,
        subSkills: [{ name: "CPU-bound sizing", confidence: 5 }],
        relatedProblems: ["bounded queues", "backpressure"],
        updatedAt: "2026-03-02T08:00:00.000Z",
      };

      repositories.skills.update(updated);

      assert.deepEqual(repositories.skills.findByName(updated.name), updated);
    } finally {
      sqlite.close();
    }
  });

  test("mistake repository stores optional topics and filters by topic", () => {
    const { sqlite, repositories } = setupRepositories();

    try {
      const concurrencyMistake = makeMistake();
      const untaggedMistake = makeMistake({
        id: "mistake-2",
        topic: undefined,
        createdAt: "2026-03-01T10:14:00.000Z",
      });

      repositories.mistakes.insert(untaggedMistake);
      repositories.mistakes.insert(concurrencyMistake);

      assert.deepEqual(repositories.mistakes.list(), [concurrencyMistake, untaggedMistake]);
      assert.deepEqual(repositories.mistakes.list("Java concurrency"), [concurrencyMistake]);
      assert.deepEqual(repositories.mistakes.list("missing-topic"), []);
    } finally {
      sqlite.close();
    }
  });

  test("exercise repository finds records and applies difficulty, topic, and tag filters", () => {
    const { sqlite, repositories } = setupRepositories();

    try {
      const mediumExercise = makeExercise();
      const easyExercise = makeExercise({
        id: "exercise-2",
        name: "Producer Consumer Warmup",
        slug: "producer-consumer-warmup",
        difficulty: 2,
        topic: "java-concurrency",
        tags: ["concurrency", "queue"],
        prerequisites: [],
        filePath: "java-concurrency/producer-consumer-warmup.md",
        createdAt: "2026-03-01T10:10:00.000Z",
      });
      const otherTopicExercise = makeExercise({
        id: "exercise-3",
        name: "LRU Cache Basics",
        slug: "lru-cache-basics",
        topic: "data-structures",
        difficulty: 1,
        tags: ["cache", "map"],
        prerequisites: [],
        filePath: "data-structures/lru-cache-basics.md",
        createdAt: "2026-03-01T10:16:00.000Z",
      });

      repositories.exercises.insert(mediumExercise);
      repositories.exercises.insert(easyExercise);
      repositories.exercises.insert(otherTopicExercise);

      assert.deepEqual(repositories.exercises.findByName(mediumExercise.name), mediumExercise);
      assert.deepEqual(repositories.exercises.findBySlug(easyExercise.slug), easyExercise);
      assert.equal(repositories.exercises.findByName("missing"), null);
      assert.equal(repositories.exercises.findBySlug("missing"), null);
      assert.deepEqual(
        repositories.exercises.list(),
        [otherTopicExercise, easyExercise, mediumExercise]
      );
      assert.deepEqual(repositories.exercises.list("java-concurrency"), [easyExercise, mediumExercise]);
      assert.deepEqual(
        repositories.exercises.list(undefined, 2),
        [otherTopicExercise, easyExercise]
      );
      assert.deepEqual(repositories.exercises.list("java-concurrency", 2), [easyExercise]);
      assert.deepEqual(
        repositories.exercises.list(undefined, undefined, ["concurrency", "queue"]),
        [easyExercise]
      );
      assert.deepEqual(
        repositories.exercises.list("java-concurrency", undefined, ["concurrency", "capacity"]),
        [mediumExercise]
      );
    } finally {
      sqlite.close();
    }
  });
});
