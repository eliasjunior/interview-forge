# Thread Contention Lab (`Lab.java`)

A self-contained Java teaching tool that manufactures **lock contention**, **memory pressure**, and **live JVM metrics** — designed for hands-on practice with thread analysis tools.

---

## What It Does

### 1. Intentional Lock Contention

The core behavior is deliberately broken by design.

- At startup, **4 worker threads** (`lab-worker-*`) are created immediately.
- A `ScheduledExecutorService` then **adds one more thread every 5 seconds** for the duration of the run.
- Each worker runs this loop forever:
  1. Acquire `LOCK` (a plain `Object` monitor)
  2. **Do 30 ms of CPU-busy work while holding the lock** — this is intentionally bad
  3. Release `LOCK`
  4. Sleep 20 ms
  5. Repeat

As threads accumulate, the majority are in `BLOCKED` state waiting for `LOCK` while one thread burns CPU inside it. This is classic **monitor contention** — exactly what you'd diagnose in a real performance incident.

### 2. Memory Pressure / GC Trigger

The main thread allocates **200 × 256 KB ≈ 50 MB** of short-lived byte arrays in a tight loop (10 ms apart). This is enough to stress the Young generation and trigger GC events, making heap metrics observable.

### 3. Metrics HTTP Server (port 8080)

A lightweight `com.sun.net.httpserver.HttpServer` serves `GET /metrics` as JSON. The payload includes:

| Field | Description |
|---|---|
| `heapUsed` / `heapMax` | Current heap consumption |
| `liveThreads` / `daemonThreads` | JVM thread counts from `ThreadMXBean` |
| `totalStartedThreads` | Cumulative threads started since JVM boot |
| `submittedTasks` | How many contention threads have been added |
| `appThreadNames` | Threads explicitly registered by this app |
| `jvmThreadNames` | All other threads (GC, JIT compiler, finalizer, etc.) |
| `stdout` | Last 2000 lines of program output (live log buffer) |

CORS header `Access-Control-Allow-Origin: *` is set so a browser page can poll it directly.

### 4. stdout Capture (Tee Stream)

`installOutCapture()` replaces `System.out` with a custom `OutputStream` that:
- **Still writes to the real stdout** (terminal output is unaffected)
- **Buffers every completed line** into `OUT_LINES` (capped at 2000 entries, guarded by `OUT_LOCK`)

This allows the `/metrics` endpoint to serve live log output to the D3 dashboard without any separate logging framework.

### 5. App vs JVM Thread Distinction

Every thread created by the application is registered in `APP_THREAD_IDS` (a `ConcurrentHashMap`-backed set). The metrics handler uses this to split the live thread list into:
- **App threads** — worker threads, the scheduler, the HTTP thread, main
- **JVM internal threads** — GC threads, JIT compiler threads, reference handler, finalizer, signal dispatcher, etc.

Stale IDs are pruned on each metrics request (`APP_THREAD_IDS.retainAll(liveIds)`).

### 6. Lifecycle

The program runs for **10 minutes** then performs a clean shutdown:
- Stops the HTTP server
- Shuts down the scheduler
- Interrupts all contention threads

---

## What It's Useful For

This lab is a practical sandbox for learning the tools and techniques used to diagnose real JVM performance problems.

### Thread Dump Analysis
Run `jcmd <pid> Thread.print` or `jstack <pid>` from another terminal while the lab is running. You will see:
- Most `lab-worker-*` threads in state `BLOCKED` waiting on `LOCK`
- One thread in `RUNNABLE` doing CPU work inside `busyWork()`
- All JVM internal threads (GC, JIT, etc.) visible alongside app threads

This is the canonical pattern for **lock contention** in a thread dump.

### Profiler / Async-profiler / JFR
Attach a profiler to observe:
- CPU time concentrated on the one thread holding `LOCK`
- Wall-clock time showing all workers spending most time blocked
- Growing thread count over time as the scheduler adds threads

### Understanding Thread States
The lab deliberately creates all three common thread states simultaneously:
- `RUNNABLE` — the thread holding the lock doing `busyWork()`
- `BLOCKED` — all other workers waiting to acquire `LOCK`
- `TIMED_WAITING` — workers in `Thread.sleep(20)` after releasing the lock

### GC Observation
The allocation loop (50 MB of short-lived byte arrays) gives you GC events to observe via:
- `jcmd <pid> GC.run` to force a collection
- `-verbose:gc` JVM flag to see GC logs
- JFR / VisualVM heap timeline

### App vs JVM Thread Identification
The metrics endpoint separates app-owned threads from JVM internal threads. This helps build intuition for what threads are "yours" vs. what the JVM itself creates (GC, JIT, reference handler, finalizer, signal dispatcher, etc.).

### D3 Live Dashboard
The companion file `d3-demo/index.html` polls `http://localhost:8080/metrics` and renders:
- Live heap usage
- Thread count over time (total, app, JVM internal)
- stdout log tail

Open it in a browser while the lab runs to see metrics update in real time.

---

## Running the Lab

```bash
# Compile
javac Lab.java

# Run (from the threads/ directory)
java Lab

# In another terminal — take a thread dump
jcmd $(jcmd | grep Lab | awk '{print $1}') Thread.print

# Or check metrics directly
curl http://localhost:8080/metrics | jq .
```

Then open `d3-demo/index.html` in a browser for the live dashboard.

---

## Key Intentional Anti-Patterns

| Anti-pattern | Location | Why it's there |
|---|---|---|
| CPU work inside a synchronized block | `addContentionThread` → `busyWork(30)` | Maximises lock hold time, causing maximum contention |
| Growing unbounded thread pool | `adder.scheduleAtFixedRate(...)` | Demonstrates thread count growth and its cost |
| Short-lived large allocations | `trash.add(new byte[256KB])` | Triggers GC — makes heap metrics interesting |

These are deliberate — the point is to observe and diagnose them, not to fix them.
