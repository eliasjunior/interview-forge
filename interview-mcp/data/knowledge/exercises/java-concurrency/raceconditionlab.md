# Exercise: RaceConditionLab

## Topic / Language / Difficulty
**Topic:** java-concurrency
**Language:** java
**Difficulty:** 2/5 — Easy

## Learning Goal
Understand why unsynchronised reads+writes to a shared variable produce incorrect results under concurrency, and know two ways to make the counter thread-safe

## Prerequisites
_None — this is a self-contained exercise._

## Problem Statement
Write a Counter class with an int field `count` and an `increment()` method. Spawn 10 threads, each calling `increment()` 1000 times. Print the final value. It should be 10 000, but it won't be. Then fix it: once with AtomicInteger, once with a synchronized block. Confirm both always print 10 000.

## Implementation Steps
1. Create Counter with a plain int field and an increment() method
2. Spawn 10 threads calling increment() 1000 times each, join all, print result — observe the wrong value
3. Replace int with AtomicInteger and incrementAndGet() — confirm result is always 10 000
4. Revert to int but wrap the increment in a synchronized(this) block — confirm result is always 10 000
5. Explain the trade-offs: AtomicInteger (CAS, lock-free) vs synchronized (monitor lock, broader scope)

## What a Good Solution Looks Like
- Correctly identifies that the read-increment-write is not atomic
- Produces a broken version that gives visibly wrong results
- AtomicInteger fix uses incrementAndGet()
- Synchronized fix locks on a consistent monitor — not a new object each call
- Can explain happens-before and visibility guarantees

## Hints
- If the broken version always shows 10 000, increase the thread count or loop count
- synchronized(new Object()) inside the method is a common mistake — why doesn't it work?

## Related Concepts
- java-concurrency.md: race condition, atomicity, happens-before
- java-concurrency.md: AtomicInteger, synchronized, monitor lock
