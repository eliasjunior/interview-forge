# Thread Dump Lab (`Lab.java`)

A self-contained Java lab for practicing `jstack` and `jcmd` against a JVM with intentional contention and clearly separated thread states.

## Getting Started

### 1. Compile And Run

From the `threads/` directory:

```bash
javac Lab.java
java Lab
```

The app prints its PID and tells you which thread names to inspect.

### 2. Capture A Thread Dump

In another terminal, use either tool:

```bash
jcmd <pid> Thread.print
```

or:

```bash
jstack <pid>
```

If you want to save the dump for annotation:

```bash
jcmd <pid> Thread.print > dump.txt
```

### 3. Scenario: `BLOCKED` On A Synchronized Counter

Goal: practice identifying monitor contention and the `waiting to lock` wording.

Steps:

```bash
jcmd <pid> Thread.print | grep -A 12 'counter-worker-'
```

What to look for:

- one `counter-worker-*` thread in `RUNNABLE`
- several `counter-worker-*` threads in `BLOCKED`
- monitor lines containing `waiting to lock <...>`
- one thread holding the monitor with `locked <...>`
- stack frames showing the hot path inside the synchronized section

What this means:

- threads are competing to enter `synchronized (COUNTER_LOCK)`
- the fix direction is reducing lock hold time or changing the locking design

### 4. Scenario: `WAITING` On A Monitor

Goal: practice identifying `waiting on` and separating it from lock-entry contention.

Steps:

```bash
jcmd <pid> Thread.print | grep -A 12 'waiter-'
```

What to look for:

- `waiter-*` threads in `WAITING`
- monitor lines containing `waiting on <...>`
- stack frames showing `Object.wait`

What this means:

- these threads are not blocked trying to enter the monitor
- they already called `wait()` and are suspended until some other thread notifies them
- the fix direction is coordination logic, missing notifications, or lifecycle problems

### 5. Scenario: `TIMED_WAITING` After Work

Goal: avoid confusing normal sleeping with contention.

Steps:

```bash
jcmd <pid> Thread.print | grep -A 12 'counter-worker-'
```

What to look for:

- some `counter-worker-*` threads in `TIMED_WAITING`
- stack frames showing `Thread.sleep`

What this means:

- the thread is pausing after leaving the critical section
- this is not the same as `BLOCKED` and usually is not a lock problem

### 6. Scenario: Observe Metrics While Dumping Threads

Goal: correlate what you see in the dump with live JVM metrics.

Steps:

```bash
curl http://localhost:8080/metrics
```

For a cleaner view:

```bash
curl http://localhost:8080/metrics | jq .
```

What to look for:

- `submittedTasks` increasing over time
- `counterValue` increasing as workers acquire the lock
- `appThreadNames` containing `counter-worker-*` and `waiter-*`
- `liveThreads` growing as more counter workers are added

### 7. Scenario: Read The Dump Format

Goal: build fluency with the thread dump structure itself.

For each thread entry, identify:

- thread name
- `tid`
- `nid`
- Java thread state
- top stack frames
- monitor lines: `locked`, `waiting to lock`, `waiting on`

Use one `counter-worker-*` and one `waiter-*` as your reference pair:

- `counter-worker-*` teaches monitor-entry contention
- `waiter-*` teaches wait-set suspension

### 8. Fast Comparison Checklist

Use this when reviewing a dump quickly:

- `BLOCKED` + `waiting to lock` = thread wants a monitor that another thread still owns
- `WAITING` + `waiting on` = thread called a wait-style primitive and is awaiting a signal
- `TIMED_WAITING` + `sleep` = thread is paused on purpose for a duration
- `RUNNABLE` + `locked` = likely current owner of the hot monitor

## Practice Goals

- Practice with `jstack` and `jcmd Thread.print` on a sample app with known contention
- Learn how to read a thread dump: thread name, `tid`, `nid`, state, stack frames, and monitor lines
- Distinguish `BLOCKED` (`waiting to lock`) from `WAITING` (`waiting on`) and connect each state to the right cause

## What The Lab Creates

### 1. Contended Synchronized Counter

