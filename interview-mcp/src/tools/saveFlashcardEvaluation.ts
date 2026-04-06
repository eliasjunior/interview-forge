import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Flashcard, Mistake } from "@mock-interview/shared";
import type { ToolDeps } from "./deps.js";

// ─────────────────────────────────────────────────────────────────────────────
// save_flashcard_evaluation
//
// Called by the orchestrator after evaluate_flashcard returns context.
// Persists the verdict for one answer:
//
//   good_enough  → mark answer Completed
//   needs_improvement →
//     1. Create improved flashcard (parentFlashcardId = old card)
//     2. Archive old flashcard (archivedAt, replacedByFlashcardId = new card)
//     3. Create mistake log (linked to answer + both flashcards)
//     4. Mark answer Completed with all FK references
// ─────────────────────────────────────────────────────────────────────────────

export function registerSaveFlashcardEvaluationTool(server: McpServer, deps: ToolDeps) {
  server.registerTool(
    "save_flashcard_evaluation",
    {
      description:
        "Persist the evaluation verdict for a single pending flashcard answer. " +
        "Call once per answer after evaluate_flashcard returns the context. " +
        "For needs_improvement: archives the old card, creates an improved one, and logs the mistake.",
      inputSchema: {
        answerId: z
          .string()
          .describe("The answer id from evaluate_flashcard output."),
        verdict: z
          .enum(["good_enough", "needs_improvement"])
          .describe("Whether the candidate's answer was good enough."),
        evaluationResult: z
          .string()
          .describe(
            "Gap analysis text: what was missing, gap type (missing_steps | wrong_mental_model | lack_of_structure), and the correct model."
          ),
        improvedQuestion: z
          .string()
          .optional()
          .describe(
            "Required when verdict=needs_improvement. " +
            "The new, more structured question text (front of the replacement flashcard). " +
            "Should target the specific gaps found."
          ),
        mistakeText: z
          .string()
          .optional()
          .describe(
            "Required when verdict=needs_improvement. " +
            "Short description of what went wrong (the 'mistake' field in the log)."
          ),
        mistakePattern: z
          .string()
          .optional()
          .describe(
            "Required when verdict=needs_improvement. " +
            "When/why this mistake happens (the 'pattern' field in the log)."
          ),
        mistakeFix: z
          .string()
          .optional()
          .describe(
            "Required when verdict=needs_improvement. " +
            "The correct approach / fix (the 'fix' field in the log)."
          ),
      },
    },
    async ({ answerId, verdict, evaluationResult, improvedQuestion, mistakeText, mistakePattern, mistakeFix }) => {
      // Load the answer
      const pendingAnswers = deps.loadFlashcardAnswersByState("Evaluating");
      const answer = pendingAnswers.find(a => a.id === answerId);

      if (!answer) {
        // Try Pending too (race condition guard)
        const allPending = deps.loadFlashcardAnswersByState("Pending");
        const inPending = allPending.find(a => a.id === answerId);
        if (!inPending) {
          return deps.stateError(`Answer '${answerId}' not found in Evaluating or Pending state.`);
        }
      }

      const targetAnswer = answer ?? deps.loadFlashcardAnswersByState("Pending").find(a => a.id === answerId)!;

      const cards = deps.loadFlashcards();
      const card = cards.find(c => c.id === targetAnswer.flashcardId);

      if (!card) {
        deps.updateFlashcardAnswer({
          ...targetAnswer,
          state: "Completed",
          llmVerdict: verdict,
          evaluationResult,
          evaluatedAt: new Date().toISOString(),
        });
        return deps.stateError(`Flashcard '${targetAnswer.flashcardId}' not found — answer marked completed.`);
      }

      if (verdict === "good_enough") {
        deps.updateFlashcardAnswer({
          ...targetAnswer,
          state: "Completed",
          llmVerdict: "good_enough",
          evaluationResult,
          evaluatedAt: new Date().toISOString(),
        });

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              answerId,
              verdict: "good_enough",
              flashcardId: card.id,
              topic: card.topic,
              message: "Answer marked as good enough. No changes to flashcard.",
            }, null, 2),
          }],
        };
      }

      // ── needs_improvement path ────────────────────────────────────────────────

      if (!improvedQuestion || !mistakeText || !mistakePattern || !mistakeFix) {
        return deps.stateError(
          "For needs_improvement verdict, improvedQuestion, mistakeText, mistakePattern, and mistakeFix are all required."
        );
      }

      const now = new Date().toISOString();
      const newCardId = deps.generateId();
      const mistakeId = deps.generateId();

      // 1. Create improved flashcard (inherits all SRS state fresh, links to parent)
      const newCard: Flashcard = {
        id: newCardId,
        front: improvedQuestion,
        back: card.back, // same rich answer — the question is what improved
        topic: card.topic,
        tags: card.tags,
        difficulty: card.difficulty,
        createdAt: now,
        dueDate: now, // due immediately
        interval: 1,
        easeFactor: 2.5,
        repetitions: 0,
        parentFlashcardId: card.id,
        source: card.source,
      };
      deps.saveFlashcard(newCard);

      // 2. Archive old flashcard with replacement pointer
      const archivedCard: Flashcard = {
        ...card,
        archivedAt: now,
        replacedByFlashcardId: newCardId,
      };
      deps.saveFlashcard(archivedCard);

      // 3. Create mistake log entry
      const mistake: Mistake = {
        id: mistakeId,
        mistake: mistakeText,
        pattern: mistakePattern,
        fix: mistakeFix,
        topic: card.topic,
        createdAt: now,
        sourceAnswerId: answerId,
        sourceFlashcardId: card.id,
        replacementFlashcardId: newCardId,
      };
      deps.saveMistake(mistake);

      // 4. Mark answer Completed with all FK references
      deps.updateFlashcardAnswer({
        ...targetAnswer,
        state: "Completed",
        llmVerdict: "needs_improvement",
        evaluationResult,
        evaluatedAt: now,
        mistakeId,
        newFlashcardId: newCardId,
      });

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            answerId,
            verdict: "needs_improvement",
            topic: card.topic,
            oldFlashcardId: card.id,
            newFlashcardId: newCardId,
            mistakeId,
            message: [
              `Old card archived: ${card.id}`,
              `New improved card created: ${newCardId} (due immediately)`,
              `Mistake logged: ${mistakeId}`,
            ].join("\n"),
          }, null, 2),
        }],
      };
    }
  );
}
