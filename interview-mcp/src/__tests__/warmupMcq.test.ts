import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import type { Session, Flashcard, Mistake, Skill, Exercise, KnowledgeGraph, Concept } from "@mock-interview/shared";
import type { KnowledgeStore, KnowledgeTopic } from "../knowledge/port.js";
import { FileKnowledgeStore } from "../knowledge/file.js";
import type { ToolDeps } from "../tools/deps.js";
import { assertState } from "../stateUtils.js";
import { calcAvgScore, buildSummary } from "../sessionUtils.js";
import { registerStartWarmUpTool } from "../tools/startWarmUp.js";
import { registerAskQuestionTool } from "../tools/askQuestion.js";
import { registerSubmitAnswerTool } from "../tools/submitAnswer.js";
import { registerEvaluateAnswerTool } from "../tools/evaluateAnswer.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
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
  knowledge: KnowledgeStore
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
    loadFlashcardAnswersByState: () => [],
    saveFlashcardAnswer: () => {},
    updateFlashcardAnswer: () => {},
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
    generateId: () => `warmup-session-${++idCounter}`,
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
      return { summary: "done", avgScore: "5.0", concepts: [] as Concept[], reportFile: "report.md" };
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

describe("FileKnowledgeStore warm-up parsing", () => {
  test("parses Level 1 advanced MCQ blocks with multi-answer keys", () => {
    const dir = makeTempDir("warmup-knowledge-");
    fs.writeFileSync(
      path.join(dir, "java-concurrency.md"),
      `# Java Concurrency

## Summary
Short summary

## Questions
1. What is volatile?

## Difficulty
- Question 1: foundation

## Evaluation Criteria
- Question 1: Explain visibility.

## Concepts
- core concepts: volatile

## Warm-up Quests

### Level 0
1. Which keyword helps with visibility?
A) final
B) volatile
C) static
D) transient
Answer: B

### Level 1
1. Which statements about volatile are correct?
A) It guarantees visibility
B) It makes count++ atomic
C) It can prevent some reordering
D) It provides mutual exclusion
Answer: A,C

### Level 2
1. Explain why volatile does not make count++ safe.
Hint: Think read-modify-write.
Answer: It is visible but not atomic.
`,
      "utf-8"
    );

    const store = new FileKnowledgeStore(dir);
    const topic = store.findByTopic("Java Concurrency");

    assert.ok(topic);
    assert.equal(topic.warmupLevels?.[1]?.questions[0]?.question, "Which statements about volatile are correct?");
    assert.deepEqual(topic.warmupLevels?.[1]?.questions[0]?.choices, [
      "It guarantees visibility",
      "It makes count++ atomic",
      "It can prevent some reordering",
      "It provides mutual exclusion",
    ]);
    assert.equal(topic.warmupLevels?.[1]?.questions[0]?.answer, "A,C");
  });
});

describe("Warm-up advanced MCQ flow", () => {
  test("returns choices from ask_question and auto-scores multi-answer keys", async () => {
    const topic: KnowledgeTopic = {
      topic: "Java Concurrency",
      summary: "Concurrency basics and tradeoffs",
      questions: ["Unused fallback question"],
      evaluationCriteria: ["Unused fallback criteria"],
      questionDifficulties: ["foundation"],
      concepts: [{ word: "volatile", cluster: "core concepts" }],
      warmupLevels: {
        1: {
          questions: [{
            question: "Which statements about volatile are correct?",
            choices: [
              "It guarantees visibility",
              "It makes count++ atomic",
              "It can prevent some unsafe reordering",
              "It provides mutual exclusion",
            ],
            answer: "A,C",
          }],
        },
      },
    };
    const knowledge: KnowledgeStore = {
      findByTopic: (name: string) => name.toLowerCase().includes("java") ? topic : null,
      listTopics: () => [topic.topic],
    };

    const sessionStore = makeSessionStore();
    const deps = makeDeps(sessionStore, knowledge);
    const startWarmUp = captureHandler(registerStartWarmUpTool, deps);
    const askQuestion = captureHandler(registerAskQuestionTool, deps);
    const submitAnswer = captureHandler(registerSubmitAnswerTool, deps);
    const evaluateAnswer = captureHandler(registerEvaluateAnswerTool, deps);

    const started = parse(await startWarmUp({ topic: "Java Concurrency", level: 1 }));
    assert.equal(started.format, "mcq");

    const asked = parse(await askQuestion({ sessionId: started.sessionId }));
    assert.deepEqual(asked.choices, [
      "It guarantees visibility",
      "It makes count++ atomic",
      "It can prevent some unsafe reordering",
      "It provides mutual exclusion",
    ]);

    await submitAnswer({ sessionId: started.sessionId, answer: "C,A" });
    const evaluated = parse(await evaluateAnswer({ sessionId: started.sessionId }));
    assert.equal(evaluated.score, 5);
    assert.match(evaluated.feedback, /A\)/);
    assert.match(evaluated.feedback, /C\)/);
  });

  test("accepts ALL and NONE answer keys", async () => {
    const sessionStore = makeSessionStore({
      "all-session": {
        id: "all-session",
        topic: "Java Concurrency",
        sessionKind: "warmup",
        questLevel: 1,
        questFormat: "mcq",
        questChoices: [["One", "Two", "Three", "Four"]],
        questAnswers: ["ALL"],
        state: "EVALUATE_ANSWER",
        currentQuestionIndex: 0,
        questions: ["Which are correct?"],
        messages: [
          { role: "interviewer", content: "Which are correct?", timestamp: "2026-03-28T10:00:00.000Z" },
          { role: "candidate", content: "A,B,C,D", timestamp: "2026-03-28T10:01:00.000Z" },
        ],
        evaluations: [],
        createdAt: "2026-03-28T10:00:00.000Z",
        knowledgeSource: "file",
      },
      "none-session": {
        id: "none-session",
        topic: "Java Concurrency",
        sessionKind: "warmup",
        questLevel: 1,
        questFormat: "mcq",
        questChoices: [["One", "Two", "Three", "Four"]],
        questAnswers: ["NONE"],
        state: "EVALUATE_ANSWER",
        currentQuestionIndex: 0,
        questions: ["Which are correct?"],
        messages: [
          { role: "interviewer", content: "Which are correct?", timestamp: "2026-03-28T10:00:00.000Z" },
          { role: "candidate", content: "none", timestamp: "2026-03-28T10:01:00.000Z" },
        ],
        evaluations: [],
        createdAt: "2026-03-28T10:00:00.000Z",
        knowledgeSource: "file",
      },
    });
    const knowledge: KnowledgeStore = {
      findByTopic: () => null,
      listTopics: () => [],
    };
    const deps = makeDeps(sessionStore, knowledge);
    const evaluateAnswer = captureHandler(registerEvaluateAnswerTool, deps);

    const allResult = parse(await evaluateAnswer({ sessionId: "all-session" }));
    const noneResult = parse(await evaluateAnswer({ sessionId: "none-session" }));

    assert.equal(allResult.score, 5);
    assert.equal(noneResult.score, 5);
    assert.match(noneResult.feedback, /NONE/);
  });
});
