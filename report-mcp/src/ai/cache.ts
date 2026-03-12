import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { AIProvider } from "./port.js";
import type { Concept, Evaluation, EvaluationResult } from "../types.js";

// ─────────────────────────────────────────────────────────────────────────────
// CachingAIProvider — decorator
//
// Wraps any AIProvider and adds file-based caching for question generation.
// Cached questions survive server restarts (stored in data/questions-cache.json).
//
// Only questions are cached — evaluations, concept extraction, and deeper dives
// are always live because they depend on the candidate's unique answers.
// ─────────────────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = path.resolve(__dirname, "../../data/questions-cache.json");

function loadCache(): Record<string, string[]> {
  if (!fs.existsSync(CACHE_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, string[]>): void {
  const dir = path.dirname(CACHE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

export class CachingAIProvider implements AIProvider {
  constructor(private readonly inner: AIProvider) {}

  async generateQuestions(topic: string): Promise<string[]> {
    const key = topic.toLowerCase().trim();
    const cache = loadCache();

    if (cache[key]) {
      console.error(`[cache] questions hit for "${topic}" — skipping API call`);
      return cache[key];
    }

    const questions = await this.inner.generateQuestions(topic);
    cache[key] = questions;
    saveCache(cache);
    console.error(`[cache] questions for "${topic}" cached`);
    return questions;
  }

  // ── pass-through for everything else ──────────────────────────────────────

  evaluateAnswer(question: string, answer: string, context?: string): Promise<EvaluationResult> {
    return this.inner.evaluateAnswer(question, answer, context);
  }

  extractConcepts(topic: string, transcript: string): Promise<Concept[]> {
    return this.inner.extractConcepts(topic, transcript);
  }

  generateDeeperDives(topic: string, evaluations: Evaluation[]): Promise<string[]> {
    return this.inner.generateDeeperDives(topic, evaluations);
  }
}
