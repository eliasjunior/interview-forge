# API Async Exercise

Small Spring Boot lab for learning:

- `DeferredResult` and `WebAsyncTask` as Spring MVC async-controller alternatives to `CompletableFuture`
- Tomcat connector settings: `maxThreads`, `acceptCount`, `connectionTimeout`
- how to verify with `jstack` that Tomcat request threads are released while async work keeps running
- how to summarize threads programmatically with `Thread.getAllStackTraces()`
- how to inspect lock details with `ThreadMXBean.dumpAllThreads()`
- how to compare two snapshots 10 seconds apart to spot persistent `BLOCKED` hotspots

## Project Layout

- [`pom.xml`](/Users/eliasjunior/Projects/ai-projects/first-mcp/api-exercise/pom.xml)
- [`AsyncController.java`](/Users/eliasjunior/Projects/ai-projects/first-mcp/api-exercise/src/main/java/com/example/apiexercise/AsyncController.java)
- [`AsyncConfig.java`](/Users/eliasjunior/Projects/ai-projects/first-mcp/api-exercise/src/main/java/com/example/apiexercise/AsyncConfig.java)
- [`application.properties`](/Users/eliasjunior/Projects/ai-projects/first-mcp/api-exercise/src/main/resources/application.properties)

## What This App Demonstrates

The app exposes four endpoints:

- `GET /sync/sleep?ms=5000`
  A blocking baseline. Tomcat request threads stay occupied during `Thread.sleep`.
- `GET /async/future?ms=5000`
  Uses `CompletableFuture` with the custom executor.
- `GET /async/deferred?ms=5000`
  Uses `DeferredResult` and completes it from the custom executor.
- `GET /async/web-task?ms=5000`
  Uses `WebAsyncTask` with the custom executor.
- `GET /diagnostics/summary`
  Uses `Thread.getAllStackTraces()` and groups threads into JVM vs framework vs app buckets.
- `GET /diagnostics/threads`
  Uses `ThreadMXBean.dumpAllThreads(true, true)` and returns lock-oriented thread details.
- `GET /diagnostics/hotspots?delayMs=10000`
  Takes two `ThreadMXBean` snapshots and returns threads still `BLOCKED` in the same top frame.
- `POST /lock-lab/start?blockedThreads=200&holdMs=60000`
  Creates one lock owner and many `BLOCKED` app threads on the same Java monitor.
- `GET /lock-lab/status`
  Returns the current lock-lab run id, owner thread, and blocker count.
- `POST /lock-lab/reset`
  Interrupts the current lock-lab run so you can start again.

All async endpoints capture:

- `requestThread`: the Tomcat request thread that accepted the request
- `workerThread`: the `lab-worker-*` thread that performed the delayed work

This makes it easy to see whether request handling left the Tomcat pool.

The diagnostics endpoints keep the exercise compact while still giving you a programmatic view of thread state and lock ownership.

## Tomcat Settings To Study

Configured in [`application.properties`](/Users/eliasjunior/Projects/ai-projects/first-mcp/api-exercise/src/main/resources/application.properties):

- `server.tomcat.threads.max=2`
  Only two Tomcat request threads are available.
- `server.tomcat.accept-count=2`
  Extra incoming connections can wait briefly in the accept queue after both worker threads are busy.
- `server.tomcat.connection-timeout=5s`
  Idle connection establishment and request-read timeouts are short, so connector behavior is easier to reason about.

### Request Lifecycle To Keep In Mind

1. A socket is accepted by Tomcat.
2. Tomcat assigns the request to one of its request threads.
3. For `/sync/sleep`, that request thread remains occupied until the response is finished.
4. For async endpoints, Spring MVC starts async processing and Tomcat can release the request thread back to the pool.
5. The custom `lab-worker-*` executor performs the simulated slow work.
6. When the async result completes, Tomcat uses a request thread again to dispatch and write the response.

## Run

From [`api-exercise`](/Users/eliasjunior/Projects/ai-projects/first-mcp/api-exercise):

```bash
mvn spring-boot:run
```

The app listens on `http://localhost:8081`.

## Quick Checks

Check the thread serving a normal request:

```bash
curl http://localhost:8081/thread
```

Try the sync baseline:

```bash
time curl "http://localhost:8081/sync/sleep?ms=5000"
```

Try the async alternatives:

```bash
time curl "http://localhost:8081/async/future?ms=5000"
time curl "http://localhost:8081/async/deferred?ms=5000"
time curl "http://localhost:8081/async/web-task?ms=5000"
```

Try the diagnostics endpoints:

```bash
curl http://localhost:8081/diagnostics/summary | jq .
curl http://localhost:8081/diagnostics/threads | jq .
curl "http://localhost:8081/diagnostics/hotspots?delayMs=10000" | jq .
```

Start the monitor-contention lab:

```bash
curl -X POST "http://localhost:8081/lock-lab/start?blockedThreads=200&holdMs=60000" | jq .
curl http://localhost:8081/lock-lab/status | jq .
```

The response should show a Tomcat thread such as `http-nio-8081-exec-1` for `requestThread` and a `lab-worker-*` thread for `workerThread`.

## Verify With `jstack`

Find the process:

```bash
jcmd | grep api-exercise
```

Capture a dump while one async request is in flight:

```bash
jstack <pid> > dump.txt
```

### What To Look For

For the sync endpoint:

- `http-nio-8081-exec-*` threads stay tied up in the sleep path
- with `maxThreads=2`, two concurrent sync requests can saturate Tomcat quickly

For the async endpoints:

