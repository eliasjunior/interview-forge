import type { Session } from "@mock-interview/shared";
import { detectContentType, detectGaps } from "../content/analyzer.js";
import { extractSpec } from "../content/parser.js";
import { buildAlgorithmQuestions, buildQuestions, polishContent } from "../content/questionBuilder.js";

const DEFAULT_FOCUS = "robustness, reliability, and extensibility in a production environment";

type ParsedPayload =
  | { contentType: "algorithm" }
  | {
      contentType: "api";
      endpoints: string[];
      models: string[];
      rules: string[];
      gaps: string[];
    };

export interface ScopedInterviewBuildInput {
  topic: string;
  problemTitle?: string;
  rawContent: string;
  generateId: () => string;
  focus?: string;
  resolvedPath?: string;
}

export interface ScopedInterviewBuildResult {
  session: Session;
  source: string;
  parsed: ParsedPayload;
  totalQuestions: number;
  previewQuestions: string[];
  normalizedContent: string;
  detectedContentType: "algorithm" | "api";
  focusArea: string;
}

function looksLikeApiSpec(rawContent: string): boolean {
  const spec = extractSpec(rawContent);
  // Require real HTTP endpoints OR both models and rules to avoid false positives
  // from algorithm problems where camelCase(arg) text accidentally matches the field extractor.
  return spec.endpoints.length > 0 || (spec.models.length > 0 && spec.rules.length > 0);
}

function inferScopedContentType(rawContent: string): "algorithm" | "api" {
  const detected = detectContentType(rawContent);
  if (detected === "algorithm") return detected;
  return looksLikeApiSpec(rawContent) ? "api" : "algorithm";
}

function buildAlgorithmScope(topic: string, problemTitle: string | undefined, rawContent: string, focus: string): string {
  const trimmed = rawContent.trim();
  if (/^#\s+Study Scope:/i.test(trimmed) || /##\s+Problem Statement/i.test(trimmed)) {
    return trimmed;
  }

  const problemLabel = problemTitle?.trim() || topic;

  return [
    `# Study Scope: ${problemLabel}`,
    "",
    "## Subject Area",
    topic,
    "",
    "## Focus Areas",
    "- recognizing the core problem pattern",
    "- maintaining the right invariant or reduction",
    "- handling boundary conditions and edge cases",
    "- explaining correctness clearly",
    "- justifying time and space complexity",
    "- implementing the final solution cleanly under interview conditions",
    "",
    "## Depth: mixed",
    "Verbal explanation first, then finish with pseudocode or code.",
    "",
    "## Evaluation Criteria",
    "- **pattern recognition**: identify the key reduction or invariant that makes the solution work",
    "- **correctness**: explain why the approach is valid, not just what to type",
    "- **constraint handling**: respect the problem's explicit constraints and assumptions",
    "- **edge cases**: call out invalid inputs, empty cases, and boundary conditions",
    "- **complexity**: justify time and space costs with clear reasoning",
    "- **implementation**: translate the chosen approach into correct, traceable code or pseudocode",
    "",
    "## Known Weak Spots (probe these specifically)",
    "- jumping straight to the trick without explaining why it works",
    "- missing length checks, empty inputs, or off-by-one style mistakes",
    "- stating complexity without tying it to the actual operations used",
    "",
    "## Out of Scope",
    "- advanced string-search internals unless directly needed",
    "- unrelated optimizations that do not change the core approach",
    "",
    "## Session Goal",
    `Candidate can solve ${problemLabel} with a clear explanation focused on ${focus}, then implement the solution correctly.`,
    "",
    "## Problem Statement",
    trimmed,
  ].join("\n");
}

export function createScopedInterviewSession({
  topic,
  problemTitle,
  rawContent,
  generateId,
  focus = DEFAULT_FOCUS,
  resolvedPath,
}: ScopedInterviewBuildInput): ScopedInterviewBuildResult {
  const contentType = inferScopedContentType(rawContent);
  const isAlgorithm = contentType === "algorithm";
  const trimmedProblemTitle = problemTitle?.trim() || undefined;
  const promptLabel = trimmedProblemTitle ?? topic;
  const normalizedContent = isAlgorithm
    ? buildAlgorithmScope(topic, trimmedProblemTitle, rawContent, focus)
    : rawContent;
  const spec = isAlgorithm ? { endpoints: [], models: [], rules: [], notes: [] } : extractSpec(normalizedContent);
  const gaps = isAlgorithm ? [] : detectGaps(normalizedContent);
  const polished = isAlgorithm ? normalizedContent : polishContent(topic, normalizedContent, focus);
  const questions = isAlgorithm
    ? buildAlgorithmQuestions(promptLabel, normalizedContent, focus)
    : buildQuestions(topic, spec, gaps, focus);

  const session: Session = {
    id: generateId(),
    topic,
    ...(trimmedProblemTitle && { problemTitle: trimmedProblemTitle }),
    interviewType: isAlgorithm ? "code" : "design",
    ...(isAlgorithm && { studyCategory: "algorithm" }),
    sessionKind: "interview",
    state: "ASK_QUESTION",
    currentQuestionIndex: 0,
    questions,
    messages: [],
    evaluations: [],
    customContent: polished,
    focusArea: focus,
    ...(resolvedPath && { sourcePath: resolvedPath }),
    createdAt: new Date().toISOString(),
    knowledgeSource: "file",
  };

  return {
    session,
    source: resolvedPath ?? "inline content",
    parsed: isAlgorithm
      ? { contentType: "algorithm" }
      : {
          contentType: "api",
          endpoints: spec.endpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`),
          models: spec.models.map((model) => `${model.name} (${model.fields.length} fields)`),
          rules: spec.rules,
          gaps,
        },
    totalQuestions: questions.length,
    previewQuestions: questions.slice(0, 2),
    normalizedContent,
    detectedContentType: contentType,
    focusArea: focus,
  };
}

export { DEFAULT_FOCUS };
