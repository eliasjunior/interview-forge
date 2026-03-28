import type { Evaluation, Session, SessionKind } from "@mock-interview/shared";
import type { WeakSubject, FullReportQuestionContext } from "./tools/deps.js";

export type ProgressSessionKind = SessionKind | "all";

export interface ProgressOverviewOptions {
  weakScoreThreshold: number;
  recentSessionsLimit: number;
  topicLimit: number;
  sessionKind: ProgressSessionKind;
}

export interface ProgressOverview {
  generatedAt: string;
  filters: {
    sessionKind: ProgressSessionKind;
    weakScoreThreshold: number;
    recentSessionsLimit: number;
    topicLimit: number;
  };
  totals: {
    sessions: number;
    topics: number;
    questionsAnswered: number;
    avgScore: string;
    weakQuestions: number;
    weakQuestionRate: string;
    followUpCount: number;
    followUpRate: string;
    firstSessionAt: string | null;
    lastSessionAt: string | null;
  };
  scoreDistribution: Record<"1" | "2" | "3" | "4" | "5", number>;
  recentSessions: Array<{
    sessionId: string;
    topic: string;
    sessionKind: SessionKind;
    createdAt: string;
    endedAt?: string;
    avgScore: string;
    questionCount: number;
    weakQuestionCount: number;
    followUpCount: number;
  }>;
  scoreTrend: Array<{
    sessionId: string;
    topic: string;
    endedAt: string;
    avgScore: string;
  }>;
  topicBreakdown: Array<{
    topic: string;
    sessionCount: number;
    avgScore: string;
    latestScore: string;
    deltaFromFirst: string;
    totalQuestions: number;
    weakQuestions: number;
    weakQuestionRate: string;
    lastSessionAt: string;
  }>;
  repeatedTopics: Array<{
    topic: string;
    sessionCount: number;
    firstScore: string;
    latestScore: string;
    delta: string;
    firstSessionAt: string;
    latestSessionAt: string;
  }>;
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

export function calcAvgScore(evaluations: Evaluation[]): string {
  if (evaluations.length === 0) return "N/A";
  return numericAvg(evaluations).toFixed(1);
}

export function buildSummary(session: Session): string {
  const avg = calcAvgScore(session.evaluations);

  const lines = session.evaluations
    .map((e, i) => `  Q${i + 1} [${e.score}/5]: ${e.feedback}`)
    .join("\n");

  return (
    `## Interview Summary — ${session.topic}\n` +
    `Date: ${new Date(session.createdAt).toLocaleDateString()}\n` +
    `Questions: ${session.evaluations.length} | Avg score: ${avg}/5\n\n` +
    `### Question breakdown\n${lines || "  No evaluations recorded."}`
  );
}

export function buildReport(session: Session): string {
  const avg = calcAvgScore(session.evaluations);
  const date = new Date(session.createdAt).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const scoreBar = (score: number) => "█".repeat(score) + "░".repeat(5 - score);

  const lines: string[] = [
    `# Interview Report — ${session.topic}`,
    ``,
    `| | |`,
    `|---|---|`,
    `| **Date** | ${date} |`,
    `| **Session ID** | \`${session.id}\` |`,
    `| **Questions answered** | ${session.evaluations.length} of ${session.questions.length} |`,
    `| **Average score** | ${avg} / 5 |`,
    ``,
    `---`,
    ``,
  ];

  if (session.evaluations.length > 0) {
    lines.push(`## Question Breakdown`, ``);

    for (let i = 0; i < session.evaluations.length; i++) {
      const e = session.evaluations[i];
      lines.push(
        `### Q${i + 1} &nbsp; ${scoreBar(e.score)} &nbsp; ${e.score}/5`,
        ``,
        `**Question:** ${e.question}`,
        ``,
        `**Answer:** ${e.answer}`,
        ``,
        ...(e.strongAnswer?.trim()
          ? [`**Strong answer:** ${e.strongAnswer}`, ``]
          : []),
        `**Feedback:** ${e.feedback}`,
        ``,
      );

      if (e.deeperDive?.trim()) {
        lines.push(
          `#### 🔍 Where to go deeper`,
          ``,
          e.deeperDive.trim(),
          ``,
        );
      }

      lines.push(`---`, ``);
    }
  }

  lines.push(
    `## Summary`,
    ``,
    buildSummary(session),
    ``,
  );

  if (session.concepts && session.concepts.length > 0) {
    const byCluster: Record<string, string[]> = {};
    for (const c of session.concepts) {
      if (!byCluster[c.cluster]) {
        byCluster[c.cluster] = [];
      }
      byCluster[c.cluster].push(c.word);
    }
    lines.push(`## Concepts Extracted`, ``);
    for (const [cluster, words] of Object.entries(byCluster)) {
      lines.push(`**${cluster}:** ${words.join(", ")}`);
    }
    lines.push(``);
  }

  if (session.messages.length > 0) {
    lines.push(`---`, ``, `## Full Transcript`, ``);
    for (const m of session.messages) {
      const role = m.role === "interviewer" ? "🎙 **Interviewer**" : "🧑‍💻 **Candidate**";
      lines.push(`${role}`, ``, `> ${m.content.replace(/\n/g, "\n> ")}`, ``);
    }
  }

  return lines.join("\n");
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
        avgScore: topicEvaluations.length === 0 ? "N/A" : (topicEvaluations.reduce((sum, evaluation) => sum + evaluation.score, 0) / topicEvaluations.length).toFixed(1),
        latestScore: calcAvgScore(latestSession.evaluations),
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
        firstScore: calcAvgScore(firstSession.evaluations),
        latestScore: calcAvgScore(latestSession.evaluations),
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
      avgScore: calcAvgScore(session.evaluations),
      questionCount: session.evaluations.length,
      weakQuestionCount: session.evaluations.filter((evaluation) => evaluation.score <= options.weakScoreThreshold).length,
      followUpCount: session.evaluations.filter((evaluation) => evaluation.needsFollowUp).length,
    })),
    scoreTrend: chronologicalSessions.map((session) => ({
      sessionId: session.id,
      topic: session.topic,
      endedAt: getEndedAt(session),
      avgScore: calcAvgScore(session.evaluations),
    })),
    topicBreakdown,
    repeatedTopics,
  };
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

