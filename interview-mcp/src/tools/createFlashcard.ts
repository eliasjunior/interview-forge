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

function buildStructuredFront(
  prompt: string,
  anchors: string[] | undefined,
): string {
  const lines = [prompt.trim()];

  if (anchors && anchors.length > 0) {
    lines.push("", "Anchors:");
    for (const anchor of anchors) {
      lines.push(`- ${anchor}`);
    }
  }

  return lines.join("\n");
}

function buildStructuredBack(input: {
  cardStyle: "basic" | "open" | "multiple_choice";
  learnerAnswer?: string;
  feedback?: string;
  strongerAnswer?: string;
  correctAnswer?: string;
  route?: Array<{ anchor: string; detail: string }>;
  studyNotes?: string;
}): string {
  const lines: string[] = [];

  if (input.learnerAnswer?.trim()) {
    lines.push("## Your answer", "", `> ${input.learnerAnswer.trim().replace(/\n/g, "\n> ")}`, "");
  }

  if (input.feedback?.trim()) {
    lines.push("## Feedback", "", input.feedback.trim(), "");
  }

  if (input.strongerAnswer?.trim()) {
    lines.push(
      input.cardStyle === "multiple_choice" ? "## Explanation" : "## Model answer",
      "",
      input.strongerAnswer.trim(),
      "",
    );
  }

  if (input.correctAnswer?.trim()) {
    lines.push("## Correct", "", input.correctAnswer.trim(), "");
  }

  if (input.route && input.route.length > 0) {
    lines.push("## Route", "");
    for (const step of input.route) {
      lines.push(`- ${step.anchor.trim()} -> ${step.detail.trim()}`);
    }
    lines.push("");
  }

  if (input.studyNotes?.trim()) {
    lines.push("## Study notes", "", input.studyNotes.trim(), "");
  }

  return lines.join("\n").trim();
}

export function registerCreateFlashcardTool(server: McpServer, deps: ToolDeps) {
  server.registerTool(
    "create_flashcard",
    {
      description: "Create a flashcard directly from supplied content. " +
      "Supports plain front/back cards and guided-recall cards with anchors plus route steps. " +
      "Useful for capturing insights, concepts, interview misses, or open-question study prompts outside of an interview session. " +
      "Cards are immediately due for review and follow the same SM-2 schedule as auto-generated cards.",
      inputSchema: {
        front: z.string().min(5).optional()
          .describe("Plain front-of-card text. Use with back for a basic card."),
        back: z.string().min(5).optional()
          .describe("Plain back-of-card text. Use with front for a basic card. Markdown is supported."),
        prompt: z.string().min(5).optional()
          .describe("Question or recall prompt for guided cards. Used when front/back are omitted."),
        cardStyle: z.enum(["basic", "open", "multiple_choice"]).default("basic")
          .describe("basic = plain front/back, open = recall prompt with model answer, multiple_choice = prompt with anchors + correct answer."),
        anchors: z.array(z.string().min(1)).max(5).optional()
          .describe("Optional 2-5 anchor phrases that guide recall without giving away the full answer."),
        route: z.array(z.object({
          anchor: z.string().min(1),
          detail: z.string().min(1),
        })).max(5).optional()
          .describe("Optional retrieval route shown on the back as 'anchor -> detail' steps."),
        learnerAnswer: z.string().optional()
          .describe("Optional original learner answer to preserve on the back of the card."),
        feedback: z.string().optional()
          .describe("Optional coaching feedback about the weak spot or miss."),
        strongerAnswer: z.string().optional()
          .describe("For open cards: the model answer. For multiple-choice cards: explanation or reasoning summary."),
        correctAnswer: z.string().optional()
          .describe("For multiple-choice cards, the correct answer label(s), e.g. 'A, B, D'."),
        studyNotes: z.string().optional()
          .describe("Optional extra study note shown at the bottom of the card."),
        sourceSessionId: z.string().optional()
          .describe("Optional originating session id for auto-prepared cards."),
        sourceQuestionIndex: z.number().int().min(0).optional()
          .describe("Optional originating question index for auto-prepared cards."),
        sourceOriginalScore: z.number().int().min(1).max(5).optional()
          .describe("Optional original score that triggered card creation."),
        topic: z.string().min(1)
          .describe("Topic label, e.g. 'Zero Matrix', 'JWT authentication'."),
        difficulty: z.enum(["easy", "medium", "hard"]).default("medium")
          .describe("How hard this card is: easy | medium | hard."),
        tags: z.array(z.string()).optional()
          .describe("Optional tags for filtering, e.g. ['arrays', 'in-place']."),
      },
    },
    async ({
      front,
      back,
      prompt,
      cardStyle,
      anchors,
      route,
      learnerAnswer,
      feedback,
      strongerAnswer,
      correctAnswer,
      studyNotes,
      sourceSessionId,
      sourceQuestionIndex,
      sourceOriginalScore,
      topic,
      difficulty,
      tags,
    }) => {
      const now = new Date().toISOString();
      const id  = `fc-manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const usePlainFields = typeof front === "string" || typeof back === "string";

      if (usePlainFields && (!front || !back)) {
        return deps.stateError("Provide both front and back for a basic flashcard.");
      }

      if (!usePlainFields && !prompt) {
        return deps.stateError("Provide either front/back or a prompt for guided flashcard creation.");
      }

      if (!usePlainFields && cardStyle === "multiple_choice" && !correctAnswer) {
        return deps.stateError("Multiple-choice guided flashcards require correctAnswer.");
      }

      const resolvedFront = usePlainFields
        ? front!
        : buildStructuredFront(prompt!, anchors);

      const resolvedBack = usePlainFields
        ? back!
        : buildStructuredBack({
            cardStyle,
            learnerAnswer,
            feedback,
            strongerAnswer,
            correctAnswer,
            route,
            studyNotes,
          });

      if (!resolvedBack.trim()) {
        return deps.stateError("Guided flashcards need answer content on the back. Provide strongerAnswer, feedback, route, studyNotes, or learnerAnswer.");
      }

      const hasAnySource =
        sourceSessionId !== undefined ||
        sourceQuestionIndex !== undefined ||
        sourceOriginalScore !== undefined;
      const hasCompleteSource =
        sourceSessionId !== undefined &&
        sourceQuestionIndex !== undefined &&
        sourceOriginalScore !== undefined;

      if (hasAnySource && !hasCompleteSource) {
        return deps.stateError("Source-linked flashcards require sourceSessionId, sourceQuestionIndex, and sourceOriginalScore together.");
      }

      const card: Flashcard = {
        id,
        front: resolvedFront,
        back: resolvedBack,
        topic,
        difficulty: difficulty as FlashcardDifficulty,
        tags: tags ?? topic.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(Boolean),
        // No source — manually created cards are not tied to a session
        createdAt:   now,
        dueDate:     now,   // due immediately
        interval:    1,
        easeFactor:  2.5,
        repetitions: 0,
        ...(hasCompleteSource ? {
          source: {
            sessionId: sourceSessionId,
            questionIndex: sourceQuestionIndex,
            originalScore: sourceOriginalScore,
          },
        } : {}),
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
            cardStyle:  usePlainFields ? "basic" : cardStyle,
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
