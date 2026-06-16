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

1. What is the difference between a process and a thread in Java, and why does sharing heap memory make concurrent code harder to get right?
2. Two threads in your application read and write a shared boolean flag, but one thread sometimes never sees the update. What is happening at the JVM level, and what does the Java Memory Model guarantee to fix it?
3. What is the difference between `synchronized` and `volatile`? When is `volatile` enough, and when does it fall short?
4. What thread pool types does Java's `ExecutorService` provide, and how do you choose the right one for CPU-bound versus I/O-bound work in a backend service?
5. Design a thread-safe cache in Java with an expiry mechanism — walk through your implementation and the tradeoffs you made.
6. Your producer threads are generating work faster than consumers can process it. How does `BlockingQueue` coordinate them, and how would you choose between `ArrayBlockingQueue` and `LinkedBlockingQueue`?
7. When would you reach for `ReentrantLock` over `synchronized`, and in what scenario would `ReadWriteLock` give you a further advantage?
8. You need a shared counter incremented by many threads without using `synchronized`. What does `AtomicInteger` give you that a plain `int` doesn't, how does it work at the CPU level, and when is it still not enough?
9. You have three independent async service calls that must all complete before responding, and one that should fall back gracefully on failure. How would you model this with `CompletableFuture`, and where does error handling belong in the chain?
10. Two threads in your application are permanently stuck — each holding a lock the other needs. Why does this happen, and what concrete strategy would prevent it?
11. You need to wait for N async tasks to complete before proceeding, and separately synchronize N threads at a phase boundary on each loop iteration. Which primitives would you use for each scenario, and why do they fit?
12. You want to cap your service at 10 concurrent database connections. What Java primitive models this naturally, and how does it differ from a plain lock?
13. You are parallelizing a recursive tree computation and notice a standard thread pool leaves many threads idle while a few process large subtasks. What makes `ForkJoinPool` better suited here, and how does work-stealing reduce that idle time?
14. Your I/O-heavy service is running out of platform threads under load. How do virtual threads change the scalability picture, and where do they still not help?
15. Walk through how `compareAndSet` allows concurrent updates without locks, and explain the ABA problem it can still be vulnerable to.
16. A low-priority task in your executor has been queued for 30 seconds under moderate load. Walk through how you would confirm this is starvation and what you would change to fix it.
17. A shared `volatile boolean running` flag reliably signals a stop to another thread. Trace what the JVM and CPU actually do on write and read, and explain why it works.
18. Why is `volatile int count; count++;` still broken, even though `volatile` guarantees visibility?
19. You are choosing between `AtomicInteger` and `LongAdder` for a new counter in a high-throughput service. What factors drive the decision, and when would `AtomicInteger` still be the right pick despite `LongAdder` being faster under contention?
20. Your team is debating `synchronized`, `AtomicInteger`, or `LongAdder` for a shared counter in a high-traffic service. Walk through your reasoning for a metrics counter versus a strict rate limiter.
21. A colleague insists that since all threads share the same JVM heap, they always see each other's writes immediately. Correct this mental model from the CPU up, and explain how `volatile`, CAS, and locks each restore correctness.
22. Without synchronization, thread A writes `x = 1` on one core but thread B still reads `x = 0` on another. Explain the hardware-level reasons this can happen, without falling back on the oversimplification that each thread owns a dedicated CPU core.
23. The common shorthand for `volatile` is "flush before write, refresh after read." What does this capture, where does it mislead, and what does `volatile` actually guarantee?
24. A colleague argues that since `volatile` already handles visibility, it should be enough to protect a critical section. What does `synchronized` add that `volatile` cannot provide, at both the JMM and CPU level?
25. Your metrics counter shows throughput degradation under load when using `AtomicInteger`. Trace what is happening at the CPU level under heavy contention, how `LongAdder` addresses it structurally, and what you trade off.

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
- Question 16: advanced
- Question 17: intermediate
- Question 18: intermediate
- Question 19: advanced
- Question 20: advanced
- Question 21: advanced
- Question 22: advanced
- Question 23: advanced
- Question 24: advanced
- Question 25: advanced

---

## Evaluation Criteria

