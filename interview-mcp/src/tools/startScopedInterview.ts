import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Session } from "@mock-interview/shared";
import type { ToolDeps } from "./deps.js";

// ─────────────────────────────────────────────────────────────────────────────
// start_scoped_interview
//
// Starts an interview grounded in specific content — a project spec, README,
// or architecture doc supplied either as raw text or a file path.
//
// All logic (file reading, content analysis, question generation) lives here.
// No AI provider calls are made. The content is:
//   1. Read from a file if contentPath is given, otherwise used as-is
//   2. Polished into a structured markdown document the LLM can reason against
//   3. Stored on the session as customContent (rubric context for evaluate_answer)
//
// ─────────────────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = path.resolve(__dirname, "../../data");

const DEFAULT_FOCUS = "robustness, reliability, and extensibility in a production environment";

// ─────────────────────────────────────────────────────────────────────────────
// Content extraction — parse raw text for structured signals
// ─────────────────────────────────────────────────────────────────────────────

interface Endpoint {
  method: string;
  path:   string;
  hint:   string; // parenthetical description if present
}

interface DataModel {
  name:   string;
  fields: Array<{ name: string; type: string }>;
}

interface ExtractedSpec {
  endpoints:  Endpoint[];
  models:     DataModel[];
  rules:      string[];
  notes:      string[];
}

