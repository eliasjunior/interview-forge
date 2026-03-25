// ─────────────────────────────────────────────────────────────────────────────
// drills/contentBuilder.ts
//
// Pure functions that build the rubric context and recall prompt for a drill
// session from past evaluation data. No I/O. No side effects.
// ─────────────────────────────────────────────────────────────────────────────

import type { Evaluation, Mistake } from "@mock-interview/shared";

export interface RecallContext {
  knownMistakes: Array<{ mistake: string; pattern: string; fix: string }>;
  weakAreas:     Array<{ question: string; previousScore: number; previousFeedback: string }>;
}

/**
 * Build the `customContent` string stored on the drill session.
 * This serves as the rubric context for `evaluate_answer`.
 */
export function buildDrillCustomContent(
  topic:       string,
  sourceId:    string,
  sourceDate:  string,
  avgScore:    string,
  weakEvals:   Evaluation[],
  mistakes:    Mistake[],
): string {
  const lines: string[] = [
    `# Drill Session — ${topic}`,
    "",
    `**Source session:** ${sourceId} (${sourceDate.slice(0, 10)})`,
    `**Avg score in source session:** ${avgScore}`,
    "",
    "## Weak Questions (score < 4)",
    "",
  ];

  weakEvals.forEach((e, i) => {
    lines.push(`### Question ${i + 1} — score ${e.score}/5`, "");
    lines.push(`**Question:** ${e.question}`, "");
    lines.push(`**Previous feedback:** ${e.feedback}`);
    if (e.strongAnswer) {
      lines.push("", `**Strong answer looks like:** ${e.strongAnswer}`);
    }
    lines.push("");
  });

  if (mistakes.length > 0) {
    lines.push("## Known Mistake Patterns", "");
    mistakes.forEach((m) => {
      lines.push(`- **${m.mistake}**`);
      lines.push(`  - Pattern: ${m.pattern}`);
      lines.push(`  - Fix: ${m.fix}`);
    });
  }

  return lines.join("\n");
}

/**
 * Build the `recallContext` object surfaced to the orchestrator so it can run
 * the recall step before asking the first drill question.
 */
export function buildRecallContext(weakEvals: Evaluation[], mistakes: Mistake[]): RecallContext {
  return {
    knownMistakes: mistakes.map((m) => ({
      mistake: m.mistake,
      pattern: m.pattern,
      fix:     m.fix,
    })),
    weakAreas: weakEvals.map((e) => ({
      question:         e.question,
      previousScore:    e.score,
      previousFeedback: e.feedback,
    })),
  };
}
