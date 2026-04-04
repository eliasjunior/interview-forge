import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { Session, Flashcard, Mistake, Skill, Exercise, KnowledgeGraph, Concept } from "@mock-interview/shared";
import type { KnowledgeStore, KnowledgeTopic } from "../knowledge/port.js";
import type { ToolDeps } from "../tools/deps.js";
import { assertState } from "../stateUtils.js";
import { calcAvgScore, buildSummary } from "../sessionUtils.js";
import { registerAskQuestionTool } from "../tools/askQuestion.js";
import { registerSubmitAnswerTool } from "../tools/submitAnswer.js";
import { registerEvaluateAnswerTool } from "../tools/evaluateAnswer.js";
import { registerNextQuestionTool } from "../tools/nextQuestion.js";
import { registerStartWarmUpTool } from "../tools/startWarmUp.js";
import { registerGetTopicLevelTool } from "../tools/getTopicLevel.js";
import { registerStartInterviewTool } from "../tools/startInterview.js";

const TOPIC = "Java Concurrency";

const ENTRY: KnowledgeTopic = {
  topic: TOPIC,
  summary: "Concurrency fundamentals and interview patterns.",
  questions: ["Explain what volatile guarantees and what it does not."],
  evaluationCriteria: ["Must explain visibility/reordering and that volatile does not make compound actions atomic."],
  questionDifficulties: ["foundation"],
  concepts: [{ word: "volatile", cluster: "core concepts" }],
  warmupLevels: {
    0: {
      questions: [{
        question: "Which keyword guarantees visibility between threads?",
        choices: ["final", "volatile", "static", "native"],
        answer: "B",
      }],
    },
    1: {
      questions: [{
        question: "Which statements about volatile are correct?",
        choices: [
          "It guarantees visibility",
          "It can prevent some unsafe reordering",
          "It makes count++ atomic",
          "It provides mutual exclusion",
        ],
        answer: "A,B",
      }],
    },
    2: {
      questions: [{
        question: "Explain why volatile does not make count++ thread-safe.",
        hint: "Break count++ into read, modify, write.",
        answer: "It provides visibility but not atomicity for read-modify-write operations.",
      }],
    },
  },
};

function makeKnowledgeStore(entry: KnowledgeTopic = ENTRY): KnowledgeStore {
  return {
    findByTopic: (topic: string) => topic.toLowerCase().includes("java") ? entry : null,
    listTopics: () => [entry.topic],
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

let idCounter = 0;
function makeDeps(
  sessionStore: ReturnType<typeof makeSessionStore>,
  knowledge: KnowledgeStore = makeKnowledgeStore(),
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
    generateId: () => `progress-session-${++idCounter}`,
    assertState,
    findLast: <T>(arr: T[], pred: (item: T) => boolean) => [...arr].reverse().find(pred),
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
        avgScore: String(calcAvgScore(session.evaluations) ?? 0),
        concepts: [] as Concept[],
        reportFile: "report.md",
      };
    },
  } as unknown as ToolDeps;
}

type Handler = (args: Record<string, unknown>) => Promise<{ content: Array<{ text: string }> }>;

