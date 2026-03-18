import type { KnowledgeGraph } from "@mock-interview/shared";

export interface GraphRepository {
  get(): KnowledgeGraph;
  save(graph: KnowledgeGraph): void;
}
