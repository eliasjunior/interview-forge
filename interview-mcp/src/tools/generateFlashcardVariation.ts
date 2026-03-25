import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolDeps } from "./deps.js";

// ─────────────────────────────────────────────────────────────────────────────
// generate_flashcard_variation
//
// Returns the original card context + a variation angle, instructing the
// orchestrator LLM to construct a different question that tests the same
// concept from a fresh perspective. The variation is ephemeral — not stored.
//
// Called by the orchestrator after review_flashcard signals nextStep when
// the card has been seen at least once before (repetitions > 0).
// ─────────────────────────────────────────────────────────────────────────────

export const VARIATION_ANGLES = [
  {
    name: "failure-case",
    prompt: "Ask what goes wrong if the candidate ignores or misapplies this concept in production.",
  },
  {
    name: "why-not-what",
    prompt: "Ask the candidate to explain the reasoning behind the answer, not just state the fact.",
  },
  {
    name: "flip-scenario",
    prompt: "Reverse the scenario — ask about the opposite constraint or the edge case that breaks the normal rule.",
  },
  {
    name: "trade-offs",
    prompt: "Ask the candidate to compare this approach to an alternative and explain when each is preferable.",
  },
  {
    name: "teach-it",
    prompt: "Ask the candidate to explain this concept to a junior developer using a concrete analogy or example.",
  },
  {
    name: "apply-to-context",
    prompt: "Ask how this concept applies to a specific production scenario (e.g. a high-traffic service, a distributed system, or a memory-constrained environment).",
  },
] as const;

export type VariationAngle = (typeof VARIATION_ANGLES)[number];

/**
 * Picks a variation angle that rotates deterministically based on how many
 * times the card has been reviewed. This ensures consecutive reviews of the
 * same card always use a different angle.
 */
export function pickVariationAngle(repetitions: number): VariationAngle {
  return VARIATION_ANGLES[repetitions % VARIATION_ANGLES.length];
}

export function registerGenerateFlashcardVariationTool(server: McpServer, deps: ToolDeps) {
  server.registerTool(
    "generate_flashcard_variation",
    {
      description:
        "Generate a variation of a flashcard question to avoid rote memorisation. " +
        "Returns the original card context and a variation angle. " +
        "You (the LLM) must create a slightly different question testing the same concept based on the angle, " +
        "present it to the candidate, and evaluate their answer against the modelAnswer. " +
        "Do NOT reveal the originalQuestion or modelAnswer to the candidate.",
      inputSchema: {
        cardId: z
          .string()
          .describe("The flashcard id returned in review_flashcard's nextStep."),
      },
    },
    async ({ cardId }) => {
      const cards = deps.loadFlashcards();
      const card = cards.find((c) => c.id === cardId);

      if (!card) {
        return deps.stateError(`Flashcard '${cardId}' not found.`);
      }

      const angle = pickVariationAngle(card.repetitions);

      const result = {
        cardId: card.id,
        topic: card.topic,
        difficulty: card.difficulty,
        tags: card.tags,
        repetitions: card.repetitions,
        originalQuestion: card.front,
        modelAnswer: card.back,
        variationAngle: angle.name,
        instruction: [
          "Using originalQuestion and modelAnswer as context, construct a varied question.",
          `Variation angle — ${angle.name}: ${angle.prompt}`,
          "Rules:",
          "  1. The varied question must test the same underlying concept.",
          "  2. Do NOT reveal originalQuestion or modelAnswer to the candidate.",
          "  3. Ask only the varied question, then wait for the candidate's answer.",
          "  4. Evaluate their response against modelAnswer — full marks if they demonstrate the same understanding from the new angle.",
        ].join("\n"),
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );
}
