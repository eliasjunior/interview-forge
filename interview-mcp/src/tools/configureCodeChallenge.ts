import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { StoredCodeChallenge } from "../repositories/codeChallengeRepository.js";
import type { ToolDeps } from "./deps.js";

export function registerConfigureCodeChallengeTool(server: McpServer, deps: ToolDeps) {
  server.registerTool(
    "configure_code_challenge",
    {
      description:
        "Attach an executable challenge to an existing code-interview session. " +
        "Generate starter code, sample tests, progressive hints, a correct private reference solution, " +
        "and a private test harness. The reference solution and harness are stored server-side and are never returned. " +
        "Java challenges must use a Solution class and provide a package-private TestRunner with main() as the separate harness. " +
        "JavaScript challenges must define the requested function/object and append a CommonJS-compatible harness. " +
        "Harnesses should print concise PASS/FAIL lines and exit non-zero on failure without revealing hidden inputs.",
      inputSchema: {
        sessionId: z.string(),
        language: z.enum(["javascript", "java"]),
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
      functionSignature,
      starterCode,
      sampleTests,
      hints,
      hiddenTestCount,
      testHarness,
      referenceSolution,
      teacherNotes,
    }) => {
      const session = deps.loadSessions()[sessionId];
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

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            configured: true,
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
              "Teach progressively: ask for an approach first, let them run code, interpret failures, offer one hint at a time, " +
              "and only discuss the complete solution after the candidate finishes or explicitly gives up.",
          }, null, 2),
        }],
      };
    },
  );
}
