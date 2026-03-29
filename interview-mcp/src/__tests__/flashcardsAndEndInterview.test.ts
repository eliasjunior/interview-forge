import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { Flashcard, KnowledgeGraph, Mistake, Session, Skill, Exercise, Concept } from "@mock-interview/shared";
import type { ToolDeps } from "../tools/deps.js";
import { registerEndInterviewTool } from "../tools/endInterview.js";
import { registerGetDueFlashcardsTool } from "../tools/getDueFlashcards.js";

type Handler = (args: Record<string, unknown>) => Promise<{ content: Array<{ text: string }> }>;

function makeFlashcard(overrides: Partial<Flashcard> = {}): Flashcard {
  return {
    id: "fc-1",
    front: "What is JWT?",
    back: "A signed token format.",
    topic: "JWT authentication",
    tags: ["jwt"],
    difficulty: "medium",
    createdAt: "2026-03-28T10:00:00.000Z",
    dueDate: "2026-03-28T09:00:00.000Z",
    interval: 1,
    easeFactor: 2.5,
    repetitions: 0,
    ...overrides,
  };
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "session-1",
    topic: "JWT authentication",
    interviewType: "design",
    state: "FOLLOW_UP",
    currentQuestionIndex: 1,
    questions: ["What is JWT?", "How do you validate it?"],
    messages: [],
    evaluations: [
      {
        questionIndex: 0,
        question: "What is JWT?",
        answer: "A token format.",
        score: 3,
        feedback: "Needs trust-boundary details.",
        needsFollowUp: true,
      },
    ],
    createdAt: "2026-03-28T10:00:00.000Z",
    knowledgeSource: "file",
    ...overrides,
  };
}

function makeDeps(overrides: Partial<ToolDeps> = {}) {
  const flashcards: Flashcard[] = [
    makeFlashcard(),
    makeFlashcard({
      id: "fc-2",
      topic: "Kafka",
      dueDate: "2026-03-28T08:00:00.000Z",
      repetitions: 3,
      lastReviewedAt: "2026-03-27T09:00:00.000Z",
    }),
    makeFlashcard({
      id: "fc-3",
      topic: "JWT authentication",
      dueDate: "2099-01-01T00:00:00.000Z",
    }),
  ];
  const sessions: Record<string, Session> = {
    "session-1": makeSession(),
    "session-2": makeSession({
      id: "session-2",
      state: "ENDED",
      endedAt: "2026-03-28T10:20:00.000Z",
    }),
  };
  let finalizeCalls = 0;

  const deps: ToolDeps = {
    ai: null,
    knowledge: {
      listTopics: () => [],
      findByTopic: () => null,
    } as ToolDeps["knowledge"],
    uiPort: "5173",
    stateError: (msg) => ({ content: [{ type: "text", text: JSON.stringify({ error: msg }) }] }),
    loadSessions: () => sessions,
    saveSessions: () => {},
    loadGraph: () => ({ nodes: [], edges: [], sessions: [] } as KnowledgeGraph),
    saveGraph: () => {},
    saveReport: () => "report.md",
    inspectSessionDeletion: () => null,
    deleteSessionById: () => null,
    loadFlashcards: () => flashcards,
    saveFlashcard: () => {},
    saveFlashcards: () => {},
    loadMistakes: () => [] as Mistake[],
    saveMistake: () => {},
    loadSkills: () => [] as Skill[],
    findSkillByName: () => null,
    saveSkill: () => {},
    updateSkill: () => {},
    loadExercises: () => [] as Exercise[],
    findExerciseByName: () => null,
    saveExercise: () => {},
    exercisesDir: "/tmp/exercises",
    scopesDir: "/tmp/scopes",
    generateId: () => "generated-id",
    assertState: () => ({ ok: true }),
    findLast: <T,>(arr: T[], pred: (item: T) => boolean) => [...arr].reverse().find(pred),
    calcAvgScore: () => "3.0",
    buildSummary: () => "summary",
    finalizeSession: async (session: Session, allSessions: Record<string, Session>) => {
      finalizeCalls += 1;
      session.state = "ENDED";
      session.endedAt = "2026-03-28T10:30:00.000Z";
      allSessions[session.id] = session;
      return {
        summary: "Interview ended",
        avgScore: "3.0",
        concepts: [{ word: "jwt", cluster: "security" }] as Concept[],
        reportFile: "reports/session-1.md",
      };
    },
    ...overrides,
  };

  return { deps, flashcards, sessions, getFinalizeCalls: () => finalizeCalls };
}

