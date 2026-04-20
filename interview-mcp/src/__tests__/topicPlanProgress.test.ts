import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { Session, TopicLevelSnapshot, WarmUpLevel } from "@mock-interview/shared";
import { inferLastLevelUpAt, shouldRecordTopicLevelUp } from "../topicPlanProgress.js";

function snapshot(level: WarmUpLevel): TopicLevelSnapshot {
  return {
    level,
    status: level >= 3 ? "ready" : level === 0 ? "cold" : "warmup",
    reason: "test",
    nextLevelRequirement: "test",
    progress: {
      current: 0,
      required: 2,
      targetLevel: (Math.min(level + 1, 4)) as WarmUpLevel,
      variant: level >= 4 ? "complete" : level >= 2 ? "interview" : "warmup",
      label: "test",
      attempted: level > 0,
      almostThere: false,
    },
  };
}

describe("shouldRecordTopicLevelUp", () => {
  test("does not mark a stale historical unlock as a fresh level-up", () => {
    const result = shouldRecordTopicLevelUp({
      previousSnapshot: snapshot(1),
      currentSnapshot: snapshot(1),
      previousStoredLevel: undefined,
      currentStoredLevel: 1,
    });

    assert.equal(result, false);
  });

  test("marks a real session-driven unlock as a fresh level-up", () => {
    const result = shouldRecordTopicLevelUp({
      previousSnapshot: snapshot(0),
      currentSnapshot: snapshot(1),
      previousStoredLevel: undefined,
      currentStoredLevel: 1,
    });

    assert.equal(result, true);
  });

  test("does not restamp when the stored level was already ahead", () => {
    const result = shouldRecordTopicLevelUp({
      previousSnapshot: snapshot(1),
      currentSnapshot: snapshot(2),
      previousStoredLevel: 2,
      currentStoredLevel: 2,
    });

    assert.equal(result, false);
  });
});

describe("inferLastLevelUpAt", () => {
  test("ignores legacy warmup sessions without explicit quest levels when backfilling timestamps", () => {
    const sessions: Record<string, Session> = {
      legacyA: {
        id: "legacyA",
        topic: "CI/CD Release Flow for Backend Engineers",
        sessionKind: "warmup",
        interviewType: "design",
        state: "ENDED",
        currentQuestionIndex: 1,
        questions: ["Q1"],
        messages: [],
        evaluations: [{ questionIndex: 0, question: "Q1", answer: "A", score: 4, feedback: "good", needsFollowUp: false }],
        createdAt: "2026-03-27T17:15:17.271Z",
        endedAt: "2026-03-27T18:30:52.427Z",
        knowledgeSource: "file",
      },
      legacyB: {
        id: "legacyB",
        topic: "CI/CD Release Flow for Backend Engineers",
        sessionKind: "warmup",
        interviewType: "design",
        state: "ENDED",
        currentQuestionIndex: 1,
        questions: ["Q1"],
        messages: [],
        evaluations: [{ questionIndex: 0, question: "Q1", answer: "A", score: 4, feedback: "good", needsFollowUp: false }],
        createdAt: "2026-03-27T22:04:38.489Z",
        endedAt: "2026-03-27T23:01:47.093Z",
        knowledgeSource: "file",
      },
      warmupL0: {
        id: "warmupL0",
        topic: "CI/CD Release Flow for Backend Engineers",
        sessionKind: "warmup",
        questLevel: 0,
        interviewType: "design",
        state: "ENDED",
        currentQuestionIndex: 1,
        questions: ["Q1"],
        messages: [],
        evaluations: [{ questionIndex: 0, question: "Q1", answer: "A", score: 4, feedback: "good", needsFollowUp: false }],
        createdAt: "2026-04-17T07:18:04.784Z",
        endedAt: "2026-04-17T07:35:57.347Z",
        knowledgeSource: "file",
      },
    };

    const inferred = inferLastLevelUpAt({
      topic: "CI/CD Release Flow for Backend Engineers",
      sessions,
      hasWarmupContent: true,
    });

    assert.equal(inferred, "2026-04-17T07:35:57.347Z");
  });
});
