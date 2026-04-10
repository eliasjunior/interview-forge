# Usage

[← Back to README](../README.md)

All interactions happen in natural language inside **Claude Desktop** or **Claude Code**. Claude decides which tools to call — you just describe what you want. Below are the main workflows with example prompts and the tool sequence Claude runs behind the scenes.

## 0. Starting a topic — warm-up ladder

Every topic now has a 5-level progression ladder. Claude always checks your history before starting anything and routes you to the right entry point.

**You say:**
```text
I want to study JWT authentication
```

**Claude runs:**
```text
get_topic_level { topic: "JWT authentication" }
  → returns level: 0, status: "cold"   ← never attempted, always starts at L0
  → instruction: call start_warm_up { topic, level: 0 }
```

**Then — if topic has warm-up content (e.g. JWT):**
```text
start_warm_up { topic: "JWT authentication", level: 0 }
  → creates a warmup session (sessionKind: "warmup", questFormat: "mcq")
  → ask_question { sessionId }
  → [you pick A / B / C / D]
  → submit_answer { sessionId, answer: "B" }
  → evaluate_answer { sessionId }    ← auto-scored against correct answer
  → next_question { sessionId }
  → [repeat per question]
  → end_interview { sessionId }      ← advances immediately when avg ≥ 4.0, or after 2 consecutive sessions with avg ≥ 3.0
```

Each warm-up session is capped at 5 questions. If more than 5 questions exist for that level, the server picks a different subset per session while keeping the selected order aligned to the authored progression.

**If topic has no warm-up content yet:** `start_warm_up` uses up to 5 regular topic questions for L0 and asks the orchestrator to generate MCQ options on the fly.

**Level routing table:**

| Status | What Claude calls |
|---|---|
| `cold` — no sessions | `start_warm_up { level: 0 }` (MCQ) |
| `warmup` L0 in progress | `start_warm_up { level: 0 }` (retry) |
| `warmup` L1 in progress | `start_warm_up { level: 1 }` (fill-in-blank) |
| `warmup` L2 in progress | `start_warm_up { level: 2 }` (guided answer) |
| `dropped` (interview avg < 2.5) | `start_warm_up { level: 1 }` (reinforcement) |
| `ready` (`L3`/`L4`) | `start_interview { topic }` |

Warm-up advancement rule: a level advances immediately after one completed warm-up session at that level with avg score ≥ 4.0, or after 2 consecutive completed sessions at that level with avg score ≥ 3.0. `L4` still requires 2 completed full interviews for that topic with avg score ≥ 4.0 in both.

## 1. Full interview

The core loop. Claude asks questions one at a time, waits for your answer, scores it, optionally asks a follow-up, then moves to the next question. At the end it generates a report and prepares flashcard drafts for weak answers.

Reached after completing the warm-up ladder, or directly for topics without warm-up content.

**You say:**
```text
Start a mock interview on JWT authentication
```

**Claude runs:**
```text
server_status
  → start_interview { topic: "JWT authentication" }
  → ask_question { sessionId }
  → [you answer]
  → submit_answer { sessionId, answer: "..." }
  → evaluate_answer { sessionId }
  → ask_followup { sessionId }   ← only if score < 3 or answer was incomplete
  → next_question { sessionId }
  → [repeat per question]
  → end_interview { sessionId }   ← generates report + flashcard next step
  → prepare_flashcards { sessionId }
  → create_flashcard { ...draft } ← once per returned draft
```

**Available topics:** JWT, REST + Spring/JPA, Payment API Design, URL Shortener, mTLS/TLS, Java Concurrency, Java OS & JVM Internals, Rotate Matrix.

## 2. Targeted drill on weak spots

This workflow starts from a completed interview and turns weak feedback into deliberate practice.

The current flow is:

1. Run a full interview.
2. End the interview with `end_interview`.
3. `end_interview` finalizes the session, writes the report, merges concepts into the graph, and returns `prepare_flashcards` as the next step when weak answers exist.
4. `prepare_flashcards` returns ready-to-submit `create_flashcard` payloads for those weak answers.
5. Review the completed session feedback and identify recurring mistakes or weak areas.
6. Optionally persist those patterns with `log_mistake`.
7. Optionally create a follow-up implementation exercise with `create_exercise` based on the weak area.
8. Run `start_drill` to revisit the weak answers verbally, using prior weak evaluations plus any logged mistakes as recall context.

