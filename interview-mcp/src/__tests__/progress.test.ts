import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { Evaluation, Session } from "@mock-interview/shared";
import { buildProgressOverview } from "../progress.js";

function makeEvaluation(overrides: Partial<Evaluation> = {}): Evaluation {
  return {
    questionIndex: 0,
    question: "Default question",
    answer: "Default answer",
    score: 3,
    feedback: "Default feedback",
    needsFollowUp: false,
    ...overrides,
  };
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "session-1",
    topic: "Java Concurrency",
    interviewType: "design",
    sessionKind: "interview",
    state: "ENDED",
    currentQuestionIndex: 0,
    questions: ["Q1"],
    messages: [],
    evaluations: [makeEvaluation()],
    createdAt: "2026-03-01T10:00:00.000Z",
    endedAt: "2026-03-01T10:05:00.000Z",
    knowledgeSource: "ai",
    ...overrides,
  };
}

describe("buildProgressOverview", () => {
  test("returns zeroed totals and empty lists when there are no ended sessions", () => {
    const inProgress = makeSession({ id: "active-1", state: "WAIT_FOR_ANSWER" });

    const overview = buildProgressOverview(
      { [inProgress.id]: inProgress },
      { sessionKind: "all", weakScoreThreshold: 3, recentSessionsLimit: 5, topicLimit: 5 }
    );

    assert.equal(overview.filters.sessionKind, "all");
    assert.equal(overview.totals.sessions, 0);
    assert.equal(overview.totals.topics, 0);
    assert.equal(overview.totals.questionsAnswered, 0);
    assert.equal(overview.totals.avgScore, "N/A");
    assert.equal(overview.totals.weakQuestionRate, "0.0%");
    assert.equal(overview.totals.followUpRate, "0.0%");
    assert.equal(overview.totals.firstSessionAt, null);
    assert.equal(overview.totals.lastSessionAt, null);
    assert.deepEqual(overview.scoreDistribution, { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 });
    assert.deepEqual(overview.recentSessions, []);
    assert.deepEqual(overview.scoreTrend, []);
    assert.deepEqual(overview.topicBreakdown, []);
    assert.deepEqual(overview.repeatedTopics, []);
    assert.match(overview.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
  });

  test("weights warm-up sessions, aggregates topics, and sorts recent sessions newest first", () => {
    const warmup = makeSession({
      id: "warmup-1",
      topic: "Java Concurrency",
      sessionKind: "warmup",
      questLevel: 0,
      createdAt: "2026-03-01T09:00:00.000Z",
      endedAt: "2026-03-01T09:05:00.000Z",
      evaluations: [makeEvaluation({ score: 5, needsFollowUp: false })],
    });
    const firstInterview = makeSession({
      id: "interview-1",
      topic: "Java Concurrency",
      createdAt: "2026-03-02T09:00:00.000Z",
      endedAt: "2026-03-02T09:05:00.000Z",
      evaluations: [
        makeEvaluation({ questionIndex: 0, score: 2, needsFollowUp: true }),
        makeEvaluation({ questionIndex: 1, score: 4, needsFollowUp: false }),
      ],
    });
    const laterInterview = makeSession({
      id: "interview-2",
      topic: " java concurrency ",
      createdAt: "2026-03-03T09:00:00.000Z",
      endedAt: "2026-03-03T09:05:00.000Z",
      evaluations: [makeEvaluation({ score: 5, needsFollowUp: false })],
    });
    const drill = makeSession({
      id: "drill-1",
      topic: "Distributed Systems",
      sessionKind: "drill",
      createdAt: "2026-03-04T09:00:00.000Z",
      endedAt: "2026-03-04T09:05:00.000Z",
      evaluations: [makeEvaluation({ score: 1, needsFollowUp: true })],
    });

    const overview = buildProgressOverview(
      {
        [warmup.id]: warmup,
        [firstInterview.id]: firstInterview,
        [laterInterview.id]: laterInterview,
        [drill.id]: drill,
      },
      { sessionKind: "all", weakScoreThreshold: 3, recentSessionsLimit: 3, topicLimit: 5 }
    );

    assert.equal(overview.totals.sessions, 4);
    assert.equal(overview.totals.topics, 2);
    assert.equal(overview.totals.questionsAnswered, 5);
    assert.equal(overview.totals.avgScore, "3.0");
    assert.equal(overview.totals.weakQuestions, 2);
    assert.equal(overview.totals.weakQuestionRate, "40.0%");
    assert.equal(overview.totals.followUpCount, 2);
    assert.equal(overview.totals.followUpRate, "40.0%");
    assert.equal(overview.totals.firstSessionAt, "2026-03-01T09:05:00.000Z");
    assert.equal(overview.totals.lastSessionAt, "2026-03-04T09:05:00.000Z");
    assert.deepEqual(overview.scoreDistribution, { "1": 1, "2": 1, "3": 0, "4": 1, "5": 2 });

    assert.deepEqual(
      overview.recentSessions.map((session) => session.sessionId),
      ["drill-1", "interview-2", "interview-1"]
    );
    assert.equal(overview.recentSessions[0].sessionKind, "drill");
    assert.equal(overview.recentSessions[1].avgScore, "5.0");
    assert.equal(overview.recentSessions[2].weakQuestionCount, 1);
    assert.equal(overview.scoreTrend[0].sessionId, "warmup-1");
    assert.equal(overview.scoreTrend.at(-1)?.sessionId, "drill-1");

    assert.equal(overview.topicBreakdown.length, 2);
    assert.equal(overview.topicBreakdown[0].topic, "Distributed Systems");
    assert.equal(overview.topicBreakdown[0].avgScore, "1.0");
    assert.equal(overview.topicBreakdown[1].topic, " java concurrency ");
    assert.equal(overview.topicBreakdown[1].sessionCount, 3);
    assert.equal(overview.topicBreakdown[1].avgScore, "4.0");
    assert.equal(overview.topicBreakdown[1].latestScore, "5.0");
    assert.equal(overview.topicBreakdown[1].deltaFromFirst, "0.0");
    assert.equal(overview.topicBreakdown[1].weakQuestions, 1);
    assert.equal(overview.topicBreakdown[1].weakQuestionRate, "25.0%");

    assert.deepEqual(overview.repeatedTopics, [
      {
        topic: " java concurrency ",
        sessionCount: 3,
        firstScore: "5.0",
        latestScore: "5.0",
        delta: "0.0",
        firstSessionAt: "2026-03-01T09:05:00.000Z",
        latestSessionAt: "2026-03-03T09:05:00.000Z",
      },
    ]);
  });

  test("filters by session kind and respects topic limits and createdAt fallback", () => {
    const noEndedAt = makeSession({
      id: "study-1",
      topic: "Refactoring",
      sessionKind: "study",
      createdAt: "2026-03-01T12:00:00.000Z",
      endedAt: undefined,
      evaluations: [],
    });
    const secondStudy = makeSession({
      id: "study-2",
      topic: "Refactoring",
      sessionKind: "study",
      createdAt: "2026-03-02T12:00:00.000Z",
      endedAt: "2026-03-02T12:15:00.000Z",
      evaluations: [makeEvaluation({ score: 4, needsFollowUp: false })],
    });
    const interview = makeSession({
      id: "interview-ignored",
      topic: "Databases",
      sessionKind: "interview",
      createdAt: "2026-03-03T12:00:00.000Z",
      endedAt: "2026-03-03T12:15:00.000Z",
      evaluations: [makeEvaluation({ score: 1, needsFollowUp: true })],
    });
    const anotherStudy = makeSession({
      id: "study-3",
      topic: "Testing",
      sessionKind: "study",
      createdAt: "2026-03-04T12:00:00.000Z",
      endedAt: "2026-03-04T12:15:00.000Z",
      evaluations: [makeEvaluation({ score: 2, needsFollowUp: true })],
    });

    const overview = buildProgressOverview(
      {
        [noEndedAt.id]: noEndedAt,
        [secondStudy.id]: secondStudy,
        [interview.id]: interview,
        [anotherStudy.id]: anotherStudy,
      },
      { sessionKind: "study", weakScoreThreshold: 2, recentSessionsLimit: 10, topicLimit: 1 }
    );

    assert.equal(overview.totals.sessions, 3);
    assert.equal(overview.totals.topics, 2);
    assert.equal(overview.totals.questionsAnswered, 2);
    assert.equal(overview.totals.avgScore, "3.0");
    assert.equal(overview.totals.firstSessionAt, "2026-03-01T12:00:00.000Z");
    assert.equal(overview.totals.lastSessionAt, "2026-03-04T12:15:00.000Z");
    assert.deepEqual(
      overview.recentSessions.map((session) => session.sessionId),
      ["study-3", "study-2", "study-1"]
    );
    assert.deepEqual(
      overview.scoreTrend.map((session) => session.sessionId),
      ["study-1", "study-2", "study-3"]
    );
    assert.equal(overview.topicBreakdown.length, 1);
    assert.equal(overview.topicBreakdown[0].topic, "Testing");
    assert.deepEqual(overview.repeatedTopics, [
      {
        topic: "Refactoring",
        sessionCount: 2,
        firstScore: "N/A",
        latestScore: "4.0",
        delta: "+4.0",
        firstSessionAt: "2026-03-01T12:00:00.000Z",
        latestSessionAt: "2026-03-02T12:15:00.000Z",
      },
    ]);
  });
});
