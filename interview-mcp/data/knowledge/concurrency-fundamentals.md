# Concurrency Fundamentals

## Summary
Concurrency fundamentals are about reasoning correctly when multiple threads or units of execution interact with shared state. The key challenge is not memorizing library APIs, but understanding why unsynchronized shared memory can produce wrong results, stale reads, broken invariants, and hard-to-reproduce failures.

Key pillars:
- **Thread vs process**: threads share memory within a process; processes have separate memory spaces
- **Atomicity vs visibility**: some problems are about partial/interleaved updates, others are about one thread not seeing another thread's writes
- **Ordering**: compilers and CPUs may reorder operations unless synchronization rules constrain them
- **Happens-before**: the core rule that defines when one thread is guaranteed to observe another thread's actions
- **Failure modes**: race conditions, deadlocks, starvation, and livelock are the common ways concurrent systems fail

This topic should build first-principles understanding. Java examples like `volatile`, `synchronized`, and the Java Memory Model are useful because they make the rules concrete, but the main goal is to explain concurrency itself clearly and precisely.

---

## Questions

1. What is the difference between concurrency and parallelism?
2. What is the difference between a process and a thread, and why do threads introduce coordination problems?
3. What is a race condition? Give a simple example with shared state.
4. Explain the difference between atomicity and visibility.
5. Why can two threads observe different values for the same shared variable on a multi-core machine?
6. What is the purpose of a memory model, such as the Java Memory Model?
7. What does the happens-before relationship guarantee?
8. Why can a shared boolean flag fail without synchronization, and why can something like `volatile` make it work?
9. Why is `count++` on shared state unsafe even when visibility is guaranteed?
10. What does mutual exclusion solve, and what does it not solve by itself?
11. What is a deadlock, and how can consistent lock ordering prevent it?
12. What is starvation, and how is it different from deadlock?
13. What is livelock, and how is it different from deadlock?
14. Explain concurrency from a CPU perspective: registers, caches, main memory, and reordering.
15. What does `synchronized` add beyond a visibility-only mechanism such as `volatile`?

---

## Difficulty

- Question 1: foundation
- Question 2: foundation
- Question 3: foundation
- Question 4: foundation
- Question 5: intermediate
- Question 6: intermediate
- Question 7: intermediate
- Question 8: intermediate
- Question 9: intermediate
- Question 10: intermediate
- Question 11: intermediate
- Question 12: intermediate
- Question 13: advanced
- Question 14: advanced
- Question 15: advanced

---

## Evaluation Criteria

