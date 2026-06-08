import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runCodeChallenge } from "../codeExecution/runner.js";
import type { ToolDeps } from "./deps.js";

export function registerRunCodeTool(server: McpServer, deps: ToolDeps) {
  server.registerTool(
    "run_code",
    {
      description:
        "Compile and run candidate code against the private tests attached to a code-interview session. " +
        "Return execution feedback only; never reveal the private harness or reference solution. " +
        "Use failures as teaching evidence: explain the likely category, ask the candidate to diagnose it, then offer one hint if needed.",
      inputSchema: {
        sessionId: z.string(),
        code: z.string().min(1),
      },
    },
    async ({ sessionId, code }) => {
      if (!deps.getCodeChallenge) {
        return deps.stateError("Code challenge storage is unavailable.");
      }
      const challenge = deps.getCodeChallenge(sessionId);
      if (!challenge) {
        return deps.stateError(
          `No executable challenge exists for session '${sessionId}'. Call configure_code_challenge first.`,
        );
      }

      const run = await runCodeChallenge(challenge, code);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            sessionId,
            language: challenge.language,
            run,
            instruction: run.ok
              ? "All tests passed. Ask the candidate to explain complexity and one trade-off before finishing."
              : "Do not reveal the private tests or reference solution. Ask the candidate to interpret the compile/test output first, then provide at most one progressive hint.",
          }, null, 2),
        }],
      };
    },
  );
}
