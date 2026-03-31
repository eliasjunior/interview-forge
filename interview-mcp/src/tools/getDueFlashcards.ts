import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolDeps } from "./deps.js";
import { isDue } from "../srsUtils.js";

export function registerGetDueFlashcardsTool(server: McpServer, deps: ToolDeps) {
  server.registerTool(
    "get_due_flashcards",
    {
      description: "Returns flashcards that are due for review today (dueDate <= now). " +
      "Optionally filter by topic. Cards are sorted most-overdue first. " +
      "Use review_flashcard to submit a rating after reviewing each card.",
      inputSchema: {
        topic: z.string().optional().describe(
          "Filter to a specific topic (e.g. 'JWT authentication'). Omit to get all due cards."
        ),
      },
    },
    async ({ topic }) => {
      const now = new Date();
      const all = deps.loadFlashcards();

      const due = all
        .filter((c) => !c.archivedAt)
        .filter((c) => isDue(c, now))
        .filter((c) => !topic || c.topic.toLowerCase() === topic.toLowerCase())
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

      const result = {
        total: all.length,
        due: due.length,
        cards: due.map((c) => ({
          id:         c.id,
          topic:      c.topic,
          difficulty: c.difficulty,
          front:      c.front,
          back:       c.back,
          tags:       c.tags,
          dueDate:    c.dueDate,
          repetitions: c.repetitions,
          lastReviewedAt: c.lastReviewedAt ?? null,
          source: c.source,
        })),
        hint: due.length > 0
          ? `Review each card, then call review_flashcard with the card id and a rating (1=Again, 2=Hard, 3=Good, 4=Easy).`
          : `No cards are due right now. Check back later or run an interview to generate new cards.`,
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );
}
