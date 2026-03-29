import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { Concept, Exercise, Flashcard, KnowledgeGraph, Mistake, Session, Skill } from "@mock-interview/shared";
import type { KnowledgeStore, KnowledgeTopic } from "../knowledge/port.js";
import type { ToolDeps } from "../tools/deps.js";
import { assertState, buildSummary, calcAvgScore } from "../interviewUtils.js";
import { registerStartWarmUpTool } from "../tools/startWarmUp.js";

type Handler = (args: Record<string, unknown>) => Promise<{ content: Array<{ text: string }> }>;

function makeSessionStore(initial: Record<string, Session> = {}) {
  const store: Record<string, Session> = { ...initial };
  return {
    load: () => ({ ...store }),
    save: (sessions: Record<string, Session>) => {
      Object.assign(store, sessions);
    },
    get: (id: string) => store[id],
  };
}

let idCounter = 0;
function makeDeps(
  sessionStore: ReturnType<typeof makeSessionStore>,
  knowledge: KnowledgeStore,
): ToolDeps {
  return {
    ai: null,
    knowledge,
    uiPort: "5173",
    stateError: (msg: string) => ({ content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }] }),
    loadSessions: () => sessionStore.load(),
    saveSessions: (sessions: Record<string, Session>) => sessionStore.save(sessions),
    loadGraph: () => ({ nodes: [], edges: [], sessions: [] } as KnowledgeGraph),
    saveGraph: () => {},
    saveReport: (session: Session) => `reports/${session.id}.md`,
    loadFlashcards: () => [] as Flashcard[],
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
    generateId: () => `warmup-branch-${++idCounter}`,
    assertState,
    findLast: <T,>(arr: T[], pred: (item: T) => boolean) => [...arr].reverse().find(pred),
    calcAvgScore,
    buildSummary,
    inspectSessionDeletion: () => null,
    deleteSessionById: () => null,
    finalizeSession: async (session: Session, sessions: Record<string, Session>) => {
      session.state = "ENDED";
      session.endedAt = new Date().toISOString();
      sessions[session.id] = session;
      sessionStore.save(sessions);
      return {
        summary: "done",
        avgScore: "5.0",
        concepts: [] as Concept[],
        reportFile: "report.md",
      };
    },
  } as unknown as ToolDeps;
}

function captureHandler(
  register: (server: any, deps: ToolDeps) => void,
  deps: ToolDeps,
): Handler {
  let handler!: Handler;
  const mockServer = {
    registerTool(_name: string, _config: object, h: Handler) {
      handler = h;
    },
  };
  register(mockServer, deps);
  return handler;
}

