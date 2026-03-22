import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  assertState,
  buildSummary,
  buildTranscript,
  calcAvgScore,
  generateFlashcards,
  mergeConceptsIntoGraph,
} from "../interviewUtils.js";
import type { Session, Evaluation, KnowledgeGraph, Concept } from "@mock-interview/shared";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "test-session",
    topic: "React hooks",
    state: "ASK_QUESTION",
    currentQuestionIndex: 0,
    questions: ["Q1", "Q2"],
    messages: [],
    evaluations: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    knowledgeSource: "ai",
    ...overrides,
  };
}

function makeEvaluation(score: number, feedback = "Good answer."): Evaluation {
  return {
    questionIndex: 0,
    question: "What is useEffect?",
    answer: "It handles side effects.",
    score,
    feedback,
    needsFollowUp: score <= 3,
  };
}

function emptyGraph(): KnowledgeGraph {
  return { nodes: [], edges: [], sessions: [] };
}

// ─────────────────────────────────────────────
// #9 — assertState
// ─────────────────────────────────────────────

describe("assertState", () => {
  test("allows a valid tool in ASK_QUESTION", () => {
    const session = makeSession({ state: "ASK_QUESTION" });
    const result = assertState(session, "ask_question");
    assert.equal(result.ok, true);
  });

  test("blocks an invalid tool in ASK_QUESTION", () => {
    const session = makeSession({ state: "ASK_QUESTION" });
    const result = assertState(session, "submit_answer");
    assert.equal(result.ok, false);
    assert.ok(!result.ok && result.error.includes("submit_answer"));
    assert.ok(!result.ok && result.error.includes("ASK_QUESTION"));
  });

  test("allows submit_answer only in WAIT_FOR_ANSWER", () => {
    const waiting = makeSession({ state: "WAIT_FOR_ANSWER" });
    assert.equal(assertState(waiting, "submit_answer").ok, true);

    const other = makeSession({ state: "FOLLOW_UP" });
    assert.equal(assertState(other, "submit_answer").ok, false);
  });

  test("allows evaluate_answer only in EVALUATE_ANSWER", () => {
    const session = makeSession({ state: "EVALUATE_ANSWER" });
    assert.equal(assertState(session, "evaluate_answer").ok, true);
    assert.equal(assertState(makeSession({ state: "ASK_QUESTION" }), "evaluate_answer").ok, false);
  });

  test("allows ask_followup and next_question only in FOLLOW_UP", () => {
    const session = makeSession({ state: "FOLLOW_UP" });
    assert.equal(assertState(session, "ask_followup").ok, true);
    assert.equal(assertState(session, "next_question").ok, true);
    assert.equal(assertState(makeSession({ state: "WAIT_FOR_ANSWER" }), "next_question").ok, false);
  });

  test("ENDED state only allows read-only tools", () => {
    const session = makeSession({ state: "ENDED" });
    assert.equal(assertState(session, "get_session").ok, true);
    assert.equal(assertState(session, "list_sessions").ok, true);
    assert.equal(assertState(session, "get_graph").ok, true);
    assert.equal(assertState(session, "ask_question").ok, false);
    assert.equal(assertState(session, "end_interview").ok, false);
  });

  test("get_session and list_sessions are allowed in every active state", () => {
    const states = ["ASK_QUESTION", "WAIT_FOR_ANSWER", "EVALUATE_ANSWER", "FOLLOW_UP", "ENDED"] as const;
    for (const state of states) {
      const session = makeSession({ state });
      assert.equal(assertState(session, "get_session").ok, true, `get_session failed in ${state}`);
      assert.equal(assertState(session, "list_sessions").ok, true, `list_sessions failed in ${state}`);
    }
  });
});

// ─────────────────────────────────────────────
// #10 — mergeConceptsIntoGraph
// ─────────────────────────────────────────────