So `start_drill` is not the whole learning loop by itself. It is the targeted verbal-recall step that comes after at least one completed interview and can be combined with flashcards, mistake logging, and exercises.

**You say:**
```text
Drill me on my weak spots from the last JWT interview
```

**Claude runs:**
```text
start_interview { topic: "JWT authentication" }
  → ask_question
  → [you answer]
  → submit_answer
  → evaluate_answer
  → next_question
  → [repeat per question]
  → end_interview                  ← report + graph merge + flashcard draft next step
  → prepare_flashcards { sessionId }
  → create_flashcard { ...draft }  ← once per returned draft
  → log_mistake { ... }            ← optional, for recurring patterns found in feedback
  → create_exercise { ... }        ← optional, for hands-on follow-up practice
start_drill { topic: "JWT authentication" }
  → returns recallContext from prior weak evaluations + logged mistakes
  → Claude shows that recall context to the candidate
  → Claude asks: "What do you remember about these areas? Where do you think you will struggle?"
  → [you respond]
  → ask_question → submit_answer → evaluate_answer → next_question
  → end_interview                  ← drill session finalized; weak drill answers can also create flashcards
  → log_mistake { ... }            ← optional, for any new gaps discovered in the drill
```

> Requires at least one completed interview for the topic first.

## 3. Scoped interview on custom content

Start an interview from any content you supply — a spec, README, architecture doc, or just a topic you want to study. There are two ways to do this.

### Option A — paste content directly

You already have the material and just want to run it as an interview. The current product flow starts in the UI and then hands off to Claude.

**UI flow:**
1. Open `/topics`.
2. Click `Start With Content`.
3. Enter:
   - `topic`
   - optional `focus`
   - pasted `content`
4. Create the session.
5. Open the session page.
6. Click `Start In Claude` or `Copy prompt`.

The backend creates a scoped interview session immediately. For algorithm prompts, it wraps the pasted content into a stronger interview scope before saving the session.

**Then in Claude Desktop:**
```text
Please start or resume the scoped interview for session <sessionId>. Call get_session first, follow the instruction field if present, and continue from the current state. If the session is ready to begin, start with ask_question.
```

**Claude runs:**
```text
get_session { sessionId: "..." }
  → ask_question → submit_answer → evaluate_answer → next_question
  → ... repeat until done ...
  → end_interview
```

**Notes:**
- The session page shows the exact launch prompt generated by the backend.
- This is currently the recommended path for algorithm-style interviews created from pasted problems.
- The handoff to Claude is still manual: the UI copies the prompt, but does not open Claude automatically yet.

### Option B — build a focused scope interactively

You have a broad topic but want the LLM to ask clarifying questions first so the interview stays focused and doesn't drift. This is the recommended approach when you know what you want to study but haven't written the content yet.

**You say:**
```text
I want to study how JavaScript works — help me narrow this down into a focused scoped interview
```

**Claude asks clarifying questions one at a time:**
```text
Which areas do you want to focus on?
  1. Event loop + task/microtask queues
  2. Call stack and execution context
  3. Async/await and Promise resolution
  4. Something else?

What depth do you want — conceptual explanation, trace through code, or mixed?

Where do you usually struggle?
```

**After your answers, Claude calls:**
```text
build_scope {
  topic: "JavaScript Runtime — Event Loop",
  focusAreas: ["event loop", "microtask vs macrotask queue", "Promise vs setTimeout order"],
  weakSpots: ["Promise.then vs setTimeout execution order"],
  depth: "trace-through-code",
  outOfScope: ["JS syntax", "DOM APIs", "Node.js internals"],
  saveAs: "js-event-loop"
}
  → start_scoped_interview { topic, content, focus }
  → ask_question → submit_answer → evaluate_answer → ... → end_interview
```

The tool builds a content block with explicit **Focus Areas**, **Evaluation Criteria**, **Known Weak Spots**, and **Out of Scope** sections that anchor the LLM during evaluation and prevent it from going in an unwanted direction.

**Reusing a saved scope:** if you passed `saveAs`, the scope is written to `data/knowledge/scopes/<slug>.md`. Next time, skip the Q&A and call `start_scoped_interview` directly with that file's content.

If you prefer the browser flow, you can also paste the resulting `content` into `Start With Content` in the Topics page instead of calling the tool directly yourself.

