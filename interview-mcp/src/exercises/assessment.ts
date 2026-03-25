// ─────────────────────────────────────────────────────────────────────────────
// exercises/assessment.ts
//
// Pure function that checks whether an exercise is appropriate for the candidate
// and builds a progression roadmap when it is not. No I/O. No side effects.
// ─────────────────────────────────────────────────────────────────────────────

import type { Exercise, ExercisePrerequisite } from "@mock-interview/shared";

export interface ComplexityAssessment {
  tooHard:            boolean;
  reason:             string | null;
  unmetPrerequisites: string[];
  roadmap:            Array<{ order: number; name: string; difficulty: number; reason: string }>;
}

/**
 * Determine whether an exercise is too hard for the candidate right now.
 *
 * Rules:
 *  - `tooHard = true` when difficulty ≥ 4 OR any named prerequisite does not
 *    yet exist in `existingExercises`.
 *  - `roadmap` is the ordered list of prerequisites by difficulty, so the LLM
 *    can propose a clear progression.
 */
export function assessComplexity(
  difficulty: number,
  prerequisites: ExercisePrerequisite[],
  existingExercises: Exercise[],
): ComplexityAssessment {
  const existingNames    = new Set(existingExercises.map((e) => e.name));
  const unmetPrerequisites = prerequisites
    .map((p) => p.name)
    .filter((name) => !existingNames.has(name));

  const resolvedPrereqs = prerequisites
    .map((p) => {
      const found = existingExercises.find((e) => e.name === p.name);
      return { name: p.name, difficulty: found?.difficulty ?? 0, reason: p.reason };
    })
    .sort((a, b) => a.difficulty - b.difficulty);

  const roadmap = resolvedPrereqs.map((p, i) => ({
    order:      i + 1,
    name:       p.name,
    difficulty: p.difficulty,
    reason:     p.reason,
  }));

  const tooHard = difficulty >= 4 || unmetPrerequisites.length > 0;
  const reason  = tooHard
    ? unmetPrerequisites.length > 0
      ? `Prerequisites not yet created: ${unmetPrerequisites.join(", ")}`
      : `Difficulty ${difficulty}/5 — recommend completing prerequisites first`
    : null;

  return { tooHard, reason, unmetPrerequisites, roadmap };
}
