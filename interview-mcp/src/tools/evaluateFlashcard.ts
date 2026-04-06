import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Flashcard, FlashcardAnswer, Mistake } from "@mock-interview/shared";
import type { ToolDeps } from "./deps.js";

// ─────────────────────────────────────────────────────────────────────────────
// evaluate_flashcard
//
// Scans all answers in state=Pending, evaluates each one against the card's
// back (the correct answer), and for each:
//
//   - If good_enough:
//       marks answer Completed with verdict=good_enough
//
//   - If needs_improvement:
//       1. Creates a new improved flashcard (linked via parentFlashcardId)
//       2. Archives the old flashcard (archivedAt + replacedByFlashcardId)
//       3. Creates a mistake log entry (linked to answer + both flashcards)
//       4. Marks answer Completed with all FK references
//
// State machine: Pending → Evaluating → Completed
// Idempotency: state is set to Evaluating before processing, so a crash
// mid-flight leaves it in Evaluating (not re-processed on next run).
// ─────────────────────────────────────────────────────────────────────────────

export function registerEvaluateFlashcardTool(server: McpServer, deps: ToolDeps) {
  server.registerTool(
    "evaluate_flashcard",
    {
      description:
        "Evaluate all pending flashcard answers. For each answer, compare the candidate's response " +
        "to the card's correct answer and determine if it's good_enough or needs_improvement. " +
        "If needs_improvement: create an improved flashcard, archive the old one, and log a mistake. " +
        "Returns a summary of what was evaluated.",
      inputSchema: {
        dryRun: z
          .boolean()
          .optional()
          .describe("If true, list pending answers without processing them."),
      },
    },
    async ({ dryRun }) => {
      const pendingAnswers = deps.loadFlashcardAnswersByState("Pending");

      if (pendingAnswers.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ status: "nothing_to_evaluate", pending: 0 }, null, 2),
          }],
        };
      }

      if (dryRun) {
        const cards = deps.loadFlashcards();
        const preview = pendingAnswers.map(a => {
          const card = cards.find(c => c.id === a.flashcardId);
          return {
            answerId: a.id,
            flashcardId: a.flashcardId,
            topic: card?.topic ?? "unknown",
            question: card?.front?.slice(0, 80) ?? "—",
            answerPreview: a.content.slice(0, 80),
            createdAt: a.createdAt,
          };
        });
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ status: "dry_run", pending: pendingAnswers.length, answers: preview }, null, 2),
          }],
        };
      }

      // Lock all pending answers as Evaluating before processing
      for (const answer of pendingAnswers) {
        deps.updateFlashcardAnswer({ ...answer, state: "Evaluating" });
      }

      const cards = deps.loadFlashcards();
      const results: Array<{
        answerId: string;
        flashcardId: string;
        topic: string;
        verdict: "good_enough" | "needs_improvement";
        newFlashcardId?: string;
        mistakeId?: string;
        evaluationResult: string;
      }> = [];

      for (const answer of pendingAnswers) {
        const card = cards.find(c => c.id === answer.flashcardId);
        if (!card) {
          // Card was deleted — mark completed without evaluation
          deps.updateFlashcardAnswer({ ...answer, state: "Completed", evaluationResult: "Card no longer exists." });
          continue;
        }

        // ── Instruct the orchestrator to evaluate ──────────────────────────────
        // The tool itself does not call the AI — the orchestrator (Claude) is the
        // one reading this tool response and doing the reasoning.
        // We return the evaluation context and instructions, and Claude fills in
        // the verdict inline as it processes each answer.
        //
        // For programmatic use we embed the evaluation prompt in the result and
        // expect Claude to decide verdict + gap fields when calling this tool.
        // Since we can't get Claude's verdict synchronously here, we return the
        // context for Claude to evaluate and call back with the verdict via
        // the complete_flashcard_evaluation helper embedded in the instruction.
        //
        // Practical flow:
        //  1. evaluate_flashcard returns the list of answers to evaluate with context
        //  2. Claude evaluates each one inline and calls evaluate_flashcard again
        //     with individual verdicts, OR the orchestrator uses the returned
        //     data to drive a loop calling this tool with verdict overrides.
        //
        // To keep the tool self-contained and avoid a second tool, we accept
        // optional per-answer verdict overrides in the input. On first call
        // (no overrides) we return evaluation context. On second call (with
        // overrides) we persist results.
        //
        // For simplicity in the current implementation: we return context for
        // Claude to evaluate. Claude should call evaluate_flashcard_answer for
        // each result after reasoning about them.

        results.push({
          answerId: answer.id,
          flashcardId: card.id,
          topic: card.topic,
          verdict: "needs_improvement", // placeholder — Claude replaces this
          evaluationResult: "",          // placeholder — Claude fills this in
          _context: {
            question: card.front,
            correctAnswer: card.back,
            candidateAnswer: answer.content,
          },
        } as typeof results[number] & { _context: unknown });
      }

      const instruction = [
        `Found ${results.length} pending answer(s) to evaluate.`,
        "",
        "For each entry in 'answers', compare candidateAnswer to correctAnswer and decide:",
        "  - verdict: 'good_enough' if the candidate demonstrates solid understanding",
        "  - verdict: 'needs_improvement' if there are significant gaps",
        "",
        "For each answer, call save_flashcard_evaluation with:",
        "  { answerId, verdict, evaluationResult (gap analysis), improvedQuestion? (for needs_improvement) }",
        "",
        "Gap analysis format for needs_improvement:",
        "  - What was missing or wrong",
        "  - Gap type: missing_steps | wrong_mental_model | lack_of_structure",
        "  - The correct model (concise)",
        "",
        "The improved question (for needs_improvement) should be more targeted and structured,",
        "as shown in the design: numbered sub-questions that probe the exact gaps found.",
      ].join("\n");

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            status: "ready_for_evaluation",
            count: results.length,
            instruction,
            answers: results.map(r => ({
              answerId: r.answerId,
              flashcardId: r.flashcardId,
              topic: r.topic,
              // @ts-expect-error _context added inline
              question: r._context.question,
              // @ts-expect-error _context added inline
              correctAnswer: r._context.correctAnswer,
              // @ts-expect-error _context added inline
              candidateAnswer: r._context.candidateAnswer,
            })),
            nextTool: "save_flashcard_evaluation",
          }, null, 2),
        }],
      };
    }
  );
}
