import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolDeps } from "./deps.js";

export function registerEndInterviewTool(server: McpServer, deps: ToolDeps) {
  server.tool(
    "end_interview",
    "Force-end the interview at any point and generate a summary. Valid in any active state.",
    { sessionId: z.string() },
    async ({ sessionId }) => {
      const sessions = deps.loadSessions();
      const session = sessions[sessionId];
      if (!session) return deps.stateError(`Session '${sessionId}' not found.`);
      if (session.state === "ENDED") return deps.stateError("Session is already ended.");

      const { summary, concepts, reportFile } = await deps.finalizeSession(session, sessions);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            sessionId,
            state: session.state,
            summary,
            conceptsExtracted: concepts.length,
            reportFile,
          }),
        }],
      };
    }
  );
}
