import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { reviewKnowledgeFile } from "../knowledge/review.js";
import type { ToolDeps } from "./deps.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = path.resolve(__dirname, "../../data/knowledge");

function listKnowledgeMarkdownFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listKnowledgeMarkdownFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(fullPath);
    }
  }
  return results;
}

export function registerReviewKnowledgeFileTool(server: McpServer, deps: ToolDeps) {
  server.registerTool(
    "review_knowledge_file",
    {
      description:
        "Review a curated knowledge markdown file under data/knowledge/. Parses the authored questions, " +
        "checks rubric/difficulty alignment, flags obvious issues, and returns a structured review packet " +
        "for the user to mark each question as keep, needs_improvement, or remove.",
      inputSchema: {
        filePath: z.string().optional().describe(
          "Path to the knowledge markdown file, relative to interview-mcp/data/knowledge/. " +
          "Example: 'java-concurrency.md' or 'algorithm/interview_prep_matrix_fundamentals_with_exercises.md'."
        ),
        topic: z.string().optional().describe(
          "Optional topic name. If filePath is omitted, the tool resolves this by matching the curated knowledge store."
        ),
      },
    },
    async ({ filePath, topic }) => {
      if (filePath && topic) {
        return deps.stateError("Provide filePath OR topic, not both.");
      }

      let resolvedPath: string | null = null;

      if (filePath) {
        resolvedPath = path.resolve(KNOWLEDGE_DIR, filePath);
      } else if (topic) {
        const match = deps.knowledge.findByTopic(topic);
        if (!match) {
          return deps.stateError(`Topic '${topic}' not found in curated knowledge files.`);
        }

        const candidates = listKnowledgeMarkdownFiles(KNOWLEDGE_DIR);
        resolvedPath = candidates.find((candidate) => reviewKnowledgeFile(candidate)?.topic === match.topic) ?? null;

        if (!resolvedPath) {
          return deps.stateError(
            `Could not resolve a markdown file for topic '${topic}'. Pass filePath explicitly relative to data/knowledge/.`
          );
        }
      } else {
        return deps.stateError("Provide filePath or topic.");
      }

      const review = reviewKnowledgeFile(resolvedPath);
      if (!review) {
        return deps.stateError(
          `Could not parse knowledge file '${resolvedPath}'. Make sure it exists under data/knowledge/ and contains a ## Questions section.`
        );
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            ...review,
            nextStep: {
              action: "user_review",
              instruction:
                "Show the numbered questions to the user and ask them to mark each one as keep, needs_improvement, or remove. " +
                "Capture short notes for any question marked needs_improvement so a follow-up edit tool can rewrite the file safely.",
              statuses: ["keep", "needs_improvement", "remove"],
            },
          }, null, 2),
        }],
      };
    }
  );
}
