import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Session } from "@mock-interview/shared";
import { detectContentType, detectGaps, discoverScopeFiles } from "../content/analyzer.js";
import { extractSpec } from "../content/parser.js";
import { buildAlgorithmQuestions, buildQuestions, polishContent } from "../content/questionBuilder.js";
import type { ToolDeps } from "./deps.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
const SCOPE_DIR = path.join(DATA_DIR, "add-scope");

const DEFAULT_FOCUS = "robustness, reliability, and extensibility in a production environment";

export function registerStartScopedInterviewTool(server: McpServer, deps: ToolDeps) {
  server.registerTool(
    "start_scoped_interview",
    {
      description: "Start a mock interview grounded in specific content — a project spec, architecture doc, or any text. " +
      "If neither contentPath nor content is provided, the tool searches data/add-scope/ for files " +
      "matching the topic name and returns candidates for the user to confirm before starting. " +
      "Once confirmed, call again with the chosen contentPath. " +
      "Content is parsed and polished into a structured spec, then stored on the session as rubric context. " +
      "No AI provider calls are made.",
      inputSchema: {
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
    },
    async ({ topic, contentPath, content, focus = DEFAULT_FOCUS }) => {
      if (contentPath && content) {
        return deps.stateError("Provide contentPath OR content, not both.");
      }

      if (!contentPath && !content) {
        const candidates = discoverScopeFiles(topic, SCOPE_DIR);

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
                  ? "Found 1 matching file. Please confirm this is the right spec before starting the interview."
                  : `Found ${candidates.length} candidate file(s). Please confirm which spec to use.`,
              candidates: candidates.map((candidate) => ({
                contentPath: candidate.contentPath,
                filename: candidate.filename,
                preview: candidate.preview,
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

      const contentType = detectContentType(rawContent);
      const isAlgorithm = contentType === "algorithm";
      const spec = isAlgorithm ? { endpoints: [], models: [], rules: [], notes: [] } : extractSpec(rawContent);
      const gaps = isAlgorithm ? [] : detectGaps(rawContent);
      const polished = isAlgorithm ? rawContent : polishContent(topic, rawContent, focus);
      const questions = isAlgorithm
        ? buildAlgorithmQuestions(topic, rawContent, focus)
        : buildQuestions(topic, spec, gaps, focus);

      console.error(
        `[start_scoped_interview] topic="${topic}" focus="${focus}" contentType=${contentType} ` +
        (isAlgorithm
          ? "(algorithm — skipping endpoint/model/gap extraction)"
          : `endpoints=${spec.endpoints.length} models=${spec.models.length} rules=${spec.rules.length} gaps=${gaps.length}`)
      );

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
        customContent: polished,
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
