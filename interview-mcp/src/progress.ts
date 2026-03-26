import type { Evaluation, ProgressOverview, ProgressSessionKind, Session, SessionKind } from "@mock-interview/shared";

export interface ProgressOverviewOptions {
  sessionKind: ProgressSessionKind;
  weakScoreThreshold: number;
  recentSessionsLimit: number;
  topicLimit: number;
}

function getSessionKind(session: Session): SessionKind {
  return session.sessionKind ?? "interview";
}

function getEndedAt(session: Session): string {
  return session.endedAt ?? session.createdAt;
}

function numericAvg(evaluations: Evaluation[]): number {
  if (evaluations.length === 0) return 0;
  return evaluations.reduce((sum, evaluation) => sum + evaluation.score, 0) / evaluations.length;
}

function formatRate(count: number, total: number): string {
  if (total === 0) return "0.0%";
  return `${((count / total) * 100).toFixed(1)}%`;
}

function formatDelta(value: number): string {
  const rounded = value.toFixed(1);
  return value > 0 ? `+${rounded}` : rounded;
}

function formatAvg(evaluations: Evaluation[]): string {
  if (evaluations.length === 0) return "N/A";
  return numericAvg(evaluations).toFixed(1);
}

export function buildProgressOverview(
  sessionsById: Record<string, Session>,
  options: ProgressOverviewOptions,
): ProgressOverview {
  const endedSessions = Object.values(sessionsById)
    .filter((session) => session.state === "ENDED")
    .filter((session) => options.sessionKind === "all" || getSessionKind(session) === options.sessionKind);

  const chronologicalSessions = endedSessions
    .slice()
    .sort((a, b) => new Date(getEndedAt(a)).getTime() - new Date(getEndedAt(b)).getTime());

  const reverseChronologicalSessions = chronologicalSessions.slice().reverse();
  const evaluations = chronologicalSessions.flatMap((session) => session.evaluations);
  const weakQuestions = evaluations.filter((evaluation) => evaluation.score <= options.weakScoreThreshold).length;
  const followUpCount = evaluations.filter((evaluation) => evaluation.needsFollowUp).length;
  const totalScore = evaluations.reduce((sum, evaluation) => sum + evaluation.score, 0);
  const avgScore = evaluations.length === 0 ? "N/A" : (totalScore / evaluations.length).toFixed(1);
  const scoreDistribution: ProgressOverview["scoreDistribution"] = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };

  for (const evaluation of evaluations) {
    scoreDistribution[String(evaluation.score) as keyof typeof scoreDistribution] += 1;
  }

  const topicGroups = new Map<string, Session[]>();
  for (const session of chronologicalSessions) {
    const key = session.topic.trim().toLowerCase();
    const group = topicGroups.get(key) ?? [];
    group.push(session);
    topicGroups.set(key, group);
  }

  const topicBreakdown = Array.from(topicGroups.values())
    .map((sessions) => {
      const topicEvaluations = sessions.flatMap((session) => session.evaluations);
      const firstSession = sessions[0];
      const latestSession = sessions[sessions.length - 1];
      const firstAvg = numericAvg(firstSession.evaluations);
      const latestAvg = numericAvg(latestSession.evaluations);
      const weakCount = topicEvaluations.filter((evaluation) => evaluation.score <= options.weakScoreThreshold).length;

      return {
        topic: latestSession.topic,
        sessionCount: sessions.length,
        avgScore: topicEvaluations.length === 0
          ? "N/A"
          : (topicEvaluations.reduce((sum, evaluation) => sum + evaluation.score, 0) / topicEvaluations.length).toFixed(1),
        latestScore: formatAvg(latestSession.evaluations),
        deltaFromFirst: formatDelta(latestAvg - firstAvg),
        totalQuestions: topicEvaluations.length,
        weakQuestions: weakCount,
        weakQuestionRate: formatRate(weakCount, topicEvaluations.length),
        lastSessionAt: getEndedAt(latestSession),
      };
    })
    .sort((a, b) => {
      const scoreDiff = Number(a.avgScore) - Number(b.avgScore);
      if (scoreDiff !== 0) return scoreDiff;
      return new Date(b.lastSessionAt).getTime() - new Date(a.lastSessionAt).getTime();
    })
    .slice(0, options.topicLimit);

  const repeatedTopics = Array.from(topicGroups.values())
    .filter((sessions) => sessions.length >= 2)
    .map((sessions) => {
      const firstSession = sessions[0];
      const latestSession = sessions[sessions.length - 1];
      const firstScore = numericAvg(firstSession.evaluations);
      const latestScore = numericAvg(latestSession.evaluations);

      return {
        topic: latestSession.topic,
        sessionCount: sessions.length,
        firstScore: formatAvg(firstSession.evaluations),
        latestScore: formatAvg(latestSession.evaluations),
        delta: formatDelta(latestScore - firstScore),
        firstSessionAt: getEndedAt(firstSession),
        latestSessionAt: getEndedAt(latestSession),
      };
    })
    .sort((a, b) => Number(b.delta) - Number(a.delta));

  return {
    generatedAt: new Date().toISOString(),
    filters: {
      sessionKind: options.sessionKind,
      weakScoreThreshold: options.weakScoreThreshold,
      recentSessionsLimit: options.recentSessionsLimit,
      topicLimit: options.topicLimit,
    },
    totals: {
      sessions: chronologicalSessions.length,
      topics: topicGroups.size,
      questionsAnswered: evaluations.length,
      avgScore,
      weakQuestions,
      weakQuestionRate: formatRate(weakQuestions, evaluations.length),
      followUpCount,
      followUpRate: formatRate(followUpCount, evaluations.length),
      firstSessionAt: chronologicalSessions[0] ? getEndedAt(chronologicalSessions[0]) : null,
      lastSessionAt: chronologicalSessions.length > 0 ? getEndedAt(chronologicalSessions[chronologicalSessions.length - 1]) : null,
    },
    scoreDistribution,
    recentSessions: reverseChronologicalSessions.slice(0, options.recentSessionsLimit).map((session) => ({
      sessionId: session.id,
      topic: session.topic,
      sessionKind: getSessionKind(session),
      createdAt: session.createdAt,
      endedAt: session.endedAt,
      avgScore: formatAvg(session.evaluations),
      questionCount: session.evaluations.length,
      weakQuestionCount: session.evaluations.filter((evaluation) => evaluation.score <= options.weakScoreThreshold).length,
      followUpCount: session.evaluations.filter((evaluation) => evaluation.needsFollowUp).length,
    })),
    scoreTrend: chronologicalSessions.map((session) => ({
      sessionId: session.id,
      topic: session.topic,
      endedAt: getEndedAt(session),
      avgScore: formatAvg(session.evaluations),
    })),
    topicBreakdown,
    repeatedTopics,
  };
}
