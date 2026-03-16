import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolDeps } from "./deps.js";
import type { ReviewRating } from "@mock-interview/shared";
import { applySM2, ratingLabel } from "../srsUtils.js";

export function registerReviewFlashcardTool(server: McpServer, deps: ToolDeps) {
  server.tool(
    "review_flashcard",
    "Submit a review rating for a flashcard after studying it. " +
    "Updates the SM-2 spaced-repetition schedule (interval, ease factor, next due date). " +
    "Ratings: 1=Again (forgot), 2=Hard, 3=Good, 4=Easy.",
    {
      cardId: z.string().describe("The flashcard id (from get_due_flashcards)."),
      rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
        .describe("How well you recalled the card: 1=Again, 2=Hard, 3=Good, 4=Easy."),
    },
    async ({ cardId, rating }) => {
      const cards = deps.loadFlashcards();
      const idx   = cards.findIndex((c) => c.id === cardId);

      if (idx === -1) {
        return deps.stateError(`Flashcard '${cardId}' not found.`);
      }

      const card = cards[idx];
      const srs  = applySM2(card, rating as ReviewRating);

      cards[idx] = {
        ...card,
        interval:        srs.interval,
        easeFactor:      srs.easeFactor,
        repetitions:     srs.repetitions,
        dueDate:         srs.dueDate,
        lastReviewedAt:  new Date().toISOString(),
      };

      deps.saveFlashcards(cards);

      const result = {
        cardId,
        topic:       card.topic,
        rating:      ratingLabel(rating as ReviewRating),
        nextDueDate: srs.dueDate,
        nextInterval:    `${srs.interval} day${srs.interval === 1 ? "" : "s"}`,
        easeFactor:  srs.easeFactor,
        repetitions: srs.repetitions,
        message: rating === 1
          ? `Card reset — you'll see it again tomorrow. Keep at it!`
          : `Great! Next review in ${srs.interval} day${srs.interval === 1 ? "" : "s"}.`,
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );
}
