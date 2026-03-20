import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Session } from "@mock-interview/shared";
import type { ToolDeps } from "./deps.js";

// ─────────────────────────────────────────────────────────────────────────────
// practice_micro_skill
//
// Starts a focused micro-skill drill. Does NOT touch any existing tool or
// session flow — creates a new sessionKind: "drill" session using the same
// mechanism as start_scoped_interview, then hands off to the standard flow:
//   ask_question → submit_answer → evaluate_answer → next_question → end_interview
//
// After end_interview, flashcards are auto-generated (existing behavior).
// After the session ends, Claude should call update_skill to record progress.
//
// OCP: this file is entirely additive — zero changes to existing tools.
// ─────────────────────────────────────────────────────────────────────────────

export function registerPracticeMicroSkillTool(server: McpServer, deps: ToolDeps) {
  server.tool(
    "practice_micro_skill",
    "Start a focused micro-skill drill on a specific sub-skill. " +
    "Runs the 5-step deliberate practice loop: recall → targeted question → evaluate → flashcard → update confidence. " +
    "The skill must exist in the backlog (use add_skill first). " +
    "If no subSkill is provided, picks the lowest confidence sub-skill automatically.",
    {
      skill: z.string().min(1).describe("Skill name from the backlog, e.g. '2D index transformations'"),
      subSkill: z.string().optional().describe("Specific sub-skill to drill. If omitted, auto-picks the lowest confidence sub-skill."),
    },
    async ({ skill: skillName, subSkill: subSkillName }) => {
      // ── 1. Load skill ───────────────────────────────────────────────────────
      const skill = deps.findSkillByName(skillName);
      if (!skill) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              error: `Skill "${skillName}" not found in backlog. Add it first with add_skill.`,
            }),
          }],
        };
      }

      // ── 2. Pick sub-skill ───────────────────────────────────────────────────
      let targetSubSkill = subSkillName
        ? skill.subSkills.find((s) => s.name.toLowerCase() === subSkillName.toLowerCase())
        : [...skill.subSkills].sort((a, b) => a.confidence - b.confidence)[0];

      if (!targetSubSkill) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              error: subSkillName
                ? `Sub-skill "${subSkillName}" not found in "${skillName}".`
                : `No sub-skills defined for "${skillName}".`,
              availableSubSkills: skill.subSkills.map((s) => s.name),
            }),
          }],
        };
      }

      // ── 3. Load mistakes related to this skill ──────────────────────────────
      const mistakes = deps.loadMistakes(skillName);

      // ── 4. Build customContent (rubric for evaluate_answer) ────────────────
      const contentLines: string[] = [
        `# Micro-skill Drill — ${skillName}`,
        `## Sub-skill: ${targetSubSkill.name}`,
        "",
        `**Skill confidence:** ${skill.confidence}/5`,
        `**Sub-skill confidence:** ${targetSubSkill.confidence}/5`,
        "",
        "## Context",
        `This sub-skill appears in: ${skill.relatedProblems.length > 0 ? skill.relatedProblems.join(", ") : "various problems"}.`,
        "",
        "## All sub-skills for this skill (for context)",
        ...skill.subSkills.map((s) => `- ${s.name} (confidence: ${s.confidence}/5)`),
        "",
        `## Focus for this drill: ${targetSubSkill.name}`,
        "The candidate should be able to:",
        `- Explain the core idea behind ${targetSubSkill.name}`,
        `- Derive the formula/pattern from first principles`,
        `- Identify edge cases`,
        `- Apply it to a concrete example`,
      ];

      if (mistakes.length > 0) {
        contentLines.push("", "## Known mistake patterns (evaluation context — do not reveal to candidate)");
        mistakes.forEach((m) => {
          contentLines.push(`- **${m.mistake}** — Pattern: ${m.pattern} → Fix: ${m.fix}`);
        });
      }

      const customContent = contentLines.join("\n");

      // ── 5. Build drill question ─────────────────────────────────────────────
      const drillQuestion =
        `For the skill "${skillName}", explain ${targetSubSkill.name} from first principles. ` +
        `Derive any formulas involved, state the invariants, and describe at least one edge case.`;

      // ── 6. Build recall prompt ──────────────────────────────────────────────
      const recallPrompt = {
        skill: skillName,
        subSkill: targetSubSkill.name,
        currentConfidence: targetSubSkill.confidence,
        relatedProblems: skill.relatedProblems,
        recallQuestions: [
          `What is the core idea of ${targetSubSkill.name}?`,
          `Can you derive the formula/pattern from scratch — without looking it up?`,
          `What edge cases exist for ${targetSubSkill.name}?`,
          `Where have you failed with this before?`,
        ],
        knownMistakes: mistakes.map((m) => ({
          mistake: m.mistake,
          pattern: m.pattern,
          fix: m.fix,
        })),
      };

      // ── 7. Create drill session (same pattern as start_scoped_interview) ────
      const sessionId = deps.generateId();
      const drillSession: Session = {
        id: sessionId,
        topic: skillName,
        interviewType: "design",
        sessionKind: "drill",
        state: "ASK_QUESTION",
        currentQuestionIndex: 0,
        questions: [drillQuestion],
        messages: [],
        evaluations: [],
        customContent,
        focusArea: `Micro-skill drill: ${targetSubSkill.name}`,
        createdAt: new Date().toISOString(),
        knowledgeSource: "file",
      };

      const sessions = deps.loadSessions();
      sessions[sessionId] = drillSession;
      deps.saveSessions(sessions);

      console.error(
        `[practice_micro_skill] skill="${skillName}" subSkill="${targetSubSkill.name}" ` +
        `confidence=${targetSubSkill.confidence}/5 session=${sessionId}`
      );

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            sessionId,
            state: drillSession.state,
            skill: skillName,
            subSkill: targetSubSkill.name,
            subSkillConfidence: targetSubSkill.confidence,
            nextTool: "ask_question",
            recallPrompt,
            instruction:
              "Run the recall step BEFORE asking the drill question: " +
              "(1) Show the candidate the recallPrompt.recallQuestions and known mistakes. " +
              "(2) Ask: 'Answer these from memory — no looking up.' " +
              "(3) Wait for their response and note gaps. " +
              "(4) Then call ask_question to begin the drill. " +
              "(5) After end_interview, call update_skill { name, subSkill, confidence } " +
              "to record the new confidence based on how well they did.",
          }, null, 2),
        }],
      };
    }
  );
}