- Question 1: Must distinguish process (own memory space, OS-level) from thread (shared heap, lighter weight). Must connect the shared heap to at least one concrete challenge: race conditions, visibility gaps, or atomicity failures. Strong answer names two or more problems and explains why shared mutable state is the root cause. Weak answer: only says "threads share memory" without explaining what goes wrong as a result.
- Question 2: Must identify the root cause as a visibility or stale-read issue from CPU caches or compiler reordering. Must explain that the Java Memory Model defines when one thread's writes become visible to another, and that the happens-before relationship is the guarantee that resolves it. Must cite at least one happens-before rule (volatile write→read, or monitor unlock→lock). Strong answer explains that "just reading RAM every time" is an oversimplification — the real guarantee is ordering and visibility enforced via memory barriers. Weak answer: says "use volatile" without explaining why the JMM requires it or what happens-before means.
- Question 3: Must explain that `synchronized` provides mutual exclusion AND visibility (full memory barrier), while `volatile` provides visibility and ordering only — no atomicity for compound operations like `i++`. Must state when `volatile` is enough (single-write/single-read flag) and when it falls short (check-then-act, read-modify-write sequences). Bonus: mention that `volatile` prevents instruction reordering around that access. Weak answer: says "volatile is for visibility" without explaining the atomicity gap or giving a concrete failing example.
- Question 4: Must name at least three pool types and match them to use cases: `newFixedThreadPool` (predictable CPU-bound load), `newCachedThreadPool` (many short-lived I/O tasks — unbounded, risky under spike), `newSingleThreadExecutor` (sequential processing), `newScheduledThreadPool` (delayed/periodic). Must explain why `newCachedThreadPool` is dangerous in production and how to configure `ThreadPoolExecutor` with a bounded queue and rejection policy. Bonus: virtual threads via `Executors.newVirtualThreadPerTaskExecutor()` for high-concurrency I/O workloads.
- Question 5: Evaluate the design for: thread-safety of reads and writes (ConcurrentHashMap or lock), expiry strategy (lazy vs background eviction), atomicity of check-then-act (computeIfAbsent), and performance tradeoffs (lock granularity, cache stampede). Strong answer mentions `ConcurrentHashMap.computeIfAbsent` for atomic put-if-absent. Excellent answer addresses cache stampede with a `Future`-based pattern.
- Question 6: Must explain that `BlockingQueue` solves the producer-consumer coordination problem by blocking producers when full and consumers when empty, removing the need for manual wait/notify. Must distinguish `ArrayBlockingQueue` (bounded, fixed capacity, array-backed, optional fairness) from `LinkedBlockingQueue` (optionally bounded, linked nodes, separate head/tail locks for higher throughput). Strong answer connects the bounding choice to backpressure behavior under overload. Weak answer: describes the pattern without explaining blocking semantics, internal locking differences, or why bounding matters.
- Question 7: Must name concrete `ReentrantLock` advantages over `synchronized`: `tryLock` with timeout, interruptible lock acquisition, fairness policy, multiple condition variables (`Condition.await/signal`). Must explain `ReadWriteLock`: multiple concurrent readers OR one exclusive writer — valuable when reads vastly outnumber writes and read operations are non-trivial. Strong answer gives a scenario for each. Weak answer: says "ReentrantLock is more flexible" without naming specific capabilities or when they matter.
- Question 8: Must identify the problem: plain `int` is not safe under concurrent increment because read-modify-write is not atomic. Must explain that `AtomicInteger` solves this via CPU compare-and-swap (CAS) — hardware-level atomic read-modify-write with no kernel lock. Must state when it is still insufficient: compound operations spanning multiple variables, or check-then-act on a collection. Bonus: `AtomicStampedReference` for ABA-sensitive cases. Weak answer: says "AtomicInteger is thread-safe" without explaining CAS or the compound-operation gap.
- Question 9: Must identify `allOf` for waiting on three independent futures and `exceptionally` or `handle` for the fallback case. Must describe chaining operators: `thenApply` (transform, same thread), `thenApplyAsync` (transform on executor), `thenCompose` (flat-map for futures returning futures), `thenCombine` (join two independent futures). Must explain that error handling belongs explicitly in the chain — not left implicit. Weak answer: only knows `thenApply` without explaining async variants, combining, or where recovery fits.
- Question 10: Must identify the root cause as circular lock dependency — A holds lock-1 waiting for lock-2, B holds lock-2 waiting for lock-1. Must explain consistent global lock ordering as the primary prevention strategy (always acquire locks in the same order everywhere). Strong answer gives a concrete two-lock ordering example. Bonus: `tryLock` with timeout and backoff, or `jstack` / `ThreadMXBean.findDeadlockedThreads()` for detection. Weak answer: names deadlock without explaining the circular dependency or giving a concrete prevention approach.
- Question 11: Must correctly match each tool to its scenario. `CountDownLatch`: one-shot, counts down to zero then releases all waiters — fits "wait for N tasks to complete before proceeding." `CyclicBarrier`: reusable, all parties wait until all arrive then proceed together — fits "synchronize N threads at a phase boundary each iteration." Must explain why the reusability distinction matters. Weak answer: treats them as interchangeable or cannot justify the assignment.
- Question 12: Must identify `Semaphore` as the right fit and explain why: it models N concurrent permits, so 10 permits = at most 10 concurrent holders. Must distinguish from a mutex (binary — one holder at a time). Must explain the acquire/release contract and what happens when all permits are held. Strong answer connects this to connection pool or rate-limiting patterns. Weak answer: says "Semaphore is like a lock" without explaining the counting aspect or why a lock alone cannot model N concurrent access.
- Question 13: Must explain that a standard thread pool performs poorly here because subtask sizes are uneven — some threads finish early and sit idle. Must explain `ForkJoinPool`'s divide-and-conquer model: tasks recursively `fork` into subtasks, then `join` results. Work-stealing: idle threads steal tasks from the tail of busy workers' deques, keeping CPUs utilized. Best for CPU-bound recursive tasks (parallel sort, tree traversal), not blocking I/O. Bonus: `parallelStream()` uses the common `ForkJoinPool` internally. Weak answer: describes fork/join mechanics without connecting them to the idle-thread problem.
- Question 14: Must identify the root problem: platform threads map to OS threads and are expensive, so a high-concurrency I/O service exhausts them under load. Must explain virtual threads are JVM-managed, do not map 1:1 to OS threads — when a virtual thread blocks on I/O, the JVM unmounts it from its carrier thread, which is freed for another virtual thread. Must state where they still do not help: CPU-bound work is not faster, shared-state contention is unchanged, and `synchronized` blocks can still pin the carrier thread. Bonus: `Executors.newVirtualThreadPerTaskExecutor()`. Weak answer: only says "virtual threads are lighter" without explaining the unmounting mechanism or their limits.
- Question 15: Must walk through CAS: atomically set value to new only if current equals expected — if another thread changed it first, the operation retries. Must explain the ABA problem: value changes A→B→A between the read and the CAS — CAS succeeds despite a logically stale observation. Must explain why this matters in pointer/reference-based structures. Fix: `AtomicStampedReference` adds a version stamp. Bonus: lock-free vs wait-free distinction. Weak answer: describes CAS retry loop but cannot explain why ABA is a problem or give a structural example.
- Question 16: Must identify starvation: low-priority tasks never get scheduled because higher-priority or luckier threads always win queue slots. Must describe how to confirm it: thread dump or executor metrics showing one task in WAITING state for far longer than expected, while other tasks run freely, combined with non-exhausted CPU. Must propose concrete fixes: fair `ReentrantLock`, bounded queue with rejection policy, separate pools for different priority work. Bonus: `jcmd <pid> Thread.print`, `ThreadMXBean.getThreadCpuTime`. Weak answer: confuses starvation with deadlock or proposes only "add more threads."
- Question 17: Must explain that a simple boolean flag works because one thread only writes a fresh value and the other only reads it — no read-modify-write sequence, so visibility is the only requirement. Must trace the JMM guarantee: a `volatile` write happens-before a subsequent `volatile` read of the same variable, so the writing thread's prior actions become visible to the reader. Should mention memory barrier / fence semantics that prevent stale cached reads and unsafe reordering. Weak answer: says only "volatile stores in main memory" without explaining happens-before or why atomicity is not needed here.
- Question 18: Must explain that `count++` is a read-modify-write sequence: read current value, add one, write back. `volatile` makes each individual read and write visible, but does not make the compound sequence atomic — two threads can both read 5 and both write 6, losing an update. Strong answer names this explicitly as a race condition or lost update. Weak answer: blames "timing" vaguely without identifying the non-atomic sequence as the root cause.
- Question 19: Must identify the key factors: `AtomicInteger` protects a single CAS location — precise and efficient under low to moderate contention, correct choice when an exact instant-by-instant value is required (IDs, sequence numbers). `LongAdder` spreads writes across striped cells — higher throughput under heavy contention, but `sum()` is an aggregate across cells so it is not suitable when correctness depends on one exact shared value at each moment. Strong answer gives a concrete example of when precision matters. Weak answer: only says "LongAdder is faster under contention" without explaining the precision tradeoff.
- Question 20: Must reason about each tool in context. `synchronized`: correct when protecting compound state or multiple related fields, but serializes access under contention. `AtomicInteger`: exact single-value counter — right for sequence generation or cases where per-nanosecond accuracy matters. `LongAdder`: highest write throughput for metrics where approximate aggregate is fine. Key insight: strict rate limiting needs exactness and often needs compound coordination, so `LongAdder` fits metrics but not enforcement. Weak answer: picks one tool universally without discussing contention, exactness, or the semantic difference between metrics and rate limiting.
- Question 21: Must correct the colleague's model: threads sharing heap memory does not mean writes are instantly visible — cores use local caches and registers, and compilers/CPUs may reorder operations legally unless synchronization prevents it. Must explain happens-before as the ordering and visibility guarantee. Must explain what each tool contributes: `volatile` adds visibility and ordering barriers for a variable, locks add mutual exclusion plus visibility for a critical section, CAS-based atomics rely on hardware atomic instructions with memory-ordering guarantees. Bonus: load/store fence semantics. Weak answer: says "volatile flushes to main memory" without addressing reordering or happens-before.
- Question 22: Must explain that threads are not permanently bound to a core — the OS and JVM scheduler move them. Must explain that each core has private caches and registers, so a write on one core may sit in that core's cache and not be observed by another core until cache coherence or synchronization forces it. Must distinguish this from "Java forgetting to use RAM" — the issue is unsynchronized observation across cores, not a language bug. Strong answer names cache coherence protocols conceptually and explains stale reads. Weak answer: says "different cores have different memory" without explaining the cache coherence mechanism or incorrectly claims permanent thread-to-core assignment.
- Question 23: Must explain that "flush/refresh everything" is a useful shorthand for visibility and ordering but is not a literal description — the JVM does not dump or reload all of memory on every volatile access. Must state the real guarantee: a volatile write happens-before a subsequent volatile read of the same variable, and volatile accesses carry fence semantics that prevent unsafe reordering around that access point. Strong answer mentions release/acquire-style semantics or load/store barriers. Weak answer: repeats "stored in main memory" without clarifying the ordering guarantee or what the simplification gets wrong.
- Question 24: Must identify what `volatile` cannot provide: mutual exclusion. A critical section requires that only one thread executes it at a time — `volatile` does not prevent concurrent entry. Must explain `synchronized` at JMM level: monitor exit happens-before a later monitor enter on the same monitor. Must explain at CPU level: the monitor establishes ordering constraints around the section in addition to exclusion. Strong answer contrasts: `volatile` protects a single variable's visibility/ordering, `synchronized` protects compound actions and invariants across multiple reads and writes. Weak answer: says only "synchronized is thread-safe" without naming mutual exclusion, monitor semantics, or what `volatile` specifically cannot do.
- Question 25: Must identify the root cause: `AtomicInteger` concentrates all updates on one CAS-protected memory location — under high contention, many threads repeatedly fail CAS and spin-retry, and the hot cache line bounces between cores (cache-line ping-pong), degrading throughput. Must explain `LongAdder`'s structural fix: updates are spread across striped internal cells so concurrent writers contend on different memory locations. Must state the tradeoff: reading requires summing cells — correct for throughput-oriented metrics but wrong when an exact per-moment value is required for correctness. Weak answer: says "LongAdder uses multiple cells" without explaining why contention causes retries, hot spots, or the cache-line bouncing mechanism.

