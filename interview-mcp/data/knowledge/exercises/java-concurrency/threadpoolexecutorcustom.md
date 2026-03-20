# Exercise: ThreadPoolExecutorCustom

## Topic / Language / Difficulty
**Topic:** java-concurrency
**Language:** java
**Difficulty:** 4/5 — Hard

## Learning Goal
Understand how ThreadPoolExecutor manages worker threads, the task queue, core/max pool sizes, and what happens when the queue is full — by building a stripped-down version from scratch

## Prerequisites
- **ProducerConsumerBlockingQueue** — The worker queue is a bounded producer-consumer pattern — you need wait/notify and BlockingQueue fluency first

## Problem Statement
Implement SimpleThreadPool that accepts a fixed pool size and a bounded task queue. It must: spawn worker threads on construction, accept Runnable tasks via execute(), block the caller when the queue is full (back-pressure), and support shutdown() that drains remaining tasks before terminating workers. Test it with 20 tasks submitted from 4 producer threads, pool size 3, queue capacity 5.

## Implementation Steps
1. Define SimpleThreadPool with a BlockingQueue and a fixed array of worker Thread objects
2. Implement the worker loop: poll with timeout, exit cleanly on shutdown signal
3. Implement execute(): offer to queue, block on put() for back-pressure
4. Implement shutdown(): set a flag, drain the queue, join all workers
5. Add a rejection policy (throw RejectedExecutionException) when shutdown is already in progress and a task arrives
6. Compare your implementation to ThreadPoolExecutor javadoc — identify what corePoolSize, maximumPoolSize, and keepAliveTime map to in your design

## What a Good Solution Looks Like
- Worker threads don't spin-wait — they block on the queue
- Shutdown drains in-flight tasks before terminating workers
- execute() after shutdown() throws RejectedExecutionException
- No thread leaks — all workers terminate after shutdown().join()
- Can explain the difference between core pool and max pool in the real ThreadPoolExecutor

## Hints
- Use a volatile boolean for the shutdown flag
- poll(timeout, unit) lets workers exit cleanly without notify()
- InterruptedException during join() in shutdown() should be handled — log and re-interrupt

## Related Concepts
- java-concurrency.md: ThreadPoolExecutor, task queue, rejection policy, graceful shutdown
- java-concurrency.md: BlockingQueue, volatile, happens-before on volatile write
