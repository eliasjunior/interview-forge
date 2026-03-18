import type { KnowledgeGraph, Session } from "@mock-interview/shared";

export interface ReportDataStore {
  loadSessions(): Record<string, Session>;
  saveSessions(sessions: Record<string, Session>): void;
  loadGraph(): KnowledgeGraph;
}