- Question 1: Must explain that concurrency is about multiple tasks making progress during overlapping time, while parallelism is about tasks literally executing at the same time on different execution resources. Weak answer: treats the two terms as synonyms.
- Question 2: Must distinguish process (separate memory space, OS-level isolation) from thread (shared heap within the same process). Must explain that shared memory creates coordination problems such as races, visibility issues, and invariant corruption. Weak answer: only says "threads are lighter" without explaining the consequence of shared state.
- Question 3: Must define race condition as correctness depending on timing/interleaving of unsynchronized operations. Should give a concrete example such as two threads incrementing the same counter. Weak answer: vague statement about "threads colliding" with no shared-state example.
- Question 4: Must explain atomicity as an operation appearing indivisible, and visibility as one thread being able to observe another thread's writes. Strong answer explicitly notes that visibility alone does not make compound operations safe. Weak answer: mixes the two terms together.
- Question 5: Must explain that threads may run on different cores that use registers and caches, so one thread can temporarily observe stale data without synchronization. Should mention that compiler/CPU reordering also matters. Weak answer: says only "because they run fast" or "because RAM is slow."
- Question 6: Must explain that a memory model defines the visibility and ordering guarantees for reads/writes across threads, so developers can reason about correctness without relying on hardware accidents. Strong answer mentions that it constrains legal reordering and defines when writes become observable. Weak answer: describes it only as a JVM optimization detail.
- Question 7: Must define happens-before as the guarantee that one action's effects are visible and ordered before another. Strong answer cites at least two examples such as monitor unlock→lock, volatile write→read, thread start, or thread join. Weak answer: talks about "usually before" with no formal guarantee.
- Question 8: Must explain that without synchronization a thread may keep reading a stale cached value of a shared flag. Must explain that a visibility mechanism such as `volatile` works because the write becomes visible and ordered before the later read. Weak answer: says only "volatile stores in main memory."
- Question 9: Must explain that `count++` is a read-modify-write sequence and therefore not atomic. Must state that even if each read/write is visible, two threads can still read the same old value and overwrite each other. Weak answer: blames timing but does not name lost update or non-atomicity.
- Question 10: Must explain that mutual exclusion prevents multiple threads from executing a critical section simultaneously, which protects compound state changes and invariants. Must also explain that it does not automatically solve higher-level design issues such as deadlock, poor lock ordering, or unnecessary contention. Weak answer: says only "locks make code thread-safe."
- Question 11: Must define deadlock as circular waiting between threads/resources. Must explain consistent lock ordering as a prevention strategy, for example always acquiring locks in the same global order. Weak answer: says "avoid deadlock by being careful."
- Question 12: Must define starvation as a thread repeatedly failing to make progress because other threads keep winning access to CPU or resources. Must distinguish it from deadlock by noting that the system may still make progress overall while one thread does not. Weak answer: treats starvation as another word for deadlock.
- Question 13: Must define livelock as threads remaining active and responsive but still failing to make progress, often because they keep backing off or retrying in sync. Must distinguish it from deadlock, where threads are stuck waiting. Weak answer: cannot distinguish livelock from either deadlock or starvation.
- Question 14: Must explain the roles of registers, per-core caches, main memory, and legal reordering by compiler/CPU. Must connect this to stale reads and the need for memory-ordering guarantees. Weak answer: uses only the inaccurate phrase "everything is flushed to RAM."
- Question 15: Must explain that `synchronized` provides mutual exclusion plus visibility/ordering guarantees. Should mention that monitor exit happens-before later monitor enter on the same monitor. Strong answer contrasts this with `volatile`, which provides visibility/ordering for a variable but not mutual exclusion for compound actions. Weak answer: says only "`synchronized` is stronger."

## Concepts

- core concepts: concurrency, parallelism, thread, process, shared-state, race condition, atomicity, visibility, ordering, java memory model, happens-before, mutual exclusion
- practical usage: volatile, synchronized, lock ordering, critical section, shared flag, counter increment, monitor
- tradeoffs: correctness vs throughput, lock contention, stale reads, compiler reordering, cpu-cache, cache-coherence, fairness, progress guarantees
- best practices: avoid shared mutable state, prefer immutability, protect invariants not just variables, establish lock ordering, keep critical sections small, use visibility-only primitives only for visibility-only problems

## Warm-up Quests

### Level 0

1. What is the difference between concurrency and parallelism?
A) Concurrency means tasks overlap in progress; parallelism means tasks execute at the same time
B) Concurrency means tasks always run on different CPU cores
C) Parallelism means tasks share no memory
D) They are exactly the same concept
Answer: A

2. In most programming systems, what is the key difference between a process and a thread?
A) A process shares heap memory with other processes, but a thread does not
B) Threads always run in parallel, but processes do not
C) A thread is heavier-weight than a process
D) Threads within the same process typically share memory, while processes are isolated from each other
Answer: D

3. Which situation is the best example of a race condition?
A) Two threads increment the same counter without synchronization
B) One thread sleeps for 1 second
C) A program opens a file for reading
D) A method returns a cached constant
Answer: A

4. Which concept is about one thread being able to observe another thread's write?
A) Atomicity
B) Fairness
C) Visibility
D) Parallelism
Answer: C

5. Which concept is about an operation appearing indivisible to other threads?
A) Visibility
B) Atomicity
C) Livelock
D) Cache coherence
Answer: B

6. Why can a shared boolean stop flag fail without synchronization?
A) Because booleans are not supported by CPUs
B) Because threads cannot read booleans concurrently
C) Because the JVM forbids shared flags
D) Because a thread may keep seeing a stale value
Answer: D

7. What problem does mutual exclusion primarily solve?
A) It makes all code non-blocking
B) It ensures only one thread executes a critical section at a time
C) It guarantees no thread will ever starve
D) It removes the need for careful design
Answer: B

8. What is a deadlock?
A) A thread running slowly due to CPU load
B) A thread seeing an old cached value
C) Threads waiting forever because of circular resource dependency
D) Multiple threads making progress at the same time
Answer: C

