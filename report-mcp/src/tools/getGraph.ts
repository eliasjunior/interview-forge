import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolDeps } from "./deps.js";

export function registerGetGraphTool(server: McpServer, deps: ToolDeps) {
  server.tool(
    "get_graph",
    "Return the full knowledge graph built from all completed sessions.",
    {},
    async () => {
      const graph = deps.loadGraph();
      return { content: [{ type: "text" as const, text: JSON.stringify(graph) }] };
    }
  );
}
