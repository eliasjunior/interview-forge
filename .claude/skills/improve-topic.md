---
name: improve-topic
description: Improve a topic's retention quality — fix linked_question_order, fill warmup gaps, audit quality, detect orphans and clusters
---

# improve-topic

Improve the retention quality of a topic in `interview-mcp/data/app.db`.

**Goal:** make concepts easier to remember by ensuring every deep question has a warmup MCQ that primes it, every warmup is correctly linked, existing warmups are high quality, and the content structure supports progressive learning.

## Usage

```
/improve-topic <topic_id>
```

Example: `/improve-topic concurrency-fundamentals`

---

## Workflow

### 1. Load current state

```bash
sqlite3 interview-mcp/data/app.db "SELECT id, \"order\", text, difficulty, evaluation_criteria FROM topic_questions WHERE topic_id = '<topic_id>' ORDER BY \"order\";"
```

```bash
sqlite3 interview-mcp/data/app.db "SELECT id, level, stem, choice_a, choice_b, choice_c, choice_d, correct_answer, linked_question_order FROM warmup_questions WHERE topic_id = '<topic_id>' ORDER BY id;"
```

---

### 2. Build a coverage map

Read every warmup stem and infer which deep question it primes. Classify each warmup as:
- **clear** — stem unambiguously maps to one deep question
- **ambiguous** — stem could match two or more deep questions
- **orphan** — stem doesn't map to any deep question

Produce this table before doing anything else:

| warmup id | stem (short) | inferred order | confidence |
|-----------|-------------|----------------|------------|
| 164 | What is the difference between... | 1 | clear |
| 176 | What is a race condition? | 2 or 9? | ambiguous |
| 182 | Why is ConcurrentHashMap preferred... | none | orphan |

Also produce the gap table:

| deep question order | text (short) | warmup id(s) | gap? |
|--------------------|-------------|--------------|------|
| 5 | Why can two threads observe... | — | YES |

**Stop here and show both tables to the user before proceeding.**

---

### 3. Resolve ambiguous links — ask user

For each warmup marked **ambiguous**, show:

```
Warmup #176: "What is a race condition?"
  Could map to:
    → order 2: "Two threads read and write a shared boolean flag..."
    → order 9: "Why is count++ unsafe even when visibility is guaranteed?"
  Which should it link to? (or skip)
```

**Wait for user input. Do not guess.**

Apply confirmed links:
```bash
sqlite3 interview-mcp/data/app.db "UPDATE warmup_questions SET linked_question_order = <order> WHERE id = <wq_id>;"
```

Apply clear links without asking:
```bash
sqlite3 interview-mcp/data/app.db "UPDATE warmup_questions SET linked_question_order = <order> WHERE id = <wq_id>;"
```

---

### 4. Handle orphan warmups — suggest a deep question

For each **orphan** warmup, show:

```
Orphan warmup #182: "Why is ConcurrentHashMap preferred over HashMap for concurrent access?"
  No matching deep question exists.
  Suggested new deep question:
    text: "You have a shared map read and written by many threads. Why is ConcurrentHashMap safer than HashMap, and what are its consistency guarantees?"
    difficulty: intermediate
    evaluation_criteria: "..."
  Add this deep question? (yes / no / reword)
```

**Wait for user input before inserting.**

Insert confirmed deep questions:
```bash
sqlite3 interview-mcp/data/app.db "INSERT INTO topic_questions (topic_id, \"order\", text, difficulty, evaluation_criteria) VALUES (...);"
```
Then link the orphan warmup to the new order.

---

### 5. Audit existing warmup quality — show and suggest

For each warmup with a confirmed link, evaluate quality against these red flags:
- Stem starts with "What is X?" or "Define X" — abstract, low retention
- Correct answer is obvious from the stem alone
- Distractors are implausible (clearly wrong, no real confusion)

For each warmup that fails, show the original and a suggested rewrite side by side:

```
Warmup #164 — quality issue: abstract stem
  Original:  "What is the difference between concurrency and parallelism?"
  Suggested: "A server handles 1000 requests by switching between them on one core. Another runs them simultaneously on 8 cores. Which term describes each?"
  Apply suggested rewrite? (yes / no / reword)
```

**Wait for user input before changing anything.**

Apply confirmed rewrites:
```bash
sqlite3 interview-mcp/data/app.db "UPDATE warmup_questions SET stem = '...', choice_a = '...', ... WHERE id = <wq_id>;"
```

---

### 6. Detect concept cluster over-concentration — quality vs quantity

Group deep questions by concept cluster (e.g. visibility, atomicity, liveness, thread pools). If one cluster has 4+ deep questions but 1 or fewer warmups, that's a coverage gap. If one cluster has 5+ warmups, flag it.

Show:

```
Concept cluster: volatile / visibility
  Deep questions: orders 17, 18, 21, 22, 23, 24 (6 questions)
  Warmup primers: 2

  This cluster is under-primed. Options:
    A) Add one warmup that covers the shared concept across all 6 (quality > quantity)
    B) Add a distinct warmup per question (full coverage)
  Which approach? (A / B / skip)
```

**Wait for user input before writing any MCQs for the cluster.**

---

### 7. Fill remaining coverage gaps

For each deep question still without a warmup after steps 3–6, write a new MCQ:
- Primes the *core concept*, not the answer
- Concrete phrasing: scenario, analogy, or "which of these" over "define X"
- One clearly correct answer, three plausible distractors
- `linked_question_order` set immediately on insert

```bash
sqlite3 interview-mcp/data/app.db "INSERT INTO warmup_questions (topic_id, level, stem, choice_a, choice_b, choice_c, choice_d, correct_answer, weight, linked_question_order) VALUES (...);"
```

---

### 8. Level promotion check — ask user per warmup

After all warmups are in place, list warmups currently at `level = 0` that cover an intermediate or advanced deep question.

Show each one:

```
Warmup #178 (level 0): "Why is AtomicInteger usually safer than a plain shared int?"
  Linked to: order 8 (intermediate)
  Promote to level 1 so it appears after the learner has seen the foundation? (yes / no)
```

**Wait for user input. Apply promotions:**
```bash
sqlite3 interview-mcp/data/app.db "UPDATE warmup_questions SET level = 1 WHERE id = <wq_id>;"
```

---

### 9. Final report

```
== improve-topic: <topic_id> ==
Links fixed (clear):        N
Ambiguous links resolved:   N  (N skipped)
Orphan warmups → new deep questions: N
Warmup rewrites applied:    N
New warmup MCQs added:      N
Level promotions:           N
```

---

## Retention Quality Rules

- Concrete > abstract: scenario or "which of these" beats "what is X?"
- Prime the concept, don't give away the answer
- Distractors should represent real misconceptions, not straw men
- One well-placed warmup serving a concept cluster beats three shallow ones
- Level 0 = foundation warmups; level 1 = intermediate priming; never promote blindly

## Correct Answer Distribution Rule

**Never let the correct answer default to the same letter across multiple warmups.**

When writing a batch of MCQs, distribute correct answers across A, B, C, and D roughly evenly. Before inserting, review the batch and rotate answer positions so no letter dominates. To rotate: physically move the correct answer text into a different position and update the other choices to fill the remaining slots — the content stays the same, only the letter changes.

Target distribution for any batch of 4+: each letter appears at least once. For batches of 8+, no letter should appear more than 40% of the time.
