import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolDeps } from "./deps.js";

export function registerServerStatusTool(server: McpServer, deps: ToolDeps) {
  server.registerTool(
    "server_status",
    { description: "Preflight check: confirm the MCP server is connected and return a lightweight runtime status snapshot." },
    async () => {
      const sessions = deps.loadSessions();
      const graph = deps.loadGraph();
      const topics = deps.knowledge.listTopics();
      const endedSessions = Object.values(sessions).filter((session) => session.state === "ENDED").length;

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            ok: true,
            server: "interview-mcp",
            version: "0.2.0",
            mode: deps.ai ? "AI + knowledge files" : "knowledge files only",
            timestamp: new Date().toISOString(),
            topicsLoaded: topics.length,
            topics,
            sessions: {
              total: Object.keys(sessions).length,
              ended: endedSessions,
              active: Object.keys(sessions).length - endedSessions,
            },
            graph: {
              nodes: graph.nodes.length,
              edges: graph.edges.length,
              sessions: graph.sessions.length,
            },
            uiPort: deps.uiPort,
            recommendedNextTools: [
              "list_topics",
              "review_knowledge_file",
              "start_interview",
            ],
          }),
        }],
      };
    }
  );
}
