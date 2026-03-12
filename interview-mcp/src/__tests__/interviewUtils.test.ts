import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  assertState,
  buildSummary,
  buildTranscript,
  calcAvgScore,
  mergeConceptsIntoGraph,
} from "../interviewUtils.js";
import type { Session, Evaluation, KnowledgeGraph, Concept } from "../types.js";

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

  test("nodes in different clusters do not produce edges between clusters", () => {
    const concepts: Concept[] = [
      { word: "Alpha", cluster: "core concepts" },
      { word: "Beta", cluster: "tradeoffs" },
    ];
    const graph = mergeConceptsIntoGraph(emptyGraph(), concepts, "s1");
    assert.equal(graph.edges.length, 0);
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
