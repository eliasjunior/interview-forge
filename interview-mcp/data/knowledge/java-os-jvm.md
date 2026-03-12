# Java OS & JVM Internals

## Summary
Java application startup involves three layers: the OS creates a native process (fork+exec), the JVM runtime initializes inside that process (loading classes, creating system threads), then your application runs via main(). Before main() executes, the JVM has already created multiple internal threads (GC, JIT compiler, signal handler, reference handler) — the exact number depends on the JVM implementation, GC algorithm, and CPU count. In production, thread count alone is not a problem — thread state (RUNNABLE vs BLOCKED vs WAITING) and lock contention determine actual impact. Thread dumps diagnose lock contention and thread pool starvation; heap dumps diagnose memory leaks. Common production issues: BLOCKED threads indicate lock contention (move I/O outside synchronized blocks), WAITING threads may indicate pool exhaustion, and @Async + .get() defeats async causing Tomcat thread pool starvation.

## Questions
1. Walk me through what happens at the OS and JVM level when you run `java -jar app.jar`.
2. How many threads exist in a JVM process before your `main()` method executes, and what types are they?
3. Your production Java service has 400 threads, high CPU, and slow responses. How do you diagnose and interpret a thread dump?
4. A thread dump shows 200 threads BLOCKED on the same lock. Walk me through how you identify the root cause and fix it.
5. In a Spring MVC service backed by Tomcat, all request threads become stuck and new requests queue up. What is happening and how do you fix it?

## Evaluation Criteria
- Question 1: Must describe the three-layer flow: (1) terminal asks OS to create a new process via fork+exec, (2) OS allocates virtual memory, heap, stack, file descriptors and schedules the process, (3) JVM runtime initializes inside that process, loads classes from JAR, creates system threads, then invokes main(). Mental model: OS Process → JVM Runtime → Application. Weak: only mentions "JVM starts" without explaining the OS layer.
- Question 2: Must say there is no fixed number — depends on JVM implementation, GC algorithm, CPU core count, and config flags. Must name at least: main thread, GC threads, JIT compiler threads, signal handler. Bonus: explain why this matters in production (GC threads affect latency, high thread count does not automatically mean a bug, thread dumps contain many JVM-internal threads that must be distinguished from application threads).
- Question 3: Must say thread count alone is not the issue — state matters. Must classify: RUNNABLE = CPU-bound work or busy loop, BLOCKED = lock contention (look for "waiting to lock"), WAITING/TIMED_WAITING = often idle pool threads but check for DB or HTTP pool exhaustion. Must distinguish thread dump (contention and starvation) from heap dump (memory leaks). Must separate JVM internal threads from framework and application threads.
- Question 4: Must explain: find repeated "waiting to lock <0xABC>" to identify the monitor, then find "locked <0xABC>" to identify the owning thread, then inspect that thread's stack trace to find the exact source line. Fix: move I/O (DB calls, HTTP calls, file writes, logging) outside the synchronized block; reduce lock scope to protect only in-memory shared state; replace coarse locks with concurrent data structures. Key line: "timeouts mitigate blast radius but the real fix is removing blocking I/O from synchronized sections."
- Question 5: Must identify thread pool starvation as the root cause. Must explain why @Async + .get() or .join() defeats async and causes starvation under load. Fix: return CompletableFuture (or similar async type) directly from the controller so Tomcat releases the request thread while the work executes. Key insight: async frees threads, not connections — the HTTP connection stays open until the response is ready, but the Tomcat thread is freed.

## Concepts
- core concepts: process, thread, jvm, virtual-memory, heap, stack, thread-state, runnable, blocked, waiting, lock-contention, thread-pool-starvation, deadlock
- practical usage: fork-exec, jvm-bootstrap, class-loading, gc-thread, jit-compiler, thread-dump, heap-dump, synchronized, completablefuture, executorservice, spring-mvc, tomcat, async
- tradeoffs: thread-count-vs-state, sync-block-scope, io-under-lock, async-vs-blocking, lock-granularity, coarse-vs-fine-grained-locking
- best practices: move-io-outside-lock, return-async-from-controller, use-thread-dump-for-contention, use-heap-dump-for-memory, classify-jvm-vs-app-threads, never-async-then-block
