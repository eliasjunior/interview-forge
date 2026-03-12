import type { AIProvider } from "../ai/index.js";
import type { KnowledgeStore } from "../knowledge/index.js";
import type { Concept, Evaluation, KnowledgeGraph, Session } from "@mock-interview/shared";

export type StateError = ReturnType<ToolDeps["stateError"]>;

export interface ToolDeps {
  ai: AIProvider | null;
  knowledge: KnowledgeStore;
  uiPort: string;

  stateError(msg: string): {
    content: Array<{ type: "text"; text: string }>;
  };

  loadSessions(): Record<string, Session>;
  saveSessions(sessions: Record<string, Session>): void;
  loadGraph(): KnowledgeGraph;
  saveGraph(graph: KnowledgeGraph): void;
  saveReport(session: Session): string;

  generateId(): string;
  assertState(session: Session, toolName: string): { ok: true } | { ok: false; error: string };
  findLast<T>(arr: T[], pred: (item: T) => boolean): T | undefined;
  calcAvgScore(evaluations: Evaluation[]): string;
  buildSummary(session: Session): string;

  finalizeSession(
    session: Session,
    sessions: Record<string, Session>
  ): Promise<{ summary: string; avgScore: string; concepts: Concept[]; reportFile: string }>;
}
