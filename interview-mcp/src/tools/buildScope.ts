import { z } from "zod";
import fs from "fs";
import path from "path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildScopeContent, deriveSessionGoal } from "../scope/builder.js";
import type { ToolDeps } from "./deps.js";

// ─────────────────────────────────────────────────────────────────────────────
// build_scope
//
// Interactive content builder for start_scoped_interview.
// Takes structured answers from a clarifying Q&A conversation and produces
// a focused, LLM-anchored content block that prevents drift during evaluation.
//
// Optionally saves the result to data/knowledge/scopes/<saveAs>.md so it can
// be reused without going through the clarification flow again.
// ─────────────────────────────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function registerBuildScopeTool(server: McpServer, deps: ToolDeps) {
  server.registerTool(
    "build_scope",
    {
      description: "Build a focused content block for start_scoped_interview from structured inputs. " +
      "Use this after a clarifying Q&A conversation where the candidate has narrowed down " +
      "a broad topic into specific focus areas, weak spots, and depth. " +
      "Optionally saves the result as a reusable .md file so the same scope can be " +
      "launched again without repeating the clarification flow.",
      inputSchema: {
        topic: z.string().min(1)
          .describe("The narrowed-down topic, e.g. 'JavaScript Runtime — Event Loop'"),
        focusAreas: z.preprocess(
          (v) => typeof v === "string" ? JSON.parse(v) : v,
          z.array(z.string()).min(1)
        ).describe("Specific areas to cover in order of priority, e.g. ['event loop', 'call stack', 'microtask queue']"),
        weakSpots: z.preprocess(
          (v) => typeof v === "string" ? JSON.parse(v) : v,
          z.array(z.string()).default([])
        ).describe("Areas the candidate has flagged as weak — LLM will probe these harder"),
        depth: z.enum(["conceptual", "implementation", "trace-through-code", "mixed"]).default("mixed")
          .describe("Expected answer depth: conceptual | implementation | trace-through-code | mixed"),
        outOfScope: z.preprocess(
          (v) => typeof v === "string" ? JSON.parse(v) : v,
          z.array(z.string()).default([])
        ).describe("Topics to explicitly exclude so the LLM does not drift, e.g. ['DOM APIs', 'Node.js internals']"),
        sessionGoal: z.string().optional()
          .describe("What a successful session looks like. Auto-derived from focusAreas if omitted."),
        saveAs: z.string().optional()
          .describe("Slug to save this scope as a reusable file, e.g. 'js-event-loop'. Omit to skip saving."),
      },
    },
    async ({ topic, focusAreas, weakSpots, depth, outOfScope, sessionGoal, saveAs }) => {
      const goal = sessionGoal ?? deriveSessionGoal(topic, focusAreas, depth);

      const content = buildScopeContent({
        topic,
        focusAreas,
        weakSpots,
        depth,
        outOfScope,
        sessionGoal: goal,
      });

      // ── Save to file if requested ────────────────────────────────────────────
      let savedTo: string | null = null;
      if (saveAs) {
        const slug = toSlug(saveAs);
        if (!fs.existsSync(deps.scopesDir)) {
          fs.mkdirSync(deps.scopesDir, { recursive: true });
        }
        savedTo = path.join(deps.scopesDir, `${slug}.md`);
        fs.writeFileSync(savedTo, content, "utf-8");
        console.error(`[build_scope] saved scope to ${savedTo}`);
      }

      const focusParam = focusAreas.join(", ");

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            topic,
            depth,
            focusAreas,
            weakSpots,
            savedTo,
            content,
            suggestedFocus: focusParam,
            instruction:
              "IMPORTANT — do the following now: " +
              "(1) Call start_scoped_interview with the 'content' field above as the content parameter " +
              `and focus='${focusParam}'. ` +
              "(2) Do NOT summarise or repeat the scope back to the candidate — go straight into the interview. " +
              "(3) During the interview, stay strictly within the Focus Areas. " +
              "If the candidate drifts into Out of Scope territory, redirect them. " +
              "(4) Probe Known Weak Spots with at least one follow-up question each. " +
              (savedTo
                ? `(5) This scope was saved to '${savedTo}' — next time use start_scoped_interview directly with that file's content.`
                : "(5) If this scope is useful for future sessions, call build_scope again with saveAs to persist it."),
          }, null, 2),
        }],
      };
    }
  );
}
