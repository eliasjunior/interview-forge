import { asc, eq } from "drizzle-orm";
import type { TopicPlan } from "@mock-interview/shared";
import type { AppDb } from "../client.js";
import { topicPlans } from "../schema.js";
import type { TopicPlanRepository } from "../../repositories/topicPlanRepository.js";

export class SQLiteTopicPlanRepository implements TopicPlanRepository {
  constructor(private readonly db: AppDb) {}

  list(): TopicPlan[] {
    return this.db.select().from(topicPlans).orderBy(asc(topicPlans.topic)).all().map((row) => ({
      topic: row.topic,
      focused: row.focused,
      priority: row.priority as TopicPlan["priority"],
      updatedAt: row.updatedAt,
      lastLevelUpAt: row.lastLevelUpAt ?? undefined,
      lastUnlockedLevel: row.lastUnlockedLevel as TopicPlan["lastUnlockedLevel"] | undefined,
    }));
  }

  upsert(plan: TopicPlan): TopicPlan {
    this.db
      .insert(topicPlans)
      .values({
        topic: plan.topic,
        focused: plan.focused,
        priority: plan.priority,
        updatedAt: plan.updatedAt,
        lastLevelUpAt: plan.lastLevelUpAt ?? null,
        lastUnlockedLevel: plan.lastUnlockedLevel ?? null,
      })
      .onConflictDoUpdate({
        target: topicPlans.topic,
        set: {
          focused: plan.focused,
          priority: plan.priority,
          updatedAt: plan.updatedAt,
          lastLevelUpAt: plan.lastLevelUpAt ?? null,
          lastUnlockedLevel: plan.lastUnlockedLevel ?? null,
        },
      })
      .run();

    const row = this.db.select().from(topicPlans).where(eq(topicPlans.topic, plan.topic)).get();
    return {
      topic: row!.topic,
      focused: row!.focused,
      priority: row!.priority as TopicPlan["priority"],
      updatedAt: row!.updatedAt,
      lastLevelUpAt: row!.lastLevelUpAt ?? undefined,
      lastUnlockedLevel: row!.lastUnlockedLevel as TopicPlan["lastUnlockedLevel"] | undefined,
    };
  }
}
