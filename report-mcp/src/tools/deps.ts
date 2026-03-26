import type { AIProvider } from "../ai/index.js";
import type { Evaluation, KnowledgeGraph, Session, SessionKind } from "@mock-interview/shared";
import type { ProgressOverview, ProgressOverviewOptions } from "../reportUtils.js";

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
export type ProgressSessionKind = SessionKind | "all";

export interface ToolDeps {
  ai: AIProvider | null;
  uiPort: string;
  generatedUiDir: string;

  stateError(msg: string): {
    content: Array<{ type: "text"; text: string }>;
  };

  loadSessions(): Record<string, Session>;
  saveSessions(sessions: Record<string, Session>): void;
  loadGraph(): KnowledgeGraph;
  saveReport(session: Session): string;
  ensureGeneratedUiDir(): void;
  writeTextFile(path: string, content: string): void;

  calcAvgScore(evaluations: Evaluation[]): string;
  buildSummary(session: Session): string;
  pickSessionByTopic(sessions: Record<string, Session>, topic: string): Session | null;
  extractWeakSubjects(session: Session, weakScoreThreshold: number, maxSubjects: number): WeakSubject[];
  buildFullQuestionContext(session: Session, weakScoreThreshold: number): FullReportQuestionContext[];
  buildProgressOverview(sessions: Record<string, Session>, options: ProgressOverviewOptions): ProgressOverview;
  countLines(text: string): number;
  escapeHtml(value: string): string;
  serializeForInlineScript(value: unknown): string;
}
