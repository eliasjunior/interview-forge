import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { Flashcard, KnowledgeGraph, Session } from "@mock-interview/shared";
import { buildSessionDeletionPreview, rebuildGraphFromSessions } from "../sessions/deleteFlow.js";

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "session-1",
    topic: "JWT authentication",
    interviewType: "design",
    sessionKind: "interview",
    state: "ENDED",
    currentQuestionIndex: 0,
    questions: ["Q1", "Q2"],
    messages: [{ role: "candidate", content: "answer", timestamp: "2026-01-01T00:00:00.000Z" }],
    evaluations: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    knowledgeSource: "file",
    ...overrides,
  };
}

describe("buildSessionDeletionPreview", () => {
  test("reports session-owned and derived artifacts", () => {
    const session = makeSession({
      concepts: [{ word: "jwt", cluster: "core concepts" }],
      summary: "Ended early",
    });
    const flashcards: Flashcard[] = [{
      id: "fc-session-1-q0",
      front: "Q1",
      back: "A1",
      topic: session.topic,
      tags: ["jwt"],
      difficulty: "medium",
      createdAt: "2026-01-01T00:00:00.000Z",
      dueDate: "2026-01-01T00:00:00.000Z",
      interval: 1,
      easeFactor: 2.5,
      repetitions: 0,
      source: { sessionId: session.id, questionIndex: 0, originalScore: 2 },
    }];
    const graph: KnowledgeGraph = {
      nodes: [{ id: "jwt", label: "JWT", clusters: ["core concepts"] }],
      edges: [],
      sessions: [session.id],
    };

    const preview = buildSessionDeletionPreview(session, flashcards, graph, {
      markdownReport: true,
      reportUiDataset: false,
      weakSubjectsHtml: false,
    });

    assert.equal(preview.flashcards.count, 1);
    assert.equal(preview.graph.includedInGraphSessions, true);
    assert.equal(preview.graph.rebuildRequired, true);
    assert.equal(preview.artifacts.markdownReport, true);
    assert.ok(preview.warnings.some((warning) => warning.includes("flashcard")));
  });
});

describe("rebuildGraphFromSessions", () => {
  test("recomputes graph from remaining sessions only", () => {
    const graph = rebuildGraphFromSessions([
      makeSession({
        id: "session-a",
        concepts: [
          { word: "jwt", cluster: "core concepts" },
          { word: "refresh token", cluster: "practical usage" },
        ],
      }),
      makeSession({
        id: "session-b",
        concepts: [{ word: "mtls", cluster: "core concepts" }],
      }),
    ]);

    assert.deepEqual(graph.sessions.sort(), ["session-a", "session-b"]);
    assert.ok(graph.nodes.find((node) => node.id === "jwt"));
    assert.ok(graph.nodes.find((node) => node.id === "mtls"));
  });
});
