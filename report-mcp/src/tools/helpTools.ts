import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolDeps } from "./deps.js";

export function registerHelpTools(server: McpServer, deps: ToolDeps) {
  server.registerTool(
    "help_tools",
    {
      description: "List all report-mcp tools with short descriptions and example input payloads.",
      inputSchema: {
        toolName: z.string().optional().describe("Optional exact tool name to filter output to one tool"),
      },
    },
    async ({ toolName }) => {
      const tools = [
        { name: "server_status", how: "Preflight report-mcp connectivity and runtime status", example: {} },
        { name: "regenerate_report", how: "Regenerate report/deeper dives for an ended session", example: { sessionId: "..." } },
        { name: "get_report_weak_subjects", how: "Get weak-question context for report UI", example: { sessionId: "...", weakScoreThreshold: 3, maxSubjects: 5 } },
        {
          name: "get_report_full_context",
          how: "Get full Q/A context for a full report UI",
          example: { sessionId: "...", weakScoreThreshold: 3 },
        },
        {
          name: "generate_report_ui",
          how: "Generate report dataset JSON and return reusable viewer URL",
          example: {
            sessionId: "...",
            questions: [{
              questionNumber: 1,
              question: "Explain JWT.",
              candidateAnswer: "...",
              interviewerFeedback: "...",
              strongAnswer: "Line 1\nLine 2",
            }],
          },
        },
        {
          name: "get_progress_overview",
          how: "Aggregate ended sessions into score trends, topic progress, and weak-question rates",
          example: { sessionKind: "interview", weakScoreThreshold: 3, recentSessionsLimit: 5, topicLimit: 10 },
        },
        { name: "get_graph", how: "Get full knowledge graph built from all completed sessions", example: {} },
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
            tip: "Call any tool with the example payload as a starting point.",
          }),
        }],
      };
    }
  );
}
