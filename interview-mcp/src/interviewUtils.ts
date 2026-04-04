/**
 * @deprecated Import directly from the focused modules instead:
 *   - stateUtils.ts    → assertState, VALID_TOOLS
 *   - sessionUtils.ts  → generateId, findLast, calcAvgScore, buildTranscript, buildSummary, buildReport, buildEndInterviewRecommendations
 *   - flashcardUtils.ts → buildFlashcardDrafts, generateFlashcards, FlashcardDraftInput
 *   - graphUtils.ts    → mergeConceptsIntoGraph
 *
 * This file is kept as a re-export barrel for backwards compatibility.
 */

export type {
  InterviewState,
  Message,
  Evaluation,
  Session,
  Concept,
  GraphNode,
  GraphEdge,
  KnowledgeGraph,
  Flashcard,
  FlashcardDifficulty,
  Mistake,
} from "@mock-interview/shared";

export { VALID_TOOLS, assertState } from "./stateUtils.js";

export {
  generateId,
  findLast,
  calcAvgScore,
  buildTranscript,
  buildSummary,
  buildReport,
  buildEndInterviewRecommendations,
} from "./sessionUtils.js";
export type { EndInterviewRecommendations } from "./sessionUtils.js";

export { buildFlashcardDrafts, generateFlashcards } from "./flashcardUtils.js";
export type { FlashcardDraftInput } from "./flashcardUtils.js";

export { mergeConceptsIntoGraph } from "./graphUtils.js";
