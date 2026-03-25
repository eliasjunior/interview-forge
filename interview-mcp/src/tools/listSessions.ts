import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolDeps } from "./deps.js";

export function registerListSessionsTool(server: McpServer, deps: ToolDeps) {
  server.registerTool(
    "list_sessions",
    { description: "List all sessions with their topic, current state, and progress." },
    async () => {
      const sessions = deps.loadSessions();
      const list = Object.values(sessions).map((s) => ({
        id: s.id,
        topic: s.topic,
        state: s.state,
        progress: `${s.currentQuestionIndex}/${s.questions.length}`,
        avgScore: s.evaluations.length > 0 ? deps.calcAvgScore(s.evaluations) : null,
        createdAt: s.createdAt,
        endedAt: s.endedAt ?? null,
      }));
      return { content: [{ type: "text" as const, text: JSON.stringify(list) }] };
    }
  );
}