function captureHandler(
  register: (server: any, deps: ToolDeps) => void,
  deps: ToolDeps
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

describe("topic progression flow", () => {
  test("simulates warm-up and interview sessions and exposes structured reward progress", async () => {
    const store = makeSessionStore();
    const deps = makeDeps(store);

    const getTopicLevel = captureHandler(registerGetTopicLevelTool, deps);
    const startWarmUp = captureHandler(registerStartWarmUpTool, deps);
    const startInterview = captureHandler(registerStartInterviewTool, deps);
    const askQuestion = captureHandler(registerAskQuestionTool, deps);
    const submitAnswer = captureHandler(registerSubmitAnswerTool, deps);
    const evaluateAnswer = captureHandler(registerEvaluateAnswerTool, deps);
    const nextQuestion = captureHandler(registerNextQuestionTool, deps);

    async function finishWarmupSession(level: 0 | 1 | 2) {
      const started = parse(await startWarmUp({ topic: TOPIC, level }));
      parse(await askQuestion({ sessionId: started.sessionId }));

      if (level === 0) {
        await submitAnswer({ sessionId: started.sessionId, answer: "B" });
        parse(await evaluateAnswer({ sessionId: started.sessionId }));
      } else if (level === 1) {
        await submitAnswer({ sessionId: started.sessionId, answer: "A,B" });
        parse(await evaluateAnswer({ sessionId: started.sessionId }));
      } else {
        await submitAnswer({ sessionId: started.sessionId, answer: "count++ is still read-modify-write, so volatile is not enough" });
        parse(await evaluateAnswer({
          sessionId: started.sessionId,
          score: 5,
          feedback: "Strong explanation of visibility vs atomicity.",
          needsFollowUp: false,
        }));
      }

      const finished = parse(await nextQuestion({ sessionId: started.sessionId }));
      assert.equal(finished.done, true);
    }

    async function finishInterviewSession(score: number) {
      const started = parse(await startInterview({ topic: TOPIC, maxQuestions: 1 }));
      parse(await askQuestion({ sessionId: started.sessionId }));
      await submitAnswer({ sessionId: started.sessionId, answer: "volatile gives visibility and ordering, but not atomicity" });
      parse(await evaluateAnswer({
        sessionId: started.sessionId,
        score,
        feedback: "Good explanation of volatile tradeoffs.",
        needsFollowUp: false,
      }));
      const finished = parse(await nextQuestion({ sessionId: started.sessionId }));
      assert.equal(finished.done, true);
    }

    const cold = parse(await getTopicLevel({ topic: TOPIC }));
    assert.equal(cold.level, 0);
    assert.deepEqual(cold.progress, {
      current: 0,
      required: 2,
      targetLevel: 1,
      variant: "warmup",
      label: "0 / 2 passes",
      attempted: false,
      almostThere: false,
    });

    await finishWarmupSession(0);
    const halfwayL0 = parse(await getTopicLevel({ topic: TOPIC }));
    assert.equal(halfwayL0.level, 0);
    assert.equal(halfwayL0.progress.current, 1);
    assert.equal(halfwayL0.progress.targetLevel, 1);

    await finishWarmupSession(0);
    const unlockedL1 = parse(await getTopicLevel({ topic: TOPIC }));
    assert.equal(unlockedL1.level, 1);
    assert.equal(unlockedL1.progress.current, 0);
    assert.equal(unlockedL1.progress.targetLevel, 2);

    await finishWarmupSession(1);
    await finishWarmupSession(1);
    const unlockedL2 = parse(await getTopicLevel({ topic: TOPIC }));
    assert.equal(unlockedL2.level, 2);
    assert.equal(unlockedL2.progress.current, 0);
    assert.equal(unlockedL2.progress.targetLevel, 3);

    await finishWarmupSession(2);
    const halfwayL2 = parse(await getTopicLevel({ topic: TOPIC }));
    assert.equal(halfwayL2.level, 2);
    assert.equal(halfwayL2.progress.current, 1);
    assert.equal(halfwayL2.progress.targetLevel, 3);

    await finishWarmupSession(2);
    const unlockedL3 = parse(await getTopicLevel({ topic: TOPIC }));
    assert.equal(unlockedL3.level, 3);
    assert.equal(unlockedL3.progress.variant, "interview");
    assert.equal(unlockedL3.progress.current, 0);
    assert.equal(unlockedL3.progress.required, 2);
    assert.equal(unlockedL3.progress.targetLevel, 4);

    await finishInterviewSession(4);
    await finishInterviewSession(5);
    const unlockedL4 = parse(await getTopicLevel({ topic: TOPIC }));
    assert.equal(unlockedL4.level, 4);
    assert.equal(unlockedL4.progress.variant, "complete");
    assert.equal(unlockedL4.progress.current, 2);
    assert.equal(unlockedL4.progress.label, "Mastered");
  });
});
