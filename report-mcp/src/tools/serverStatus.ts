import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolDeps } from "./deps.js";

export function registerServerStatusTool(server: McpServer, deps: ToolDeps) {
  server.registerTool(
    "server_status",
    { description: "Preflight check: confirm the report-mcp server is connected and return a lightweight runtime status snapshot." },
    async () => {
      const sessions = deps.loadSessions();
      const graph = deps.loadGraph();
      const endedSessions = Object.values(sessions).filter((s) => s.state === "ENDED").length;

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            ok: true,
            server: "report-mcp",
            version: "0.1.0",
            mode: deps.ai ? "AI enabled (deeper dives available)" : "AI disabled (report rebuild only)",
            timestamp: new Date().toISOString(),
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
            generatedUiDir: deps.generatedUiDir,
            recommendedNextTools: [
              "get_report_full_context",
              "get_report_weak_subjects",
              "get_graph",
            ],
          }),
        }],
      };
    }
  );
}