## Concepts

- core concepts: thread, process, concurrency, parallelism, race condition, deadlock, livelock, starvation, atomicity, visibility, java memory model, happens-before, memory-barrier, cache-coherence, cpu-cache, compiler-reordering
- practical usage: synchronized, volatile, reentrantlock, readwritelock, executorservice, threadpoolexecutor, future, completablefuture, countdownlatch, cyclicbarrier, semaphore, blockingqueue, concurrenthashmap, copyonwritearraylist, forkjoinpool, atomic-variables, cas, atomicinteger, longadder
- tradeoffs: context switching, lock contention, throughput vs latency, lock granularity, optimistic vs pessimistic locking, bounded vs unbounded queue, heap sharing, platform vs virtual threads, precision-vs-throughput
- best practices: thread confinement, immutability, lock ordering, avoid shared mutable state, prefer concurrent collections over synchronized wrappers, use executorservice over raw threads, shutdown executor on exit, bounded queues with rejection policy, use-volatile-only-for-visibility-not-compound-updates

## Warm-up Quests

### Level 0

1. In Java, what is the main difference between a process and a thread?
A) A process shares the heap with other processes, but a thread does not
B) A thread shares heap memory with other threads in the same process, but a process has its own memory space
C) A thread always runs on a dedicated CPU core, but a process does not
D) A process is lighter-weight than a thread
Answer: B

