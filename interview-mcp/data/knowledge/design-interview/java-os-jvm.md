# Java OS & JVM Internals

## Summary
Java application startup involves three layers: the OS creates a native process (fork+exec), the JVM runtime initializes inside that process (loading classes, creating system threads), then your application runs via main(). Before main() executes, the JVM has already created multiple internal threads (GC, JIT compiler, signal handler, reference handler) — the exact number depends on the JVM implementation, GC algorithm, and CPU count. In production, thread count alone is not a problem — thread state (RUNNABLE vs BLOCKED vs WAITING) and lock contention determine actual impact. Thread dumps diagnose lock contention and thread pool starvation; heap dumps diagnose memory leaks. Common production issues: BLOCKED threads indicate lock contention (move I/O outside synchronized blocks), WAITING threads may indicate pool exhaustion, and @Async + .get() defeats async causing Tomcat thread pool starvation.

Diagnosing live contention requires knowing which tools expose what: `jcmd`/`jstack` for thread dumps, `ThreadMXBean` for programmatic metrics, JFR and async-profiler for CPU time distribution. A key diagnostic skill is separating app threads from JVM internal threads in a dump — JVM threads (GC, JIT, finalizer, signal dispatcher) are always present and must not be mistaken for application problems. The lock owner pattern — find the monitor address repeated in "waiting to lock", then find "locked <same address>" to identify the owning thread — is the core of contention diagnosis.

A strong candidate understands not just the tools but the mental model: OS process → JVM runtime → application code, and can reason about GC pressure, JIT compilation, class loading, and memory regions (heap, metaspace, stack) from first principles.

---

## Questions

1. Walk me through what happens at the OS and JVM level when you run `java -jar app.jar`.
2. How many threads exist in a JVM process before your `main()` method executes, and what types are they?
3. Your production Java service has 400 threads, high CPU, and slow responses. How do you diagnose and interpret a thread dump?
4. A thread dump shows 200 threads BLOCKED on the same lock. Walk me through how you identify the root cause and fix it.
5. In a Spring MVC service backed by Tomcat, all request threads become stuck and new requests queue up. What is happening and how do you fix it?
6. You have a `synchronized` block that acquires a lock and then does 30 ms of CPU work before releasing it. What contention pattern does this create as thread count grows, and how do you fix it?
7. How would you distinguish app threads from JVM internal threads in a thread dump, and why does that distinction matter when diagnosing a production incident?
8. Without any external framework, how would you expose live JVM metrics (heap usage, live thread count, thread names) over HTTP? What Java APIs would you use?
9. How does the JVM garbage collector work? Compare at least two GC algorithms and explain when you would choose each one.
10. What is the JVM metaspace and what causes a `java.lang.OutOfMemoryError: Metaspace` error?
11. How does the JIT compiler work and what is the difference between interpreted mode, C1 (client), and C2 (server) compilation?
12. How would you diagnose and fix a memory leak in a long-running Java application?
13. What is GC pause time and how do you minimize it in a latency-sensitive application?
14. How does class loading work in Java? What is the bootstrap, extension, and application class loader, and what is the parent delegation model?
15. How would you use Java Flight Recorder (JFR) and async-profiler to diagnose a CPU spike in production without restarting the JVM?
16. What is the difference between the Java heap, stack, metaspace, and native memory? What causes each one to fill up?

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

