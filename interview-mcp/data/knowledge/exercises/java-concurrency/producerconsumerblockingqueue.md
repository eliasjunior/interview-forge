# Exercise: ProducerConsumerBlockingQueue

## Topic / Language / Difficulty
**Topic:** java-concurrency
**Language:** java
**Difficulty:** 3/5 — Medium

## Real-World Context
**Scenario:** Background email/job processing system — the API receives requests and hands them off to worker threads asynchronously

### Why this matters in production
- Prevent system overload under high traffic by bounding the queue size
- Introduce backpressure so fast producers cannot overwhelm slow consumers
- Decouple request handling from heavy processing (e.g. sending email, writing to DB)
- Understand what happens when the buffer is full — drop, block, or reject?

## Learning Goal
Understand how wait/notify coordinates threads across a shared buffer, why spurious wakeups require a while-loop guard, and how BlockingQueue eliminates the boilerplate

## Prerequisites
- **RaceConditionLab** — Must understand synchronized and monitor locks before coordinating threads with wait/notify

## Problem Statement
Build a BoundedBuffer class with capacity 5 backed by a LinkedList. Implement put(item) that blocks when full and take() that blocks when empty, using wait/notify. Wire up 2 producer threads and 3 consumer threads running for 3 seconds. Then swap the implementation for an ArrayBlockingQueue and confirm behaviour is identical with far less code.

## Implementation Steps
1. Implement BoundedBuffer with synchronized put/take using if+wait — observe spurious wakeup bug
2. Fix put/take to use while+wait instead of if+wait
3. Add 2 producers and 3 consumers, run for 3 seconds, print total produced and consumed
4. Replace BoundedBuffer entirely with ArrayBlockingQueue(5) — confirm same output
5. Explain: why notifyAll() instead of notify()? What happens if you call notify() with multiple waiters?

## What a Good Solution Looks Like
- Uses while loop around wait(), not if
- Calls notifyAll() not notify() when signalling state change
- Handles InterruptedException correctly (restores interrupt flag or re-throws)
- BlockingQueue version is substantially shorter and correct
- Can explain the monitor pattern: lock, condition check, wait, mutate, notify

## Hints
- If consumers starve, check that producers call notifyAll() not notify()
- InterruptedException in wait() should restore the interrupt flag via Thread.currentThread().interrupt()

## Related Concepts
- java-concurrency.md: wait/notify, spurious wakeup, monitor pattern
- java-concurrency.md: BlockingQueue, ArrayBlockingQueue, producer-consumer