2. When would `volatile` be appropriate?
A) When you need to make `count++` atomic across threads
B) When you need mutual exclusion for a critical section
C) When you need a shared flag to become visible quickly across threads
D) When you need to update two related fields consistently
Answer: C

3. What is a race condition?
A) When two threads are created at the same time
B) When a thread is blocked waiting on I/O
C) When the JVM uses more than one CPU core
D) When program correctness depends on timing/interleaving of unsynchronized operations
Answer: D

4. Which type is most directly designed for a producer-consumer queue with blocking behavior?
A) `HashMap`
B) `ArrayList`
C) `BlockingQueue`
D) `AtomicInteger`
Answer: C

5. Why is `AtomicInteger` usually safer than a plain shared `int` for concurrent increments?
A) Because it makes read-modify-write updates atomic
B) Because it stores the value off-heap
C) Because it guarantees fairness between threads
D) Because it prevents all lock contention in the JVM
Answer: A

6. Which statement best distinguishes `CountDownLatch` from `CyclicBarrier`?
A) `CountDownLatch` is reusable, `CyclicBarrier` is one-shot
B) `CountDownLatch` releases one waiting thread at a time, `CyclicBarrier` releases none
C) `CountDownLatch` is typically one-shot, while `CyclicBarrier` is reusable across rounds
D) They are equivalent and differ only by package name
Answer: C