- the long-running work appears on `lab-worker-*`
- Tomcat `http-nio-8081-exec-*` threads should no longer be parked in the simulated slow work during most of the wait
- near completion, a Tomcat request thread reappears to finish the async dispatch and write the response

For `/diagnostics/summary`:

- `categoryCounts` should separate `http-nio-*` as framework threads
- `lab-worker-*` should appear under app threads only while async work is in flight
- depending on timing, the app bucket may be empty when no custom async task is running
- JVM infrastructure threads should remain in the JVM bucket

For `/diagnostics/threads`:

- each item includes `state`, `topFrame`, `lockName`, `lockOwner`, and `waitingOn`
- this is the direct programmatic shape returned from `ThreadMXBean.dumpAllThreads()`, reduced to the fields you care about
- if you call this endpoint with no active async request, you will usually see only JVM and framework threads
- trigger `/async/future`, `/async/deferred`, or `/async/web-task` with a longer delay and then call `/diagnostics/threads` again to catch `lab-worker-*`

For `/diagnostics/hotspots`:

- any thread listed stayed `BLOCKED` in the same top frame across both snapshots
- those are the first lock-contention hotspots to investigate

## Suggested Experiments

### 1. Saturate Sync Requests

Open three terminals and run:

```bash
time curl "http://localhost:8081/sync/sleep?ms=15000"
```

Expected:

- two requests consume the two Tomcat request threads
- the third request waits in the connector queue or client-side until Tomcat can accept it

While those requests are still running, find the PID with the actual application class name:

```bash
jcmd | grep ApiExerciseApplication
```

Then capture a dump:

```bash
jstack <pid> > dump-sync.txt
```

Check the Tomcat request threads:

```bash
grep -A 12 'http-nio-8081-exec-' dump-sync.txt
```

What you want to see here:

- `http-nio-8081-exec-*` threads occupied in the sync request path
- stack frames showing your controller sleep path instead of an idle Tomcat worker queue
- with `server.tomcat.threads.max=2`, both Tomcat request threads should be busy

### 2. Compare Async Endpoints

Open three terminals and run:

```bash
curl "http://localhost:8081/async/deferred?ms=15000"
curl "http://localhost:8081/async/web-task?ms=15000"
curl "http://localhost:8081/async/future?ms=15000"
```

Expected:

- Tomcat request threads are released early
- the bottleneck moves to the `lab-worker-*` executor because it also has only two threads

While those async requests are still running:

```bash
jcmd | grep ApiExerciseApplication
jstack <pid> > dump-async.txt
grep -A 12 'http-nio-8081-exec-' dump-async.txt
grep -A 12 'lab-worker-' dump-async.txt
```

What you want to see here:

- `http-nio-8081-exec-*` threads mostly idle or waiting for new tasks
- `lab-worker-*` threads doing the delayed work
- this is the main proof that async handling freed the Tomcat request threads during the wait

### 3. Read Connector Behavior

While load is running, relate symptoms back to the connector settings:

- `maxThreads`: caps active Tomcat request-processing threads
- `acceptCount`: controls how many connections can wait once all request threads are busy
- `connectionTimeout`: affects how long Tomcat waits for the client during connection/request-read stages

### 4. Programmatic Snapshot Comparison

While hitting the sync endpoint from multiple terminals, run:

```bash
curl "http://localhost:8081/diagnostics/hotspots?delayMs=10000" | jq .
```

Expected:

- if the same threads remain `BLOCKED` in the same frame across both snapshots, they are likely true contention hotspots
- transient blockers usually disappear between snapshots and will not be reported

### 5. Monitor-Address Technique

Problem statement:

> A thread dump shows 200 threads all blocked. Walk me through the exact diagnosis steps before you touch any code.

Use the built-in lock lab to create that scenario:

```bash
curl -X POST "http://localhost:8081/lock-lab/start?blockedThreads=200&holdMs=60000" | jq .
jcmd | grep ApiExerciseApplication
jstack <pid> > dump-lock.txt
```

You should now have:

- one `lock-owner-run-*` thread holding the monitor
- many `lock-blocker-run-*` threads in `BLOCKED`

#### Step 1. Find The Contended Monitor

Search the dump for the blocked threads:

```bash
grep -n 'lock-blocker-run-' dump-lock.txt
grep -n 'waiting to lock <' dump-lock.txt
```

What to look for:

- the same monitor address repeated across many `lock-blocker-run-*` threads
- example shape: `waiting to lock <0x00000007....>`

That repeated address is the contended monitor.

#### Step 2. Find The Lock Owner

Search for the same monitor address, but this time for the owner:

```bash
grep -n 'locked <0x' dump-lock.txt
```

Then narrow it to the exact monitor address you found in Step 1.

What to look for:

- exactly one thread with `locked <that-monitor-address>`
- that thread should be `lock-owner-run-*`

That is the lock owner.

#### Step 3. Read The Owner Stack Trace

Once you find the owner thread, read its stack carefully.

What to extract:

- class name
- method name
- line number
- whether the thread is doing real work, sleeping, waiting on I/O, or stuck in a bad critical section

That stack is the real root cause, not the 200 blocked followers.

#### Why This Technique Matters

When hundreds of threads are `BLOCKED`, the blocked threads are symptoms. The owner thread is the cause.

The shortest path is:

1. find the repeated `waiting to lock <address>`
2. find the single `locked <same-address>`
3. read that owner stack trace

#### Clean Up

After the exercise:

```bash
curl -X POST http://localhost:8081/lock-lab/reset | jq .
```
