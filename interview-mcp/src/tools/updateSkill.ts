import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolDeps } from "./deps.js";

export function registerUpdateSkillTool(server: McpServer, deps: ToolDeps) {
  server.registerTool(
    "update_skill",
    {
      description: "Update confidence on a skill or one of its sub-skills after a drill. " +
      "If subSkill is provided, updates that sub-skill's confidence and recalculates the overall skill confidence as the average. " +
      "If only confidence is provided, updates the overall skill confidence directly.",
      inputSchema: {
        name: z.string().min(1).describe("Skill name, e.g. '2D index transformations'"),
        confidence: z.number().int().min(1).max(5).describe("New confidence rating 1–5"),
        subSkill: z.string().optional().describe("Sub-skill name to update. If omitted, updates the overall skill confidence."),
      },
    },
    async ({ name, confidence, subSkill }) => {
      const skill = deps.findSkillByName(name);
      if (!skill) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ error: `Skill "${name}" not found. Use add_skill first.` }),
          }],
        };
      }

      const now = new Date().toISOString();

      if (subSkill) {
        const idx = skill.subSkills.findIndex((s) => s.name.toLowerCase() === subSkill.toLowerCase());
        if (idx === -1) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ error: `Sub-skill "${subSkill}" not found in "${name}".`, availableSubSkills: skill.subSkills.map((s) => s.name) }),
            }],
          };
        }
        skill.subSkills[idx].confidence = confidence;
        // Recalculate overall confidence as average of sub-skills
        const avg = skill.subSkills.reduce((sum, s) => sum + s.confidence, 0) / skill.subSkills.length;
        skill.confidence = Math.round(avg);
      } else {
        skill.confidence = confidence;
      }

      skill.updatedAt = now;
      deps.updateSkill(skill);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ updated: true, skill }),
        }],
      };
    }
  );
}