7. What does a `Semaphore` with 10 permits model most naturally?
A) Only one thread may ever enter the protected code
B) Exactly 10 threads must arrive before continuing
C) 10 tasks must be executed sequentially
D) Up to 10 concurrent holders may access the protected resource
Answer: D

8. Why is `ExecutorService` usually preferred over manually creating raw threads for every task?
A) It manages worker reuse and task execution more efficiently
B) It avoids all synchronization issues automatically
C) It guarantees tasks run in submission order
D) It makes every task non-blocking
Answer: A

9. Why is `ConcurrentHashMap` usually preferred over `HashMap` for concurrent access?
A) It is always lock-free for every operation
B) It automatically makes compound check-then-act operations atomic
C) It preserves insertion order under concurrency
D) It allows thread-safe access without external coarse-grained synchronization
Answer: D

10. What is `LongAdder` primarily optimized for?
A) Exact transactional counters across multiple fields
B) High-throughput counters under heavy write contention
C) Single-threaded integer arithmetic
D) Replacing all uses of `AtomicInteger`
Answer: B

### Level 1

1. Which statements about `volatile` are correct?
A) It guarantees visibility of writes to other threads
B) It makes `count++` atomic
C) It prevents some unsafe reordering around that variable access
D) It provides mutual exclusion
Answer: A,C

2. Which statements about `count++` on a shared `volatile int` are correct?
A) It is still a read-modify-write sequence
B) Two threads can still lose updates
C) Two threads can still read the same old value before either writes back
D) Visibility alone is not enough to make it correct
Answer: A,B,C,D

