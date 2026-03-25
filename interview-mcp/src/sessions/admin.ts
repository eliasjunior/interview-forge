import fs from "fs";
import path from "path";
import type { AppRepositories } from "../repositories/index.js";
import { buildSessionDeletionPreview, rebuildGraphFromSessions } from "./deleteFlow.js";

export interface SessionAdminPaths {
  reportsDir: string;
  generatedUiDir: string;
}

function artifactPathsFor(sessionId: string, paths: SessionAdminPaths) {
  return {
    markdownReport: path.join(paths.reportsDir, `${sessionId}.md`),
    reportUiDataset: path.join(paths.generatedUiDir, `${sessionId}-report-ui.json`),
    weakSubjectsHtml: path.join(paths.generatedUiDir, `${sessionId}-weak-subjects.html`),
  };
}

export function inspectSessionDeletionImpact(
  repositories: AppRepositories,
  sessionId: string,
  paths: SessionAdminPaths,
) {
  const session = repositories.sessions.getById(sessionId);
  if (!session) return null;

  const flashcards = repositories.flashcards.list().filter((card) => card.source?.sessionId === sessionId);
  const graph = repositories.graph.get();
  const artifactPaths = artifactPathsFor(sessionId, paths);

  return buildSessionDeletionPreview(session, flashcards, graph, {
    markdownReport: fs.existsSync(artifactPaths.markdownReport),
    reportUiDataset: fs.existsSync(artifactPaths.reportUiDataset),
    weakSubjectsHtml: fs.existsSync(artifactPaths.weakSubjectsHtml),
  });
}

export function deleteSessionWithArtifacts(
  repositories: AppRepositories,
  sessionId: string,
  paths: SessionAdminPaths,
) {
  const preview = inspectSessionDeletionImpact(repositories, sessionId, paths);
  if (!preview) return null;

  const deletedFlashcards = repositories.flashcards.deleteBySourceSessionId(sessionId);
  repositories.sessions.deleteById(sessionId);

  const rebuiltGraph = rebuildGraphFromSessions(repositories.sessions.list());
  repositories.graph.save(rebuiltGraph);

  const deletedArtifacts: string[] = [];
  const artifactPaths = artifactPathsFor(sessionId, paths);

  for (const artifactPath of Object.values(artifactPaths)) {
    if (!fs.existsSync(artifactPath)) continue;
    fs.unlinkSync(artifactPath);
    deletedArtifacts.push(artifactPath);
  }

  return {
    preview,
    deletedFlashcards,
    deletedArtifacts,
    graph: {
      nodes: rebuiltGraph.nodes.length,
      edges: rebuiltGraph.edges.length,
      sessions: rebuiltGraph.sessions.length,
    },
  };
}
