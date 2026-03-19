import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolDeps } from "./deps.js";

export function registerHelpTools(server: McpServer, deps: ToolDeps) {
  server.tool(
    "help_tools",
    "List all MCP tools with short descriptions and example input payloads.",
    {
      toolName: z.string().optional().describe("Optional exact tool name to filter output to one tool"),
    },
    async ({ toolName }) => {
      const tools = [
        { name: "server_status", how: "Preflight MCP connectivity and runtime status", example: {} },
        { name: "start_interview", how: "Start interview from a curated knowledge topic", example: { topic: "JWT authentication" } },
        {
          name: "start_scoped_interview",
          how: "Start an interview grounded in custom content (project spec, README, architecture doc). Questions are generated from the content with a configurable focus angle.",
          example: {
            topic: "Mortgage API",
            content: "POST /api/mortgage-check — checks if a mortgage is feasible given income, loanValue, homeValue, maturityPeriod. Business rules: mortgage must not exceed 4× income or home value.",
            focus: "robustness, reliability, and extensibility in a production environment",
          },
        },
        { name: "ask_question", how: "Get current question", example: { sessionId: "..." } },
        { name: "submit_answer", how: "Submit candidate answer", example: { sessionId: "...", answer: "..." } },
        { name: "evaluate_answer", how: "Evaluate answer (AI on: sessionId only)", example: { sessionId: "..." } },
        { name: "ask_followup", how: "Ask follow-up question", example: { sessionId: "..." } },
        { name: "next_question", how: "Advance to next question / finish", example: { sessionId: "..." } },
        { name: "end_interview", how: "Force-end session and build report", example: { sessionId: "..." } },
        { name: "get_session", how: "Get full session data", example: { sessionId: "..." } },
        { name: "list_sessions", how: "List sessions", example: {} },
        { name: "list_topics", how: "List curated knowledge topics", example: {} },
        { name: "get_due_flashcards", how: "Get flashcards due for spaced-repetition review today", example: { topic: "JWT authentication" } },
        { name: "review_flashcard", how: "Submit a recall rating (1=Again, 2=Hard, 3=Good, 4=Easy) — applies SM-2 and schedules next review", example: { cardId: "...", rating: 3 } },
        { name: "log_mistake", how: "Record a micro-skill mistake: what went wrong, the pattern (when it happens), and the fix. Call this after any drill or evaluation.", example: { mistake: "Off-by-one in binary search", pattern: "Always happens with while condition", fix: "Use left <= right and adjust boundaries carefully", topic: "Algorithms" } },
        { name: "list_mistakes", how: "List all logged mistakes, optionally filtered by topic", example: { topic: "Java Thread States" } },
        {
          name: "start_drill",
          how: "Start a targeted drill on weak spots from a past interview. Pulls questions scored < 4 and logged mistakes for the topic, surfaces a recall prompt, then starts a focused drill session. Requires at least one completed interview on the topic first.",
          example: { topic: "Java OS & JVM Internals" },
        },
      ];

      const filtered = toolName
        ? tools.filter((tool) => tool.name === toolName)
        : tools;

      if (toolName && filtered.length === 0) {
        return deps.stateError(`Tool '${toolName}' not found.`);
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            count: filtered.length,
            tools: filtered,
            preflight: {
              requiredFirstTool: "server_status",
              why: "Verify the MCP server is connected and the runtime is healthy before starting an interview.",
            },
            tip: "Call server_status first. After a healthy preflight, call any other tool with the example payload as a starting point. For report generation, use the report-mcp service.",
          }),
        }],
      };
    }
  );
}
