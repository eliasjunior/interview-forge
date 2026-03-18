import type { KnowledgeGraph } from "@mock-interview/shared";
import type { GraphRepository } from "../../repositories/graphRepository.js";
import type { AppDb } from "../client.js";
import { graphEdges, graphNodeClusters, graphNodes, graphSessions } from "../schema.js";
import { mapGraphAggregateToDomain, mapGraphToNormalizedRecord } from "../../repositories/mappers.js";

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

      if (record.nodes.length) tx.insert(graphNodes).values(record.nodes).run();
      if (record.nodeClusters.length) tx.insert(graphNodeClusters).values(record.nodeClusters).run();
      if (record.edges.length) tx.insert(graphEdges).values(record.edges).run();
      if (record.sessions.length) tx.insert(graphSessions).values(record.sessions).run();
    });
  }
}
