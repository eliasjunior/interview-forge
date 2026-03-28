import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { Evaluation, Session } from "@mock-interview/shared";
import { buildProgressOverview } from "../reportUtils.js";

function makeEvaluation(score: number, questionIndex: number, needsFollowUp = score <= 3): Evaluation {
  return {
    questionIndex,
    question: `Question ${questionIndex + 1}`,
    answer: `Answer ${questionIndex + 1}`,
    score,
    feedback: `Feedback ${questionIndex + 1}`,
    needsFollowUp,
  };
}

function makeSession(overrides: Partial<Session> & Pick<Session, "id" | "topic" | "createdAt">): Session {
  const { id, topic, createdAt, ...rest } = overrides;

  return {
    id,
    topic,
    state: "ENDED",
    currentQuestionIndex: 0,
    questions: ["Question 1", "Question 2"],
    messages: [],
    evaluations: [makeEvaluation(3, 0), makeEvaluation(4, 1, false)],
    createdAt,
    knowledgeSource: "file",
    ...rest,
  };
}

describe("buildProgressOverview", () => {
  test("aggregates ended interview sessions and treats legacy sessions as interview", () => {
    const sessions: Record<string, Session> = {
      a1: makeSession({
        id: "a1",
        topic: "JWT",
        createdAt: "2026-03-01T09:00:00.000Z",
        endedAt: "2026-03-01T09:30:00.000Z",
        evaluations: [makeEvaluation(2, 0), makeEvaluation(3, 1)],
      }),
      a2: makeSession({
        id: "a2",
        topic: "JWT",
        createdAt: "2026-03-10T09:00:00.000Z",
        endedAt: "2026-03-10T09:25:00.000Z",
        evaluations: [makeEvaluation(4, 0, false), makeEvaluation(5, 1, false)],
      }),
      b1: makeSession({
        id: "b1",
        topic: "Kafka",
        createdAt: "2026-03-15T09:00:00.000Z",
        endedAt: "2026-03-15T09:20:00.000Z",
        sessionKind: "interview",
        evaluations: [makeEvaluation(3, 0), makeEvaluation(4, 1, false)],
      }),
      draft: makeSession({
        id: "draft",
        topic: "Ignored",
        createdAt: "2026-03-20T09:00:00.000Z",
        state: "WAIT_FOR_ANSWER",
      }),
      study1: makeSession({
        id: "study1",
        topic: "JWT",
        createdAt: "2026-03-18T09:00:00.000Z",
        endedAt: "2026-03-18T09:10:00.000Z",
        sessionKind: "study",
        evaluations: [makeEvaluation(5, 0, false)],
      }),
    };

    const overview = buildProgressOverview(sessions, {
      sessionKind: "interview",
      weakScoreThreshold: 3,
      recentSessionsLimit: 2,
      topicLimit: 5,
    });

    assert.equal(overview.totals.sessions, 3);
    assert.equal(overview.totals.questionsAnswered, 6);
    assert.equal(overview.totals.avgScore, "3.5");
    assert.equal(overview.totals.weakQuestions, 3);
    assert.equal(overview.totals.weakQuestionRate, "50.0%");
    assert.equal(overview.totals.followUpRate, "50.0%");
    assert.deepEqual(overview.scoreDistribution, { "1": 0, "2": 1, "3": 2, "4": 2, "5": 1 });
    assert.equal(overview.recentSessions.length, 2);
    assert.equal(overview.recentSessions[0].sessionId, "b1");
    assert.equal(overview.scoreTrend[0].sessionId, "a1");
    assert.equal(overview.scoreTrend[2].sessionId, "b1");
    assert.equal(overview.topicBreakdown[0].topic, "Kafka");
    assert.equal(overview.topicBreakdown[1].topic, "JWT");
    assert.equal(overview.repeatedTopics.length, 1);
    assert.equal(overview.repeatedTopics[0].topic, "JWT");
    assert.equal(overview.repeatedTopics[0].delta, "+2.0");
  });

  test("can aggregate all session kinds together", () => {
    const sessions: Record<string, Session> = {
      interview1: makeSession({
        id: "interview1",
        topic: "System Design",
        createdAt: "2026-03-01T09:00:00.000Z",
        endedAt: "2026-03-01T09:30:00.000Z",
        sessionKind: "interview",
        evaluations: [makeEvaluation(4, 0, false)],
      }),
      drill1: makeSession({
        id: "drill1",
        topic: "System Design",
        createdAt: "2026-03-02T09:00:00.000Z",
        endedAt: "2026-03-02T09:10:00.000Z",
        sessionKind: "drill",
        evaluations: [makeEvaluation(5, 0, false)],
      }),
    };

    const overview = buildProgressOverview(sessions, {
      sessionKind: "all",
      weakScoreThreshold: 3,
      recentSessionsLimit: 5,
      topicLimit: 5,
    });

    assert.equal(overview.totals.sessions, 2);
    assert.equal(overview.totals.avgScore, "4.5");
    assert.equal(overview.topicBreakdown[0].sessionCount, 2);
  });
});
