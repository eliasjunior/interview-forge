import type { Session } from "@mock-interview/shared";

export interface SessionLaunchPrompt {
  sessionId: string;
  title: string;
  prompt: string;
  nextTool: "get_session";
}

function getModeLabel(session: Session): string {
  if (session.interviewType === "code") return "code interview";
  if (session.focusArea) return "scoped interview";
  return "interview";
}

function getSessionTitle(session: Session): string {
  if (session.problemTitle && session.problemTitle !== session.topic) {
    return `${session.topic} — ${session.problemTitle}`;
  }
  return session.topic;
}

export function buildSessionLaunchPrompt(session: Session): SessionLaunchPrompt {
  const action = session.state === "ENDED" ? "review" : "start or resume";
  const modeLabel = getModeLabel(session);
  const prompt = [
    `Please ${action} the ${modeLabel} for session ${session.id}.`,
    "Call get_session first, follow the instruction field if present, and continue from the current state.",
    "If the session is ready to begin, start with ask_question.",
    "When asking each question, ask the question first, then naturally offer three numbered answer styles so the candidate can reply with 1, 2, or 3.",
    "Do not ask the candidate to choose a mode before they see the question.",
    "Avoid mechanical UI-style wording like 'Answer modes:'. Prefer natural interviewer phrasing such as 'You can answer 1) Brief, 2) Bullets, or 3) Deep dive.'",
    "When you call submit_answer, always pass the chosen answerMode so evaluation stays fair for concise answers.",
    "After evaluate_answer, keep candidate-facing feedback mode-aware: for brief mode use at most 2-3 sentences plus one focused follow-up; for bullets mode keep the correction compact and structured; for deep_dive mode fuller explanation is fine.",
    "Do not expose tool chatter like tool counts or internal step labels to the candidate.",
  ].join(" ");

  return {
    sessionId: session.id,
    title: `${getSessionTitle(session)} — ${modeLabel}`,
    prompt,
    nextTool: "get_session",
  };
}
