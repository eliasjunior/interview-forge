import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolDeps } from "./deps.js";

export function registerRegenerateReportTool(server: McpServer, deps: ToolDeps) {
  server.tool(
    "regenerate_report",
    "Re-generate the deeper-dive feedback and report file for a completed session.",
    { sessionId: z.string() },
    async ({ sessionId }) => {
      const sessions = deps.loadSessions();
      const session = sessions[sessionId];
      if (!session) return deps.stateError(`Session '${sessionId}' not found.`);
      if (session.state !== "ENDED") return deps.stateError("Session is not ended yet.");

      if (deps.ai) {
        const dives = await deps.ai.generateDeeperDives(session.topic, session.evaluations);
        dives.forEach((dive, i) => {
          if (session.evaluations[i] && dive) session.evaluations[i].deeperDive = dive;
        });
        deps.saveSessions(sessions);
      }

      const reportFile = deps.saveReport(session);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            sessionId,
            reportFile,
            deeperDivesGenerated: deps.ai ? session.evaluations.filter((e) => e.deeperDive).length : 0,
            ...(deps.ai ? {} : { note: "AI is disabled — report rebuilt from existing data. Enable AI_ENABLED=true to generate deeper dives." }),
          }),
        }],
      };
    }
  );
}
