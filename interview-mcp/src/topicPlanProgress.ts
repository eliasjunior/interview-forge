import type { Session, TopicLevelSnapshot, WarmUpLevel } from "@mock-interview/shared";
import { detectTopicLevel } from "./tools/getTopicLevel.js";

export function shouldRecordTopicLevelUp(params: {
  previousSnapshot: TopicLevelSnapshot;
  currentSnapshot: TopicLevelSnapshot;
  previousStoredLevel?: WarmUpLevel;
  currentStoredLevel: WarmUpLevel;
}): boolean {
  const { previousSnapshot, currentSnapshot, previousStoredLevel, currentStoredLevel } = params;

  const previousPersisted = previousStoredLevel ?? 0;
  const sessionUnlockedNewLevel = currentSnapshot.level > previousSnapshot.level;
  const storedLevelAdvanced = currentStoredLevel > previousPersisted;

  return sessionUnlockedNewLevel && storedLevelAdvanced;
}

export function inferLastLevelUpAt(params: {
  topic: string;
  sessions: Record<string, Session>;
  hasWarmupContent: boolean;
}): string | undefined {
  const { topic, sessions, hasWarmupContent } = params;
  const normalise = (value: string) => value.toLowerCase().replace(/[\s\-_]+/g, "");
  const topicNorm = normalise(topic);

  const orderedTopicSessions = Object.values(sessions)
    .filter((session) => normalise(session.topic) === topicNorm && session.state === "ENDED")
    .sort((a, b) => {
      const timeA = new Date(a.endedAt ?? a.createdAt).getTime();
      const timeB = new Date(b.endedAt ?? b.createdAt).getTime();
      return timeA - timeB;
    });

  let simulatedSessions: Record<string, Session> = {};
  let previousStoredLevel: WarmUpLevel | undefined;
  let lastLevelUpAt: string | undefined;

  for (const session of orderedTopicSessions) {
    const previousSnapshot = detectTopicLevel(topic, simulatedSessions, hasWarmupContent);
    simulatedSessions = { ...simulatedSessions, [session.id]: session };
    const currentSnapshot = detectTopicLevel(topic, simulatedSessions, hasWarmupContent);
    const currentStoredLevel = Math.max(previousStoredLevel ?? 0, currentSnapshot.level) as WarmUpLevel;

    if (shouldRecordTopicLevelUp({
      previousSnapshot,
      currentSnapshot,
      previousStoredLevel,
      currentStoredLevel,
    })) {
      lastLevelUpAt = session.endedAt ?? session.createdAt;
    }

    previousStoredLevel = currentStoredLevel;
  }

  return lastLevelUpAt;
}
