import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { StoredCodeChallenge } from "../repositories/codeChallengeRepository.js";
import { replaceProblemStatement } from "../codeChallenges/problemDefinition.js";
import type { ToolDeps } from "./deps.js";

export function registerConfigureCodeChallengeTool(server: McpServer, deps: ToolDeps) {
  server.registerTool(
    "configure_code_challenge",
    {
      description:
        "Attach an executable challenge to an existing code-interview session. " +
        "Generate a candidate-facing LeetCode-style problem statement with input/output examples and constraints, " +
        "plus starter code, sample tests, progressive hints, a correct private reference solution, " +
        "and a private test harness. The reference solution and harness are stored server-side and are never returned. " +
        "Java challenges must use a Solution class and provide a package-private TestRunner with main() as the separate harness. " +
        "JavaScript challenges must define the requested function/object and append a CommonJS-compatible harness. " +
        "Harnesses should print concise PASS/FAIL lines and exit non-zero on failure without revealing hidden inputs.",
      inputSchema: {
        sessionId: z.string(),
        language: z.enum(["javascript", "java"]),
        problemStatement: z.string().min(20)
          .describe("Clear candidate-facing description of the task. Do not include the solution or evaluator guidance."),
        examples: z.array(z.object({
          input: z.string().min(1),
          output: z.string().min(1),
          explanation: z.string().optional(),
        })).min(2).max(5)
          .describe("Basic LeetCode-style examples. Include at least one normal case and one useful edge or negative case."),
        constraints: z.array(z.string().min(1)).min(1).max(12)
          .describe("Candidate-facing input constraints and assumptions."),
        functionSignature: z.string().min(1),
        starterCode: z.string().min(1),
        sampleTests: z.array(z.string()).min(1),
        hints: z.array(z.string()).min(1).max(5),
        hiddenTestCount: z.number().int().min(1).max(100),
        testHarness: z.string().min(1).describe("Private executable harness appended to candidate code. Never show this to the candidate."),
        referenceSolution: z.string().min(1).describe("Private correct solution used by the teacher for reasoning. Never show this to the candidate."),
        teacherNotes: z.string().default("").describe("Private coaching notes: likely mistakes, challenge progression, and when to offer each hint."),
      },
    },
    async ({
      sessionId,
      language,
      problemStatement,
      examples,
      constraints,
      functionSignature,
      starterCode,
      sampleTests,
      hints,
      hiddenTestCount,
      testHarness,
      referenceSolution,
      teacherNotes,
    }) => {
      const sessions = deps.loadSessions();
      const session = sessions[sessionId];
      if (!session) return deps.stateError(`Session '${sessionId}' not found.`);
      if (session.interviewType !== "code") {
        return deps.stateError(`Session '${sessionId}' is not a code interview.`);
      }
      if (!deps.getCodeChallenge || !deps.saveCodeChallenge) {
        return deps.stateError("Code challenge storage is unavailable.");
      }

      const now = new Date().toISOString();
      const existing = deps.getCodeChallenge(sessionId);
      const challenge: StoredCodeChallenge = {
        sessionId,
        language,
        functionSignature,
        starterCode,
        sampleTests,
        hints,
        hiddenTestCount,
        testHarness,
        referenceSolution,
        teacherNotes,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      deps.saveCodeChallenge(challenge);

      session.customContent = replaceProblemStatement(session.customContent, {
        problemStatement,
        examples,
        constraints,
      });
      sessions[sessionId] = session;
      deps.saveSessions(sessions);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            configured: true,
            problemDefinition: {
              problemStatement,
              examples,
              constraints,
            },
            challenge: {
              sessionId,
              language,
              functionSignature,
              starterCode,
              sampleTests,
              hints,
              hiddenTestCount,
              createdAt: challenge.createdAt,
              updatedAt: challenge.updatedAt,
            },
            privateArtifactsStored: {
              referenceSolution: true,
              testHarness: true,
              teacherNotes: Boolean(teacherNotes),
            },
            instruction:
              "Do not print the reference solution or test harness. Tell the candidate the executable challenge is ready. " +
              "Present the persisted problem statement and examples, then teach progressively: ask for an approach first, " +
              "let them run code, interpret failures, offer one hint at a time, " +
              "and only discuss the complete solution after the candidate finishes or explicitly gives up.",
          }, null, 2),
        }],
      };
    },
  );
}
