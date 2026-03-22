import type { Concept } from "@mock-interview/shared";

export interface CanonicalConcept {
  id: string;
  label: string;
}

export interface NormalizedConcept extends Concept {
  word: string;
  rawWord: string;
}

export interface SemanticConceptEdge {
  source: string;
  target: string;
  relation: string;
}

const SEMANTIC_ONLY_CONCEPT_IDS = new Set([
  "classify-jvm-vs-app-threads",
  "move-io-outside-lock",
  "never-async-then-block",
  "return-async-from-controller",
  "use-bigdecimal-for-money",
  "use-heap-dump-for-memory",
  "use-thread-dump-for-contention",
]);

interface CanonicalConceptSeed extends CanonicalConcept {
  aliases: string[];
}

const CANONICAL_CONCEPTS: CanonicalConceptSeed[] = [
  {
    id: "thread-dump",
    label: "Thread Dump",
    aliases: ["thread-dump", "thread dump", "thread dumps"],
  },
  {
    id: "heap-dump",
    label: "Heap Dump",
    aliases: ["heap-dump", "heap dump", "heap dumps"],
  },
  {
    id: "lock-contention",
    label: "Lock Contention",
    aliases: ["lock-contention", "lock contention", "thread contention", "contention"],
  },
  {
    id: "thread-state",
    label: "Thread State",
    aliases: ["thread-state", "thread state", "thread states"],
  },
  {
    id: "thread-count-vs-state",
    label: "Thread Count vs State",
    aliases: ["thread-count-vs-state", "thread count vs state"],
  },
  {
    id: "gc-thread",
    label: "GC Thread",
    aliases: ["gc-thread", "gc thread", "gc threads"],
  },
  {
    id: "jvm-internal-threads",
    label: "JVM Internal Threads",
    aliases: ["jvm-internal-threads", "jvm internal threads", "jvm threads"],
  },
  {
    id: "app-threads",
    label: "App Threads",
    aliases: ["app-threads", "app threads", "application threads"],
  },
  {
    id: "heap",
    label: "Heap",
    aliases: ["heap", "memory"],
  },
];

const conceptsByAlias = new Map<string, CanonicalConcept>();
for (const concept of CANONICAL_CONCEPTS) {
  for (const alias of concept.aliases) {
    conceptsByAlias.set(normalizeAliasKey(alias), {
      id: concept.id,
      label: concept.label,
    });
  }
}

function normalizeAliasKey(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"`]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

export function isSemanticOnlyConcept(word: string): boolean {
  return SEMANTIC_ONLY_CONCEPT_IDS.has(normalizeAliasKey(word));
}

export function canonicalizeConceptWord(word: string): CanonicalConcept {
  const normalized = normalizeAliasKey(word);
  const known = conceptsByAlias.get(normalized);
  if (known) return known;

  return {
    id: normalized,
    label: word.trim(),
  };
}

export function normalizeConcepts(concepts: Concept[]): NormalizedConcept[] {
  const seen = new Set<string>();
  const normalizedConcepts: NormalizedConcept[] = [];

  for (const concept of concepts) {
    const canonical = canonicalizeConceptWord(concept.word);
    const dedupeKey = `${canonical.id}::${concept.cluster}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    normalizedConcepts.push({
      word: canonical.label,
      rawWord: concept.word,
      cluster: concept.cluster,
    });
  }

  return normalizedConcepts;
}

export function filterGraphNodeConcepts(concepts: NormalizedConcept[]): NormalizedConcept[] {
  return concepts.filter((concept) => !isSemanticOnlyConcept(concept.rawWord));
}

function buildSemanticPatternEdges(
  concepts: NormalizedConcept[],
  graphNodeIds: Set<string>
): SemanticConceptEdge[] {
  const edges = new Map<string, SemanticConceptEdge>();

  for (const concept of concepts) {
    const rawKey = normalizeAliasKey(concept.rawWord);

    if (rawKey.startsWith("use-") && rawKey.includes("-for-")) {
      const withoutPrefix = rawKey.slice(4);
      const [toolPart, targetPart] = withoutPrefix.split("-for-", 2);
      if (!toolPart || !targetPart) continue;

      const tool = canonicalizeConceptWord(toolPart);
      const target = canonicalizeConceptWord(targetPart);
      const edge = normalizeSemanticEdge({
        source: tool.id,
        target: target.id,
        relation: "used-for",
      });
      if (!graphNodeIds.has(edge.source) || !graphNodeIds.has(edge.target)) continue;
      edges.set(`${edge.source}::${edge.target}::${edge.relation}`, edge);
      continue;
    }

    if (rawKey.startsWith("classify-") && rawKey.includes("-vs-")) {
      const edge = normalizeSemanticEdge({
        source: "jvm-internal-threads",
        target: "app-threads",
        relation: "contrasts-with",
      });
      if (!graphNodeIds.has(edge.source) || !graphNodeIds.has(edge.target)) continue;
      edges.set(`${edge.source}::${edge.target}::${edge.relation}`, edge);
    }
  }

  return [...edges.values()];
}

function buildSemanticAssociationEdges(graphNodeIds: Set<string>): SemanticConceptEdge[] {
  const edges = new Map<string, SemanticConceptEdge>();

  const addEdgeIfPresent = (source: string, target: string, relation: string) => {
    if (!graphNodeIds.has(source) || !graphNodeIds.has(target)) return;
    const edge = normalizeSemanticEdge({ source, target, relation });
    edges.set(`${edge.source}::${edge.target}::${edge.relation}`, edge);
  };

  addEdgeIfPresent("thread-dump", "lock-contention", "diagnoses");
  addEdgeIfPresent("thread-dump", "thread-state", "inspects");
  addEdgeIfPresent("heap-dump", "heap", "inspects");

  return [...edges.values()];
}

export function deriveSemanticConceptEdges(concepts: NormalizedConcept[]): SemanticConceptEdge[] {
  const graphNodeIds = new Set(
    filterGraphNodeConcepts(concepts).map((concept) => canonicalizeConceptWord(concept.word).id)
  );
  const edges = new Map<string, SemanticConceptEdge>();
  for (const edge of [
    ...buildSemanticPatternEdges(concepts, graphNodeIds),
    ...buildSemanticAssociationEdges(graphNodeIds),
  ]) {
    edges.set(`${edge.source}::${edge.target}::${edge.relation}`, edge);
  }
  return [...edges.values()];
}

function normalizeSemanticEdge(edge: SemanticConceptEdge): SemanticConceptEdge {
  const [source, target] = [edge.source, edge.target].sort();
  return {
    source,
    target,
    relation: edge.relation,
  };
}
