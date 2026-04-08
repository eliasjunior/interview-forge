import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { TopicLevelSnapshot, WarmUpLevel } from "@mock-interview/shared";
import { shouldRecordTopicLevelUp } from "../topicPlanProgress.js";

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
