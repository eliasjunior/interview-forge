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
  ].join(" ");

  return {
    sessionId: session.id,
    title: `${getSessionTitle(session)} — ${modeLabel}`,
    prompt,
    nextTool: "get_session",
  };
}
