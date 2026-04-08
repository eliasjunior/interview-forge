import type { TopicLevelSnapshot, WarmUpLevel } from "@mock-interview/shared";

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
