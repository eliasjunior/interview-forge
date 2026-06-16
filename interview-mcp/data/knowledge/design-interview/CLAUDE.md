# Knowledge Files — Design Interview Topics

All files in this directory follow the standard knowledge file format. When the user asks to improve or work on any of these files, apply the **Knowledge File Improvement Process** defined in `interview-mcp/CLAUDE.md`.

## Topic Index

### algorithms/
| File | Topic |
|---|---|
| `algorithms/rotate-matrix-algorithm.md` | Rotate Matrix |
| `algorithms/stack-queue-fundamentals.md` | Stacks and Queues Fundamentals |

### api-design/
| File | Topic |
|---|---|
| `api-design/data-access-tradeoffs-growing-complexity.md` | REST API Growth and Data Trade-offs |
| `api-design/mortgage-rest-design.md` | REST API Design & Mortgage Service (Java + Spring Boot) |
| `api-design/payment-api-design.md` | Payment API Design |
| `api-design/rest-spring-jpa.md` | REST API Design, Spring Boot & JPA |
| `api-design/scalable-rest-api.md` | Scalable REST API Design |

### concurrency/
| File | Topic |
|---|---|
| `concurrency/concurrency-fundamentals.md` | Concurrency Fundamentals |
| `concurrency/java-concurrency.md` | Java Concurrency |

### databases/
| File | Topic |
|---|---|
| `databases/database-basics-senior-engineer.md` | Database Basics for Senior Backend Engineers |
| `databases/database-design.md` | Database Design |

### devops/
| File | Topic |
|---|---|
| `devops/cicd-release-flow.md` | CI/CD Release Flow for Backend Engineers |

### java/
| File | Topic |
|---|---|
| `java/java-os-jvm.md` | Java OS & JVM Internals |
| `java/spring-fundamentals.md` | Spring Fundamentals |

### javascript/
| File | Topic |
|---|---|
| `javascript/js-fundamentals.md` | JavaScript Fundamentals (DOM, Promises, Event Loop) |

### security/
| File | Topic |
|---|---|
| `security/java-tls-spring.md` | Java TLS, mTLS, and Spring |
| `security/jwt.md` | JWT — JSON Web Token |
| `security/mtls-tls.md` | TLS and mTLS |
| `security/tls-fundamentals.md` | TLS Fundamentals |

### system-design/
| File | Topic |
|---|---|
| `system-design/backend-user-platform-mixed-interview.md` | Backend User Platform Mixed Interview |
| `system-design/url-shortener.md` | URL Shortener System Design |

## Knowledge File Format

Every file must follow this exact structure:

```markdown
# <Topic Title>

## Summary
<One paragraph: what concepts are covered, what a strong candidate knows>

## Questions
1. <Question 1>
2. <Question 2>
...

## Difficulty
- Question 1: foundation | intermediate | advanced
- Question 2: ...

## Evaluation Criteria
- Question 1: <Strong answer includes X. Weak answer misses Y. Bonus: Z.>
- Question 2: ...

## Concepts
- core concepts: word1, word2
- practical usage: word3, word4
- tradeoffs: word5, word6
- best practices: word7, word8

## Warm-up Quests
### Level 0
1. <MCQ stem>
   A) ...  B) ...  C) ...  D) ...
   Answer: <Correct option>
```

Cluster names must be exactly one of: `core concepts`, `practical usage`, `tradeoffs`, `best practices`.

## Improvement Process (summary)

1. **Load and group** — read the file, group questions into `foundation / intermediate / advanced` tiers. Present tier by tier, not all at once.
2. **Analyse** — for each question: interview frequency + learning value. Flag: definition-first framing, bundled questions, laundry-list prompts, wrong difficulty label, bad ordering, ambiguous scope.
3. **Present findings** — show a table of flagged questions + proposed fix. Wait for approval before changing anything.
4. **Apply** — for each approved change, update `## Questions`, `## Difficulty`, and `## Evaluation Criteria` in sync.

**Never touch** `## Concepts`, `## Summary`, or `## Warm-up Quests` unless explicitly asked.
