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
17. Why does `volatile` work for a shared boolean flag, and what happens at the Java Memory Model and CPU level when one thread writes and another thread reads it?
18. Why is `volatile int count; count++;` still broken, even though `volatile` guarantees visibility?
19. Compare `AtomicInteger` and `LongAdder`. How do they differ internally, and when would you choose one over the other?
20. In a high-traffic backend service, if you need a shared counter for metrics or rate limiting, how would you choose between `synchronized`, `AtomicInteger`, and `LongAdder`?
21. Explain Java concurrency from the perspective of a multi-core CPU: registers, CPU caches, main memory, compiler reordering, happens-before, and memory barriers. How do `volatile`, CAS, and locks restore correctness?
22. At the CPU level, why can two Java threads observe different values for the same shared variable on a multi-core machine? Explain the roles of core-local caches, cache coherence, stale reads, and why the simplified statement "each thread runs on a CPU core" is not quite accurate.
23. People often summarize `volatile` as "before write flush everything, after read refresh everything." What is this trying to capture, what is inaccurate about that simplification, and what guarantees does `volatile` actually provide in terms of visibility, ordering, and reordering prevention?
24. What does `synchronized` add beyond `volatile` at both the Java Memory Model level and the CPU level? Explain mutual exclusion, happens-before, monitor enter/exit, and the practical effect of memory barriers around a critical section.
25. Under heavy write contention on modern CPUs, why does `LongAdder` often outperform `AtomicInteger`? Explain the contention pattern, retry behavior, cache-line bouncing / hot-spotting, and the tradeoff in read semantics.

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
- Question 17: Must explain that `volatile` guarantees visibility and ordering, not mutual exclusion. Strong answer ties this to the JMM: a volatile write happens-before a subsequent volatile read of the same variable, so prior writes by thread A become visible to thread B. Should mention memory barriers / fence semantics and that the practical goal is preventing stale cached reads and unsafe reordering. Weak answer: says only "volatile stores in main memory" without explaining happens-before or ordering.
- Question 18: Must explain that `count++` is a read-modify-write sequence: read current value, add one, write back. `volatile` makes each individual read/write visible, but does not make the compound operation atomic, so two threads can both read 5 and both write 6. Strong answer explicitly calls this a race condition / lost update. Weak answer: blames "timing" vaguely without naming the non-atomic sequence.
- Question 19: Must explain that `AtomicInteger` uses a single CAS-protected value, which is precise and efficient under low to moderate contention, while `LongAdder` spreads updates across multiple internal cells to reduce contention under high write concurrency. Must mention tradeoff: `LongAdder.sum()` is an aggregate across cells and is preferred for throughput-oriented counters such as metrics, not for cases needing a single exact instant-by-instant value. Weak answer: only says "LongAdder is faster" without explaining striping and precision tradeoff.
- Question 20: Must compare the three choices in context. `synchronized`: correct when compound state changes or strong mutual exclusion is needed, but can serialize access under contention. `AtomicInteger`: best for exact single-value counters / IDs / low-contention increments. `LongAdder`: best for high-throughput counters like metrics where throughput matters more than exact per-nanosecond precision. Strong answer should note that a strict rate limiter often needs exactness and additional coordination, so `LongAdder` may suit metrics better than enforcement. Weak answer: picks one tool universally without discussing contention, accuracy, or semantics.
- Question 21: Must explain that on multi-core CPUs each core may use registers and local caches, so without coordination two threads can observe different values and the compiler/CPU may legally reorder operations. Must define happens-before as the visibility/ordering guarantee that one action's effects are seen by another. Strong answer explains that `volatile` introduces visibility and ordering guarantees via memory-barrier semantics, locks provide both mutual exclusion and visibility, and CAS-based atomics rely on hardware atomic instructions plus memory-ordering guarantees. Bonus: names load/store fences or explains that the conceptual model is more important than pretending Java directly "reads RAM every time." Weak answer: only says "volatile flushes to main memory" without tying it to reordering, happens-before, and cache coherence.
- Question 22: Must explain that threads are scheduled onto cores by the OS and JVM runtime; there is not a permanent 1:1 mapping of thread to core. Must explain that each core may use private caches and registers, so one core can temporarily observe an older value until coherence and synchronization rules force visibility. Strong answer mentions cache coherence protocols conceptually, stale reads, and that the real problem is unsynchronized shared-memory observation across cores, not "Java forgot to use RAM." Weak answer: says only "different cores have different memory" or incorrectly claims each thread owns a core.
- Question 23: Must explain that the "flush/refresh everything" mental model is a simplification for visibility plus ordering, not a literal rule that the JVM dumps or reloads all memory on every volatile access. Must state the real guarantee: a volatile write happens-before a subsequent volatile read of the same variable, and volatile accesses carry memory-ordering / fence semantics that prevent unsafe reordering around that access. Strong answer mentions release/acquire-style semantics or load/store barriers conceptually. Weak answer: repeats "stored in main memory" without clarifying the ordering guarantee or the simplification's limits.
- Question 24: Must explain that `synchronized` adds mutual exclusion plus visibility. At JMM level: monitor exit by one thread happens-before a later monitor enter on the same monitor by another thread. At runtime/CPU level: entering and exiting the monitor establishes ordering constraints around the critical section, in addition to ensuring only one thread executes it at a time. Strong answer contrasts this with volatile: volatile gives visibility/ordering for a variable, but synchronized also protects compound actions and invariants across multiple reads/writes. Weak answer: says only "synchronized is thread-safe" without naming monitor semantics or mutual exclusion.
- Question 25: Must explain that `AtomicInteger` centers all updates on one CAS-protected memory location, so under heavy contention many threads repeatedly fail CAS and retry on the same hot variable, causing cache-line ping-pong / coherence traffic. Must explain that `LongAdder` reduces this by spreading writes across striped cells so different threads often update different memory locations, improving throughput. Must mention the tradeoff: reading requires summing cells and is not the ideal choice when an exact instant-by-instant value is required for correctness. Weak answer: only says "LongAdder is better under contention" without explaining retries, hot spots, or read tradeoffs.

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
