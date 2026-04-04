import type { InterviewState, Session } from "@mock-interview/shared";

// ─────────────────────────────────────────────
// State machine
// ─────────────────────────────────────────────

export const VALID_TOOLS: Record<InterviewState, string[]> = {
  ASK_QUESTION:    ["ask_question",    "end_interview", "get_session", "list_sessions", "get_graph"],
  WAIT_FOR_ANSWER: ["submit_answer",   "end_interview", "get_session", "list_sessions", "get_graph"],
  EVALUATE_ANSWER: ["evaluate_answer", "end_interview", "get_session", "list_sessions", "get_graph"],
  FOLLOW_UP:       ["ask_followup", "next_question", "end_interview", "get_session", "list_sessions", "get_graph"],
  ENDED:           ["get_session", "list_sessions", "get_graph"],
};

export function assertState(
  session: Session,
  toolName: string
): { ok: true } | { ok: false; error: string } {
  const valid = VALID_TOOLS[session.state];
  if (!valid.includes(toolName)) {
    return {
      ok: false,
      error:
        `Tool '${toolName}' is not valid in state '${session.state}'. ` +
        `Valid tools right now: [${valid.join(", ")}]`,
    };
  }
  return { ok: true };
}