describe("mergeConceptsIntoGraph", () => {
  test("adds new nodes from concepts", () => {
    const concepts: Concept[] = [
      { word: "useState", cluster: "core concepts" },
    ];
    const graph = mergeConceptsIntoGraph(emptyGraph(), concepts, "s1");
    assert.equal(graph.nodes.length, 1);
    assert.equal(graph.nodes[0].id, "usestate");
    assert.equal(graph.nodes[0].label, "useState");
    assert.deepEqual(graph.nodes[0].clusters, ["core concepts"]);
  });

  test("existing node gets a new cluster added (no duplicate)", () => {
    const graph: KnowledgeGraph = {
      nodes: [{ id: "usestate", label: "useState", clusters: ["core concepts"] }],
      edges: [],
      sessions: [],
    };
    const concepts: Concept[] = [{ word: "useState", cluster: "practical usage" }];
    mergeConceptsIntoGraph(graph, concepts, "s2");
    assert.equal(graph.nodes.length, 1);
    assert.deepEqual(graph.nodes[0].clusters, ["core concepts", "practical usage"]);
  });

  test("existing node does not get a duplicate cluster", () => {
    const graph: KnowledgeGraph = {
      nodes: [{ id: "usestate", label: "useState", clusters: ["core concepts"] }],
      edges: [],
      sessions: [],
    };
    const concepts: Concept[] = [{ word: "useState", cluster: "core concepts" }];
    mergeConceptsIntoGraph(graph, concepts, "s3");
    assert.deepEqual(graph.nodes[0].clusters, ["core concepts"]);
  });

  test("creates edges between nodes in the same cluster", () => {
    const concepts: Concept[] = [
      { word: "Alpha", cluster: "core concepts" },
      { word: "Beta", cluster: "core concepts" },
    ];
    const graph = mergeConceptsIntoGraph(emptyGraph(), concepts, "s1");
    assert.equal(graph.edges.length, 1);
    assert.equal(graph.edges[0].source, "alpha");
    assert.equal(graph.edges[0].target, "beta");
    assert.equal(graph.edges[0].weight, 1);
  });

  test("increments edge weight when the same pair appears again", () => {
    const concepts: Concept[] = [
      { word: "Alpha", cluster: "core concepts" },
      { word: "Beta", cluster: "core concepts" },
    ];
    const graph = mergeConceptsIntoGraph(emptyGraph(), concepts, "s1");
    mergeConceptsIntoGraph(graph, concepts, "s2");
    assert.equal(graph.edges[0].weight, 2);
  });

  test("nodes in different clusters produce session-level bridge edges", () => {
    const concepts: Concept[] = [
      { word: "Alpha", cluster: "core concepts" },
      { word: "Beta", cluster: "tradeoffs" },
    ];
    const graph = mergeConceptsIntoGraph(emptyGraph(), concepts, "s1");
    assert.equal(graph.edges.length, 1);
    assert.equal(graph.edges[0].source, "alpha");
    assert.equal(graph.edges[0].target, "beta");
    assert.equal(graph.edges[0].weight, 1);
  });

  test("adds cross-cluster bridges without removing same-cluster relationships", () => {
    const concepts: Concept[] = [
      { word: "Alpha", cluster: "core concepts" },
      { word: "Beta", cluster: "core concepts" },
      { word: "Gamma", cluster: "tradeoffs" },
    ];
    const graph = mergeConceptsIntoGraph(emptyGraph(), concepts, "s1");
    const alphaBeta = graph.edges.find((edge) => edge.source === "alpha" && edge.target === "beta");
    const alphaGamma = graph.edges.find((edge) => edge.source === "alpha" && edge.target === "gamma");
    const betaGamma = graph.edges.find((edge) => edge.source === "beta" && edge.target === "gamma");

    assert.ok(alphaBeta);
    assert.ok(alphaGamma);
    assert.ok(betaGamma);
    assert.equal(alphaBeta.weight, 1);
    assert.equal(alphaGamma.weight, 1);
    assert.equal(betaGamma.weight, 1);
  });

  test("adds sessionId and does not duplicate it on second merge", () => {
    const concepts: Concept[] = [{ word: "Alpha", cluster: "core concepts" }];
    const graph = mergeConceptsIntoGraph(emptyGraph(), concepts, "s1");
    assert.deepEqual(graph.sessions, ["s1"]);
    mergeConceptsIntoGraph(graph, concepts, "s1");
    assert.deepEqual(graph.sessions, ["s1"]);
  });
});