export function serializeForInlineScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\u003c")
    .replace(/>/g, "\u003e")
    .replace(/&/g, "\u0026");
}

export function countLines(text: string): number {
  return text.trim().split(/\r?\n/).length;
}

function buildWeakSubjectTitle(question: string, topic: string): string {
  const q = question.toLowerCase();
  if (q.includes("high-scale production")) return `${topic} in high-scale production`;
  if (q.includes("pitfalls") || q.includes("mistakes")) return `${topic} common pitfalls`;
  if (q.includes("practical example") || q.includes("real-world use case")) return `${topic} practical use cases`;
  if (q.includes("junior developer")) return `${topic} explanation for juniors`;
  if (q.includes("high-level overview")) return `${topic} overview and fundamentals`;
  if (q.includes("elaborate further")) return `${topic} deeper explanation`;
  return question.replace(/\?+$/, "");
}

export function pickSessionByTopic(sessions: Record<string, Session>, topic: string): Session | null {
  const topicNorm = topic.trim().toLowerCase();
  const ended = Object.values(sessions).filter((s) => s.state === "ENDED");

  const exact = ended.filter((s) => s.topic.trim().toLowerCase() === topicNorm);
  const partial = exact.length > 0
    ? exact
    : ended.filter((s) => s.topic.trim().toLowerCase().includes(topicNorm));

  if (partial.length === 0) return null;
  return partial.sort((a, b) => {
    const aTime = new Date(a.endedAt ?? a.createdAt).getTime();
    const bTime = new Date(b.endedAt ?? b.createdAt).getTime();
    return bTime - aTime;
  })[0] ?? null;
}

export function extractWeakSubjects(
  session: Session,
  weakScoreThreshold: number,
  maxSubjects: number,
): WeakSubject[] {
  const byQuestion = new Map<number, Evaluation[]>();
  for (const evaluation of session.evaluations) {
    const list = byQuestion.get(evaluation.questionIndex) ?? [];
    list.push(evaluation);
    byQuestion.set(evaluation.questionIndex, list);
  }

  const weak: WeakSubject[] = [];
  for (const [questionIndex, evaluations] of byQuestion.entries()) {
    const minScore = Math.min(...evaluations.map((e) => e.score));
    if (minScore > weakScoreThreshold) continue;

    const mainQuestion = session.questions[questionIndex] ?? evaluations[0]?.question ?? `Question ${questionIndex + 1}`;
    const gapParts = evaluations
      .map((e) => (e.deeperDive && !e.deeperDive.startsWith("ERROR")) ? e.deeperDive : e.feedback)
      .filter(Boolean);
    const gapSummary = gapParts.join(" ").replace(/\s+/g, " ").trim();

    weak.push({
      questionIndex,
      question: mainQuestion,
      subject: buildWeakSubjectTitle(mainQuestion, session.topic),
      score: minScore,
      gapSummary,
      exampleAnswer: evaluations[evaluations.length - 1]?.answer ?? "",
    });
  }

  return weak
    .sort((a, b) => a.score - b.score || a.questionIndex - b.questionIndex)
    .slice(0, maxSubjects);
}

export function buildFullQuestionContext(
  session: Session,
  weakScoreThreshold: number,
): FullReportQuestionContext[] {
  return session.evaluations.map((evaluation, idx) => {
    const primaryQuestion = session.questions[evaluation.questionIndex] ?? evaluation.question;
    const subject = buildWeakSubjectTitle(primaryQuestion, session.topic);
    const gapSummary =
      evaluation.deeperDive && !evaluation.deeperDive.startsWith("ERROR")
        ? evaluation.deeperDive
        : evaluation.feedback;

    return {
      askedOrder: idx + 1,
      questionNumber: evaluation.questionIndex + 1,
      subject,
      question: evaluation.question,
      candidateAnswer: evaluation.answer,
      strongAnswer: evaluation.strongAnswer,
      interviewerFeedback: evaluation.feedback,
      score: evaluation.score,
      isWeak: evaluation.score <= weakScoreThreshold,
      gapSummary,
    };
  });
}