9. What is starvation?
A) No threads in the system are runnable
B) Two threads wait forever on each other
C) A cache line is reloaded from memory
D) One thread keeps failing to make progress while others continue
Answer: D

10. What does happens-before give you?
A) A guarantee of visibility and ordering between actions
B) A guarantee that code runs faster
C) A guarantee that no locks are needed
D) A guarantee that all threads run on separate cores
Answer: A

### Level 1

1. Which statements about concurrency and parallelism are correct?
A) Concurrency does not require literal simultaneous execution
B) Parallelism implies overlapping execution in real time
C) Concurrency and parallelism are always the same thing
D) A single-core system can still exhibit concurrency
Answer: A,B,D

2. Which statements about shared state are correct?
A) Shared state is always safe if the variable type is primitive
B) Two threads can corrupt a shared invariant even if both pieces of code look correct in isolation
C) Shared mutable state creates the need for coordination
D) Immutability can reduce concurrency risk
Answer: B,C,D

3. Which statements about visibility and atomicity are correct?
A) An operation can be visible without being atomic
B) Visibility and atomicity are exactly the same property
C) An operation can be atomic yet still need ordering guarantees with other actions
D) Correct concurrent code often needs to reason about both
Answer: A,C,D

4. Which statements about stale reads are correct?
A) A thread may observe an old value if no synchronization rule forces visibility
B) CPU caches and registers are part of why stale reads happen
C) Reordering and visibility are related concerns
D) Stale reads are impossible on modern multi-core hardware
Answer: A,B,C

5. Which statements about happens-before are correct?
A) It is a formal visibility/ordering guarantee, not just a timing guess
B) Without happens-before, another thread may legally observe older or reordered effects
C) Thread start and thread join are examples of happens-before rules
D) Happens-before only matters for performance tuning
Answer: A,B,C

6. Which statements about a shared stop flag are correct?
A) Without synchronization, another thread might not notice the flag change promptly
B) The stop flag case is the same as making a counter increment atomic
C) A visibility-only mechanism can be enough when the problem is just "see the latest value"
D) The stop flag is fundamentally a visibility problem
Answer: A,C,D

7. Which statements about `count++` on shared state are correct?
A) It is a read-modify-write sequence
B) Two threads can both read the same old value and both write back the same next value
C) Lost updates are the core failure mode
D) Visibility alone is sufficient to make it correct
Answer: A,B,C

8. Which statements about deadlock prevention are correct?
A) Consistent global lock ordering helps prevent circular wait
B) Reducing the time locks are held can help reduce risk
C) Acquiring locks in arbitrary order is safe if code is small
D) Avoiding unnecessary nested locking is usually helpful
Answer: A,B,D

9. Which statements correctly distinguish starvation and livelock?
A) Starvation and livelock are exactly the same condition
B) In livelock, participants remain active but still fail to make useful progress
C) In starvation, one participant may be blocked out while others still progress
D) Deadlock differs because waiting becomes permanently circular/stuck
Answer: B,C,D

10. Which statements about `synchronized` and `volatile` are correct?
A) `volatile` is about visibility/ordering for a variable access
B) `synchronized` also provides mutual exclusion for a critical section
C) `volatile` makes compound state changes atomic
D) `synchronized` can protect invariants across multiple reads/writes
Answer: A,B,D

### Level 2

1. Explain the difference between concurrency and parallelism, and why concurrency problems can still exist even on a single-core machine.
Hint: Focus on interleaving and shared-state correctness, not just CPU count.
Answer: Concurrency is about multiple tasks making progress during overlapping periods, while parallelism is about tasks actually running at the same instant on separate execution resources. Concurrency bugs do not require multiple cores, because even on a single-core machine the scheduler can interleave operations from different threads in ways that break shared-state assumptions. If correctness depends on uninterrupted execution of a compound operation, interleaving alone is enough to create races.

2. Explain why shared mutable state is the core source of many concurrency problems.
Hint: Mention races, broken invariants, and why "each thread's code looks fine alone" is not enough.
Answer: Shared mutable state means multiple threads can read and write the same data over time, so correctness depends on their interactions rather than on one thread in isolation. That creates risks like race conditions, lost updates, and broken invariants across related fields. The difficulty is that each code path may look locally correct, but the combined interleavings can still produce invalid states unless visibility, ordering, and mutual exclusion are handled explicitly.