The main contention path uses a shared monitor named `COUNTER_LOCK`.

- Four `counter-worker-*` threads start immediately
- One more `counter-worker-*` thread is added every 5 seconds
- Each worker loops forever:
  1. Enter `synchronized (COUNTER_LOCK)`
  2. Increment a shared `counter`
  3. Burn CPU for 30 ms while still holding the monitor
  4. Exit the monitor
  5. Sleep 20 ms

This intentionally creates a bad pattern: one worker is inside the critical section while the others are `BLOCKED` trying to enter it.

In a thread dump, this is the `waiting to lock` case.

### 2. Explicit `WAITING` Threads

The lab also creates three `waiter-*` threads.

- Each thread enters `synchronized (WAIT_MONITOR)`
- It then calls `WAIT_MONITOR.wait()`
- No notifier wakes it up during normal execution

These threads are not trying to acquire a busy lock. They already entered the monitor and then moved into the wait set. In a thread dump, this is the `waiting on` case and should show up as `WAITING`.

### 3. Memory Pressure / GC Trigger

The main thread allocates about 50 MB of short-lived byte arrays. This gives you heap movement and possible GC activity while you inspect the process.

### 4. Metrics HTTP Server

`GET http://localhost:8080/metrics` returns JSON with:

- `heapUsed` / `heapMax`
- `liveThreads` / `daemonThreads`
- `totalStartedThreads`
- `submittedTasks`
- `counterValue`
- `appThreadNames`
- `jvmThreadNames`
- `stdout`

## What To Look For In A Dump

Run one of these from another terminal:

```bash
jcmd <pid> Thread.print
jstack <pid>
```

Then inspect:

- `counter-worker-*`
  These should usually be split between `RUNNABLE`, `BLOCKED`, and sometimes `TIMED_WAITING`
- `waiter-*`
  These should be `WAITING` on `WAIT_MONITOR`

### Reading The Dump

For each thread, identify:

- Thread name
- `tid`: JVM thread identifier in the dump
- `nid`: native thread identifier
- Java thread state
- Top stack frames
- Monitor lines such as:
  - `waiting to lock <...>` for monitor entry contention
  - `waiting on <...>` for `wait()` / parked style waiting
  - `locked <...>` for currently owned monitors

## State Mapping

| State | Typical thread in this lab | Meaning | Likely fix in real systems |
|---|---|---|---|
| `RUNNABLE` | one `counter-worker-*` | Currently executing inside the synchronized block | reduce work in critical section |
| `BLOCKED` | most `counter-worker-*` | Waiting to acquire `COUNTER_LOCK` | shorten lock hold time, reduce contention, redesign locking |
| `WAITING` | all `waiter-*` | Waiting on `WAIT_MONITOR.wait()` after releasing the monitor | investigate missing signal / coordination flow |
| `TIMED_WAITING` | some `counter-worker-*` | Sleeping for 20 ms after the critical section | usually intentional pause, not lock contention |

## Why `BLOCKED` And `WAITING` Are Different

`BLOCKED` means a thread is stuck at monitor entry. Another thread still owns the monitor it wants.

`WAITING` means a thread voluntarily suspended itself with a wait-style primitive and is now waiting for another thread to signal or unpark it.

Those lead to different fixes:

- `BLOCKED`: focus on lock ownership, critical section duration, and contention hot spots
- `WAITING`: focus on coordination logic, missing notifications, lifecycle bugs, and producer/consumer flow

## Running The Lab

```bash
# Compile
javac Lab.java

# Run from the threads/ directory
java Lab

# In another terminal
jcmd $(jcmd | grep Lab | awk '{print $1}') Thread.print
```

The app also prints the PID and the expected thread names on startup.

## Intentional Anti-Patterns

| Anti-pattern | Location | Why it's there |
|---|---|---|
| CPU work inside a synchronized block | `counter-worker-*` loop | forces visible contention and `BLOCKED` threads |
| Growing thread count | scheduled thread adder | makes contention worsen over time |
| Waiters with no notifier | `waiter-*` loop | gives a stable `WAITING` example |
| Short-lived large allocations | startup allocation loop | makes heap and GC behavior visible |