// ─────────────────────────────────────────────
// #11 — buildSummary
// ─────────────────────────────────────────────

describe("buildSummary", () => {
  test("includes topic and date in the header", () => {
    const session = makeSession();
    const summary = buildSummary(session);
    assert.ok(summary.includes("React hooks"));
    assert.ok(summary.includes("## Interview Summary"));
  });

  test("shows N/A avg score when there are no evaluations", () => {
    const session = makeSession({ evaluations: [] });
    const summary = buildSummary(session);
    assert.ok(summary.includes("Avg score: N/A/5"));
    assert.ok(summary.includes("No evaluations recorded."));
  });

  test("calculates correct avg score across evaluations", () => {
    const session = makeSession({
      evaluations: [makeEvaluation(4), makeEvaluation(2)],
    });
    const summary = buildSummary(session);
    assert.ok(summary.includes("Avg score: 3.0/5"));
  });

  test("lists each evaluation with its score and feedback", () => {
    const session = makeSession({
      evaluations: [makeEvaluation(5, "Perfect answer."), makeEvaluation(3, "Needs more detail.")],
    });
    const summary = buildSummary(session);
    assert.ok(summary.includes("Q1 [5/5]: Perfect answer."));
    assert.ok(summary.includes("Q2 [3/5]: Needs more detail."));
  });

  test("reports correct question count", () => {
    const session = makeSession({
      evaluations: [makeEvaluation(4), makeEvaluation(4), makeEvaluation(4)],
    });
    const summary = buildSummary(session);
    assert.ok(summary.includes("Questions: 3"));
  });
});

// ─────────────────────────────────────────────
// #12 — buildTranscript
// ─────────────────────────────────────────────

describe("buildTranscript", () => {
  test("returns empty string for a session with no messages", () => {
    const session = makeSession({ messages: [] });
    assert.equal(buildTranscript(session), "");
  });

  test("formats each message with uppercase role prefix", () => {
    const session = makeSession({
      messages: [
        { role: "interviewer", content: "What is a closure?", timestamp: "" },
        { role: "candidate", content: "A function with captured scope.", timestamp: "" },
      ],
    });
    const transcript = buildTranscript(session);
    assert.ok(transcript.includes("INTERVIEWER: What is a closure?"));
    assert.ok(transcript.includes("CANDIDATE: A function with captured scope."));
  });

  test("preserves message order", () => {
    const session = makeSession({
      messages: [
        { role: "interviewer", content: "First", timestamp: "" },
        { role: "candidate", content: "Second", timestamp: "" },
        { role: "interviewer", content: "Third", timestamp: "" },
      ],
    });
    const transcript = buildTranscript(session);
    const firstIdx = transcript.indexOf("First");
    const secondIdx = transcript.indexOf("Second");
    const thirdIdx = transcript.indexOf("Third");
    assert.ok(firstIdx < secondIdx && secondIdx < thirdIdx);
  });

  test("separates messages with double newlines", () => {
    const session = makeSession({
      messages: [
        { role: "interviewer", content: "Q", timestamp: "" },
        { role: "candidate", content: "A", timestamp: "" },
      ],
    });
    assert.ok(buildTranscript(session).includes("\n\n"));
  });
});

// ─────────────────────────────────────────────
// #13 — calcAvgScore
// ─────────────────────────────────────────────

describe("calcAvgScore", () => {
  test("returns N/A for empty evaluations", () => {
    assert.equal(calcAvgScore([]), "N/A");
  });

  test("returns correct average for a single evaluation", () => {
    assert.equal(calcAvgScore([makeEvaluation(4)]), "4.0");
  });

  test("returns correct average for multiple evaluations", () => {
    assert.equal(calcAvgScore([makeEvaluation(3), makeEvaluation(5)]), "4.0");
  });

  test("rounds to one decimal place", () => {
    assert.equal(calcAvgScore([makeEvaluation(1), makeEvaluation(2)]), "1.5");
    assert.equal(calcAvgScore([makeEvaluation(1), makeEvaluation(1), makeEvaluation(2)]), "1.3");
  });

  test("handles all same scores", () => {
    const evals = [makeEvaluation(3), makeEvaluation(3), makeEvaluation(3)];
    assert.equal(calcAvgScore(evals), "3.0");
  });
});

