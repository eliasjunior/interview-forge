import type { AIProvider } from "../ai/index.js";
import type { Evaluation, KnowledgeGraph, Session } from "@mock-interview/shared";

export type WeakSubject = {
  questionIndex: number;
  question: string;
  subject: string;
  score: number;
  gapSummary: string;
  exampleAnswer: string;
};

export type FullReportQuestionContext = {
  askedOrder: number;
  questionNumber: number;
  subject: string;
  question: string;
  candidateAnswer: string;
  strongAnswer?: string;
  interviewerFeedback: string;
  score: number;
  isWeak: boolean;
  gapSummary: string;
};

export type StateError = ReturnType<ToolDeps["stateError"]>;

export interface ToolDeps {
  ai: AIProvider | null;
  uiPort: string;
  generatedUiDir: string;

  stateError(msg: string): {
    content: Array<{ type: "text"; text: string }>;
  };

  // Data access — sessions (read + write for regenerate_report deeper dives)
  loadSessions(): Record<string, Session>;
  saveSessions(sessions: Record<string, Session>): void;

  // Data access — graph (read-only)
  loadGraph(): KnowledgeGraph;

  // Report file persistence
  saveReport(session: Session): string;

  // UI generation
  ensureGeneratedUiDir(): void;
  writeTextFile(path: string, content: string): void;

  // Utility functions
  calcAvgScore(evaluations: Evaluation[]): string;
  buildSummary(session: Session): string;
  pickSessionByTopic(sessions: Record<string, Session>, topic: string): Session | null;
  extractWeakSubjects(session: Session, weakScoreThreshold: number, maxSubjects: number): WeakSubject[];
  buildFullQuestionContext(session: Session, weakScoreThreshold: number): FullReportQuestionContext[];
  countLines(text: string): number;
  escapeHtml(value: string): string;
  serializeForInlineScript(value: unknown): string;
}
