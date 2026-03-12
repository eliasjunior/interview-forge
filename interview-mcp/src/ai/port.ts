import type { Concept, Evaluation, EvaluationResult } from "@mock-interview/shared";

// ─────────────────────────────────────────────────────────────────────────────
// AIProvider — the port
//
// This interface is the only thing server.ts (or any other caller) depends on.
// The concrete implementation (Anthropic, OpenAI, local model, mock …) is
// chosen once at the composition root and injected — callers never import
// from a specific adapter directly.
// ─────────────────────────────────────────────────────────────────────────────

export interface AIProvider {
  /** Generate 5 progressive interview questions for a given topic. */
  generateQuestions(topic: string): Promise<string[]>;

  /**
   * Score a candidate's answer 1–5 and decide whether a follow-up is needed.
   * @param context  Optional evaluation criteria from the knowledge store —
   *                 passed when a knowledge file for the topic is available,
   *                 giving the model ground truth to score against.
   */
  evaluateAnswer(question: string, answer: string, context?: string): Promise<EvaluationResult>;

  /** Extract key technical concepts from the full interview transcript. */
  extractConcepts(topic: string, transcript: string): Promise<Concept[]>;

  /**
   * For each evaluation, produce markdown bullet points on "where to go deeper".
   * Returns one string per evaluation (same order, same length).
   */
  generateDeeperDives(topic: string, evaluations: Evaluation[]): Promise<string[]>;
}
