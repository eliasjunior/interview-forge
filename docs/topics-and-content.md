# Topics and Content

[← Back to README](../README.md)

## Knowledge topics

Knowledge files live in `interview-mcp/data/knowledge/*.md`. Each file follows a fixed structure: `## Summary`, `## Questions`, `## Difficulty`, `## Evaluation Criteria`, and `## Concepts`. The `## Difficulty` section tags every question as `foundation`, `intermediate`, or `advanced`.

## How questions are selected per interview

`start_interview` picks **5 questions by default** (configurable up to 10 via `maxQuestions`) using a difficulty-progressive selection:

| Slot | Tier |
|---|---|
| Q1, Q2 | foundation |
| Q3, Q4 | intermediate |
| Q5 | advanced |

Within each tier, questions you have been asked least often across past sessions are prioritised first — so repeated interviews gradually cycle through the full question pool rather than repeating the same 5 questions. When a question has been seen before, the `selectionRationale` field in the `start_interview` response signals Claude to probe deeper instead of accepting a surface-level recall answer.

## Current topics

| File | Topic | Questions |
|---|---|---|
| `jwt.md` | JWT — JSON Web Token | 16 (5 foundation, 7 intermediate, 4 advanced) |
| `rest-spring-jpa.md` | REST API Design, Spring Boot & JPA | 16 (5 foundation, 7 intermediate, 4 advanced) |
| `payment-api-design.md` | Payment API Design | 16 (5 foundation, 7 intermediate, 4 advanced) |
| `url-shortener.md` | URL Shortener System Design | 16 (5 foundation, 7 intermediate, 4 advanced) |
| `mtls-tls.md` | mTLS / TLS | 16 (5 foundation, 7 intermediate, 4 advanced) |
| `tls-fundamentals.md` | TLS Fundamentals | 16 (5 foundation, 7 intermediate, 4 advanced) |
| `java-tls-spring.md` | Java TLS, mTLS, and Spring | 16 (5 foundation, 7 intermediate, 4 advanced) |
| `java-concurrency.md` | Java Concurrency | 21 (5 foundation, 9 intermediate, 7 advanced) |
| `java-os-jvm.md` | Java OS & JVM Internals | 16 (5 foundation, 7 intermediate, 4 advanced) |
| `js-fundamentals.md` | JavaScript Fundamentals: DOM, Callbacks, Promises, XHR, Event Loop & Web APIs | 16 (5 foundation, 7 intermediate, 4 advanced) |
| `cicd-release-flow.md` | CI/CD Release Flow for Backend Engineers | 16 (5 foundation, 7 intermediate, 4 advanced) |
| `rotate-matrix-algorithm.md` | Rotate Matrix (algorithm) | 14 (5 foundation, 7 intermediate, 2 advanced) |
| `mortgage-rest-design.md` | Mortgage REST API Design | 20 (5 foundation, 10 intermediate, 5 advanced) |

## Warm-up quest levels

Every topic has a 4-level progression ladder. Before jumping into a full interview, the system checks your session history and routes you to the right entry point.

| Level | Format | Goal | Evaluation |
|---|---|---|---|
| **L0 — Spark** | Multiple-choice (MCQ) | Trigger memory, reduce anxiety, build familiarity | Auto-scored — answer a letter (A/B/C/D) |
| **L1 — Padawan** | Fill in the blank | Partial activation with low cognitive load | Auto-scored — answer must contain the key term |
| **L2 — Forge** | Open answer with structure hint | Structured thinking, reduce blank-page problem | Orchestrator scores against provided structure |
| **L3 — Ranger** | Full open-ended question | Mock-interview capable | Full evaluation with score, feedback, follow-up |
| **L4 — Jedi Ready** | Full open-ended question | Sustained real-interview readiness | Earned after repeated strong full interviews |

**Status badges on the Topics page:**

| Badge | Meaning |
|---|---|
| L0 — Spark | No sessions exist for this topic yet, or the candidate is still below the first warm-up threshold |
| L1 — Padawan | Working through L1, or dropped back from a poor interview (avg < 2.5) |
| L2 — Forge | Working through L2 |
| L3 — Ranger | Full interview unlocked; latest full interview avg score ≥ 3.0, or all warm-up levels completed |
| L4 — Jedi Ready | Last 2 completed full interviews for this topic both have avg score ≥ 4.0 |

**Level advancement thresholds:** a warm-up level advances only after 2 completed sessions at that level with avg score ≥ 4.0. Warm-up sessions are capped at 5 questions and can draw a different subset each run when more authored questions exist. A full interview with avg < 2.5 drops the topic back to L1 for reinforcement. `L4` requires 2 completed full interviews for that topic with avg score ≥ 4.0 in both.

**MCP tools for the warm-up flow:**
```text
get_topic_level { topic }               → check current level + status
start_warm_up { topic, level? }         → begin warm-up (auto-detects level if omitted)
evaluate_answer { sessionId }           → L0/L1 auto-score; L2 needs orchestrator score
```

Warm-up content lives in the `## Warm-up Quests` section of each knowledge file. When more than 5 questions exist for a level, `start_warm_up` selects up to 5 per session.

## Knowledge file format

```markdown
# <Topic Title>

## Summary
<One-paragraph context — what the topic covers and what a strong candidate knows>

## Questions
1. <Question>
2. ...

## Difficulty
- Question 1: foundation
- Question 2: intermediate
- Question 3: advanced
...

## Evaluation Criteria
- Question 1: <What a strong answer includes. What a weak answer misses. Bonus points.>
- Question 2: ...

## Concepts
- core concepts: word1, word2
- practical usage: word3, word4
- tradeoffs: word5, word6
- best practices: word7, word8
```

Cluster names must be one of: `core concepts`, `practical usage`, `tradeoffs`, `best practices`.

To add warm-up content for a topic, append a `## Warm-up Quests` section:

```markdown
## Warm-up Quests

### Level 0 — Spark (MCQ)
1. <Question text>
   A) <Option A>
   B) <Option B>
   C) <Option C>
   D) <Option D>
   Answer: A

### Level 1 — Padawan (Fill in the Blank)
1. <Sentence with ___ gap>
   Answer: <key term>

### Level 2 — Forge (Guided Answer)
1. <Open question with structure hint>
   Hint: <Scaffolding hint shown to candidate before they answer>
```

Set `AI_ENABLED=true` to let the server generate questions for any topic not in the knowledge base.