// ─────────────────────────────────────────────
// generateFlashcards
// ─────────────────────────────────────────────

function makeEval(score: number, questionIndex = 0, overrides: Partial<Evaluation> = {}): Evaluation {
  return {
    questionIndex,
    question: "What is useEffect?",
    answer: "It handles side effects.",
    score,
    feedback: "Good answer.",
    needsFollowUp: score <= 3,
    ...overrides,
  };
}

describe("generateFlashcards", () => {
  test("returns empty array when there are no evaluations", () => {
    assert.deepEqual(generateFlashcards(makeSession({ evaluations: [] })), []);
  });

  test("returns empty array when all scores are >= 4", () => {
    const session = makeSession({ evaluations: [makeEval(4), makeEval(5, 1)] });
    assert.deepEqual(generateFlashcards(session), []);
  });

  test("generates one card for a single weak evaluation", () => {
    const session = makeSession({ evaluations: [makeEval(3)] });
    const cards = generateFlashcards(session);
    assert.equal(cards.length, 1);
    assert.equal(cards[0].front, "What is useEffect?");
    assert.equal(cards[0].topic, session.topic);
  });

  test("card id is deterministic: fc-{sessionId}-q{questionIndex}", () => {
    const session = makeSession({ id: "sess-abc", evaluations: [makeEval(2, 1)] });
    assert.equal(generateFlashcards(session)[0].id, "fc-sess-abc-q1");
  });

  test("maps score <= 2 to hard difficulty", () => {
    assert.equal(generateFlashcards(makeSession({ evaluations: [makeEval(1)] }))[0].difficulty, "hard");
    assert.equal(generateFlashcards(makeSession({ evaluations: [makeEval(2)] }))[0].difficulty, "hard");
  });

  test("maps score == 3 to medium difficulty", () => {
    assert.equal(generateFlashcards(makeSession({ evaluations: [makeEval(3)] }))[0].difficulty, "medium");
  });

  test("score == 4 is not weak and produces no card", () => {
    const session = makeSession({
      evaluations: [makeEval(4, 0), makeEval(3, 1)],
    });
    const cards = generateFlashcards(session);
    assert.equal(cards.length, 1);
    assert.equal(cards[0].id, `fc-${session.id}-q1`);
  });

  test("deduplicates by questionIndex, keeping the evaluation with the lowest score", () => {
    const session = makeSession({
      evaluations: [makeEval(3, 0), makeEval(1, 0)],
    });
    const cards = generateFlashcards(session);
    assert.equal(cards.length, 1);
    assert.equal(cards[0].difficulty, "hard"); // score 1 → hard
  });

  test("generates one card per unique weak questionIndex", () => {
    const session = makeSession({
      evaluations: [makeEval(2, 0), makeEval(3, 1)],
    });
    assert.equal(generateFlashcards(session).length, 2);
  });

  test("card back includes the candidate answer and feedback", () => {
    const session = makeSession({ evaluations: [makeEval(2, 0, { feedback: "Missing edge cases." })] });
    const back = generateFlashcards(session)[0].back;
    assert.ok(back.includes("It handles side effects."));
    assert.ok(back.includes("Missing edge cases."));
  });

  test("card back includes deeperDive when present", () => {
    const session = makeSession({
      evaluations: [makeEval(2, 0, { deeperDive: "- Study invariant conditions" })],
    });
    assert.ok(generateFlashcards(session)[0].back.includes("Study invariant conditions"));
  });

  test("card has correct SM-2 initial values and is due immediately", () => {
    const session = makeSession({ evaluations: [makeEval(3)] });
    const card = generateFlashcards(session)[0];
    assert.equal(card.interval, 1);
    assert.equal(card.easeFactor, 2.5);
    assert.equal(card.repetitions, 0);
    assert.equal(card.dueDate, card.createdAt);
  });

  test("card source links back to session and question", () => {
    const session = makeSession({ id: "sess-xyz", evaluations: [makeEval(2, 2)] });
    assert.deepEqual(generateFlashcards(session)[0].source, {
      sessionId: "sess-xyz",
      questionIndex: 2,
      originalScore: 2,
    });
  });
});
