// ─────────────────────────────────────────────────────────────────────────────
// exercises/markdown.ts
//
// Pure function that renders an Exercise record as structured markdown.
// No I/O. No side effects.
// ─────────────────────────────────────────────────────────────────────────────

import type { Exercise } from "@mock-interview/shared";

export const DIFFICULTY_LABELS: Record<number, string> = {
  1: "Trivial",
  2: "Easy",
  3: "Medium",
  4: "Hard",
  5: "Very Hard",
};

export interface ExerciseMarkdownOpts {
  learningGoal:       string;
  problemStatement:   string;
  steps:              string[];
  evaluationCriteria: string[];
  hints:              string[];
  relatedConcepts:    string[];
}

export function buildExerciseMarkdown(exercise: Exercise, opts: ExerciseMarkdownOpts): string {
  const diffLabel     = DIFFICULTY_LABELS[exercise.difficulty] ?? "Medium";
  const tagSection    = exercise.tags.length > 0 ? exercise.tags.join(", ") : "_None_";
  const prereqSection = exercise.prerequisites.length > 0
    ? exercise.prerequisites.map((p) => `- **${p.name}** — ${p.reason}`).join("\n")
    : "_None — this is a self-contained exercise._";

  const stepsSection   = opts.steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
  const evalSection    = opts.evaluationCriteria.map((c) => `- ${c}`).join("\n");
  const hintsSection   = opts.hints.length > 0
    ? opts.hints.map((h) => `- ${h}`).join("\n")
    : "_No hints — try to work through it first._";
  const conceptsSection = opts.relatedConcepts.map((c) => `- ${c}`).join("\n");
  const meaningSection  = exercise.problemMeaning.map((m) => `- ${m}`).join("\n");

  return `# Exercise: ${exercise.name}

## Topic / Language / Difficulty
**Topic:** ${exercise.topic}
**Language:** ${exercise.language}
**Difficulty:** ${exercise.difficulty}/5 — ${diffLabel}
**Tags:** ${tagSection}

## Real-World Context
**Scenario:** ${exercise.scenario}

### Why this matters in production
${meaningSection}

## Learning Goal
${opts.learningGoal}

## Prerequisites
${prereqSection}

## Problem Statement
${opts.problemStatement}

## Implementation Steps
${stepsSection}

## What a Good Solution Looks Like
${evalSection}

## Hints
${hintsSection}

## Related Concepts
${conceptsSection}
`;
}
