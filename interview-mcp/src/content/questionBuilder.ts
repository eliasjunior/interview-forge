// ─────────────────────────────────────────────────────────────────────────────
// content/questionBuilder.ts
//
// Pure functions that generate interview questions and structured markdown
// from extracted spec signals. No I/O. No side effects.
// ─────────────────────────────────────────────────────────────────────────────

import { detectGaps } from "./analyzer.js";
import { extractSpec } from "./parser.js";
import type { ExtractedSpec } from "./parser.js";

function pushUnique(target: string[], value: string) {
  if (!target.includes(value)) target.push(value);
}

export function buildAlgorithmFollowUpCandidates(topic: string, content: string): string[] {
  const text = `${topic}\n${content}`.toLowerCase();
  const candidates: string[] = [];

  if (/\bmatrix\b|\bgrid\b|\b2d\b/.test(text)) {
    pushUnique(candidates, `Can you make ${topic} work in place, and what changes in the index manipulation?`);
    pushUnique(candidates, `How would your solution change if the input were not square or had a slightly different traversal constraint?`);
  }

  if (/\blinked list\b|\blistnode\b|\bnode\b/.test(text)) {
    pushUnique(candidates, `Can you solve ${topic} in one pass with O(1) extra space, and what invariant would you rely on?`);
    pushUnique(candidates, `What pointer-update mistake is most likely here, and how would you guard against it while coding?`);
  }

  if (/\bsorted\b|\bbinary search\b/.test(text)) {
    pushUnique(candidates, `Which property of the sorted input are you exploiting, and how would the solution change if that guarantee disappeared?`);
  }

  if (/\bsubstring\b|\bstring\b|\bpalindrome\b|\banagram\b/.test(text)) {
    pushUnique(candidates, `Can you reduce the extra space for ${topic}, and what trade-off would that introduce?`);
    pushUnique(candidates, `How would you adapt the solution if the input became streaming instead of fully available upfront?`);
  }

  if (/\binterval\b|\boverlap\b|\bmerge\b/.test(text)) {
    pushUnique(candidates, `What ordering assumption makes your interval logic correct, and how would you defend that in a proof sketch?`);
  }

  if (/\bgraph\b|\bdfs\b|\bbfs\b|\btraversal\b/.test(text)) {
    pushUnique(candidates, `When would you switch between DFS and BFS for ${topic}, and what trade-off changes?`);
  }

  if (/\bdp\b|\bdynamic programming\b|\bmemo\b/.test(text)) {
    pushUnique(candidates, `Can you compress the DP state further, and how would you justify that no required information is lost?`);
  }

  pushUnique(candidates, `What would you optimize or simplify next in ${topic}, and what trade-off would that change?`);
  pushUnique(candidates, `How would you convince another engineer that your solution to ${topic} is correct, not just plausible?`);

  return candidates.slice(0, 3);
}

/** Code-interview flow for algorithm sessions. Further follow-ups are decided dynamically after the solution is submitted. */
export function buildAlgorithmQuestions(topic: string, _content: string, _focus: string): string[] {
  return [
    `Looking at ${topic}, what algorithmic pattern or technique would you apply here, and why? ` +
    `Walk me through how you recognised the pattern from the problem constraints.`,

    `Before you code ${topic}, walk through your approach, the core invariant or reduction, ` +
    `the edge cases you care about most, and the tests you would use to sanity-check the implementation.`,

    `Now implement ${topic}. ` +
    `Write working code or precise pseudocode, narrate the key decisions as you go, ` +
    `and if you already know the time and space complexity, include them with the final solution.`,
  ];
}

export function polishContent(topic: string, raw: string, focus: string): string {
  const spec = extractSpec(raw);
  const gaps = detectGaps(raw);
  const lines: string[] = [];

  lines.push(`# ${topic} — Structured Spec`, "");
  lines.push(`**Interview focus:** ${focus}`, "");

  lines.push("## API Endpoints", "");
  if (spec.endpoints.length > 0) {
    lines.push("| Method | Path | Description |");
    lines.push("|--------|------|-------------|");
    for (const endpoint of spec.endpoints) {
      lines.push(`| \`${endpoint.method}\` | \`${endpoint.path}\` | ${endpoint.hint || "—"} |`);
    }
  } else {
    lines.push("*No explicit HTTP endpoints detected — see original spec below.*");
  }
  lines.push("");

  if (spec.models.length > 0) {
    lines.push("## Data Models", "");
    for (const model of spec.models) {
      lines.push(`### ${model.name}`, "");
      lines.push("| Field | Type |");
      lines.push("|-------|------|");
      for (const field of model.fields) {
        lines.push(`| \`${field.name}\` | ${field.type} |`);
      }
      lines.push("");
    }
  }

  lines.push("## Business Rules", "");
  if (spec.rules.length > 0) {
    spec.rules.forEach((rule, index) => lines.push(`${index + 1}. ${rule}`));
  } else {
    lines.push("*No explicit business rules detected — see original spec below.*");
  }
  lines.push("");

  if (spec.notes.length > 0) {
    lines.push("## Implementation Notes", "");
    for (const note of spec.notes) {
      lines.push(`- ${note}`);
    }
    lines.push("");
  }

  if (gaps.length > 0) {
    lines.push("## Detected Gaps (not addressed in the spec)", "");
    lines.push("These topics are absent from the specification. Use them as interview angles.", "");
    for (const gap of gaps) {
      lines.push(`- ${gap}`);
    }
    lines.push("");
  }

  lines.push("---", "");
  lines.push("## Original Spec", "");
  lines.push(raw.trim());

  return lines.join("\n");
}

/** Six structured questions grounded in API spec signals. */
export function buildQuestions(
  topic: string,
  spec: ExtractedSpec,
  gaps: string[],
  focus: string,
): string[] {
  const endpointList = spec.endpoints.length > 0
    ? spec.endpoints.map((e) => `\`${e.method} ${e.path}\``).join(", ")
    : `the ${topic} endpoints`;

  const fieldSample = spec.models.flatMap((m) => m.fields.map((f) => f.name)).slice(0, 4);
  const fieldList   = fieldSample.length > 0 ? fieldSample.join(", ") : "the request fields";

  const ruleSnippet = spec.rules.length > 0 ? `"${spec.rules[0]}"` : "the business rules in the spec";

  const topGaps = gaps.slice(0, 3).join(", ");

  return [
    `Looking at the ${topic} spec — ${endpointList} — what are the most critical missing pieces ` +
    `from a ${focus} perspective that you would address before going to production?` +
    (topGaps ? ` Consider in particular: ${topGaps}.` : ""),

    `The ${topic} API accepts fields like ${fieldList}. ` +
    `What input validation, sanitisation, and error response strategy would you put in place, ` +
    `and how would you communicate failures clearly to API consumers?`,

    `One business rule states ${ruleSnippet}. ` +
    `How would you implement and test this so that new rules can be added or existing ones changed ` +
    `without modifying the core calculation logic?`,

    `What logging, metrics, and alerting would you instrument in ${topic} ` +
    `so an on-call engineer can diagnose a spike in errors or latency within minutes, ` +
    `without access to the codebase?`,

    `Walk me through every failure mode of ${endpointList}. ` +
    `For each one: what is the impact on the caller, and how would you degrade gracefully ` +
    `instead of returning a 500?`,

    `${topic} currently stores its data in memory on startup. ` +
    `What would need to change — and in what order — if the service had to: ` +
    `(a) survive restarts without data loss, ` +
    `(b) run as multiple instances behind a load balancer, ` +
    `(c) allow live updates without a redeploy?`,
  ];
}

export const buildApiQuestions = buildQuestions;
