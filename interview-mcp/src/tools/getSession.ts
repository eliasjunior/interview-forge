import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolDeps } from "./deps.js";

export function registerGetSessionTool(server: McpServer, deps: ToolDeps) {
  server.tool(
    "get_session",
    "Retrieve a session by ID — transcript, state, evaluations, and summary.",
    { sessionId: z.string() },
    async ({ sessionId }) => {
      const sessions = deps.loadSessions();
      const session = sessions[sessionId];
      if (!session) return deps.stateError(`Session '${sessionId}' not found.`);
      return { content: [{ type: "text" as const, text: JSON.stringify(session) }] };
    }
  );
}
