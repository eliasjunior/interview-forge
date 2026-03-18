import { createDb } from "./client.js";
import { createSqliteRepositories } from "./repositories/createRepositories.js";
import { mergeConceptsIntoGraph } from "../interviewUtils.js";
import type { KnowledgeGraph } from "@mock-interview/shared";

const db = createDb();
const repositories = createSqliteRepositories(db);

let graph: KnowledgeGraph = { nodes: [], edges: [], sessions: [] };
for (const session of repositories.sessions.list()) {
  if (!session.concepts || session.concepts.length === 0) continue;
  graph = mergeConceptsIntoGraph(
    { nodes: [...graph.nodes], edges: [...graph.edges], sessions: [...graph.sessions] },
    session.concepts,
    session.id
  );
}

repositories.graph.save(graph);

console.log(
  JSON.stringify(
    {
      ok: true,
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      sessions: graph.sessions.length,
    },
    null,
    2
  )
);
