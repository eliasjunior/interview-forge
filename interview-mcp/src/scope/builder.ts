// ─────────────────────────────────────────────────────────────────────────────
// scope/builder.ts
//
// Pure functions that build reusable scoped-interview content blocks.
// No I/O. No side effects.
// ─────────────────────────────────────────────────────────────────────────────

const DEPTH_DESCRIPTION: Record<string, string> = {
  conceptual: "Verbal explanation only — no code required. Candidate should explain the mental model.",
  implementation: "Candidate writes pseudocode or real code. Correctness and structure matter.",
  "trace-through-code": "Candidate traces through a provided snippet step by step. Focus on execution order and state.",
  mixed: "Mix of verbal explanation and code tracing. Adapt depth per question.",
};

function buildCriterion(area: string): string {
  return `**${area}**: Candidate must explain this clearly and give a concrete example. ` +
    "Probe if the answer is vague or generic.";
}

export function buildScopeContent(opts: {
  topic: string;
  focusAreas: string[];
  weakSpots: string[];
  depth: string;
  outOfScope: string[];
  sessionGoal: string;
}): string {
  const lines: string[] = [];

  lines.push(`# Study Scope: ${opts.topic}`, "");

  lines.push("## Focus Areas");
  for (const area of opts.focusAreas) {
    lines.push(`- ${area}`);
  }
  lines.push("");

  lines.push(`## Depth: ${opts.depth}`);
  lines.push(DEPTH_DESCRIPTION[opts.depth] ?? DEPTH_DESCRIPTION.mixed);
  lines.push("");

  lines.push("## Evaluation Criteria");
  for (const area of opts.focusAreas) {
    lines.push(`- ${buildCriterion(area)}`);
  }
  lines.push("");

  if (opts.weakSpots.length > 0) {
    lines.push("## Known Weak Spots (probe these specifically)");
    for (const spot of opts.weakSpots) {
      lines.push(`- ${spot}`);
    }
    lines.push("");
  }

  if (opts.outOfScope.length > 0) {
    lines.push("## Out of Scope");
    for (const item of opts.outOfScope) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  lines.push("## Session Goal");
  lines.push(opts.sessionGoal);
  lines.push("");

  return lines.join("\n");
}

export function deriveSessionGoal(_topic: string, focusAreas: string[], depth: string): string {
  const areaList = focusAreas.slice(0, 3).join(", ");
  const extra = focusAreas.length > 3 ? `, and ${focusAreas.length - 3} more` : "";
  return (
    `Candidate can explain ${areaList}${extra} without prompting. ` +
    `Depth: ${depth}. No drifting into unrelated areas.`
  );
}
