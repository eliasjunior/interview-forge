import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolDeps } from "./deps.js";

export function registerListSkillsTool(server: McpServer, deps: ToolDeps) {
  server.registerTool(
    "list_skills",
    {
      description: "List skills in the backlog. Optionally filter to only show skills at or below a confidence level — useful for finding what to drill next.",
      inputSchema: {
        maxConfidence: z.number().int().min(1).max(5).optional().describe("Only return skills with confidence ≤ this value. Omit to return all."),
      },
    },
    async ({ maxConfidence }) => {
      const list = deps.loadSkills(maxConfidence);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ total: list.length, skills: list }),
        }],
      };
    }
  );
}