3. Which statements about `ConcurrentHashMap` are correct?
A) Individual map operations are thread-safe
B) Compound check-then-act logic may still need extra coordination
C) `get` followed by conditional `put` is automatically atomic
D) `computeIfAbsent` can help with atomic put-if-absent style logic
Answer: A,B,D

4. Which statements about `AtomicInteger` and `LongAdder` are correct?
A) `AtomicInteger` is often better when you need a single exact value at each instant
B) `LongAdder` reduces write contention by spreading updates across internal cells
C) `LongAdder` is usually preferred for metrics-style counters under heavy concurrency
D) `LongAdder` is usually a poor fit when correctness depends on one exact instant-by-instant shared value
Answer: A,B,C,D

5. Which statements about `ReentrantLock` are correct?
A) It supports `tryLock`
B) It supports interruptible lock acquisition
C) It supports fairness configuration
D) It is identical to `synchronized` in capabilities
Answer: A,B,C

6. Which statements about thread pools are correct?
A) An unbounded queue can hide overload until memory pressure becomes severe
B) A bounded queue can provide backpressure or trigger rejection
C) `newCachedThreadPool()` always gives the safest production default
D) Thread-pool design should consider whether work is CPU-bound or I/O-bound
Answer: A,B,D

7. Which statements about virtual threads are correct?
A) They are well-suited to high-concurrency I/O-heavy workloads
B) They make CPU-bound work inherently faster
C) Blocking I/O can unmount a virtual thread from its carrier thread
D) They eliminate the need to reason about shared mutable state
Answer: A,C

8. Which strategies help prevent deadlock?
A) Acquire locks in a consistent global order
B) Hold one lock while waiting indefinitely for another in arbitrary order
C) Use timeouts or `tryLock` where appropriate
D) Reduce the scope and duration of held locks
Answer: A,C,D

9. Which statements about `BlockingQueue` are correct?
A) Producers can block when the queue is full
B) Consumers can block when the queue is empty
C) It is a natural fit for producer-consumer coordination
D) Queue capacity choices still matter because they determine overload behavior and backpressure
Answer: A,B,C,D

10. Which statements about happens-before are correct?
A) A monitor unlock happens-before a later lock on the same monitor
B) A `volatile` write happens-before a later `volatile` read of the same variable
C) Thread start and join establish happens-before relationships
D) Without happens-before, another thread may observe stale or reordered effects
Answer: A,B,C,D

### Level 2

1. Explain why `volatile boolean running` can work for a stop flag, but `volatile int count; count++;` is still broken.
Hint: Separate visibility/ordering from atomicity, and describe the read-modify-write sequence.
Answer: `volatile` can be enough for a stop flag because one thread writes a new value and another thread only needs to observe that value promptly. The Java Memory Model guarantees visibility and ordering for the volatile write/read pair. But `count++` is a compound read-modify-write operation: read current value, add one, write back. `volatile` makes each read and write visible, but it does not make the whole sequence atomic, so concurrent increments can overwrite each other and lose updates.

2. In a backend service, how would you choose between `synchronized`, `AtomicInteger`, and `LongAdder` for metrics, ID generation, and rate limiting?
Hint: Compare exactness, contention, and whether the operation is a simple increment or part of a larger invariant.
Answer: Use `synchronized` when you must protect a larger critical section or maintain invariants across multiple reads/writes together. Use `AtomicInteger` when you need one exact shared value with atomic updates, such as a simple ID/counter under low or moderate contention. Use `LongAdder` for high-throughput counters like metrics where write throughput matters more than an exact instant-by-instant single value. For strict rate limiting, exactness and coordination matter, so `AtomicInteger` or a broader synchronized/distributed design is usually more appropriate than `LongAdder`.

3. Design a bounded producer-consumer flow for background job processing and explain how backpressure works.
Hint: Mention queue capacity, what happens when producers are faster than consumers, and why unbounded buffering is risky.
Answer: Use a bounded `BlockingQueue` between producers and worker threads. Producers submit work into the queue; consumers take work and process it. When the queue is full, producers should block, slow down, or be rejected depending on the business requirement. That bounded capacity creates backpressure so the system cannot accumulate unbounded work and eventually fail with memory pressure. This pattern makes overload explicit instead of hiding it in an ever-growing queue.

