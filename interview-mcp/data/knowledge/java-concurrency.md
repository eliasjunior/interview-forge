# Java Concurrency

## Summary
Java concurrency is the ability to run multiple threads within a single JVM process, sharing the same heap memory. The core challenge is coordinating access to shared mutable state without introducing race conditions, deadlocks, or visibility issues.

Key pillars:
- **Java Memory Model (JMM)**: defines when writes by one thread are visible to another via the happens-before relationship
- **Synchronization**: `synchronized`, `volatile`, `java.util.concurrent.locks` — mechanisms to enforce ordering and atomicity
- **Thread pools**: `ExecutorService` manages a pool of worker threads, avoiding the cost of creating/destroying threads per task
- **Concurrent collections**: `ConcurrentHashMap`, `CopyOnWriteArrayList`, `BlockingQueue` — thread-safe without coarse-grained locking
- **Higher-level abstractions**: `CompletableFuture`, `CountDownLatch`, `Semaphore`, `CyclicBarrier` for coordinating complex workflows

Common pitfalls: race conditions, deadlocks (circular lock dependency), livelocks, starvation, and visibility issues from CPU caching. A strong candidate can reason about these from first principles — not just name the APIs but explain why the JMM requires explicit synchronization even on modern hardware.

---

## Questions

1. What is the difference between a process and a thread in Java, and what are the main challenges of writing concurrent code?
2. Explain the difference between `synchronized` and `volatile`. When would you use each?
3. What is the Java Memory Model and what does the happens-before relationship guarantee?
4. How does `ExecutorService` work, what types of thread pools does Java provide, and how do you choose between them?
5. Design a thread-safe cache in Java with an expiry mechanism — walk through your implementation and the tradeoffs you made.
6. What is `BlockingQueue` and how does it enable the producer-consumer pattern? Compare `ArrayBlockingQueue` and `LinkedBlockingQueue`.
7. How does `ReentrantLock` differ from `synchronized`? When would you use `ReadWriteLock` instead?
8. What are atomic variables (`AtomicInteger`, `AtomicReference`)? How do they work under the hood and when are they not sufficient?
9. How does `CompletableFuture` work? Walk through chaining operations, combining futures, and handling errors asynchronously.
10. What is a deadlock and how would you prevent it? Give a concrete example of a lock ordering strategy.
11. What is `CountDownLatch` and how does it differ from `CyclicBarrier`? Give a concrete use case for each.
12. What is the difference between `Semaphore` and a mutex? When would you use a `Semaphore` to control resource access?
13. Explain how `ForkJoinPool` works and what kinds of problems it is designed for. How does work-stealing help throughput?
14. What are Java virtual threads (Project Loom, Java 21)? How do they change the mental model for concurrent programming compared to platform threads?
15. What is a lock-free algorithm? Give an example using `compareAndSet` and explain the ABA problem.
16. How would you diagnose and fix thread starvation in a production application? What metrics and tools would you use?

---

## Difficulty

- Question 1: foundation
- Question 2: foundation
- Question 3: foundation
- Question 4: foundation
- Question 5: foundation
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
- Question 16: advanced

---

## Evaluation Criteria