/** Extract HTTP endpoints with optional inline descriptions. */
function extractEndpoints(content: string): Endpoint[] {
  const re = /\b(GET|POST|PUT|PATCH|DELETE)\s+(\/[\w/{}:.-]+)(?:\s*\(([^)]*)\))?/gi;
  const seen = new Set<string>();
  const results: Endpoint[] = [];
  for (const m of content.matchAll(re)) {
    const key = `${m[1].toUpperCase()} ${m[2]}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({ method: m[1].toUpperCase(), path: m[2], hint: m[3]?.trim() ?? "" });
    }
  }
  return results;
}

/**
 * Extract named data models by scanning for "contains [at least] the fields" anchors,
 * then collecting every "fieldName (Type)" pattern in the following lines until we hit
 * another model anchor, a blank line followed by a capital letter, or a section header.
 * Falls back to a single flat model when no named groups are found.
 */
function extractModels(content: string): DataModel[] {
  // Normalise line endings
  const lines = content.replace(/\r\n/g, "\n").split("\n");

  // Detect any line that introduces a model — "contains [at least] the fields"
  // Works regardless of how many words appear before or after the entity keyword.
  const anchorRe  = /\bcontains\s+(?:at\s+least\s+)?the\s+fields\b/i;
  const stopRe    = /^(business rules|#|\* (get|post|put|patch|delete)\b)/i;
  const fieldRe   = /\b([a-z][a-zA-Z]+)\s*\(([^)]+)\)/g;

  /** Extract a human-readable model name from the part of the line before "contains". */
  function modelNameFrom(line: string): string {
    const before = line.split(/\bcontains\b/i)[0] ?? line;
    return before
      .replace(/^\s*(?:the|a|an)\s+/i, "") // drop leading article
      .trim()
      .replace(/\s+/g, " ") || "Data Model";
  }

  const models: DataModel[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (!anchorRe.test(lines[i])) continue;

    const name = capitalise(modelNameFrom(lines[i]));
    const fields: Array<{ name: string; type: string }> = [];

    // Collect from the anchor line itself and subsequent lines
    for (let j = i; j < Math.min(i + 10, lines.length); j++) {
      const line = lines[j];

      // Stop at section boundaries or the start of the next model anchor (but not the current line)
      if (j > i && (stopRe.test(line.trim()) || anchorRe.test(line))) break;
      // Stop at a blank line once we already have at least one field — avoids crossing into
      // a separate section (e.g. response body after the request fields)
      if (j > i && line.trim() === "" && fields.length > 0) break;

      for (const f of line.matchAll(fieldRe)) {
        if (!fields.find((x) => x.name === f[1])) {
          fields.push({ name: f[1], type: f[2].trim() });
        }
      }
    }

    if (fields.length > 0) {
      models.push({ name: capitalise(name), fields });
    }
  }

  // Fallback: collect all typed fields into one flat model
  if (models.length === 0) {
    const fields: Array<{ name: string; type: string }> = [];
    for (const m of content.matchAll(/\b([a-z][a-zA-Z]+)\s*\(([^)]+)\)/g)) {
      if (!fields.find((f) => f.name === m[1])) {
        fields.push({ name: m[1], type: m[2].trim() });
      }
    }
    if (fields.length > 0) models.push({ name: "Data Fields", fields });
  }

  return models;
}

/**
 * Pull explicit business-rule sentences: constraint language present AND
 * the line is not just a structural description (e.g. "contains at least the fields").
 */
function extractRules(content: string): string[] {
  // Patterns that signal a structural description, not a business rule
  const structuralRe = /\b(contains|created|contains the fields|contain at least|is calculated|is returned)\b/i;

  return content
    .split(/\n/)
    .map((l) => l.replace(/^[-*•\d.]\s*/, "").trim())
    .filter((l) =>
      l.length > 10 &&
      /\b(should not|must not|cannot|must be|should be|not exceed|no more than|limited to|only if|requires|is forbidden|is required|is mandatory)\b/i.test(l) &&
      !structuralRe.test(l)
    )
    .slice(0, 8);
}

/** Pull implementation notes — things like "in memory on startup", "framework choice". */
function extractNotes(content: string): string[] {
  return content
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) =>
      l.length > 10 &&
      /\b(in memory|on startup|on application startup|framework|library|in-memory|cache|no database|no persistence)\b/i.test(l)
    )
    .slice(0, 5);
}

// ─────────────────────────────────────────────────────────────────────────────
// Gap detection — things the spec does NOT mention
// ─────────────────────────────────────────────────────────────────────────────

const GAP_CHECKS: Array<{ label: string; keywords: RegExp }> = [
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

function detectGaps(content: string): string[] {
  return GAP_CHECKS
    .filter((g) => !g.keywords.test(content))
    .map((g) => g.label);
}

// ─────────────────────────────────────────────────────────────────────────────
// Content type detection
// ─────────────────────────────────────────────────────────────────────────────

function detectContentType(content: string): 'algorithm' | 'api' {
  const algorithmSignals = [
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
  const hits = algorithmSignals.filter((re) => re.test(content)).length;
  return hits >= 2 ? 'algorithm' : 'api';
}

function buildAlgorithmQuestions(topic: string, content: string, focus: string): string[] {
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
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Content polisher — transform raw spec → structured markdown for the LLM
// ─────────────────────────────────────────────────────────────────────────────

function polishContent(topic: string, raw: string, focus: string): string {
  const spec  = extractSpec(raw);
  const gaps  = detectGaps(raw);
  const lines: string[] = [];

  lines.push(`# ${topic} — Structured Spec`);
  lines.push("");
  lines.push(`**Interview focus:** ${focus}`);
  lines.push("");

  // ── Endpoints ──────────────────────────────────────────────────────────────
  lines.push("## API Endpoints");
  lines.push("");
  if (spec.endpoints.length > 0) {
    lines.push("| Method | Path | Description |");
    lines.push("|--------|------|-------------|");
    for (const e of spec.endpoints) {
      lines.push(`| \`${e.method}\` | \`${e.path}\` | ${e.hint || "—"} |`);
    }
  } else {
    lines.push("*No explicit HTTP endpoints detected — see original spec below.*");
  }
  lines.push("");

  // ── Data models ────────────────────────────────────────────────────────────
  if (spec.models.length > 0) {
    lines.push("## Data Models");
    lines.push("");
    for (const model of spec.models) {
      lines.push(`### ${model.name}`);
      lines.push("");
      lines.push("| Field | Type |");
      lines.push("|-------|------|");
      for (const f of model.fields) {
        lines.push(`| \`${f.name}\` | ${f.type} |`);
      }
      lines.push("");
    }
  }

  // ── Business rules ─────────────────────────────────────────────────────────
  lines.push("## Business Rules");
  lines.push("");
  if (spec.rules.length > 0) {
    spec.rules.forEach((r, i) => lines.push(`${i + 1}. ${r}`));
  } else {
    lines.push("*No explicit business rules detected — see original spec below.*");
  }
  lines.push("");

  // ── Implementation notes ───────────────────────────────────────────────────
  if (spec.notes.length > 0) {
    lines.push("## Implementation Notes");
    lines.push("");
    for (const n of spec.notes) {
      lines.push(`- ${n}`);
    }
    lines.push("");
  }

  // ── Detected gaps ──────────────────────────────────────────────────────────
  if (gaps.length > 0) {
    lines.push("## Detected Gaps (not addressed in the spec)");
    lines.push("");
    lines.push("These topics are absent from the specification. Use them as interview angles.");
    lines.push("");
    for (const g of gaps) {
      lines.push(`- ${g}`);
    }
    lines.push("");
  }

  // ── Original spec ──────────────────────────────────────────────────────────
  lines.push("---");
  lines.push("");
  lines.push("## Original Spec");
  lines.push("");
  lines.push(raw.trim());

  return lines.join("\n");
}

