/**
 * Tests for the dynamic interview flow:
 *   - selectQuestions (pure function)
 *   - startInterview — question selection + questionCriteria population
 *   - askQuestion — uses session.questionCriteria (not positional file lookup)
 *   - evaluateAnswer — uses session.questionCriteria for rubric
 *   - Simulated LLM host — full tool-by-tool flow as Claude Desktop would drive it
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { Session, Flashcard, Mistake, Skill, Exercise, KnowledgeGraph, Concept } from "@mock-interview/shared";
import { assertState } from "../stateUtils.js";
import { calcAvgScore, buildSummary } from "../sessionUtils.js";
import { selectQuestions, registerStartInterviewTool } from "../tools/startInterview.js";
import { registerAskQuestionTool } from "../tools/askQuestion.js";
import { registerSubmitAnswerTool } from "../tools/submitAnswer.js";
import { registerEvaluateAnswerTool } from "../tools/evaluateAnswer.js";
import { registerAskFollowupTool } from "../tools/askFollowup.js";
import { registerNextQuestionTool } from "../tools/nextQuestion.js";
import type { ToolDeps } from "../tools/deps.js";
import type { KnowledgeStore, KnowledgeTopic } from "../knowledge/port.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const TOPIC = "REST API Design & Mortgage Service (Java + Spring Boot)";

/** 6-question knowledge entry spanning all 3 tiers */
const MOCK_ENTRY: KnowledgeTopic = {
  topic: TOPIC,
  summary: "Design and implement a mortgage REST API.",
  questions: [
    "How would you design the GET /api/interest-rates endpoint?",    // 0 foundation
    "How would you model the MortgageRate domain object?",           // 1 foundation
    "How would you validate incoming request data?",                  // 2 intermediate
    "What edge cases would you handle?",                              // 3 intermediate
    "How would you design this service for resilience?",              // 4 advanced
    "What failure modes would you expect under load?",               // 5 advanced
  ],
  evaluationCriteria: [
    "Must define GET endpoint returning a list of rates. REST conventions.",
    "Must include maturityPeriod, interestRate (BigDecimal), lastUpdate.",
    "Must use @Valid, @NotNull, @Positive. Return 400 for invalid input.",
    "Must consider zero/negative income, missing rate, overflow, rounding.",
    "Must mention circuit breakers, timeouts, fallback strategies.",
    "Must identify thread-pool exhaustion, connection pool saturation.",
  ],
  questionDifficulties: [
    "foundation", "foundation",
    "intermediate", "intermediate",
    "advanced", "advanced",
  ],
  concepts: [{ word: "rest-api", cluster: "core concepts" }],
};

// ─── Mock infrastructure ─────────────────────────────────────────────────────

function makeKnowledgeStore(entry: KnowledgeTopic | null = MOCK_ENTRY): KnowledgeStore {
  return {
    findByTopic: (topic: string) =>
      entry && topic.toLowerCase().includes("mortgage") ? entry : null,
    listTopics: () => (entry ? [entry.topic] : []),
  };
}

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

let _idCounter = 0;
function makeDeps(
  sessionStore: ReturnType<typeof makeSessionStore>,
  knowledge: KnowledgeStore = makeKnowledgeStore(),
  overrides: Partial<ToolDeps> = {}
): ToolDeps {
  return {
    ai: null,
    knowledge,
    uiPort: "5173",
    stateError: (msg: string) => ({ content: [{ type: "text" as const, text: msg }] }),
    loadSessions: () => sessionStore.load(),
    saveSessions: (s: Record<string, Session>) => sessionStore.save(s),
    loadGraph: () => ({ nodes: [], edges: [], sessions: [] } as KnowledgeGraph),
    saveGraph: () => {},
    saveReport: (session: Session) => `reports/${session.id}.md`,
    loadFlashcards: () => [],
    saveFlashcard: () => {},
    saveFlashcards: () => {},
    loadMistakes: () => [],
    saveMistake: () => {},
    loadSkills: () => [],
    findSkillByName: () => null,
    saveSkill: () => {},
    updateSkill: () => {},
    loadExercises: () => [],
    findExerciseByName: () => null,
    saveExercise: () => {},
    exercisesDir: "/tmp/exercises",
    scopesDir: "/tmp/scopes",
    generateId: () => `session-${++_idCounter}`,
    assertState,
    findLast: <T>(arr: T[], pred: (item: T) => boolean) =>
      [...arr].reverse().find(pred),
    calcAvgScore,
    buildSummary,
    inspectSessionDeletion: () => null,
    deleteSessionById: () => null,
    finalizeSession: async (session: Session, sessions: Record<string, Session>) => {
      session.state = "ENDED";
      session.endedAt = new Date().toISOString();
      sessions[session.id] = session;
      sessionStore.save(sessions);
      return { summary: "Interview complete.", avgScore: "3.0", concepts: [], reportFile: "report.md" };
    },
    ...overrides,
  } as unknown as ToolDeps;
}

