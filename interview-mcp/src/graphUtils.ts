import type { Concept, KnowledgeGraph } from "@mock-interview/shared";
import {
  canonicalizeConceptWord,
  deriveSemanticConceptEdges,
  filterGraphNodeConcepts,
  normalizeConcepts,
} from "./graph/concepts.js";

// ─────────────────────────────────────────────
// Graph merge
// ─────────────────────────────────────────────

export function mergeConceptsIntoGraph(
  graph: KnowledgeGraph,
  concepts: Concept[],
  sessionId: string
): KnowledgeGraph {
  const incrementEdge = (
    sourceId: string,
    targetId: string,
    kind: "cooccurrence" | "semantic",
    relation: string
  ) => {
    const [source, target] = [sourceId, targetId].sort();
    const existing = graph.edges.find(
      (edge) =>
        edge.source === source &&
        edge.target === target &&
        edge.kind === kind &&
        edge.relation === relation
    );
    if (existing) existing.weight++;
    else graph.edges.push({ source, target, weight: 1, kind, relation });
  };

  const normalizedConcepts = normalizeConcepts(concepts);
  const graphNodeConcepts = filterGraphNodeConcepts(normalizedConcepts);

  for (const concept of graphNodeConcepts) {
    const canonical = canonicalizeConceptWord(concept.word);
    const id = canonical.id;
    const existing = graph.nodes.find((n) => n.id === id);
    if (existing) {
      if (!existing.clusters.includes(concept.cluster)) {
        existing.clusters.push(concept.cluster);
      }
      existing.label = canonical.label;
    } else {
      graph.nodes.push({ id, label: canonical.label, clusters: [concept.cluster] });
    }
  }

  const clusterMap: Record<string, string[]> = {};
  for (const c of graphNodeConcepts) {
    if (!clusterMap[c.cluster]) {
      clusterMap[c.cluster] = [];
    }
    clusterMap[c.cluster].push(canonicalizeConceptWord(c.word).id);
  }

  for (const words of Object.values(clusterMap)) {
    for (let i = 0; i < words.length; i++) {
      for (let j = i + 1; j < words.length; j++) {
        incrementEdge(words[i], words[j], "cooccurrence", "co-occurs-with");
      }
    }
  }

  const clustersByWord = new Map<string, Set<string>>();
  for (const concept of graphNodeConcepts) {
    const id = canonicalizeConceptWord(concept.word).id;
    const clusters = clustersByWord.get(id) ?? new Set<string>();
    clusters.add(concept.cluster);
    clustersByWord.set(id, clusters);
  }

  const uniqueWords = Array.from(clustersByWord.keys()).sort();
  for (let i = 0; i < uniqueWords.length; i++) {
    for (let j = i + 1; j < uniqueWords.length; j++) {
      const source = uniqueWords[i];
      const target = uniqueWords[j];
      const sourceClusters = clustersByWord.get(source)!;
      const targetClusters = clustersByWord.get(target)!;
      const sharesCluster = Array.from(sourceClusters).some((cluster) =>
        targetClusters.has(cluster)
      );

      // Add a weaker bridge whenever concepts co-occur in the same session
      // but never share a cluster. This keeps related areas connected.
      if (!sharesCluster) {
        incrementEdge(source, target, "cooccurrence", "co-occurs-with");
      }
    }
  }

  for (const semanticEdge of deriveSemanticConceptEdges(normalizedConcepts)) {
    incrementEdge(
      semanticEdge.source,
      semanticEdge.target,
      "semantic",
      semanticEdge.relation
    );
  }

  if (!graph.sessions.includes(sessionId)) graph.sessions.push(sessionId);
  return graph;
}