function extractSpec(raw: string): ExtractedSpec {
  return {
    endpoints: extractEndpoints(raw),
    models:    extractModels(raw),
    rules:     extractRules(raw),
    notes:     extractNotes(raw),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Question generation — grounded in the polished spec signals
// ─────────────────────────────────────────────────────────────────────────────

function buildQuestions(
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
    // 1. Gap scan — biggest missing pieces for the focus angle
    `Looking at the ${topic} spec — ${endpointList} — what are the most critical missing pieces ` +
    `from a ${focus} perspective that you would address before going to production?` +
    (topGaps ? ` Consider in particular: ${topGaps}.` : ""),

    // 2. Input validation
    `The ${topic} API accepts fields like ${fieldList}. ` +
    `What input validation, sanitisation, and error response strategy would you put in place, ` +
    `and how would you communicate failures clearly to API consumers?`,

    // 3. Business rule extensibility
    `One business rule states ${ruleSnippet}. ` +
    `How would you implement and test this so that new rules can be added or existing ones changed ` +
    `without modifying the core calculation logic?`,

    // 4. Observability
    `What logging, metrics, and alerting would you instrument in ${topic} ` +
    `so an on-call engineer can diagnose a spike in errors or latency within minutes, ` +
    `without access to the codebase?`,

    // 5. Failure modes
    `Walk me through every failure mode of ${endpointList}. ` +
    `For each one: what is the impact on the caller, and how would you degrade gracefully ` +
    `instead of returning a 500?`,

    // 6. Architecture evolution
    `${topic} currently stores its data in memory on startup. ` +
    `What would need to change — and in what order — if the service had to: ` +
    `(a) survive restarts without data loss, ` +
    `(b) run as multiple instances behind a load balancer, ` +
    `(c) allow live updates without a redeploy?`,
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// File discovery — search add-scope/ for files matching a topic string
// ─────────────────────────────────────────────────────────────────────────────

const SCOPE_DIR      = path.join(DATA_DIR, "add-scope");
const PREVIEW_LINES  = 4;
const SUPPORTED_EXTS = [".md", ".txt", ".yaml", ".yml", ".json"];

interface ScopeCandidate {
  /** Relative path usable as contentPath, e.g. "add-scope/rest-api.md" */
  contentPath: string;
  filename: string;
  /** First few lines of the file — enough to recognise it */
  preview: string;
  /** 0–1 relevance score based on word overlap between topic and filename */
  score: number;
}

/**
 * Find files in add-scope/ whose names overlap with the topic words.
 * Returns candidates sorted by relevance score (highest first).
 * Returns ALL files when no words match, so the user can pick manually.
 */
function discoverScopeFiles(topic: string): ScopeCandidate[] {
  if (!fs.existsSync(SCOPE_DIR)) return [];

  const topicWords = topic
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);

  const files = fs.readdirSync(SCOPE_DIR)
    .filter((f) => SUPPORTED_EXTS.some((ext) => f.endsWith(ext)));

  const candidates: ScopeCandidate[] = files.map((filename) => {
    const normalised = filename.toLowerCase().replace(/[-_.]/g, " ");
    const matched    = topicWords.filter((w) => normalised.includes(w));
    const score      = topicWords.length > 0 ? matched.length / topicWords.length : 0;

    const fullPath   = path.join(SCOPE_DIR, filename);
    const raw        = fs.readFileSync(fullPath, "utf-8");
    const preview    = raw
      .split("\n")
      .map((l) => l.trimEnd())
      .filter((l) => l.length > 0)
      .slice(0, PREVIEW_LINES)
      .join("\n");

    return {
      contentPath: `add-scope/${filename}`,
      filename,
      preview,
      score,
    };
  });

  const matched = candidates
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);

  // Fall back to all files when nothing matched, so the user can still pick
  return matched.length > 0 ? matched : candidates;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool registration
// ─────────────────────────────────────────────────────────────────────────────

export function registerStartScopedInterviewTool(server: McpServer, deps: ToolDeps) {
  server.tool(
    "start_scoped_interview",
    "Start a mock interview grounded in specific content — a project spec, architecture doc, or any text. " +
    "If neither contentPath nor content is provided, the tool searches data/add-scope/ for files " +
    "matching the topic name and returns candidates for the user to confirm before starting. " +
    "Once confirmed, call again with the chosen contentPath. " +
    "Content is parsed and polished into a structured spec, then stored on the session as rubric context. " +
    "No AI provider calls are made.",
    {
      topic: z.string()
        .describe("Short label for the session, e.g. 'Mortgage API', 'Payments Service'"),
      contentPath: z.string().optional()
        .describe(
          "Path to the spec file, relative to interview-mcp/data/. " +
          "Example: 'add-scope/rest-api.md'. Mutually exclusive with content."
        ),
      content: z.string().min(20).optional()
        .describe(
          "Raw spec text. Use this when you want to paste content directly. " +
          "Mutually exclusive with contentPath."
        ),
      focus: z.string().optional()
        .describe(
          `The interview angle. Default: "${DEFAULT_FOCUS}". ` +
          `Examples: "security and input validation", "scalability and caching strategies", ` +
          `"API design and backward compatibility".`
        ),
    },
    async ({ topic, contentPath, content, focus = DEFAULT_FOCUS }) => {
      // ── 1. Resolve content source ──────────────────────────────────────────
      if (contentPath && content) {
        return deps.stateError("Provide contentPath OR content, not both.");
      }

      // Discovery mode — search add-scope/ for files matching the topic name
      if (!contentPath && !content) {
        const candidates = discoverScopeFiles(topic);

        if (candidates.length === 0) {
          return deps.stateError(
            `No files found in data/add-scope/. ` +
            `Add a spec file there or pass raw content via the "content" parameter.`
          );
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              action: "confirm_file",
              topic,
              message:
                candidates.length === 1
                  ? `Found 1 matching file. Please confirm this is the right spec before starting the interview.`
                  : `Found ${candidates.length} candidate file(s). Please confirm which spec to use.`,
              candidates: candidates.map((c) => ({
                contentPath: c.contentPath,
                filename:    c.filename,
                preview:     c.preview,
              })),
              instruction:
                "Show the candidate(s) to the user with the filename and preview text. " +
                "Once the user confirms, call start_scoped_interview again with the chosen contentPath.",
            }, null, 2),
          }],
        };
      }

      let rawContent: string;
      let resolvedPath: string | undefined;

      if (contentPath) {
        resolvedPath = path.resolve(DATA_DIR, contentPath);
        if (!fs.existsSync(resolvedPath)) {
          return deps.stateError(
            `File not found: "${resolvedPath}". ` +
            `contentPath is resolved relative to interview-mcp/data/. ` +
            `Available files in data/: ${fs.readdirSync(DATA_DIR).join(", ")}`
          );
        }
        rawContent = fs.readFileSync(resolvedPath, "utf-8");
        console.error(`[start_scoped_interview] loaded content from ${resolvedPath} (${rawContent.length} chars)`);
      } else {
        rawContent = content!;
      }

      // ── 2. Detect content type, extract signals, polish ───────────────────
      const contentType = detectContentType(rawContent);
      const isAlgorithm = contentType === 'algorithm';

      const spec     = isAlgorithm ? { endpoints: [], models: [], rules: [], notes: [] } : extractSpec(rawContent);
      const gaps     = isAlgorithm ? [] : detectGaps(rawContent);
      const polished = isAlgorithm ? rawContent : polishContent(topic, rawContent, focus);

      console.error(
        `[start_scoped_interview] topic="${topic}" focus="${focus}" contentType=${contentType} ` +
        (isAlgorithm
          ? `(algorithm — skipping endpoint/model/gap extraction)`
          : `endpoints=${spec.endpoints.length} models=${spec.models.length} rules=${spec.rules.length} gaps=${gaps.length}`)
      );

      // ── 3. Generate questions from the polished signals ────────────────────
      const questions = isAlgorithm
        ? buildAlgorithmQuestions(topic, rawContent, focus)
        : buildQuestions(topic, spec, gaps, focus);

      // ── 4. Persist session ─────────────────────────────────────────────────
      const sessions = deps.loadSessions();
      const id = deps.generateId();

      const session: Session = {
        id,
        topic,
        interviewType: "design",
        sessionKind: "interview",
        state: "ASK_QUESTION",
        currentQuestionIndex: 0,
        questions,
        messages: [],
        evaluations: [],
        customContent: polished,   // LLM sees the structured version, not the raw text
        focusArea: focus,
        ...(resolvedPath && { sourcePath: resolvedPath }),
        createdAt: new Date().toISOString(),
        knowledgeSource: "file",
      };

      sessions[id] = session;
      deps.saveSessions(sessions);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            sessionId: id,
            state: session.state,
            topic,
            focusArea: focus,
            source: resolvedPath ?? "inline content",
            parsed: isAlgorithm
              ? { contentType: 'algorithm' }
              : {
                  contentType: 'api',
                  endpoints: spec.endpoints.map((e) => `${e.method} ${e.path}`),
                  models:    spec.models.map((m) => `${m.name} (${m.fields.length} fields)`),
                  rules:     spec.rules,
                  gaps,
                },
            totalQuestions: questions.length,
            previewQuestions: questions.slice(0, 2),
            nextTool: "ask_question",
            instruction:
              "Session ready. Content has been parsed and polished for LLM evaluation. " +
              "Call ask_question to start. " +
              (deps.ai
                ? "AI is enabled — evaluate_answer will score against the structured spec automatically."
                : "AI is disabled — provide score, feedback, and needsFollowUp manually when calling evaluate_answer."),
          }, null, 2),
        }],
      };
    }
  );
}