- Question 1: Must distinguish process (own memory space, OS-level) from thread (shared heap, lighter weight). Must name at least two concurrency challenges: race conditions, visibility, deadlock, atomicity. Weak answer: only says "threads share memory" without naming the problems this causes.
- Question 2: Must explain that `synchronized` provides mutual exclusion AND visibility (full memory barrier), while `volatile` provides visibility only (no atomicity for compound operations like i++). Must give a concrete example of when volatile is insufficient (check-then-act). Bonus: mention that `volatile` prevents instruction reordering.
- Question 3: Must define happens-before as a guarantee that all actions before a write are visible to a thread that reads that write. Must cite at least two happens-before rules: monitor unlock→lock, volatile write→read, thread start, thread join. Weak answer: vague description without naming happens-before or specific rules.
- Question 4: Must name at least three pool types: `newFixedThreadPool` (bounded, predictable), `newCachedThreadPool` (unbounded, short-lived tasks), `newSingleThreadExecutor` (sequential), `newScheduledThreadPool` (delayed/periodic). Must explain the risk of unbounded queues (OOM) and how to configure `ThreadPoolExecutor` with a bounded queue + rejection policy. Bonus: virtual threads (Project Loom, Java 21).
- Question 5: Evaluate the design for: thread-safety of reads and writes (ConcurrentHashMap or lock), expiry strategy (lazy vs background eviction), atomicity of check-then-act (computeIfAbsent), and performance tradeoffs (lock granularity, cache stampede). Strong answer mentions `ConcurrentHashMap.computeIfAbsent` for atomic put-if-absent. Excellent answer addresses cache stampede with a `Future`-based pattern.
- Question 6: Must explain that `BlockingQueue` provides thread-safe put/take with blocking semantics — producer blocks when full, consumer blocks when empty. Must distinguish `ArrayBlockingQueue` (bounded, fixed capacity, array-backed, fair ordering optional) from `LinkedBlockingQueue` (optionally bounded, linked nodes, separate head/tail locks for higher throughput). Weak: only describes the pattern without explaining internal locking differences or bounding.
- Question 7: Must explain `ReentrantLock` advantages over `synchronized`: tryLock with timeout, interruptible lock acquisition, fairness policy, condition variables (Condition.await/signal). `ReadWriteLock`: allows multiple concurrent readers OR one exclusive writer — use when reads vastly outnumber writes and read operations are non-trivial. Weak: says "ReentrantLock is more flexible" without naming specific features.
- Question 8: Must explain that atomic variables use CPU compare-and-swap (CAS) instructions — hardware-level atomic read-modify-write with no kernel lock. Insufficient when: compound operations span multiple variables (AtomicReference alone can't atomically update two fields together) or when you need to check-then-act on a collection. Bonus: `AtomicStampedReference` for the ABA problem.
- Question 9: Must describe CompletableFuture chaining: `thenApply` (transform result, same thread), `thenApplyAsync` (transform on executor), `thenCompose` (flat-map, for futures that return futures), `thenCombine` (combine two independent futures). Error handling: `exceptionally`, `handle` (runs on both success and failure). Combining: `allOf`, `anyOf`. Weak: only knows `thenApply` without explaining async variants or error handling.
- Question 10: Must define deadlock as circular lock dependency (A holds lock-1 waiting for lock-2, B holds lock-2 waiting for lock-1). Prevention strategies: consistent lock ordering (always acquire lock-1 before lock-2 everywhere), tryLock with timeout and backoff, lock-free alternatives. Must give a concrete ordering example. Bonus: using `jstack` or `ThreadMXBean.findDeadlockedThreads()` to detect at runtime.
- Question 11: Must distinguish: `CountDownLatch` — one-time barrier, count down to zero then release all waiting threads, cannot be reset (e.g. wait for N services to start); `CyclicBarrier` — reusable barrier, all threads wait until all arrive then proceed together, can repeat (e.g. iterative simulation rounds). Weak: treats them as equivalent or cannot give distinct use cases.
- Question 12: Must distinguish `Semaphore` (counting semaphore, allows N concurrent permits — e.g. limit to 10 concurrent DB connections) from mutex (binary semaphore, one holder at a time). Use `Semaphore` when: rate limiting concurrent access to a resource pool, throttling API calls, implementing bounded parallelism. Weak: says "semaphore is like a lock" without explaining the counting aspect.
- Question 13: Must explain `ForkJoinPool` uses a divide-and-conquer model: task splits itself into subtasks recursively (`fork`), each subtask executes independently, then results are joined (`join`). Work-stealing: idle worker threads steal tasks from the tail of busy workers' deques — improves CPU utilization when subtask sizes are uneven. Best for: CPU-bound recursive tasks (parallel sort, tree traversal), not for blocking I/O. Bonus: `parallelStream()` internally uses the common `ForkJoinPool`.
- Question 14: Must explain virtual threads are JVM-managed, lightweight threads that do not map 1:1 to OS threads. When a virtual thread blocks on I/O, the JVM unmounts it from the carrier (platform) thread and parks it — the carrier thread is freed for another virtual thread. Mental model shift: can create millions of virtual threads where you'd be limited to thousands of platform threads. Use cases: high-concurrency I/O (HTTP servers, DB calls). Caveat: CPU-bound work and `synchronized` blocks still pin the carrier thread. Bonus: `Thread.ofVirtual().start(...)` and `Executors.newVirtualThreadPerTaskExecutor()`.
- Question 15: Must explain CAS (compare-and-set): atomically set value to new only if current equals expected — if another thread changed it, retry. ABA problem: value changes A→B→A between read and CAS — CAS succeeds despite a logical change. Fix: `AtomicStampedReference` adds a version stamp. Lock-free vs wait-free distinction: lock-free guarantees at least one thread makes progress; wait-free guarantees all threads make progress in bounded steps. Weak: describes CAS but cannot explain why ABA matters in linked-list or reference-based structures.
- Question 16: Must define starvation: threads never get scheduled because higher-priority or luckier threads always win. Symptoms: low-priority tasks queue forever, unfair lock policy, executor queue unbounded and always full. Diagnosis: thread dump showing WAITING threads on the same resource for extended periods, executor metrics (queue depth, rejected tasks). Fix: fair ReentrantLock, bounded executor queue with rejection policy, separate thread pools for different priority work, priority queue. Bonus: `jcmd <pid> Thread.print`, `ThreadMXBean.getThreadCpuTime` to find starved threads.

## Concepts

- core concepts: thread, process, concurrency, parallelism, race condition, deadlock, livelock, starvation, atomicity, visibility, java memory model, happens-before
- practical usage: synchronized, volatile, reentrantlock, readwritelock, executorservice, threadpoolexecutor, future, completablefuture, countdownlatch, cyclicbarrier, semaphore, blockingqueue, concurrenthashmap, copyonwritearraylist, forkjoinpool, atomic-variables, cas
- tradeoffs: context switching, lock contention, throughput vs latency, lock granularity, optimistic vs pessimistic locking, bounded vs unbounded queue, heap sharing, platform vs virtual threads
- best practices: thread confinement, immutability, lock ordering, avoid shared mutable state, prefer concurrent collections over synchronized wrappers, use executorservice over raw threads, shutdown executor on exit, bounded queues with rejection policy
