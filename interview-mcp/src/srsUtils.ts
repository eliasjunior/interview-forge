// ─────────────────────────────────────────────────────────────────────────────
// SM-2 Spaced Repetition Algorithm — pure, side-effect-free
//
// Rating scale (1–4):
//   1 = Again  — completely forgot, reset the card
//   2 = Hard   — remembered but with major difficulty
//   3 = Good   — remembered with some effort
//   4 = Easy   — recalled perfectly with no effort
//
// Mapped to SM-2 quality (0–5):
//   1 → 0  (complete blackout)
//   2 → 2  (incorrect but easy after seeing answer)
//   3 → 3  (correct with difficulty)
//   4 → 5  (perfect response)
// ─────────────────────────────────────────────────────────────────────────────

import type { Flashcard, ReviewRating } from "@mock-interview/shared";

const MIN_EASE_FACTOR = 1.3;
const INITIAL_EASE_FACTOR = 2.5;

/** Map our 1–4 rating to the SM-2 quality integer (0–5). */
function toQuality(rating: ReviewRating): number {
  switch (rating) {
    case 1: return 0;
    case 2: return 2;
    case 3: return 3;
    case 4: return 5;
  }
}

/**
 * Apply the SM-2 algorithm to a card given a review rating.
 * Returns the updated SRS fields — does NOT mutate the card.
 */
export function applySM2(
  card: Pick<Flashcard, "interval" | "easeFactor" | "repetitions">,
  rating: ReviewRating
): { interval: number; easeFactor: number; repetitions: number; dueDate: string } {
  const quality = toQuality(rating);

  let { interval, easeFactor, repetitions } = card;

  if (quality < 3) {
    // Failed recall — reset sequence but keep (slightly lowered) ease factor
    interval    = 1;
    repetitions = 0;
    easeFactor  = Math.max(MIN_EASE_FACTOR, easeFactor - 0.2);
  } else {
    // Successful recall — advance the schedule
    repetitions += 1;

    if (repetitions === 1)      interval = 3;
    else if (repetitions === 2) interval = 8;
    else                        interval = Math.round(interval * easeFactor);

    // SM-2 ease-factor update formula
    easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor);
  }

  // Add ±1 day jitter so cards from the same session don't all cluster on the same date
  const jitter = Math.round((Math.random() - 0.5) * 2); // -1, 0, or +1
  const dueDate = new Date(
    Date.now() + (interval + jitter) * 24 * 60 * 60 * 1000
  ).toISOString();

  return { interval, easeFactor: parseFloat(easeFactor.toFixed(2)), repetitions, dueDate };
}

/**
 * Returns true if a card is due for review (dueDate <= now).
 */
export function isDue(card: Flashcard, now = new Date()): boolean {
  return new Date(card.dueDate) <= now;
}

/**
 * Returns a human-readable description of a rating for tool responses.
 */
export function ratingLabel(rating: ReviewRating): string {
  switch (rating) {
    case 1: return "Again (reset)";
    case 2: return "Hard";
    case 3: return "Good";
    case 4: return "Easy";
  }
}
