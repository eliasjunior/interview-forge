import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider } from "./port.js";
import type { Concept, Evaluation, EvaluationResult } from "../types.js";

// ─────────────────────────────────────────────────────────────────────────────
// AnthropicAIProvider — adapter
//
// Implements AIProvider using the Anthropic Messages API.
// Nothing outside this file should import from "@anthropic-ai/sdk".
// To swap providers, implement AIProvider with a different class and update
// the factory in index.ts — server.ts requires zero changes.
// ─────────────────────────────────────────────────────────────────────────────

// Fast, low-cost model — good for per-turn calls during an interview.
const MODEL = "claude-haiku-4-5-20251001";

// ─────────────────────────────────────────────────────────────────────────────
// JSON extraction helper
// Claude sometimes wraps JSON in ```json … ``` — this handles both cases.
// ─────────────────────────────────────────────────────────────────────────────

function parseJSON<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {}
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) {
    try {
      return JSON.parse(match[1].trim()) as T;
    } catch {}
  }
  throw new Error(`Could not parse JSON from response:\n${text}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Fallbacks — used when any API call fails
// ─────────────────────────────────────────────────────────────────────────────

const FALLBACK_QUESTIONS = [
  "Give me a high-level overview of {topic} and explain why it matters.",
  "Walk me through a practical example or real-world use case for {topic}.",
  "What are the most common pitfalls or mistakes developers make with {topic}?",
  "How would you explain {topic} to a junior developer who has never seen it?",
  "If you had to use {topic} in a high-scale production system, what tradeoffs would you consider?",
];

function fallbackQuestions(topic: string): string[] {
  return FALLBACK_QUESTIONS.map((t) => t.replace(/{topic}/g, topic));
}

function fallbackEvaluate(answer: string): EvaluationResult {
  const words = answer.trim().split(/\s+/).length;
  const score = words < 10 ? 1 : words < 30 ? 2 : words < 60 ? 3 : words < 100 ? 4 : 5;
  const feedbacks: Record<number, string> = {
    1: "Too brief — needs significant expansion.",
    2: "Partial — missing important concepts.",
    3: "Adequate, but could go deeper on key points.",
    4: "Strong answer — clear and well-structured.",
    5: "Excellent — thorough, structured, and insightful.",
  };
  return {
    score,
    feedback: feedbacks[score],
    needsFollowUp: score <= 3,
    followUpQuestion: score <= 3 ? "Can you elaborate further and give a concrete example?" : undefined,
    deeperDive: undefined,
  };
}

function fallbackConcepts(topic: string, transcript: string): Concept[] {
  const text = transcript.toLowerCase();
  const topicLower = topic.toLowerCase();
  const clusterDefs: Record<string, string[]> = {
    "core concepts":   ["definition", "overview", "concept", "principle", topicLower],
    "practical usage": ["example", "use case", "practical", "implement", "build"],
    "tradeoffs":       ["tradeoff", "pitfall", "mistake", "downside", "compare"],
    "best practices":  ["best practice", "junior", "explain", "pattern", "design"],
  };
  const concepts: Concept[] = [];
  for (const [cluster, keywords] of Object.entries(clusterDefs)) {
    for (const kw of keywords) {
      if (text.includes(kw)) concepts.push({ word: kw, cluster });
    }
  }
  if (!concepts.find((c) => c.word === topicLower)) {
    concepts.push({ word: topic, cluster: "core concepts" });
  }
  return concepts;
}

// ─────────────────────────────────────────────────────────────────────────────
// AnthropicAIProvider
// ─────────────────────────────────────────────────────────────────────────────

export class AnthropicAIProvider implements AIProvider {
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  // ── generateQuestions ──────────────────────────────────────────────────────

  async generateQuestions(topic: string): Promise<string[]> {
    try {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: 600,
        system: `You are a senior technical interviewer at a top tech company.
Generate interview questions that are clear, specific, and progressively deeper.
Respond with a JSON array of exactly 5 question strings. No markdown, no explanation — only the JSON array.`,
        messages: [{
          role: "user",
          content:
            `Generate 5 progressive interview questions for the topic: "${topic}".
Start with a broad conceptual question and get more specific/advanced.
Return only a JSON array of strings, e.g. ["Q1", "Q2", "Q3", "Q4", "Q5"]`,
        }],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      const questions = parseJSON<string[]>(text);
      if (!Array.isArray(questions) || questions.length === 0) throw new Error("Unexpected response shape");
      return questions;
    } catch (err) {
      console.error("[AnthropicAIProvider] generateQuestions failed, using fallback:", err);
      return fallbackQuestions(topic);
    }
  }

  // ── evaluateAnswer ─────────────────────────────────────────────────────────

  async evaluateAnswer(question: string, answer: string, context?: string): Promise<EvaluationResult> {
    const criteriaBlock = context
      ? `\n\nEvaluation criteria for this question:\n${context}`
      : "";
    try {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: 800,
        system: `You are a strict but fair technical interviewer evaluating a candidate's answer.
Score honestly. Most answers deserve a 3. Only exceptional ones get 5.
When evaluation criteria are provided, use them as ground truth for scoring.
Respond with a JSON object only — no markdown, no extra text.`,
        messages: [{
          role: "user",
          content: `Question: ${question}

Candidate answer: ${answer}${criteriaBlock}

Evaluate this answer and return a JSON object with exactly these fields:
{
  "score": <integer 1-5>,
  "feedback": "<one specific, actionable sentence>",
  "needsFollowUp": <true if score is 3 or below>,
  "followUpQuestion": "<a probing follow-up question, or null if not needed>",
  "deeperDive": "<3–5 bullet points on what to study deeper, format: - **concept** → one-sentence explanation, separated by \\n>"
}`,
        }],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      const result = parseJSON<EvaluationResult>(text);
      result.score = Math.max(1, Math.min(5, Math.round(result.score)));
      result.needsFollowUp = result.score <= 3;
      return result;
    } catch (err) {
      console.error("[AnthropicAIProvider] evaluateAnswer failed, using fallback:", err);
      return fallbackEvaluate(answer);
    }
  }

  // ── extractConcepts ────────────────────────────────────────────────────────

  async extractConcepts(topic: string, transcript: string): Promise<Concept[]> {
    try {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: 800,
        system: `You are extracting key technical concepts from an interview transcript.
Respond with a JSON array only — no markdown, no extra text.`,
        messages: [{
          role: "user",
          content: `Topic: "${topic}"

Interview transcript:
${transcript}

Extract 10–20 key technical concepts, terms, and ideas mentioned.
Assign each to one of these clusters: "core concepts", "practical usage", "tradeoffs", "best practices".
A word can appear in multiple clusters if relevant.

Return a JSON array of objects:
[{ "word": "<concept>", "cluster": "<cluster>" }, ...]`,
        }],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      const concepts = parseJSON<Concept[]>(text);
      if (!Array.isArray(concepts)) throw new Error("Unexpected response shape");

      const topicLower = topic.toLowerCase();
      if (!concepts.find((c) => c.word.toLowerCase() === topicLower)) {
        concepts.push({ word: topic, cluster: "core concepts" });
      }
      return concepts;
    } catch (err) {
      console.error("[AnthropicAIProvider] extractConcepts failed, using fallback:", err);
      return fallbackConcepts(topic, transcript);
    }
  }

  // ── generateDeeperDives ────────────────────────────────────────────────────

  async generateDeeperDives(topic: string, evaluations: Evaluation[]): Promise<string[]> {
    if (evaluations.length === 0) return [];

    const questionsBlock = evaluations
      .map((e, i) =>
        `Q${i + 1} (score ${e.score}/5):\n` +
        `Question: ${e.question}\n` +
        `Answer: ${e.answer}\n` +
        `Feedback: ${e.feedback}`
      )
      .join("\n\n---\n\n");

    try {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: 4000,
        system: `You are a senior engineer writing educational post-interview feedback.
For each question, write 3–5 concise bullet points on "where to go deeper".
Each bullet must follow this exact format:  - **concept** → one-sentence explanation.
Respond ONLY with a valid JSON array of strings, one string per question, in the same order.
No markdown fences, no extra text — raw JSON array only.`,
        messages: [{
          role: "user",
          content:
            `Topic: "${topic}"\n\n` +
            `Here are the ${evaluations.length} interview questions with scores and feedback:\n\n` +
            questionsBlock +
            `\n\nReturn a JSON array of exactly ${evaluations.length} strings.\n` +
            `Each string = 3–5 bullet points (- **concept** → explanation) for that question.\n` +
            `Focus on low-score questions (1–3) but include advanced topics for high scores too.`,
        }],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      const dives = parseJSON<string[]>(text);
      if (!Array.isArray(dives)) throw new Error(`Response is not an array: ${text.slice(0, 200)}`);

      while (dives.length < evaluations.length) dives.push("");
      return dives.slice(0, evaluations.length);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[AnthropicAIProvider] generateDeeperDives failed:", msg);
      return evaluations.map((_, i) => (i === 0 ? `ERROR: ${msg}` : ""));
    }
  }
}