function captureTool(register: (server: any, deps: ToolDeps) => void, deps: ToolDeps) {
  const handlers = new Map<string, Handler>();
  const server = {
    registerTool(name: string, _config: object, handler: Handler) {
      handlers.set(name, handler);
    },
  };
  register(server, deps);
  return handlers;
}

function parse(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0]!.text);
}

describe("flashcard and end-interview tools", () => {
  test("get_due_flashcards returns only due cards, sorted oldest first", async () => {
    const { deps } = makeDeps();
    const handlers = captureTool(registerGetDueFlashcardsTool, deps);

    const payload = parse(await handlers.get("get_due_flashcards")!({}));
    assert.equal(payload.total, 3);
    assert.equal(payload.due, 2);
    assert.deepEqual(payload.cards.map((card: { id: string }) => card.id), ["fc-2", "fc-1"]);
    assert.match(payload.hint, /review_flashcard/);
  });

  test("get_due_flashcards can filter by topic and reports when nothing is due", async () => {
    const { deps } = makeDeps();
    const handlers = captureTool(registerGetDueFlashcardsTool, deps);

    const filtered = parse(await handlers.get("get_due_flashcards")!({ topic: "JWT authentication" }));
    assert.equal(filtered.due, 1);
    assert.equal(filtered.cards[0].id, "fc-1");

    const emptyDeps = makeDeps({
      loadFlashcards: () => [
        makeFlashcard({ id: "future-1", dueDate: "2099-01-01T00:00:00.000Z" }),
      ],
    }).deps;
    const emptyHandlers = captureTool(registerGetDueFlashcardsTool, emptyDeps);
    const empty = parse(await emptyHandlers.get("get_due_flashcards")!({}));
    assert.equal(empty.due, 0);
    assert.match(empty.hint, /No cards are due right now/);
  });

  test("end_interview returns stateError for missing or already ended sessions", async () => {
    const { deps } = makeDeps();
    const handlers = captureTool(registerEndInterviewTool, deps);

    const missing = parse(await handlers.get("end_interview")!({ sessionId: "missing" }));
    assert.equal(missing.error, "Session 'missing' not found.");

    const ended = parse(await handlers.get("end_interview")!({ sessionId: "session-2" }));
    assert.equal(ended.error, "Session is already ended.");
  });

  test("end_interview finalizes active sessions and returns summary metadata", async () => {
    const { deps, sessions, getFinalizeCalls } = makeDeps();
    const handlers = captureTool(registerEndInterviewTool, deps);

    const payload = parse(await handlers.get("end_interview")!({ sessionId: "session-1" }));
    assert.equal(payload.sessionId, "session-1");
    assert.equal(payload.state, "ENDED");
    assert.equal(payload.summary, "Interview ended");
    assert.equal(payload.conceptsExtracted, 1);
    assert.equal(payload.reportFile, "reports/session-1.md");
    assert.equal(payload.recommendations.drill.tool, "start_drill");
    assert.equal(payload.recommendations.drill.args.sessionId, "session-1");
    assert.equal(payload.recommendations.deepExplanation.mode, "deep_explanation");
    assert.equal(getFinalizeCalls(), 1);
    assert.equal(sessions["session-1"]?.state, "ENDED");
    assert.equal(sessions["session-1"]?.endedAt, "2026-03-28T10:30:00.000Z");
  });
});