function parse(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

describe("start_warm_up branch coverage", () => {
  test("redirects to start_interview for level 3 and above", async () => {
    const topic: KnowledgeTopic = {
      topic: "JWT authentication",
      summary: "JWT fundamentals",
      questions: ["What is JWT?"],
      evaluationCriteria: ["Explain signature verification."],
      questionDifficulties: ["foundation"],
      concepts: [{ word: "JWT", cluster: "security" }],
      warmupLevels: {
        0: { questions: [{ question: "What is JWT?", choices: ["Token", "Cache"], answer: "A" }] },
      },
    };
    const knowledge: KnowledgeStore = {
      findByTopic: () => topic,
      listTopics: () => [topic.topic],
    };

    const sessionStore = makeSessionStore({
      interviewA: {
        id: "interviewA",
        topic: "JWT authentication",
        interviewType: "design",
        state: "ENDED",
        currentQuestionIndex: 1,
        questions: ["Q1"],
        messages: [],
        evaluations: [{ questionIndex: 0, question: "Q1", answer: "A", score: 3, feedback: "ok", needsFollowUp: false }],
        createdAt: "2026-03-28T10:00:00.000Z",
        endedAt: "2026-03-28T10:10:00.000Z",
        knowledgeSource: "file",
      },
      interviewB: {
        id: "interviewB",
        topic: "JWT authentication",
        interviewType: "design",
        state: "ENDED",
        currentQuestionIndex: 1,
        questions: ["Q1"],
        messages: [],
        evaluations: [{ questionIndex: 0, question: "Q1", answer: "A", score: 3, feedback: "ok", needsFollowUp: false }],
        createdAt: "2026-03-29T10:00:00.000Z",
        endedAt: "2026-03-29T10:10:00.000Z",
        knowledgeSource: "file",
      },
    });

    const deps = makeDeps(sessionStore, knowledge);
    const startWarmUp = captureHandler(registerStartWarmUpTool, deps);
    const payload = parse(await startWarmUp({ topic: "JWT authentication" }));

    assert.equal(payload.status, "redirect");
    assert.equal(payload.level, 3);
    assert.equal(payload.nextTool, "start_interview");
  });

  test("falls back to generated L0 MCQ when no authored warm-up content exists", async () => {
    const topic: KnowledgeTopic = {
      topic: "Payments",
      summary: "Payments topic",
      questions: ["What should happen when amount is zero?", "How should currency be validated?"],
      evaluationCriteria: ["Discuss validation", "Discuss error handling"],
      questionDifficulties: ["foundation", "intermediate"],
      concepts: [{ word: "validation", cluster: "core concepts" }],
    };
    const knowledge: KnowledgeStore = {
      findByTopic: () => topic,
      listTopics: () => [topic.topic],
    };
    const sessionStore = makeSessionStore();
    const deps = makeDeps(sessionStore, knowledge);
    const startWarmUp = captureHandler(registerStartWarmUpTool, deps);

    const payload = parse(await startWarmUp({ topic: "Payments", level: 0 }));
    assert.equal(payload.generatedMCQ, true);
    assert.equal(payload.format, "mcq");
    assert.equal(payload.nextTool, "ask_question");

    const created = sessionStore.get(payload.sessionId);
    assert.ok(created);
    assert.equal(created?.sessionKind, "warmup");
    assert.equal(created?.questLevel, 0);
    assert.equal(created?.questions.length, 2);
  });

  test("returns a helpful error when the requested warm-up level has no authored content", async () => {
    const topic: KnowledgeTopic = {
      topic: "Java Concurrency",
      summary: "Concurrency basics",
      questions: ["What is volatile?"],
      evaluationCriteria: ["Explain visibility."],
      questionDifficulties: ["foundation"],
      concepts: [{ word: "volatile", cluster: "core concepts" }],
      warmupLevels: {
        0: {
          questions: [{ question: "Which keyword helps visibility?", choices: ["final", "volatile"], answer: "B" }],
        },
      },
    };
    const knowledge: KnowledgeStore = {
      findByTopic: () => topic,
      listTopics: () => [topic.topic],
    };
    const sessionStore = makeSessionStore();
    const deps = makeDeps(sessionStore, knowledge);
    const startWarmUp = captureHandler(registerStartWarmUpTool, deps);

    const payload = parse(await startWarmUp({ topic: "Java Concurrency", level: 2 }));
    assert.match(payload.error, /No warm-up content found/);
    assert.deepEqual(payload.availableLevels, [0]);
    assert.match(payload.suggestion, /start_interview/);
  });

  test("includes freshness metadata for authored warm-up sessions with previous attempts", async () => {
    const topic: KnowledgeTopic = {
      topic: "Java Concurrency",
      summary: "Concurrency basics",
      questions: ["Unused"],
      evaluationCriteria: ["Unused"],
      questionDifficulties: ["foundation"],
      concepts: [{ word: "volatile", cluster: "core concepts" }],
      warmupLevels: {
        1: {
          questions: [
            { question: "Which statements about volatile are correct?", choices: ["A", "B", "C", "D"], answer: "A,C" },
            { question: "Which statements about locks are correct?", choices: ["A", "B", "C", "D"], answer: "B" },
          ],
        },
      },
    };
    const knowledge: KnowledgeStore = {
      findByTopic: () => topic,
      listTopics: () => [topic.topic],
    };
    const sessionStore = makeSessionStore({
      previous: {
        id: "previous",
        topic: "Java Concurrency",
        sessionKind: "warmup",
        questLevel: 1,
        questFormat: "mcq",
        state: "ENDED",
        currentQuestionIndex: 1,
        questions: ["Which statements about volatile are correct?"],
        messages: [],
        evaluations: [{ questionIndex: 0, question: "Which statements about volatile are correct?", answer: "A,C", score: 5, feedback: "ok", needsFollowUp: false }],
        createdAt: "2026-03-28T10:00:00.000Z",
        endedAt: "2026-03-28T10:05:00.000Z",
        knowledgeSource: "file",
      },
    });
    const deps = makeDeps(sessionStore, knowledge);
    const startWarmUp = captureHandler(registerStartWarmUpTool, deps);

    const payload = parse(await startWarmUp({ topic: "Java Concurrency", level: 1 }));
    assert.equal(payload.format, "mcq");
    assert.deepEqual(payload.previouslyAskedQuestions, ["Which statements about volatile are correct?"]);
    assert.equal(typeof payload.freshQuestionsSelected, "number");
  });
});
