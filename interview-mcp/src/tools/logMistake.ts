import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolDeps } from "./deps.js";

export function registerLogMistakeTool(server: McpServer, deps: ToolDeps) {
  server.tool(
    "log_mistake",
    "Record a micro-skill mistake to the mistake log. Captures what went wrong, the pattern (when/why it happens), and the fix. Use this after a drill or interview to preserve a learning.",
    {
      mistake: z.string().min(1).describe("What went wrong — specific and concrete"),
      pattern: z.string().min(1).describe("When or why this mistake happens — the trigger or context"),
      fix: z.string().min(1).describe("The correct approach or rule to remember"),
      topic: z.string().optional().describe("Topic label, e.g. 'Java Thread States'"),
    },
    async ({ mistake, pattern, fix, topic }) => {
      const entry = {
        id: deps.generateId(),
        mistake,
        pattern,
        fix,
        topic,
        createdAt: new Date().toISOString(),
      };
      deps.saveMistake(entry);
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ logged: true, id: entry.id, topic: entry.topic ?? null }) }],
      };
    }
  );
}
