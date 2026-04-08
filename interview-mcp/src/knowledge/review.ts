import fs from "fs";
import path from "path";
import { parseKnowledgeFile } from "./file.js";

export interface KnowledgeQuestionReview {
  questionIndex: number;
  question: string;
  difficulty: string | null;
  evaluationCriteria: string | null;
  verdict: "looks_good" | "needs_attention";
  reasons: string[];
  suggestions: string[];
}

export interface KnowledgeFileReview {
  filePath: string;
  topic: string;
  summary: {
    questionCount: number;
    criteriaCount: number;
    difficultyCount: number;
    conceptCount: number;
    warmupLevels: number[];
  };
  sectionChecks: {
    hasSummary: boolean;
    hasConcepts: boolean;
    criteriaAligned: boolean;
    difficultyAligned: boolean;
  };
  findings: string[];
  questions: KnowledgeQuestionReview[];
}

function normalizeQuestion(text: string): string {
  return text.toLowerCase().replace(/[`"'.,:;!?()[\]{}]/g, "").replace(/\s+/g, " ").trim();
}

function duplicateQuestionIndices(questions: string[]): Map<number, number[]> {
  const groups = new Map<string, number[]>();

  for (let index = 0; index < questions.length; index += 1) {
    const key = normalizeQuestion(questions[index] ?? "");
    const bucket = groups.get(key) ?? [];
    bucket.push(index);
    groups.set(key, bucket);
  }

  const duplicates = new Map<number, number[]>();
  for (const indices of groups.values()) {
    if (indices.length < 2) continue;
    for (const index of indices) duplicates.set(index, indices);
  }
  return duplicates;
}

export function reviewKnowledgeFile(filePath: string): KnowledgeFileReview | null {
  if (!fs.existsSync(filePath)) return null;

  const parsed = parseKnowledgeFile(filePath);
  if (!parsed) return null;

  const duplicateIndices = duplicateQuestionIndices(parsed.questions);
  const findings: string[] = [];

  if (!parsed.summary.trim()) findings.push("Missing `## Summary` content.");
  if (parsed.concepts.length === 0) findings.push("Missing `## Concepts` content.");
  if (parsed.evaluationCriteria.length !== parsed.questions.length) {
    findings.push(
      `Question count (${parsed.questions.length}) and evaluation-criteria count (${parsed.evaluationCriteria.length}) do not match.`
    );
  }
  if (parsed.questionDifficulties.length !== parsed.questions.length) {
    findings.push(
      `Question count (${parsed.questions.length}) and difficulty count (${parsed.questionDifficulties.length}) do not match.`
    );
  }

  const difficultySet = new Set(parsed.questionDifficulties);
  if (parsed.questions.length >= 6 && !difficultySet.has("foundation")) {
    findings.push("No foundation questions detected. The file may be too steep for a warm start.");
  }
  if (parsed.questions.length >= 6 && !difficultySet.has("advanced")) {
    findings.push("No advanced questions detected. The file may not stretch stronger candidates.");
  }

  const questions = parsed.questions.map((question, index): KnowledgeQuestionReview => {
    const reasons: string[] = [];
    const suggestions: string[] = [];
    const criteria = parsed.evaluationCriteria[index] ?? null;
    const difficulty = parsed.questionDifficulties[index] ?? null;

    if (!criteria) {
      reasons.push("Missing evaluation criteria for this question.");
      suggestions.push("Add a concrete rubric entry so the interviewer can score consistently.");
    }

    if (!difficulty) {
      reasons.push("Missing difficulty label for this question.");
      suggestions.push("Label it as foundation, intermediate, or advanced.");
    }

    if (question.length < 24) {
      reasons.push("Question is very short and may be too vague.");
      suggestions.push("Clarify the exact behaviour, scenario, or tradeoff you want the candidate to explain.");
    }

    if (question.length > 220) {
      reasons.push("Question is long and may bundle too many asks into one turn.");
      suggestions.push("Split it into a primary question plus a follow-up prompt.");
    }

    const questionMarks = (question.match(/\?/g) ?? []).length;
    if (questionMarks > 1) {
      reasons.push("Question appears to contain multiple prompts.");
      suggestions.push("Separate the core prompt from optional follow-up probes.");
    }

    const duplicateGroup = duplicateIndices.get(index);
    if (duplicateGroup) {
      reasons.push(
        `Question looks duplicated with question ${duplicateGroup.map((value) => value + 1).join(", ")}.`
      );
      suggestions.push("Merge or differentiate the overlapping prompts.");
    }

    const verdict = reasons.length === 0 ? "looks_good" : "needs_attention";
    return {
      questionIndex: index + 1,
      question,
      difficulty,
      evaluationCriteria: criteria,
      verdict,
      reasons,
      suggestions,
    };
  });

  return {
    filePath: path.resolve(filePath),
    topic: parsed.topic,
    summary: {
      questionCount: parsed.questions.length,
      criteriaCount: parsed.evaluationCriteria.length,
      difficultyCount: parsed.questionDifficulties.length,
      conceptCount: parsed.concepts.length,
      warmupLevels: parsed.warmupLevels ? Object.keys(parsed.warmupLevels).map((value) => Number(value)).sort() : [],
    },
    sectionChecks: {
      hasSummary: parsed.summary.trim().length > 0,
      hasConcepts: parsed.concepts.length > 0,
      criteriaAligned: parsed.evaluationCriteria.length === parsed.questions.length,
      difficultyAligned: parsed.questionDifficulties.length === parsed.questions.length,
    },
    findings,
    questions,
  };
}
