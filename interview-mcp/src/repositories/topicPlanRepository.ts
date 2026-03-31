import type { TopicPlan } from "@mock-interview/shared";

export interface TopicPlanRepository {
  list(): TopicPlan[];
  upsert(plan: TopicPlan): TopicPlan;
}
