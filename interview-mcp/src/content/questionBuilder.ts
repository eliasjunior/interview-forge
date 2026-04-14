// ─────────────────────────────────────────────────────────────────────────────
// content/questionBuilder.ts
//
// Pure functions that generate interview questions and structured markdown
// from extracted spec signals. No I/O. No side effects.
// ─────────────────────────────────────────────────────────────────────────────

import { detectGaps } from "./analyzer.js";
import { extractSpec } from "./parser.js";
import type { ExtractedSpec } from "./parser.js";

/** Default seven-step algorithm flow, but sessions may finish earlier once the candidate submits final code plus complexity analysis. */
export function buildAlgorithmQuestions(topic: string, _content: string, _focus: string): string[] {
  return [
    `Looking at ${topic}, what algorithmic pattern or technique would you apply here, and why? ` +
    `Walk me through how you recognised the pattern from the problem constraints.`,

    `Describe your step-by-step approach to solving ${topic}. ` +
    `Focus on: how you set up the initial state, what invariant you maintain through each iteration, ` +
    `and how you know when to stop.`,

    `Analyse the time and space complexity of your solution to ${topic}. ` +
    `Justify each bound — don't just state it. ` +
    `Is there a more space-efficient version, even at a cost to time?`,

    `What edge cases does ${topic} need to handle? ` +
    `For each one: what goes wrong in a naive implementation, and how does your solution address it?`,

    `What are the most common off-by-one errors or logical mistakes candidates make when implementing ${topic}? ` +
    `Walk through a specific mistake and show how you would catch it.`,

    `How would you design test cases for ${topic}? ` +
    `Give at least one minimal example, one edge case, and one large-input scenario.`,

    `Now implement ${topic}. ` +
    `Write working code or precise pseudocode, narrate the key decisions as you go, ` +
    `and use the test cases you just designed to sanity-check the implementation before you finish.`,
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
