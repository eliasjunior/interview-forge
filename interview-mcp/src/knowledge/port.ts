import type { Concept } from "@mock-interview/shared";

// ── Warm-up quest data (internal to knowledge store) ─────────────────────────

export interface WarmUpQuestion {
  question: string;
  /** MCQ option labels (e.g. ["Header", "SessionID", …]). Present at Level 0 only. */
  choices?: string[];
  /** Correct answer: option letter (L0), fill-in text (L1), or model answer (L2). */
  answer: string;
  /** Scaffolding hint shown before the candidate answers. Present at Level 2. */
  hint?: string;
}

/** Content for one warm-up level (0, 1, or 2). Level 3 = full interview — no data needed. */
export interface WarmUpLevelContent {
  questions: WarmUpQuestion[];
}

export type ExerciseFit = "none" | "micro" | "standard";

export interface QuestionExerciseGuidance {
  fit: ExerciseFit;
  goal?: string;
  owner?: string;
  scope?: string;
  constraints?: string[];
  acceptance?: string[];
  seed?: string;
}

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

  /** Structured exercise guidance parallel to `questions`. */
  questionExercises?: QuestionExerciseGuidance[];

  /**
   * Evaluation guidelines passed as context to ai.evaluateAnswer.
   * One string per question, same order/length as `questions`.
   * If shorter, remaining questions get no specific criteria.
   */
  evaluationCriteria: string[];

  /**
   * Difficulty tier per question, parallel to `questions`.
   * Values: "foundation" | "intermediate" | "advanced".
   * Missing entries default to "intermediate".
   */
  questionDifficulties: string[];

  /** Pre-defined concepts — replaces ai.extractConcepts */
  concepts: Concept[];

  /**
   * Warm-up quest content indexed by level (0, 1, 2).
   * Level 3 redirects to a full interview — no content stored here.
   * Missing levels mean no warm-up content was authored for that level.
   */
  warmupLevels?: Partial<Record<0 | 1 | 2, WarmUpLevelContent>>;
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
