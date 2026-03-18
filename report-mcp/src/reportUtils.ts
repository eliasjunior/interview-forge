import type { Evaluation, Session, KnowledgeGraph } from "@mock-interview/shared";
import type { WeakSubject, FullReportQuestionContext } from "./tools/deps.js";

// ─────────────────────────────────────────────────────────────────────────────
// Session utilities
// ─────────────────────────────────────────────────────────────────────────────

export function calcAvgScore(evaluations: Evaluation[]): string {
  if (evaluations.length === 0) return "N/A";
  return (
    evaluations.reduce((s, e) => s + e.score, 0) / evaluations.length
  ).toFixed(1);
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

  // ── Header ────────────────────────────────────────────────────────────────
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

  // ── Question breakdown ────────────────────────────────────────────────────
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

  // ── Overall summary ───────────────────────────────────────────────────────
  lines.push(
    `## Summary`,
    ``,
    buildSummary(session),
    ``,
  );

  // ── Concepts ──────────────────────────────────────────────────────────────
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

  // ── Full transcript ───────────────────────────────────────────────────────
  if (session.messages.length > 0) {
    lines.push(`---`, ``, `## Full Transcript`, ``);
    for (const m of session.messages) {
      const role = m.role === "interviewer" ? "🎙 **Interviewer**" : "🧑‍💻 **Candidate**";
      lines.push(`${role}`, ``, `> ${m.content.replace(/\n/g, "\n> ")}`, ``);
    }
  }

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Report helper utilities
// ─────────────────────────────────────────────────────────────────────────────

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
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
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
