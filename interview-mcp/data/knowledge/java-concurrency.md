# Java Concurrency

## Summary
Java concurrency is the ability to run multiple threads within a single JVM process, sharing the same heap memory. The core challenge is coordinating access to shared mutable state without introducing race conditions, deadlocks, or visibility issues.

Key pillars:
- **Java Memory Model (JMM)**: defines when writes by one thread are visible to another via the happens-before relationship
- **Synchronization**: `synchronized`, `volatile`, `java.util.concurrent.locks` — mechanisms to enforce ordering and atomicity
- **Thread pools**: `ExecutorService` manages a pool of worker threads, avoiding the cost of creating/destroying threads per task
- **Concurrent collections**: `ConcurrentHashMap`, `CopyOnWriteArrayList`, `BlockingQueue` — thread-safe without coarse-grained locking
- **Higher-level abstractions**: `CompletableFuture`, `CountDownLatch`, `Semaphore`, `CyclicBarrier` for coordinating complex workflows

Common pitfalls: race conditions, deadlocks (circular lock dependency), livelocks, starvation, and visibility issues from CPU caching.

## Questions
1. What is the difference between a process and a thread in Java, and what are the main challenges of writing concurrent code?
2. Explain the difference between `synchronized` and `volatile`. When would you use each?
3. What is the Java Memory Model and what does the happens-before relationship guarantee?
4. How does `ExecutorService` work, what types of thread pools does Java provide, and how do you choose between them?
5. Design a thread-safe cache in Java with an expiry mechanism — walk through your implementation and the tradeoffs you made.

## Evaluation Criteria
- Question 1: Must distinguish process (own memory space, OS-level) from thread (shared heap, lighter weight). Must name at least two concurrency challenges: race conditions, visibility, deadlock, atomicity. Weak answer: only says "threads share memory" without naming the problems this causes.
- Question 2: Must explain that `synchronized` provides mutual exclusion AND visibility (full memory barrier), while `volatile` provides visibility only (no atomicity for compound operations like i++). Must give a concrete example of when volatile is insufficient (check-then-act). Bonus: mention that `volatile` prevents instruction reordering.
- Question 3: Must define happens-before as a guarantee that all actions before a write are visible to a thread that reads that write. Must cite at least two happens-before rules: monitor unlock→lock, volatile write→read, thread start, thread join. Weak answer: vague description without naming happens-before or specific rules.
- Question 4: Must name at least three pool types: `newFixedThreadPool` (bounded, predictable), `newCachedThreadPool` (unbounded, short-lived tasks), `newSingleThreadExecutor` (sequential), `newScheduledThreadPool` (delayed/periodic). Must explain the risk of unbounded queues (OOM) and how to configure `ThreadPoolExecutor` with a bounded queue + rejection policy. Bonus: virtual threads (Project Loom, Java 21).
- Question 5: Evaluate the design for: thread-safety of reads and writes (ConcurrentHashMap or lock), expiry strategy (lazy vs background eviction), atomicity of check-then-act (computeIfAbsent), and performance tradeoffs (lock granularity, cache stampede). Strong answer mentions `ConcurrentHashMap.computeIfAbsent` for atomic put-if-absent. Excellent answer addresses cache stampede with a `Future`-based pattern.

## Concepts
- core concepts: thread, process, concurrency, parallelism, race condition, deadlock, livelock, starvation, atomicity, visibility, java memory model, happens-before
- practical usage: synchronized, volatile, reentrantlock, executorservice, threadpoolexecutor, future, completablefuture, countdownlatch, cyclicbarrier, semaphore, blockingqueue, concurrenthashmap, copyonwritearraylist
- tradeoffs: context switching, lock contention, throughput vs latency, lock granularity, optimistic vs pessimistic locking, bounded vs unbounded queue, heap sharing
- best practices: thread confinement, immutability, lock ordering, avoid shared mutable state, prefer concurrent collections over synchronized wrappers, use executorservice over raw threads, shutdown executor on exit
