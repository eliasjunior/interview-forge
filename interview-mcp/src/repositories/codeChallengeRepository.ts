import type { CodeChallenge, CodeChallengeLanguage } from "@mock-interview/shared";

export interface StoredCodeChallenge extends CodeChallenge {
  testHarness: string;
  referenceSolution: string;
  teacherNotes: string;
}

export interface CodeChallengeRepository {
  getBySessionId(sessionId: string): StoredCodeChallenge | null;
  upsert(challenge: StoredCodeChallenge): void;
}

export type { CodeChallengeLanguage };
