import type { Session, Evaluation, Mistake } from "@mock-interview/shared";

// ─────────────────────────────────────────────
// Session utilities
// ─────────────────────────────────────────────

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// findLast polyfill — Array.findLast is ES2023, our target is ES2022
export function findLast<T>(arr: T[], pred: (item: T) => boolean): T | undefined {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (pred(arr[i])) return arr[i];
  }
  return undefined;
}

export function calcAvgScore(evaluations: Evaluation[]): string {
  if (evaluations.length === 0) return "N/A";
  return (
    evaluations.reduce((s, e) => s + e.score, 0) / evaluations.length
  ).toFixed(1);
}

export function buildTranscript(session: Session): string {
  return session.messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");
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

// ─────────────────────────────────────────────
// Post-interview recommendations
// ─────────────────────────────────────────────

const RECOMMENDATION_SCORE_THRESHOLD = 4;

export interface EndInterviewRecommendations {
  weakAreasDetected: boolean;
  recommendedActions: string[];
  drill: null | {
    available: boolean;
    tool: "start_drill";
    args: {
      topic: string;
      sessionId: string;
    };
    weakQuestionCount: number;
    reason: string;
  };
  deepExplanation: null | {
    available: boolean;
    mode: "deep_explanation";
    reason: string;
    focusAreas: Array<{
      question: string;
      score: number;
      gap: string;
      strongAnswer?: string;
    }>;
    mistakePatterns: Array<{
      mistake: string;
      pattern: string;
      fix: string;
    }>;
    prompt: string;
  };
}

function summarizeGap(feedback: string): string {
  const normalized = feedback.replace(/\s+/g, " ").trim();
  if (!normalized) return "Needs a deeper explanation of the underlying model and tradeoffs.";
  return normalized.length <= 180 ? normalized : `${normalized.slice(0, 177)}...`;
}

function dedupeWeakEvaluations(session: Session): Evaluation[] {
  const weakByIndex = new Map<number, Evaluation>();
  for (const evaluation of session.evaluations) {
    if (evaluation.score >= RECOMMENDATION_SCORE_THRESHOLD) continue;
    const existing = weakByIndex.get(evaluation.questionIndex);
    if (!existing || evaluation.score < existing.score) {
      weakByIndex.set(evaluation.questionIndex, evaluation);
    }
  }
  return Array.from(weakByIndex.values()).sort((a, b) => a.score - b.score);
}

export function buildEndInterviewRecommendations(
  session: Session,
  mistakes: Mistake[],
): EndInterviewRecommendations {
  const weakEvaluations = dedupeWeakEvaluations(session);
  const focusAreas = weakEvaluations.slice(0, 3).map((evaluation) => ({
    question: evaluation.question,
    score: evaluation.score,
    gap: summarizeGap(evaluation.feedback),
    strongAnswer: evaluation.strongAnswer,
  }));
  const mistakePatterns = mistakes.slice(0, 3).map((mistake) => ({
    mistake: mistake.mistake,
    pattern: mistake.pattern,
    fix: mistake.fix,
  }));

  const recommendedActions: string[] = [];
  if (weakEvaluations.length > 0) recommendedActions.push("start_drill");
  if (focusAreas.length > 0 || mistakePatterns.length > 0) recommendedActions.push("deep_explanation");

  const deepExplanationPromptParts = [
    `Explain ${session.topic} in depth for interview preparation.`,
    "For each weak area, cover the mental model, why it matters, tradeoffs, common mistakes, and when to use it.",
  ];

  if (focusAreas.length > 0) {
    deepExplanationPromptParts.push(
      `Weak areas:\n${focusAreas.map((item, index) =>
        `${index + 1}. Question: ${item.question}\n   Gap: ${item.gap}${
          item.strongAnswer ? `\n   Strong answer: ${item.strongAnswer}` : ""
        }`
      ).join("\n")}`
    );
  }

  if (mistakePatterns.length > 0) {
    deepExplanationPromptParts.push(
      `Known mistake patterns:\n${mistakePatterns.map((item, index) =>
        `${index + 1}. Mistake: ${item.mistake}\n   Pattern: ${item.pattern}\n   Fix: ${item.fix}`
      ).join("\n")}`
    );
  }

  return {
    weakAreasDetected: weakEvaluations.length > 0 || mistakePatterns.length > 0,
    recommendedActions,
    drill: weakEvaluations.length > 0
      ? {
          available: true,
          tool: "start_drill",
          args: {
            topic: session.topic,
            sessionId: session.id,
          },
          weakQuestionCount: weakEvaluations.length,
          reason:
            weakEvaluations.length === 1
              ? "One weak answer was detected. A drill can revisit it immediately."
              : `${weakEvaluations.length} weak answers were detected. A drill can target them directly.`,
        }
      : null,
    deepExplanation: focusAreas.length > 0 || mistakePatterns.length > 0
      ? {
          available: true,
          mode: "deep_explanation",
          reason:
            "The candidate showed gaps that would benefit from a teaching pass focused on mental models, tradeoffs, and when to use the subject correctly.",
          focusAreas,
          mistakePatterns,
          prompt: deepExplanationPromptParts.join("\n\n"),
        }
      : null,
  };
}
