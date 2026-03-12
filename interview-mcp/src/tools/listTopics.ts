import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolDeps } from "./deps.js";

export function registerListTopicsTool(server: McpServer, deps: ToolDeps) {
  server.tool(
    "list_topics",
    "List topics that have curated knowledge files. These topics use pre-built questions and concepts — no AI API call needed.",
    {},
    async () => {
      const topics = deps.knowledge.listTopics();
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            topics,
            count: topics.length,
            instruction: topics.length > 0
              ? `Use start_interview with any of these topics for zero-cost sessions: ${topics.join(", ")}`
              : "No knowledge files found. All topics will use AI-generated questions.",
          }),
        }],
      };
    }
  );
}
