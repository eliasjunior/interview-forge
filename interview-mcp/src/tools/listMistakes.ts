import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolDeps } from "./deps.js";

export function registerListMistakesTool(server: McpServer, deps: ToolDeps) {
  server.tool(
    "list_mistakes",
    "List all logged mistakes, optionally filtered by topic. Returns mistake, pattern, fix, and metadata for each entry.",
    {
      topic: z.string().optional().describe("Filter by topic label, e.g. 'Java Thread States'"),
    },
    async ({ topic }) => {
      const entries = deps.loadMistakes(topic);
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ total: entries.length, mistakes: entries }) }],
      };
    }
  );
}
