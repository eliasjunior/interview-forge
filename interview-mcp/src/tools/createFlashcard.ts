import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Flashcard, FlashcardDifficulty } from "@mock-interview/shared";
import type { ToolDeps } from "./deps.js";

// ─────────────────────────────────────────────────────────────────────────────
// create_flashcard
//
// Creates a single flashcard from user-supplied content — decoupled from the
// interview flow. Also exports persistFlashcard() so end_interview can reuse
// the same insertion logic (SRP: one place that knows how to save a card).
// ─────────────────────────────────────────────────────────────────────────────

/** Idempotent single-card save — skips if the id already exists. */
export function persistFlashcard(deps: ToolDeps, card: Flashcard): boolean {
  const existing = deps.loadFlashcards();
  if (existing.some((c) => c.id === card.id)) return false;
  deps.saveFlashcard(card);
  return true;
}

export function registerCreateFlashcardTool(server: McpServer, deps: ToolDeps) {
  server.registerTool(
    "create_flashcard",
    {
      description: "Create a flashcard directly from supplied front/back content. " +
      "Useful for capturing insights, concepts, or mistakes outside of an interview session. " +
      "Cards are immediately due for review and follow the same SM-2 schedule as auto-generated cards.",
      inputSchema: {
        front: z.string().min(5)
          .describe("The question or concept prompt shown during review."),
        back: z.string().min(5)
          .describe("The answer, explanation, or key points revealed after the prompt. Markdown is supported."),
        topic: z.string().min(1)
          .describe("Topic label, e.g. 'Zero Matrix', 'JWT authentication'."),
        difficulty: z.enum(["easy", "medium", "hard"]).default("medium")
          .describe("How hard this card is: easy | medium | hard."),
        tags: z.array(z.string()).optional()
          .describe("Optional tags for filtering, e.g. ['arrays', 'in-place']."),
      },
    },
    async ({ front, back, topic, difficulty, tags }) => {
      const now = new Date().toISOString();
      const id  = `fc-manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      const card: Flashcard = {
        id,
        front,
        back,
        topic,
        difficulty: difficulty as FlashcardDifficulty,
        tags: tags ?? topic.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(Boolean),
        // No source — manually created cards are not tied to a session
        createdAt:   now,
        dueDate:     now,   // due immediately
        interval:    1,
        easeFactor:  2.5,
        repetitions: 0,
      };

      const created = persistFlashcard(deps, card);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            created,
            cardId:     card.id,
            topic:      card.topic,
            difficulty: card.difficulty,
            dueDate:    card.dueDate,
            message:    created
              ? `Flashcard created — due immediately for first review.`
              : `Card '${id}' already exists — skipped.`,
          }, null, 2),
        }],
      };
    }
  );
}