### Content template (for writing your own)

When writing `content` manually for `start_scoped_interview`, this structure gives the LLM the most to work with:

```markdown
# Study Scope: <topic>

## Focus Areas
- <specific area 1>
- <specific area 2>

## Depth: mixed
Verbal explanation + code tracing expected.

## Evaluation Criteria
- **<area 1>**: What a strong answer includes. Probe if vague.
- **<area 2>**: ...

## Known Weak Spots (probe these specifically)
- <thing you always get wrong>

## Out of Scope
- <topic to exclude so the LLM doesn't drift>

## Session Goal
Candidate can explain X and Y without prompting. No drifting into Z.
```

The `Out of Scope` section is the most important when drift is a concern — the LLM will redirect the candidate if they wander into excluded territory.

## 4. Flashcard review

Cards are generated automatically when you score below 4. Review due cards using SM-2 spaced repetition — Claude flips each card and waits for your self-rating.

**You say:**
```text
Review my due flashcards for JWT
```

**Claude runs:**
```text
get_due_flashcards { topic: "JWT authentication" }
  → [for each card]
     review_flashcard { cardId, rating: 1|2|3|4 }
       → if the card has been seen before and recall succeeded (rating ≥ 3):
           response includes nextStep: { tool: "generate_flashcard_variation", cardId }
         → generate_flashcard_variation { cardId }
             returns originalQuestion + modelAnswer + a variation angle
             Claude constructs a varied question, asks it, evaluates the answer
```

**Rating guide:** `1` = forgot, `2` = hard, `3` = good, `4` = easy. The next due date is set automatically.

**Variation angles** — on repeated cards, Claude picks a different angle each time instead of repeating the same question verbatim:

| Angle | What Claude asks instead |
|---|---|
| `failure-case` | What goes wrong if you ignore or misapply this concept in production? |
| `why-not-what` | Explain the *reasoning* behind the answer, not just the fact. |
| `flip-scenario` | Reverse the constraint — what's the edge case that breaks the normal rule? |
| `trade-offs` | Compare this approach to an alternative and say when each is preferable. |
| `teach-it` | Explain this concept to a junior developer using a concrete analogy. |
| `apply-to-context` | How does this apply to a high-traffic service / distributed system / memory-constrained environment? |

The angle rotates deterministically with each review (`repetitions % 6`), so consecutive reviews always use a fresh perspective.

You can also review cards in the browser at **http://localhost:5173/flashcards**.

## 5. Micro-skill practice

For algorithm-style skills (for example, "2D index transformations"), track confidence per sub-skill and drill the weakest one.

**You say:**
```text
Add a skill for 2D index transformations with sub-skills: layer boundaries, coordinate mapping, offset reasoning
```
```text
Practice micro-skill: 2D index transformations — focus on layer boundaries
```

**Claude runs:**
```text
add_skill {
  name: "2D index transformations",
  subSkills: ["layer boundaries", "coordinate mapping", "offset reasoning"],
  relatedProblems: ["rotate matrix", "spiral matrix"],
  confidence: 1
}

practice_micro_skill { skill: "2D index transformations", subSkill: "layer boundaries" }
  → shows recallQuestions + known mistakes
  → ask_question → submit_answer → evaluate_answer → end_interview
  → update_skill { name, subSkill, confidence: 2 }
```

**You say:**
```text
What micro-skills do I still need to drill? (confidence ≤ 2)
```

**Claude runs:**
```text
list_skills { maxConfidence: 2 }
```

## 6. Coding exercises

Hands-on implementation tasks grounded in real-world scenarios. The tool writes a full `.md` exercise file, persists metadata plus cross-topic tags, assesses complexity, and either presents the exercise or proposes simpler prerequisites first.

Exercises can come from two sources:

1. a direct request after a completed interview or drill
2. a question-specific weak slice from the Topics UI when that knowledge-file question is authored as exercise-fit

Not every question should produce an exercise. Some are deliberately discussion-only. The authored question metadata decides whether the exercise action appears.

**You say:**
```text
Create an exercise for Java concurrency — implement a producer-consumer queue like you'd use in a background job system
```