- Question 1: Must describe the three-layer flow: (1) terminal asks OS to create a new process via fork+exec, (2) OS allocates virtual memory, heap, stack, file descriptors and schedules the process, (3) JVM runtime initializes inside that process, loads classes from JAR, creates system threads, then invokes main(). Mental model: OS Process → JVM Runtime → Application. Weak: only mentions "JVM starts" without explaining the OS layer.
- Question 2: Must say there is no fixed number — depends on JVM implementation, GC algorithm, CPU core count, and config flags. Must name at least: main thread, GC threads, JIT compiler threads, signal handler. Bonus: explain why this matters in production (GC threads affect latency, high thread count does not automatically mean a bug, thread dumps contain many JVM-internal threads that must be distinguished from application threads).
- Question 3: Must say thread count alone is not the issue — state matters. Must classify: RUNNABLE = CPU-bound work or busy loop, BLOCKED = lock contention (look for "waiting to lock"), WAITING/TIMED_WAITING = often idle pool threads but check for DB or HTTP pool exhaustion. Must distinguish thread dump (contention and starvation) from heap dump (memory leaks). Must separate JVM internal threads from framework and application threads.
- Question 4: Must explain: find repeated "waiting to lock <0xABC>" to identify the monitor, then find "locked <0xABC>" to identify the owning thread, then inspect that thread's stack trace to find the exact source line. Fix: move I/O (DB calls, HTTP calls, file writes, logging) outside the synchronized block; reduce lock scope to protect only in-memory shared state; replace coarse locks with concurrent data structures. Key line: "timeouts mitigate blast radius but the real fix is removing blocking I/O from synchronized sections."
- Question 5: Must identify thread pool starvation as the root cause. Must explain why @Async + .get() or .join() defeats async and causes starvation under load. Fix: return CompletableFuture (or similar async type) directly from the controller so Tomcat releases the request thread while the work executes. Key insight: async frees threads, not connections — the HTTP connection stays open until the response is ready, but the Tomcat thread is freed.
- Question 6: Must identify this as the classic "long critical section" antipattern. Must explain: while one thread does CPU work inside the lock, all other threads pile up in BLOCKED state; throughput degrades as thread count grows because lock hold time is constant but contention grows linearly. Fix: keep the synchronized block as short as possible — protect only the shared state mutation, move all computation outside. Bonus: mention that replacing a coarse synchronized block with a ConcurrentHashMap or ReadWriteLock can further reduce contention.
- Question 7: Must explain that JVM internal threads (GC, JIT compiler, finalizer, reference handler, signal dispatcher) are always present in every dump and are not application bugs. Weak answer: treats all threads as application threads and draws wrong conclusions. Strong answer: names at least three JVM internal thread types, explains how to spot them (naming patterns like "GC Thread#", "C2 CompilerThread", "Finalizer"), and says the first step in dump analysis is filtering them out to focus on app threads. Bonus: mention that `ThreadMXBean` or `Thread.getAllStackTraces()` can be used programmatically to separate threads by name pattern or registration.
- Question 8: Must mention `com.sun.net.httpserver.HttpServer` (or equivalent) as a zero-dependency HTTP server option. Must identify `ManagementFactory.getThreadMXBean()` for thread count and `Runtime.getRuntime()` for heap metrics. Must identify `Thread.getAllStackTraces().keySet()` for live thread enumeration. Strong answer mentions CORS headers for browser access. Bonus: describe the tee-stream pattern for capturing stdout into a ring buffer so the metrics endpoint can serve recent log lines alongside numeric metrics.
- Question 9: Must name at least two GC algorithms and explain when to choose each. Serial GC: single-threaded, low overhead, suitable for small heaps and single-core environments. Parallel GC (throughput collector): multi-threaded stop-the-world collections, maximizes throughput, longer pauses. G1 GC (default since Java 9): divides heap into regions, concurrent marking, predictable pause targets, good for large heaps (>4 GB) with < 200 ms pause goals. ZGC / Shenandoah: concurrent compaction, sub-millisecond pauses, best for latency-sensitive services. Must explain the throughput vs. pause time trade-off. Weak: can only name one GC or cannot explain when to switch.
- Question 10: Must explain: Metaspace is the off-heap memory region (outside Java heap) that stores class metadata — class structures, method bytecode, constant pool. Unlike the old PermGen (which had a fixed size), Metaspace grows dynamically up to the native memory limit. OutOfMemoryError: Metaspace causes: (1) class loader leak — frameworks that create new ClassLoaders per request without unloading old ones (web apps, scripting engines); (2) excessive dynamic class generation (reflection, bytecode manipulation at runtime); (3) too many loaded classes without unloading. Fix: -XX:MaxMetaspaceSize to cap growth and trigger OOM early; diagnose with jmap -clstats or JFR class loading events.
- Question 11: Must explain: the JVM starts in interpreted mode (slow, no optimization). After a method is called a threshold number of times, it becomes "hot" and is compiled by C1 (client compiler) — fast compilation with basic optimizations (inlining, branch prediction). After more invocations, C2 (server compiler) compiles with aggressive optimizations (loop unrolling, escape analysis, intrinsics). Must mention tiered compilation (enabled by default since Java 8) combines C1 and C2. Key insight: JIT makes long-running Java processes faster over time (warmup), but adds initial CPU overhead. Bonus: on-stack replacement (OSR) allows mid-execution compilation of running loops.
- Question 12: Must describe the diagnosis flow: (1) observe heap growth over time — GC not releasing memory even after full GC indicates a leak; (2) take heap dump: jmap -dump:format=b,file=heap.hprof <pid> or via -XX:+HeapDumpOnOutOfMemoryError; (3) analyze with Eclipse MAT or VisualVM — look for dominator tree (what holds the most memory), retention paths (what prevents objects from being collected); (4) identify the GC root holding a reference chain to leaked objects. Common causes: static collections growing unboundedly, event listeners not deregistered, thread-local variables not cleared, caches without eviction. Fix: add eviction, use WeakReferences for caches, ensure listeners are removed.
- Question 13: Must define GC pause time: the stop-the-world (STW) phase where all application threads are frozen while the GC performs some work (e.g. marking roots, compacting). Minimizing strategies: (1) choose a low-pause GC (ZGC, Shenandoah) — concurrent phases run alongside app threads; (2) right-size the heap — too small means frequent GC, too large means long compaction; (3) reduce object allocation rate — fewer short-lived objects means less GC pressure; (4) avoid finalizers and soft/weak reference overuse; (5) tune GC thread count, pause target (-XX:MaxGCPauseMillis). Monitor with GC logs (-Xlog:gc*) and JFR. Must mention: eliminating STW entirely is impossible with current GC technology — the goal is to make pauses short and predictable, not zero.
- Question 14: Must describe the three built-in class loaders: Bootstrap (loads JDK core classes from rt.jar/modules — implemented in native code), Extension/Platform (loads JDK extension modules), Application/System (loads application classpath). Parent delegation model: when a class loader is asked to load a class, it first delegates to its parent; only if the parent cannot load it does the child attempt. This prevents app classes from overriding core JDK classes. Bonus: custom class loaders (OSGi, Tomcat web app isolation) break or extend parent delegation deliberately; class loader leaks occur when custom loaders are not garbage collected.
- Question 15: Must describe JFR: a low-overhead profiling framework built into the JVM (production-safe, < 1% overhead). Commands: `jcmd <pid> JFR.start duration=60s filename=profile.jfr` to capture, then open in JDK Mission Control. JFR captures: CPU samples, GC events, class loading, thread states, I/O, lock contention. Async-profiler: samples stack traces at the OS signal level (SIGPROF) — captures CPU time even in native frames that JFR misses, and avoids the safepoint bias of JVM-native sampling. For a CPU spike: JFR identifies which threads are RUNNABLE, async-profiler gives a flame graph of where CPU time is spent. Must distinguish: JFR is good for broad production monitoring; async-profiler is better for surgical CPU profiling of hot methods.
- Question 16: Must define each region: Heap = where objects live (Young generation: Eden + Survivor spaces; Old generation), garbage collected; Stack = per-thread, stores stack frames (local variables, return addresses), fixed size, StackOverflowError on overflow (deep recursion); Metaspace = off-heap class metadata, grows dynamically, OutOfMemoryError: Metaspace on class loader leak; Native memory = JVM's own internal structures, off-heap buffers (DirectByteBuffer, NIO, JNI), not managed by GC — grows with native code usage. Must correctly say: OutOfMemoryError: Java heap space = heap full; StackOverflowError = stack full; OutOfMemoryError: Metaspace = class metadata full; OutOfMemoryError: Direct buffer memory = off-heap buffer exhausted.

## Concepts
- core concepts: process, thread, jvm, virtual-memory, heap, stack, thread-state, runnable, blocked, waiting, lock-contention, thread-pool-starvation, deadlock, monitor, critical-section, lock-hold-time, gc, metaspace, jit, class-loading
- practical usage: fork-exec, jvm-bootstrap, class-loading, gc-thread, jit-compiler, thread-dump, heap-dump, synchronized, completablefuture, executorservice, spring-mvc, tomcat, async, jcmd, jstack, jfr, async-profiler, threadmxbean, scheduledexecutorservice, concurrenthashmap, jmap, eclipse-mat
- tradeoffs: thread-count-vs-state, sync-block-scope, io-under-lock, async-vs-blocking, lock-granularity, coarse-vs-fine-grained-locking, long-critical-section, lock-hold-time-vs-throughput, throughput-vs-pause-time, heap-size-vs-gc-frequency
- best practices: move-io-outside-lock, return-async-from-controller, use-thread-dump-for-contention, use-heap-dump-for-memory, classify-jvm-vs-app-threads, never-async-then-block, minimize-lock-scope, register-app-threads-for-diagnostics, enable-heap-dump-on-oom, use-jfr-in-production
