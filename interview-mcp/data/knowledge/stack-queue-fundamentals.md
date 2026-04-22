# Stacks and Queues Fundamentals

## Summary
Stacks and queues are foundational linear data structures that show up everywhere in interviews and real systems. A stack follows `LIFO` (last in, first out), while a queue follows `FIFO` (first in, first out). A candidate who is rusty should first recover the mental model, then the common operations, then typical implementation choices and use cases.

Key properties:
- Stack: push, pop, peek/top
- Queue: enqueue, dequeue, front/peek
- Stack order: newest element leaves first
- Queue order: oldest element leaves first
- Common implementations: arrays/dynamic arrays, linked lists, circular buffers, deque-backed structures

This topic should feel like a smooth re-entry point for someone who vaguely remembers the names but needs help rebuilding confidence before handling interview-style reasoning.

---

## Questions

1. What is a stack, and what does `LIFO` mean in practice?
2. What is a queue, and what does `FIFO` mean in practice?
3. What are the core operations on a stack and a queue?
4. Walk through this stack sequence: push `1`, push `2`, push `3`, then pop once. What remains and what value was removed?
5. Walk through this queue sequence: enqueue `1`, enqueue `2`, enqueue `3`, then dequeue once. What remains and what value was removed?
6. Why is a stack a natural fit for function calls or undo operations?
7. Why is a queue a natural fit for scheduling or breadth-first processing?
8. How can you implement a stack using an array, and what are the trade-offs?
9. How can you implement a queue using an array, and why is a naive shifting array often a bad idea?
10. What is a circular queue, and what problem does it solve?
11. How would you implement a queue using two stacks?
12. How would you implement a stack using two queues, and why is it less natural?
13. What are common edge cases when implementing stacks and queues?
14. Compare stacks and queues in terms of access pattern, use cases, and common interview mistakes.

---

## Difficulty

- Question 1: foundation
- Question 2: foundation
- Question 3: foundation
- Question 4: foundation
- Question 5: foundation
- Question 6: foundation
- Question 7: foundation
- Question 8: intermediate
- Question 9: intermediate
- Question 10: intermediate
- Question 11: intermediate
- Question 12: intermediate
- Question 13: intermediate
- Question 14: advanced

---

## Evaluation Criteria

- Question 1: Must define a stack as a linear structure where insertion and removal happen at the same end. Must explain `LIFO` as "the most recently added item is removed first." Weak answer: only says "like a pile of plates" without naming the rule clearly.
- Question 2: Must define a queue as a linear structure where elements are added at one end and removed from the other. Must explain `FIFO` as "the oldest item leaves first." Weak answer: confuses queue ordering with stack ordering.
- Question 3: Must name `push`, `pop`, and `peek`/`top` for a stack, and `enqueue`, `dequeue`, and `front`/`peek` for a queue. Bonus: mention `isEmpty` and sometimes `size`.
- Question 4: Must conclude that `3` is removed and `1, 2` remain, with `2` now on top. Weak answer: removes `1`, which reveals FIFO confusion.
- Question 5: Must conclude that `1` is removed and `2, 3` remain, with `2` now at the front. Weak answer: removes `3`, which reveals LIFO confusion.
- Question 6: Must explain that function calls and undo actions need to return to the most recent unfinished state first. Bonus: mention call stack frames or browser backtracking behavior.
- Question 7: Must explain that scheduling and breadth-first work need fair arrival ordering, so earlier items should be processed before newer ones. Bonus: mention printer queues, task queues, or BFS.
- Question 8: Must explain array-backed stack implementation with a top pointer or using the end of a dynamic array. Must state that push/pop at the end are typically O(1) amortized. Weak answer: suggests inserting/removing at the front of an array as the normal stack approach.
- Question 9: Must explain that a naive array queue that removes from index 0 causes shifting of all remaining elements, making dequeue O(n). Must propose a better design such as a circular buffer or linked list. Weak answer: says arrays are always O(1) for queues without qualification.
- Question 10: Must define a circular queue as an array-backed queue that wraps head/tail indices around to reuse freed slots. Must explain that it avoids repeated shifting and makes enqueue/dequeue O(1). Weak answer: describes it vaguely as "a queue in a loop."
- Question 11: Must explain the standard two-stack queue idea: one stack for incoming pushes, one for outgoing pops; when the outgoing stack is empty, move all items from incoming to outgoing. Must justify why this reverses order correctly. Bonus: note amortized O(1).
- Question 12: Must explain that implementing a stack with two queues is possible by reordering elements during push or pop so the newest item stays accessible first. Must note it is less natural because queues do not directly support same-end insertion/removal behavior. Weak answer: cannot explain where the reordering cost appears.
- Question 13: Must mention underflow on pop/dequeue from empty, overflow only for fixed-capacity implementations, off-by-one pointer bugs, and keeping size/head/tail/top consistent. Bonus: mention distinguishing full vs empty in circular queues.
- Question 14: Must compare stack vs queue by access rule, operation direction, and natural applications. Strong answer also calls out common interview traps: mixing up front/top, forgetting amortized vs worst-case array behavior, and choosing the wrong structure for BFS/DFS. Weak answer: just repeats LIFO vs FIFO with no practical comparison.