**Claude runs:**
```text
create_exercise {
  name: "ProducerConsumerBlockingQueue",
  topic: "java-concurrency",
  difficulty: 3,
  tags: ["concurrency", "shared-state", "synchronization"],
  scenario: "Background email/job processing system",
  problemMeaning: [
    "Prevent overload by bounding queue size",
    "Introduce backpressure when queue is full",
    "Decouple request handling from heavy processing"
  ],
  ...
}
```

If the exercise is too hard or has unmet prerequisites, Claude shows the roadmap:
```text
Before this exercise I recommend completing:
1. RaceConditionLab (Easy) — understand synchronized before wait/notify

Do you want to start with the prerequisites, or jump straight in?
```

After completing the exercise:
```text
log_mistake { ... }
start_scoped_interview { topic, content: problemStatement }
end_interview
```

**You say:**
```text
List all my exercises for Java concurrency, max difficulty 3
```

**Claude runs:**
```text
list_exercises { topic: "java-concurrency", maxDifficulty: 3 }
```

You can also group related exercises without pretending they are the same exact problem:

**You say:**
```text
Show me all matrix problems
```

**Claude runs:**
```text
list_exercises { tags: ["matrix"] }

### Question-level exercise guidance

Knowledge files can now attach compact exercise guidance directly to a specific question. This is used to keep 20-minute exercises narrow and centered on the hard part of the problem.

Supported fields:

- `Exercise fit`: `none | micro | standard`
- `Exercise owner`
- `Exercise goal`
- `Exercise scope`
- `Exercise constraints`
- `Exercise acceptance`
- `Exercise seed`

Typical use:

- mark broad architecture/trade-off questions as `Exercise fit: none`
- mark focused implementation-worthy questions as `micro`
- mark larger but still valid implementation follow-ups as `standard`

This is especially useful when you want the exercise to stay inside one layer, for example:

- service-layer pagination logic
- one query-shaping refactor
- one resilience boundary
- one focused test suite

and explicitly keep these out of scope:

- controller wiring
- framework boilerplate
- multi-step vertical slices
- unrelated infrastructure work
```

For example, `ZeroMatrix` and `RotateMatrixInPlace` can both live under the same broader matrix family via tags like:

```json
["matrix", "2d-indexing", "array-traversal"]
```

## 7. Reports and knowledge graph

**You say:**
```text
Show me the report for my last JWT session
```

**Claude runs:**
```text
list_sessions
  → get_report_full_context { sessionId }
  → generate_report_ui { sessionId, ... }
  → returns URL: /generated/report-ui.html?sessionId=...
```

**You say:**
```text
What are my weakest subjects across all sessions?
```

**Claude runs:**
```text
get_report_weak_subjects { sessionId }
```

The graph model works like this:

- **Canonical nodes** — concepts are normalised before merge, so wording variants map to one stable node ID.
- **Cluster membership** — a concept can belong to multiple clusters (`core concepts`, `practical usage`, `tradeoffs`, `best practices`) without becoming multiple nodes.
- **Co-occurrence edges** — concepts that appear together in a session are linked with weighted co-occurrence edges.
- **Semantic edges** — curated graph rules can also add explicit semantic relationships, for example tool-to-diagnosis links such as `thread-dump -> lock-contention`.

Example: if the graph already contains `spring-mvc` and a new completed interview extracts `Spring MVC`, the new concept is normalised before merge and updates the existing `spring-mvc` node instead of creating a second node.

Variations handled automatically today:

- case differences: `Spring MVC` -> `spring-mvc`
- spaces vs hyphens vs underscores: `thread dump`, `thread-dump`, `thread_dump`
- repeated separators and punctuation cleanup
- explicitly configured aliases such as `thread dump` / `thread dumps` / `thread-dump`

Variations that still need an explicit alias rule:

- true synonyms that are not just formatting variants
- domain-specific renames such as `thread contention` -> `lock-contention`
- concept families where plural/singular should collapse but the wording is not predictable from formatting alone

Because the graph is derived from saved session concepts, changes to canonicalisation or semantic-edge rules may require a graph rebuild to backfill historical data.

## Full deliberate practice loop

The recommended cycle for deep learning on any topic:

```text
1. start_interview { topic }
   → end_interview

2. start_drill { topic }

3. create_exercise { topic, ... }
   → candidate codes the exercise
   → log_mistake for gaps
   → start_scoped_interview

4. get_due_flashcards → review

5. list_skills { maxConfidence: 2 }
   → practice_micro_skill
```
