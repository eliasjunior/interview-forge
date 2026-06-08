// ─────────────────────────────────────────────────────────────────────────────
// content/analyzer.ts
//
// Pure-ish functions that classify content, detect missing topics, and
// discover candidate scope files. File discovery touches disk but is kept
// outside tool wiring so it can be tested independently.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "fs";
import path from "path";

export const GAP_CHECKS: Array<{ label: string; keywords: RegExp }> = [
  { label: "Authentication / authorisation",      keywords: /\b(auth|jwt|oauth|api.?key|bearer|token|security)\b/i },
  { label: "Input validation & error responses",  keywords: /\b(valid|constraint|400|422|error response|bad request)\b/i },
  { label: "HTTP status codes & error schema",    keywords: /\b(status code|4\d\d|5\d\d|error body|error schema)\b/i },
  { label: "Rate limiting / throttling",          keywords: /\b(rate.?limit|throttl|quota)\b/i },
  { label: "Logging & observability",             keywords: /\b(log|metric|trace|observ|monitor|alert)\b/i },
  { label: "Data persistence across restarts",    keywords: /\b(database|db|persist|disk|file|sql|nosql|storage)\b/i },
  { label: "Concurrency & thread safety",         keywords: /\b(thread|concurr|lock|sync|atomic|race)\b/i },
  { label: "Pagination for list endpoints",       keywords: /\b(page|paginate|limit|offset|cursor)\b/i },
  { label: "Versioning strategy (e.g. /v1/)",     keywords: /\/v\d+\/|api.?version/i },
  { label: "Caching strategy",                    keywords: /\b(cache|etag|cache-control|ttl)\b/i },
  { label: "Testing strategy",                    keywords: /\b(unit test|integration test|test coverage|tdd)\b/i },
];

const PREVIEW_LINES = 4;
const SUPPORTED_EXTS = [".md", ".txt", ".yaml", ".yml", ".json"];

export interface ScopeCandidate {
  contentPath: string;
  filename: string;
  preview: string;
  score: number;
}

/** Return labels for topics that are absent from the spec. */
export function detectGaps(content: string): string[] {
  return GAP_CHECKS
    .filter((g) => !g.keywords.test(content))
    .map((g) => g.label);
}

/**
 * Classify pasted content when the caller did not choose an interview type.
 * Strong coding-problem shapes should not need authored markdown headings.
 */
export function detectContentType(content: string): "algorithm" | "api" {
  const strongAlgorithmSignals = [
    /\bgiven an? (array|string|matrix|linked list|binary tree|graph|integer|number|sequence)\b/i,
    /\breturn (the )?(indices?|index|length|count|number|array|list|boolean|true|false)\b/i,
    /\b(write|implement|design) (a |an )?(function|method|algorithm|solution|program|code)\b/i,
    /\binput\s*:/i,
    /\boutput\s*:/i,
    /\byou may assume\b/i,
    /\bexactly one solution\b/i,
  ];
  if (strongAlgorithmSignals.filter((re) => re.test(content)).length >= 2) {
    return "algorithm";
  }

  const authoredAlgorithmSignals = [
    /##\s+Problem Statement/i,
    /##\s+Constraints/i,
    /##\s+Expected approach/i,
    /##\s+Common mistakes/i,
    /\bTime:\s*O\(/i,
    /\bSpace:\s*O\(/i,
    /\bO\([^)]+\)/,
    /\bpattern:/i,
    /\binvariant:/i,
    /\bedge cases?\b/i,
  ];
  const hits = authoredAlgorithmSignals.filter((re) => re.test(content)).length;
  return hits >= 2 ? "algorithm" : "api";
}

export function discoverScopeFiles(topic: string, scopeDir: string): ScopeCandidate[] {
  if (!fs.existsSync(scopeDir)) return [];

  const topicWords = topic
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1);

  const files = fs.readdirSync(scopeDir)
    .filter((filename) => SUPPORTED_EXTS.some((ext) => filename.endsWith(ext)));

  const candidates: ScopeCandidate[] = files.map((filename) => {
    const normalised = filename.toLowerCase().replace(/[-_.]/g, " ");
    const matched = topicWords.filter((word) => normalised.includes(word));
    const score = topicWords.length > 0 ? matched.length / topicWords.length : 0;

    const fullPath = path.join(scopeDir, filename);
    const raw = fs.readFileSync(fullPath, "utf-8");
    const preview = raw
      .split("\n")
      .map((line) => line.trimEnd())
      .filter((line) => line.length > 0)
      .slice(0, PREVIEW_LINES)
      .join("\n");

    return {
      contentPath: `${path.basename(scopeDir)}/${filename}`,
      filename,
      preview,
      score,
    };
  });

  const matched = candidates
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score);

  return matched.length > 0 ? matched : candidates;
}
