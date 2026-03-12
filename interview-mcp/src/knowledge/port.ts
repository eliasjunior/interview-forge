import type { Concept } from "@mock-interview/shared";

// ─────────────────────────────────────────────────────────────────────────────
// KnowledgeStore — port
//
// Provides curated topic data to the server. The concrete implementation
// (file-based, database, remote API …) is chosen at the composition root
// and injected — server.ts never imports a specific adapter.
//
// When a topic has a knowledge entry:
//   • questions come from the file  → 0 API calls for generateQuestions
//   • concepts come from the file   → 0 API calls for extractConcepts
//   • evaluationCriteria is passed as context to evaluateAnswer → better scoring
//
// When a topic has NO entry, server.ts falls back to the AIProvider for all three.
// ─────────────────────────────────────────────────────────────────────────────

export interface KnowledgeTopic {
  /** Canonical topic name (e.g. "JWT") */
  topic: string;

  /** Short summary passed to the orchestrator as grounding context */
  summary: string;

  /** Curated ordered questions — replaces ai.generateQuestions */
  questions: string[];

  /**
   * Evaluation guidelines passed as context to ai.evaluateAnswer.
   * One string per question, same order/length as `questions`.
   * If shorter, remaining questions get no specific criteria.
   */
  evaluationCriteria: string[];

  /** Pre-defined concepts — replaces ai.extractConcepts */
  concepts: Concept[];
}

export interface KnowledgeStore {
  /**
   * Find a topic by name. Matching is case-insensitive and ignores
   * punctuation so "JWT", "jwt", "JSON Web Token" all resolve to the same entry.
   * Returns null when no match is found — caller falls back to AI.
   */
  findByTopic(topic: string): KnowledgeTopic | null;

  /** List all available topic names (for the list_topics tool). */
  listTopics(): string[];
}
