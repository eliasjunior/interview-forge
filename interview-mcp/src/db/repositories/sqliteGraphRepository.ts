import type { KnowledgeGraph } from "@mock-interview/shared";
import type { GraphRepository } from "../../repositories/graphRepository.js";
import type { AppDb } from "../client.js";
import { graphEdges, graphNodeClusters, graphNodes, graphSessions } from "../schema.js";
import { mapGraphAggregateToDomain, mapGraphToNormalizedRecord } from "../../repositories/mappers.js";

function chunks<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

export class SQLiteGraphRepository implements GraphRepository {
  constructor(private readonly db: AppDb) {}

  get(): KnowledgeGraph {
    return mapGraphAggregateToDomain({
      nodes: this.db.select().from(graphNodes).all(),
      nodeClusters: this.db.select().from(graphNodeClusters).all(),
      edges: this.db.select().from(graphEdges).all(),
      sessions: this.db.select().from(graphSessions).all(),
    });
  }

  save(graph: KnowledgeGraph): void {
    const record = mapGraphToNormalizedRecord(graph);

    this.db.transaction((tx) => {
      tx.delete(graphNodeClusters).run();
      tx.delete(graphEdges).run();
      tx.delete(graphSessions).run();
      tx.delete(graphNodes).run();

      for (const batch of chunks(record.nodes, 499)) tx.insert(graphNodes).values(batch).run();
      for (const batch of chunks(record.nodeClusters, 499)) tx.insert(graphNodeClusters).values(batch).run();
      for (const batch of chunks(record.edges, 199)) tx.insert(graphEdges).values(batch).run();
      for (const batch of chunks(record.sessions, 999)) tx.insert(graphSessions).values(batch).run();
    });
  }
}