3. Explain the difference between visibility and atomicity using a shared stop flag and a shared counter.
Hint: One case is mostly "see the latest value"; the other is a compound update.
Answer: Visibility is about whether one thread can observe another thread's write. A shared stop flag is mainly a visibility problem: one thread writes `false` or `true`, and another thread must reliably see that new value. Atomicity is about an operation appearing indivisible. A shared counter increment is a read-modify-write sequence, so even if each read/write is visible, two threads can still interleave and lose updates unless the entire sequence is protected atomically.

4. Explain what a memory model is and why application developers should care about it.
Hint: Connect it to reordering, visibility, and what guarantees code can rely on.
Answer: A memory model defines the legal rules for visibility and ordering of reads/writes between threads. Developers need it because modern CPUs and compilers reorder operations and use caches aggressively, so intuitive "source order" reasoning is not enough for concurrent code. The memory model tells you which synchronization actions create reliable guarantees and which observations are legal or illegal across threads.

5. Explain happens-before in practical terms and give two examples of how it is established.
Hint: Use examples like monitor boundaries, volatile write/read, thread start, or thread join.
Answer: Happens-before means that one action's effects must be visible and ordered before another action in another thread. It is the bridge from "a write occurred" to "another thread is guaranteed to see it correctly." Examples include a monitor unlock happening-before a later lock on the same monitor, and a volatile write happening-before a later volatile read of the same variable. Thread start and thread join are also classic happens-before boundaries.

6. Explain why two threads can observe different values for the same variable on a multi-core machine without synchronization.
Hint: Mention registers, caches, main memory, and legal reordering.
Answer: Different cores may use registers and local caches, so one thread can keep working with a value that has not yet been made visible to another thread in the way the memory model requires. At the same time, compilers and CPUs may reorder operations when no synchronization forbids it. Without synchronization, there is no guarantee that one thread will observe another thread's writes promptly or in program order, which is why stale reads and surprising behavior are possible.

7. Explain what mutual exclusion solves and why it is still possible to build a poor concurrent design even when locks are used.
Hint: Contrast protecting a critical section with broader problems like contention, deadlock, and oversized lock scope.
Answer: Mutual exclusion ensures that only one thread executes a protected critical section at a time, which helps preserve invariants across compound reads and writes. But locks do not automatically make a design good: you can still create deadlocks through inconsistent ordering, starvation through unfair access, or severe throughput collapse by holding locks too broadly or too long. Correctness is necessary, but good concurrent design also requires careful coordination strategy and contention management.

8. Explain deadlock, starvation, and livelock, and distinguish them clearly.
Hint: One is circular waiting, one is unfair lack of progress, one is active but unproductive behavior.
Answer: Deadlock is circular waiting: threads block forever because each waits for resources held by another. Starvation means a thread or task keeps failing to make progress because others repeatedly win access to CPU time or shared resources, even though the system as a whole may still move forward. Livelock means participants remain active and responsive, often repeatedly retrying or backing off, but still fail to complete useful work. The key distinction is blocked forever, unfairly denied progress, versus active but unproductive behavior.

9. Explain how lock ordering prevents deadlock.
Hint: Use a concrete example with two resources that might otherwise be acquired in different orders.
Answer: Deadlock requires circular wait, so if every code path acquires multiple locks in the same global order, the circle cannot form. For example, if transfers between two accounts always lock the lower account ID first and the higher ID second, two threads cannot end up holding the locks in opposite order. This rule removes one of the necessary deadlock conditions and makes the system easier to reason about.

10. Explain what `synchronized` adds beyond a visibility-only mechanism such as `volatile`.
Hint: Mention mutual exclusion, monitor enter/exit, and compound actions.
Answer: A visibility-only mechanism such as `volatile` can make writes observable and constrain some reordering, but it does not stop multiple threads from entering the same critical section simultaneously. `synchronized` adds mutual exclusion, so compound actions and invariants across multiple reads/writes can be protected as one unit. It also creates happens-before relationships at monitor boundaries, so it provides both exclusion and visibility/ordering guarantees around the protected section.