type Handler = (args: Record<string, unknown>) => Promise<{ content: Array<{ text: string }> }>;

function captureHandler(
  register: (server: any, deps: ToolDeps) => void,
  deps: ToolDeps
): Handler {
  let handler!: Handler;
  const mockServer = {
    registerTool(_n: string, _config: object, h: Handler) { handler = h; },
  };
  register(mockServer, deps);
  return handler;
}

function parse(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

// ─── selectQuestions (pure) ──────────────────────────────────────────────────

describe("selectQuestions — pure function", () => {
  const { questions, evaluationCriteria, questionDifficulties } = MOCK_ENTRY;

  test("selects exactly maxQuestions", () => {
    const selected = selectQuestions(questions, evaluationCriteria, questionDifficulties, new Map(), 5);
    assert.equal(selected.length, 5);
  });

  test("never exceeds the pool size even if maxQuestions is larger", () => {
    const selected = selectQuestions(questions, evaluationCriteria, questionDifficulties, new Map(), 10);
    assert.ok(selected.length <= questions.length);
  });

  test("respects difficulty order — foundation before intermediate before advanced", () => {
    const selected = selectQuestions(questions, evaluationCriteria, questionDifficulties, new Map(), 5);
    const tiers = selected.map((c) => c.difficulty);
    const tierOrder = ["foundation", "intermediate", "advanced"];
    let lastTierIdx = -1;
    for (const tier of tiers) {
      const idx = tierOrder.indexOf(tier);
      assert.ok(idx >= lastTierIdx, `tier out of order: ${tiers.join(", ")}`);
      lastTierIdx = idx;
    }
  });

  test("each selected candidate carries the correct criteria for its original index", () => {
    const selected = selectQuestions(questions, evaluationCriteria, questionDifficulties, new Map(), 6);
    for (const c of selected) {
      assert.equal(c.criteria, evaluationCriteria[c.index]);
    }
  });

  test("deprioritises frequently-asked questions — 0-count questions come first within a tier", () => {
    // Mark both foundation questions as asked 3 times
    const pastAskCounts = new Map([[0, 3], [1, 3]]);
    const selected = selectQuestions(questions, evaluationCriteria, questionDifficulties, pastAskCounts, 5);
    const foundationPicks = selected.filter((c) => c.difficulty === "foundation");
    // Foundation picks should still be the only foundation questions available
    assert.ok(foundationPicks.every((c) => c.timesAsked === 3));
    // But intermediate/advanced picks should be fresh (timesAsked === 0)
    const otherPicks = selected.filter((c) => c.difficulty !== "foundation");
    assert.ok(otherPicks.every((c) => c.timesAsked === 0));
  });

  test("handles missing difficulty — defaults to intermediate", () => {
    const selected = selectQuestions(
      ["Q?"],
      ["criteria"],
      [],   // no difficulties provided
      new Map(),
      1
    );
    assert.equal(selected.length, 1);
    assert.equal(selected[0].difficulty, "intermediate");
  });

  test("redistributes unused tier slots when all questions fall into one tier", () => {
    const selected = selectQuestions(
      ["Q1", "Q2", "Q3", "Q4", "Q5", "Q6"],
      ["c1", "c2", "c3", "c4", "c5", "c6"],
      [],   // every question defaults to intermediate
      new Map(),
      5
    );
    assert.equal(selected.length, 5);
    assert.ok(selected.every((c) => c.difficulty === "intermediate"));
  });
});

// ─── startInterview — question selection ─────────────────────────────────────

describe("startInterview — question selection", () => {
  test("session.questions.length respects maxQuestions", async () => {
    const store = makeSessionStore();
    const deps = makeDeps(store);
    const start = captureHandler(registerStartInterviewTool, deps);

    const res = parse(await start({ topic: TOPIC, maxQuestions: 3 }));
    assert.ok(res.sessionId);
    assert.equal(res.totalQuestions, 3);
  });

  test("fills to maxQuestions even when the topic has no authored difficulty metadata", async () => {
    const store = makeSessionStore();
    const difficultyFreeEntry: KnowledgeTopic = {
      ...MOCK_ENTRY,
      topic: "Difficulty Free Topic",
      questionDifficulties: [],
    };
    const deps = makeDeps(store, {
      findByTopic: (topic: string) => topic === difficultyFreeEntry.topic ? difficultyFreeEntry : null,
      listTopics: () => [difficultyFreeEntry.topic],
    });
    const start = captureHandler(registerStartInterviewTool, deps);

    const res = parse(await start({ topic: difficultyFreeEntry.topic, maxQuestions: 5 }));
    assert.equal(res.totalQuestions, 5);
    assert.equal(store.get(res.sessionId).questions.length, 5);
  });

  test("session.questionCriteria is populated and same length as questions", async () => {
    const store = makeSessionStore();
    const deps = makeDeps(store);
    const start = captureHandler(registerStartInterviewTool, deps);

    const res = parse(await start({ topic: TOPIC, maxQuestions: 4 }));
    const session = store.get(res.sessionId);
    assert.ok(session.questionCriteria);
    assert.equal(session.questionCriteria.length, session.questions.length);
  });

  test("returns selectionRationale with difficulty and timesAskedBefore per question", async () => {
    const store = makeSessionStore();
    const deps = makeDeps(store);
    const start = captureHandler(registerStartInterviewTool, deps);

    const res = parse(await start({ topic: TOPIC, maxQuestions: 5 }));
    assert.ok(Array.isArray(res.selectionRationale));
    assert.equal(res.selectionRationale.length, res.totalQuestions);
    for (const r of res.selectionRationale) {
      assert.ok(["foundation", "intermediate", "advanced"].includes(r.difficulty));
      assert.equal(typeof r.timesAskedBefore, "number");
      assert.equal(typeof r.fresh, "boolean");
    }
  });

  test("returns stateError for unknown topic when AI is disabled", async () => {
    const store = makeSessionStore();
    const deps = makeDeps(store, makeKnowledgeStore(null));
    const start = captureHandler(registerStartInterviewTool, deps);

    const res = await start({ topic: "Unknown Topic" });
    // stateError returns plain text, not JSON
    assert.ok(res.content[0].text.includes("not found"));
  });

  test("deprioritises past questions — second session for same topic gets fresher picks", async () => {
    const store = makeSessionStore();
    const deps = makeDeps(store);
    const start = captureHandler(registerStartInterviewTool, deps);

    // First session — all questions fresh
    const res1 = parse(await start({ topic: TOPIC, maxQuestions: 3 }));
    const firstQuestions = store.get(res1.sessionId).questions;

    // Manually mark first session as ENDED so it counts as past history
    const sessions = store.load();
    sessions[res1.sessionId].state = "ENDED";
    store.save(sessions);

    // Second session — should prefer questions not in the first set
    const res2 = parse(await start({ topic: TOPIC, maxQuestions: 3 }));
    const secondQuestions = store.get(res2.sessionId).questions;

    // At least some questions should differ (pool has 6, picking 3 each time)
    const overlap = firstQuestions.filter((q: string) => secondQuestions.includes(q));
    assert.ok(overlap.length < 3, `Expected fewer repeated questions, got ${overlap.length} of 3`);
  });
});

// ─── askQuestion — questionCriteria ──────────────────────────────────────────

describe("askQuestion — uses session.questionCriteria", () => {
  test("returns criteria from session.questionCriteria, not file positional index", async () => {
    const store = makeSessionStore();
    const deps = makeDeps(store);

    // Manually plant a session where questions are in reverse order of the file,
    // but questionCriteria is correctly paired
    const session: Session = {
      id: "manual-1",
      topic: TOPIC,
      state: "ASK_QUESTION",
      currentQuestionIndex: 0,
      questions: [MOCK_ENTRY.questions[4], MOCK_ENTRY.questions[0]], // advanced first, then foundation
      questionCriteria: [MOCK_ENTRY.evaluationCriteria[4], MOCK_ENTRY.evaluationCriteria[0]],
      messages: [],
      evaluations: [],
      createdAt: new Date().toISOString(),
      knowledgeSource: "file",
    };
    store.save({ "manual-1": session });

    const ask = captureHandler(registerAskQuestionTool, deps);
    const res = parse(await ask({ sessionId: "manual-1" }));

    // Should get criteria for the ADVANCED question (index 4), not index 0 (foundation)
    assert.equal(res.evaluationCriteria, MOCK_ENTRY.evaluationCriteria[4]);
    assert.equal(res.question, MOCK_ENTRY.questions[4]);
  });

  test("falls back to file positional lookup for legacy sessions without questionCriteria", async () => {
    const store = makeSessionStore();
    const deps = makeDeps(store);

    const session: Session = {
      id: "legacy-1",
      topic: TOPIC,
      state: "ASK_QUESTION",
      currentQuestionIndex: 0,
      questions: [MOCK_ENTRY.questions[0]],
      // No questionCriteria field — legacy session
      messages: [],
      evaluations: [],
      createdAt: new Date().toISOString(),
      knowledgeSource: "file",
    };
    store.save({ "legacy-1": session });

    const ask = captureHandler(registerAskQuestionTool, deps);
    const res = parse(await ask({ sessionId: "legacy-1" }));

    // Should fall back to file criteria at index 0
    assert.equal(res.evaluationCriteria, MOCK_ENTRY.evaluationCriteria[0]);
  });
});

// ─── evaluateAnswer — questionCriteria ───────────────────────────────────────

describe("evaluateAnswer — uses session.questionCriteria", () => {
  test("AI-disabled: accepts score+feedback from orchestrator and persists evaluation", async () => {
    const store = makeSessionStore();
    const deps = makeDeps(store);

    const session: Session = {
      id: "eval-1",
      topic: TOPIC,
      state: "EVALUATE_ANSWER",
      currentQuestionIndex: 0,
      questions: [MOCK_ENTRY.questions[0]],
      questionCriteria: [MOCK_ENTRY.evaluationCriteria[0]],
      messages: [
        { role: "interviewer", content: MOCK_ENTRY.questions[0], timestamp: new Date().toISOString() },
        { role: "candidate", content: "I would define a REST GET endpoint.", timestamp: new Date().toISOString() },
      ],
      evaluations: [],
      createdAt: new Date().toISOString(),
      knowledgeSource: "file",
    };
    store.save({ "eval-1": session });

    const evaluate = captureHandler(registerEvaluateAnswerTool, deps);
    const res = parse(await evaluate({
      sessionId: "eval-1",
      score: 4,
      feedback: "Clear explanation of REST conventions.",
      needsFollowUp: false,
    }));

    assert.equal(res.score, 4);
    assert.equal(res.needsFollowUp, false);
    assert.equal(store.get("eval-1").evaluations.length, 1);
    assert.equal(store.get("eval-1").state, "FOLLOW_UP");
  });

  test("stores the evaluation with the correct questionIndex", async () => {
    const store = makeSessionStore();
    const deps = makeDeps(store);

    const session: Session = {
      id: "eval-2",
      topic: TOPIC,
      state: "EVALUATE_ANSWER",
      currentQuestionIndex: 2,  // third question asked
      questions: MOCK_ENTRY.questions.slice(0, 4),
      questionCriteria: MOCK_ENTRY.evaluationCriteria.slice(0, 4),
      messages: [
        { role: "interviewer", content: MOCK_ENTRY.questions[2], timestamp: new Date().toISOString() },
        { role: "candidate", content: "I'd use @Valid annotation.", timestamp: new Date().toISOString() },
      ],
      evaluations: [],
      createdAt: new Date().toISOString(),
      knowledgeSource: "file",
    };
    store.save({ "eval-2": session });

    const evaluate = captureHandler(registerEvaluateAnswerTool, deps);
    await evaluate({ sessionId: "eval-2", score: 3, feedback: "Partial.", needsFollowUp: true, followUpQuestion: "What about @Positive?" });

    const saved = store.get("eval-2");
    assert.equal(saved.evaluations[0].questionIndex, 2);
    assert.equal(saved.evaluations[0].score, 3);
    assert.equal(saved.evaluations[0].needsFollowUp, true);
  });
});

// ─── Simulated LLM host — full interview flow ─────────────────────────────────

/**
 * SimulatedHost acts as the orchestrator LLM (Claude Desktop).
 * It calls tools in the correct sequence and records what happened.
 */
class SimulatedHost {
  private start: Handler;
  private ask: Handler;
  private submit: Handler;
  private evaluate: Handler;
  private followup: Handler;
  private next: Handler;

  public log: string[] = [];

  constructor(deps: ToolDeps) {
    this.start    = captureHandler(registerStartInterviewTool, deps);
    this.ask      = captureHandler(registerAskQuestionTool, deps);
    this.submit   = captureHandler(registerSubmitAnswerTool, deps);
    this.evaluate = captureHandler(registerEvaluateAnswerTool, deps);
    this.followup = captureHandler(registerAskFollowupTool, deps);
    this.next     = captureHandler(registerNextQuestionTool, deps);
  }

  /** Start an interview and return the sessionId. */
  async startInterview(topic: string, maxQuestions = 3): Promise<string> {
    const res = parse(await this.start({ topic, maxQuestions }));
    this.log.push(`start: sessionId=${res.sessionId}, total=${res.totalQuestions}`);
    return res.sessionId;
  }

  /**
   * Run one full question cycle: ask → submit → evaluate → (optional followup) → next.
   * `scoreForAnswer` controls what the "LLM" scores the candidate's answer.
   * When needsFollowUp is returned, the host asks one follow-up then scores it 4.
   */
  async runQuestionCycle(
    sessionId: string,
    candidateAnswer: string,
    score: number,
    done: { value: boolean } = { value: false }
  ) {
    // ask
    const askRes = parse(await this.ask({ sessionId }));
    this.log.push(`ask[${askRes.questionNumber}]: "${askRes.question.slice(0, 40)}..." criteria=${!!askRes.evaluationCriteria}`);

    // submit
    await this.submit({ sessionId, answer: candidateAnswer });
    this.log.push(`submit: answer="${candidateAnswer}"`);

    // evaluate — orchestrator uses evaluationCriteria it received in ask_question
    const needsFollowUp = score < 4;
    const evalRes = parse(await this.evaluate({
      sessionId,
      score,
      feedback: score >= 4 ? "Strong answer." : "Needs more detail.",
      needsFollowUp,
      followUpQuestion: needsFollowUp ? "Can you elaborate on the implementation details?" : undefined,
    }));
    this.log.push(`evaluate: score=${evalRes.score}, needsFollowUp=${evalRes.needsFollowUp}`);

    // follow-up cycle if needed
    if (evalRes.needsFollowUp) {
      const fuRes = parse(await this.followup({ sessionId }));
      this.log.push(`followup: "${fuRes.followUpQuestion?.slice(0, 40)}..."`);

      await this.submit({ sessionId, answer: "More complete answer with implementation details." });

      const fuEvalRes = parse(await this.evaluate({
        sessionId,
        score: 4,
        feedback: "Good elaboration.",
        needsFollowUp: false,
      }));
      this.log.push(`followup-evaluate: score=${fuEvalRes.score}`);
    }

    // next
    const nextRes = parse(await this.next({ sessionId }));
    this.log.push(`next: done=${nextRes.done ?? false}`);
    if (nextRes.done) done.value = true;
  }

  /** Run all questions in sequence until the interview ends. */
  async runFullInterview(sessionId: string, totalQuestions: number) {
    const done = { value: false };
    let q = 0;
    while (!done.value && q < totalQuestions) {
      const score = q % 2 === 0 ? 3 : 4; // alternate scores to exercise both paths
      await this.runQuestionCycle(sessionId, `Answer to question ${q + 1}`, score, done);
      q++;
    }
    return done.value;
  }
}

describe("SimulatedHost — full interview flow (AI disabled)", () => {
  test("completes a 3-question interview and ends in ENDED state", async () => {
    const store = makeSessionStore();
    const deps = makeDeps(store);
    const host = new SimulatedHost(deps);

    const sessionId = await host.startInterview(TOPIC, 3);
    const ended = await host.runFullInterview(sessionId, 3);

    assert.ok(ended, "interview should complete");
    assert.equal(store.get(sessionId).state, "ENDED");
  });

  test("produces one evaluation per question", async () => {
    const store = makeSessionStore();
    const deps = makeDeps(store);
    const host = new SimulatedHost(deps);

    const sessionId = await host.startInterview(TOPIC, 3);
    await host.runFullInterview(sessionId, 3);

    const session = store.get(sessionId);
    // Each question gets at least one evaluation; follow-up questions on the same
    // questionIndex produce additional evaluations — at least 3 total
    assert.ok(session.evaluations.length >= 3);
  });

  test("evaluationCriteria returned by ask_question matches session.questionCriteria", async () => {
    const store = makeSessionStore();
    const deps = makeDeps(store);

    const startH = captureHandler(registerStartInterviewTool, deps);
    const askH   = captureHandler(registerAskQuestionTool, deps);

    const startRes = parse(await startH({ topic: TOPIC, maxQuestions: 3 }));
    const { sessionId } = startRes;
    const session = store.get(sessionId);

    // Ask each question and verify criteria matches what was stored on the session
    for (let i = 0; i < session.questions.length; i++) {
      if (i > 0) {
        // Advance state manually to ASK_QUESTION for test isolation
        const sessions = store.load();
        sessions[sessionId].state = "ASK_QUESTION";
        sessions[sessionId].currentQuestionIndex = i;
        store.save(sessions);
      }
      const askRes = parse(await askH({ sessionId }));
      const expectedCriteria = session.questionCriteria?.[i] ?? "";
      assert.equal(
        askRes.evaluationCriteria,
        expectedCriteria,
        `Question ${i}: criteria mismatch`
      );
    }
  });

  test("follow-up is triggered when score < 4, skipped when score >= 4", async () => {
    const store = makeSessionStore();
    const deps = makeDeps(store);
    const host = new SimulatedHost(deps);

    const sessionId = await host.startInterview(TOPIC, 2);
    await host.runFullInterview(sessionId, 2);

    const followupLines = host.log.filter((l) => l.startsWith("followup:"));
    const evalLines     = host.log.filter((l) => l.startsWith("evaluate:"));

    // Q0 score=3 → follow-up; Q1 score=4 → no follow-up
    assert.equal(followupLines.length, 1);
    assert.ok(evalLines.some((l) => l.includes("needsFollowUp=true")));
    assert.ok(evalLines.some((l) => l.includes("needsFollowUp=false")));
  });

  test("selectionRationale instructs LLM to probe deeper on repeated questions", async () => {
    const store = makeSessionStore();
    const deps = makeDeps(store);
    const startH = captureHandler(registerStartInterviewTool, deps);

    // Create a past ENDED session that used all 6 questions
    const pastSession: Session = {
      id: "past-1",
      topic: TOPIC,
      state: "ENDED",
      currentQuestionIndex: 5,
      questions: MOCK_ENTRY.questions,
      messages: [],
      evaluations: [],
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      knowledgeSource: "file",
    };
    store.save({ "past-1": pastSession });

    const res = parse(await startH({ topic: TOPIC, maxQuestions: 3 }));

    // All questions were asked before — timesAskedBefore should be 1 for each
    assert.ok(res.selectionRationale.every((r: any) => r.timesAskedBefore >= 1));
    assert.ok(res.selectionRationale.every((r: any) => r.fresh === false));
    // instruction should contain the probing guidance
    assert.ok(res.instruction.includes("probe deeper") || res.instruction.includes("timesAskedBefore"));
  });
});
