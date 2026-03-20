import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolDeps } from "./deps.js";

export function registerAddSkillTool(server: McpServer, deps: ToolDeps) {
  server.tool(
    "add_skill",
    "Add a transferable micro-skill to the skill backlog. " +
    "Skills are atomic, reusable abilities (e.g. '2D index transformations') that appear across multiple problems. " +
    "Breaks the skill into sub-skills, each with its own confidence rating.",
    {
      name: z.string().min(1).describe("Transferable skill name, e.g. '2D index transformations'"),
      subSkills: z.array(z.string()).min(1).describe("Atomic sub-skills, e.g. ['layer boundaries', 'coordinate mapping', 'offset reasoning']"),
      relatedProblems: z.array(z.string()).default([]).describe("Problems where this skill appears, e.g. ['rotate matrix', 'spiral matrix']"),
      confidence: z.number().int().min(1).max(5).default(1).describe("Overall confidence 1–5 (default 1 = just identified)"),
    },
    async ({ name, subSkills, relatedProblems, confidence }) => {
      const existing = deps.findSkillByName(name);
      if (existing) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              error: `Skill "${name}" already exists. Use update_skill to change confidence or add sub-skills.`,
              existing,
            }),
          }],
        };
      }

      const now = new Date().toISOString();
      const skill = {
        id: deps.generateId(),
        name,
        confidence,
        subSkills: subSkills.map((s) => ({ name: s, confidence })),
        relatedProblems,
        createdAt: now,
        updatedAt: now,
      };

      deps.saveSkill(skill);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ added: true, skill }),
        }],
      };
    }
  );
}