## Concepts

- core concepts: stack, queue, lifo, fifo, linear-data-structure, push, pop, enqueue, dequeue, peek
- practical usage: call-stack, undo, browser-history, bfs, task-scheduling, buffering, producer-consumer
- tradeoffs: array-vs-linked-list, shifting-cost, circular-buffer, amortized-complexity, underflow, fixed-capacity-vs-dynamic
- best practices: clear-operation-naming, handle-empty-cases, track-head-tail-correctly, avoid-front-shifts, choose-structure-by-access-pattern

## Warm-up Quests

### Level 0 — Trace Small Problems (MCQ)
1. You are scanning the string `"("` for the Valid Parentheses problem. What should you do with the character?
   A) Ignore it
   B) Push it onto the stack
   C) Pop from the stack
   D) Return false immediately
   Answer: B

2. You are scanning the string `"()"`. After reading the second character `")"`, what should happen?
   A) Push `")"` onto the stack
   B) Pop the matching `"("` from the stack
   C) Clear the whole stack no matter what
   D) Return true immediately, even if more characters remain
   Answer: B

3. You are scanning the string `")("`. What should happen on the very first character?
   A) Push it and continue
   B) Skip it and continue
   C) Return false because there is no matching opener
   D) Reverse the string first
   Answer: C

4. After scanning the full string `"(()"`, what does the stack tell you?
   A) The string is valid because no error happened yet
   B) The string is invalid because one opener is still unmatched
   C) The string is valid because it starts with `"("`
   D) The string is invalid only if it contains square brackets
   Answer: B

5. Which idea is the core reason a stack works for Valid Parentheses?
   A) We need random access to all previous characters
   B) We must always match the oldest opening bracket first
   C) We must match the most recent unmatched opening bracket first
   D) We need the characters to stay sorted
   Answer: C

### Level 1 — Short Coding Recall
1. In Valid Parentheses, opening brackets are usually ___ onto the stack.
   Answer: pushed

2. On a closing bracket, you compare against the ___ element of the stack.
   Answer: top

3. If the stack is empty when a closing bracket appears, you should return ___.
   Answer: false

4. After processing the entire string, the stack must be ___ for the input to be valid.
   Answer: empty

5. A common optimization is to use a map like `')' -> '('` so each closing bracket can be checked against its expected ___ bracket.
   Answer: opening

### Level 2 — Guided Coding Patterns
1. Explain how you would solve "Valid Parentheses" using a stack. Use this structure: [what gets pushed → what happens on each closing bracket → what must be true at the end].
   Hint: Do not count brackets. Focus on matching the most recent unmatched opener.
   Answer: Push every opening bracket onto the stack. For each closing bracket, first check whether the stack is empty; if it is, the string is invalid because there is nothing to match. Otherwise compare the stack top to the expected opening bracket for that closing bracket. If they match, pop; if they do not, return false. After the full scan, the string is valid only if the stack is empty.

2. Explain why a simple counter is not enough for mixed bracket types like `"([)]"`. Use this structure: [what a counter can detect → what it misses → why stack order fixes that].
   Hint: The issue is not just "how many" open brackets exist, but "which one must close next."
   Answer: A counter can tell you whether the total number of openings and closings lines up, but it cannot preserve bracket type or nesting order. In `"([)]"`, the counts look balanced, yet the `')'` is trying to close `'('` while `'['` is still the most recent unmatched opener. A stack fixes that because it remembers the exact opening bracket that must be matched next.

3. Explain how you would trace the string `"{[()]}"` with a stack. Use this structure: [push steps → pop steps → final result].
   Hint: Read left to right and describe only what happens at the top of the stack.
   Answer: Push `'{'`, then push `'['`, then push `'('`. When `')'` appears, it matches `'('`, so pop. When `']'` appears, it matches `'['`, so pop. When `'}'` appears, it matches `'{'`, so pop. The stack ends empty, so the string is valid.

4. Explain how you would trace the string `"([)]"` with a stack and identify the exact failure point. Use this structure: [initial pushes → first bad closing bracket → why it fails immediately].
   Hint: The wrong answer is not "finish scanning and then decide." The failure happens at a specific character.
   Answer: Push `'('`, then push `'['`. The next character is `')'`, which expects `'('` on the top of the stack, but the actual top is `'['`. That mismatch means the nesting order is broken, so the algorithm should return false immediately at that character without scanning the rest.

5. Explain how this warm-up pattern prepares a candidate for harder stack problems. Use this structure: [basic matching → ordered removal idea → next problem families].
   Hint: Connect "most recent unresolved item" to larger interview patterns.
   Answer: Valid Parentheses teaches the core stack instinct: keep unresolved items, and always resolve the most recent one first. Once that becomes natural, it transfers to harder problems such as removing adjacent pairs, evaluating expressions, next greater element, daily temperatures, largest rectangle in histogram, and monotonic stack problems in general. The warm-up works because it builds the right mental move before adding harder index and complexity details.
