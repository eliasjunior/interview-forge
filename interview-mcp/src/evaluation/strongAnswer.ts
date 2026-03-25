function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function stripCriteriaNoise(criteria: string): string {
  return criteria
    .replace(/^Question\s+\d+:\s*/i, "")
    .replace(/\bWeak answer:.*$/i, "")
    .replace(/\bBonus:.*$/i, "")
    .trim();
}

function extractExplicitStrongAnswer(criteria: string): string | undefined {
  const match = criteria.match(/\bStrong answer:\s*([\s\S]*?)(?:\bBonus:|\bWeak answer:|$)/i);
  if (!match) return undefined;
  const text = collapseWhitespace(match[1] ?? "");
  return text.length > 0 ? text : undefined;
}

function criteriaToStrongAnswer(criteria: string): string | undefined {
  const explicit = extractExplicitStrongAnswer(criteria);
  if (explicit) return explicit;

  const cleaned = stripCriteriaNoise(criteria)
    .split(/(?<=\.)\s+/)
    .map((sentence) =>
      sentence
        .replace(/^\s*(Must|Should)\s+/i, "")
        .replace(/^\s*Must\s+include\s+/i, "Include ")
        .replace(/^\s*Must\s+mention\s+/i, "Mention ")
        .replace(/^\s*Must\s+identify\s+/i, "Identify ")
        .replace(/^\s*Must\s+define\s+/i, "Define ")
        .replace(/^\s*Must\s+describe\s+/i, "Describe ")
        .replace(/^\s*Must\s+explain\s+/i, "Explain ")
        .replace(/^\s*Must\s+compare\s+/i, "Compare ")
        .trim()
    )
    .filter(Boolean)
    .join(" ");

  const normalized = collapseWhitespace(cleaned);
  return normalized.length > 0 ? normalized : undefined;
}

function feedbackToStrongAnswer(feedback: string, answer?: string): string | undefined {
  const normalizedFeedback = collapseWhitespace(feedback);
  if (!normalizedFeedback) return answer ? collapseWhitespace(answer) : undefined;

  if (/^(Strong answer|Excellent|Perfect|Solid answer|Good foundation)\b/i.test(normalizedFeedback) && answer) {
    return collapseWhitespace(answer);
  }

  return `A stronger answer would cover the missing points called out in feedback: ${normalizedFeedback}`;
}

export function buildStrongAnswer(input: {
  criteria?: string | null;
  feedback?: string | null;
  answer?: string | null;
}): string | undefined {
  const fromCriteria = input.criteria ? criteriaToStrongAnswer(input.criteria) : undefined;
  if (fromCriteria) return fromCriteria;

  const fromFeedback = input.feedback ? feedbackToStrongAnswer(input.feedback, input.answer ?? undefined) : undefined;
  if (fromFeedback) return fromFeedback;

  const fromAnswer = input.answer ? collapseWhitespace(input.answer) : "";
  return fromAnswer.length > 0 ? fromAnswer : undefined;
}