4. How should `ThreadPoolExecutor` be configured for a backend service, and why are unbounded queues risky?
Hint: Discuss core/max size, queue type, rejection policy, and CPU-bound vs I/O-bound workloads.
Answer: Configure `ThreadPoolExecutor` intentionally: choose pool sizes based on workload type, use a bounded queue, and define a rejection policy that matches the service behavior under overload. CPU-bound work usually needs a smaller pool near core count; I/O-bound work may tolerate more concurrency. Unbounded queues are risky because they can absorb overload silently, increase latency, and eventually drive memory exhaustion instead of forcing the system to shed load or apply backpressure.

5. Compare `synchronized`, `ReentrantLock`, and `ReadWriteLock` for a read-heavy in-memory cache.
Hint: Cover simplicity, flexibility, and when multiple readers help.
Answer: `synchronized` is the simplest option and is often good enough when contention is modest and the critical section is straightforward. `ReentrantLock` is useful when you need features like `tryLock`, interruptible acquisition, fairness, or explicit condition variables. `ReadWriteLock` can help when reads are much more frequent than writes and read operations are substantial enough that allowing concurrent readers improves throughput. But it adds complexity, so it should be justified by measured contention or workload characteristics.

6. What is a deadlock, and how would you prevent it with a lock-ordering strategy?
Hint: Give a concrete two-lock example and explain why consistent ordering works.
Answer: A deadlock happens when threads wait forever in a circular dependency, such as thread A holding lock 1 while waiting for lock 2 and thread B holding lock 2 while waiting for lock 1. A standard prevention strategy is global lock ordering: define that every code path must acquire locks in the same order, for example always acquire `accountId` with smaller numeric ID first. That removes the circular wait condition and prevents the deadlock from forming.

7. Explain `CompletableFuture` chaining and where error handling belongs in an asynchronous workflow.
Hint: Contrast `thenApply`, `thenCompose`, `thenCombine`, and `exceptionally`/`handle`.
Answer: `thenApply` transforms a successful result, `thenCompose` is used when the next step itself returns another future, and `thenCombine` joins two independent futures. Error handling belongs explicitly in the chain with operators such as `exceptionally` or `handle`, rather than being left implicit or mixed into unrelated business logic. Good design keeps success flow and recovery/fallback behavior readable, and it uses explicit executors when async work should not run on the default execution context.

8. Explain what can happen on a multi-core CPU when two Java threads read and write shared state without synchronization.
Hint: Mention caches, reordering, stale reads, and happens-before.
Answer: On a multi-core machine, threads may run on different cores that use local caches and registers, so one thread may temporarily observe an older value than another. The compiler and CPU may also reorder operations when no synchronization rule forbids it. Without a happens-before relationship, there is no guarantee that one thread will observe another thread’s writes promptly or in the intended order. `volatile`, locks, and atomic operations restore correctness by imposing visibility and ordering guarantees.

9. Compare platform threads and virtual threads, including where virtual threads do not help.
Hint: Separate I/O scalability from CPU throughput and mention pinning risks.
Answer: Platform threads map much more directly to OS threads and are relatively expensive, so large counts can become costly. Virtual threads are lightweight JVM-managed threads that are excellent for high-concurrency I/O workloads because blocked I/O does not require one expensive platform thread per task. But they do not make CPU-bound work faster, they do not remove contention on shared mutable state, and some blocking patterns such as certain monitor-heavy sections can still pin carrier threads and reduce the benefit.

10. Why does `LongAdder` often outperform `AtomicInteger` under heavy write contention?
Hint: Compare one hot memory location versus striped cells and mention the read tradeoff.
Answer: `AtomicInteger` concentrates all updates on one CAS-protected memory location, so many threads repeatedly contend on the same value and may spin through failed retries. That also increases cache-line bouncing between cores. `LongAdder` spreads updates across multiple internal cells, so concurrent writers are less likely to fight over the same location, which improves throughput. The tradeoff is that reads aggregate across cells and are better suited to throughput-oriented counters like metrics than to correctness-critical exact instant-by-instant values.
