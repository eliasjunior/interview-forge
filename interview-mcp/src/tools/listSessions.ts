import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolDeps } from "./deps.js";

const DEFAULT_LIMIT = 10;

export function registerListSessionsTool(server: McpServer, deps: ToolDeps) {
  server.registerTool(
    "list_sessions",
    {
      description: "List sessions with their topic, current state, and progress. Returns the most recent sessions first. Use limit and offset for pagination.",
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional()
          .describe(`Max sessions to return. Default: ${DEFAULT_LIMIT}.`),
        offset: z.number().int().min(0).optional()
          .describe("Number of sessions to skip (for pagination). Default: 0."),
        topic: z.string().optional()
          .describe("Filter by topic (case-insensitive substring match)."),
        state: z.enum(["ASK_QUESTION", "WAIT_FOR_ANSWER", "EVALUATE_ANSWER", "FOLLOW_UP", "ENDED"]).optional()
          .describe("Filter by session state."),
      },
    },
    async ({ limit = DEFAULT_LIMIT, offset = 0, topic, state }) => {
      const sessions = deps.loadSessions();
      let list = Object.values(sessions)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      if (topic) {
        list = list.filter((s) => s.topic.toLowerCase().includes(topic.toLowerCase()));
      }
      if (state) {
        list = list.filter((s) => s.state === state);
      }

      const total = list.length;
      const page = list.slice(offset, offset + limit).map((s) => ({
        id: s.id,
        topic: s.topic,
        state: s.state,
        progress: `${s.currentQuestionIndex}/${s.questions.length}`,
        avgScore: s.evaluations.length > 0 ? deps.calcAvgScore(s.evaluations) : null,
        createdAt: s.createdAt,
        endedAt: s.endedAt ?? null,
      }));

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ total, offset, limit, returned: page.length, sessions: page }),
        }],
      };
    }
  );
}
