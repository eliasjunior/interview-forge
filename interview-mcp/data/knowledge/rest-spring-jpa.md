# REST API Design, Spring Boot & JPA

## Summary
REST API design requires clear contracts for versioning (URI versioning protects backward compatibility), idempotency (same server-side effect on retries — GET is idempotent by definition, POST is not), HTTP status semantics, and pagination (controls payload size, DB load, and client rendering cost). The Spring Boot request lifecycle flows through: Filter chain → Security filter → DispatcherServlet → Controller → Service layer → @Transactional proxy → Repository → DB. Transactions belong at the service layer; @Transactional rolls back by default only for RuntimeException and Error — checked exceptions require explicit rollbackFor, and swallowing an exception inside a transaction causes a silent commit. The JPA N+1 problem (1 query for N parents + N queries for each child relationship) is solved with JOIN FETCH, @EntityGraph, or DTO projections; the rule is to fetch exactly what the endpoint needs and avoid global EAGER loading.

A strong candidate understands not just the happy path but the failure modes: transaction propagation bugs, cache invalidation under concurrent writes, async pitfalls with Tomcat thread pools, and resilience patterns for downstream dependencies.

---

## Questions

1. Design a `GET /api/v1/orders` endpoint. Explain your choices for versioning, idempotency, status codes, and pagination.
2. Walk me through the Spring Boot request lifecycle from an incoming HTTP request through to the database call and back to the response.
3. When does Spring @Transactional roll back a transaction? What are the common pitfalls that cause unexpected commits or rollbacks?
4. What is the JPA N+1 problem? How would you detect and fix it for a `GET /orders/{id}` endpoint that returns an order with its line items?
5. Compare JOIN FETCH, @EntityGraph, and DTO projections as solutions to the N+1 problem. When would you choose each one?
6. How does Spring's `@Cacheable` work? What are the cache invalidation risks under concurrent writes and how do you mitigate them?
7. How does `@Async` work in Spring? What are the common mistakes that cause it to silently fail or stall the Tomcat thread pool?
8. How would you implement centralized exception handling in Spring Boot so every endpoint returns a consistent error response structure?
9. What is optimistic locking in JPA? Walk through the `@Version` mechanism and what happens when two concurrent updates conflict.
10. How would you design a paginated endpoint for a large dataset (millions of rows)? Compare offset-based and cursor-based pagination.
11. How does Spring Security integrate into the request lifecycle? When does it run relative to filters and the DispatcherServlet?
12. What are Spring transaction propagation modes (REQUIRED, REQUIRES_NEW, NESTED)? Give a concrete scenario where choosing the wrong propagation causes a bug.
13. How would you integrate a circuit breaker (e.g. Resilience4j) into a Spring Boot service that calls an external REST API?
14. How do you configure and tune the HikariCP connection pool in Spring Boot? What symptoms indicate pool exhaustion?
15. How would you implement distributed locking in a multi-instance Spring Boot deployment to prevent concurrent execution of a scheduled task?
16. How would you design an event-driven integration between two Spring Boot services using Spring Events or a message broker? What delivery guarantees do each offer?

---

## Evaluation Criteria

- Question 1: Must explain URI versioning (/api/v1) protects backward compatibility. Idempotency: GET is safe and idempotent by definition. Status codes: 200 OK for success, 400 for invalid params, 404 for unknown resource. Pagination: must mention page+size or cursor-based, metadata in response (total count, next page link), and explain why — reduces DB load, payload size, latency, and client rendering cost. Weak: defines idempotency vaguely without applying it correctly to GET.
- Question 2: Must describe in order: Filter chain runs first → Spring Security filter → DispatcherServlet → HandlerMapping selects controller → Controller method executes → calls Service → @Transactional AOP proxy opens transaction → Repository executes SQL → transaction commits on clean exit → response assembled. Must place @Transactional at service layer, not controller. Bonus: AOP proxy self-invocation limitation and that filters run before Spring Security.
- Question 3: Must say: default rollback on RuntimeException (unchecked) and Error only. Checked exceptions do NOT rollback by default — fix with `@Transactional(rollbackFor = SomeCheckedException.class)`. Common pitfall 1: catching an exception inside a @Transactional method and not rethrowing it causes a silent commit. Common pitfall 2: @Transactional on a private method — AOP proxy cannot intercept it, annotation is ignored. Bonus: noRollbackFor, REQUIRES_NEW for independent sub-transactions.
- Question 4: Must define N+1: fetching N parent entities results in N additional queries for each child association — N+1 total queries. Impact: query explosion, DB pressure, latency spike visible in slow logs. Detection: Hibernate statistics logging, slow query logs, N+1 detector libraries. Fix: JOIN FETCH in JPQL with DISTINCT for one-to-many, or @EntityGraph. Must warn against global EAGER loading. Bonus: DTO projections for read-heavy endpoints.
- Question 5: Must compare all three: JOIN FETCH = inline JPQL query, good for ad-hoc needs, can produce cartesian product when joining multiple collections simultaneously; @EntityGraph = declarative, reusable at repository level, applied cleanly at query time; DTO projections = best for read APIs that need selective fields only, avoids loading full entity. Weak: treats them as equivalent or cannot explain when to prefer one over another.
- Question 6: Must explain `@Cacheable` caches the return value of a method keyed by parameters; subsequent calls with the same key return the cached value without executing the method. Invalidation risks: stale data under concurrent writes (another thread updates the DB but cache still serves old value). Mitigations: `@CacheEvict` on write operations, TTL-based expiry, use optimistic locking to detect conflicts. Bonus: cache-aside vs write-through patterns, distributed cache (Redis) vs local (Caffeine) trade-offs.
- Question 7: Must explain `@Async` runs the method on a separate thread pool (SimpleAsyncTaskExecutor by default — creates unbounded threads; must configure a real executor). Common silent failures: (1) calling @Async method within the same bean — AOP proxy not involved, runs synchronously; (2) @Async on a non-public method — ignored. Common stall: returning a `Future` then calling `.get()` blocks the calling thread — defeats async and starves the Tomcat pool under load. Fix: propagate `CompletableFuture` to the caller without blocking.
- Question 8: Must propose `@ControllerAdvice` with `@ExceptionHandler` methods returning a standardized error body (timestamp, status, message, path). Must include `@ResponseStatus` or `ResponseEntity` for correct HTTP codes. Bonus: error code enum for machine-readable errors, differentiating validation errors (400) from business errors (422) from server errors (500), and not leaking stack traces to clients.
- Question 9: Must explain `@Version` field (int or Long) on the entity. First update reads entity at version=N, saves — JPA issues `UPDATE ... WHERE id=? AND version=N`, sets version=N+1. Second concurrent update also read at version=N — JPA WHERE version=N finds 0 rows, throws `OptimisticLockException`. Service must catch and return 409 Conflict or retry. Key point: non-blocking, no row lock held — detects conflicts only at commit time. Weak: confuses optimistic with pessimistic (SELECT FOR UPDATE).
- Question 10: Must distinguish offset pagination (LIMIT/OFFSET — simple but slows with deep pages, can miss/duplicate rows on concurrent inserts) from cursor pagination (WHERE id > last_seen_id — consistent, fast regardless of depth, but complex to implement and requires a sortable cursor key). Must explain why offset is problematic at millions of rows. Bonus: keyset pagination as a cursor variant, covering indexes for performance.
- Question 11: Must place Spring Security as a servlet filter chain that runs before DispatcherServlet — typically `SecurityFilterChain` with `DelegatingFilterProxy`. Authentication filters (JWT, session) extract credentials early; authorization checks happen at method or URL level. Must note: `@PreAuthorize` and method-level security use AOP, so self-invocation bypasses them the same way @Transactional does. Bonus: SecurityContextHolder and how it propagates across async boundaries.
- Question 12: Must define: REQUIRED = join existing transaction or start new (default); REQUIRES_NEW = always start a new transaction, suspend current (inner commits/rollbacks independently); NESTED = savepoint within current transaction (rollback to savepoint on inner failure without rolling back outer). Concrete bug scenario: audit log in REQUIRED — if outer transaction rolls back, the audit log is also lost; fix with REQUIRES_NEW so audit always persists. Weak: cannot name more than two modes or explain NESTED.
- Question 13: Must describe Resilience4j `CircuitBreaker` wrapping the HTTP client call. States: CLOSED (normal), OPEN (failing fast, call not attempted), HALF_OPEN (probe requests to test recovery). Configuration: failure rate threshold, slow call rate, wait duration in OPEN state. Integration: `@CircuitBreaker` annotation or functional wrapper. Fallback: return cached data, default response, or propagate a service-unavailable error. Bonus: combining with `@Retry` and `@Bulkhead` for layered resilience.
- Question 14: Must mention key HikariCP properties: `maximumPoolSize` (threads competing for connections should not exceed this), `minimumIdle`, `connectionTimeout` (how long to wait for a connection before throwing), `idleTimeout`, `maxLifetime`. Pool exhaustion symptoms: `Connection is not available, request timed out after Xms` in logs, slow API response times, increasing WAITING threads in thread dump all blocked on pool. Fix: size pool to workload, identify slow queries holding connections, avoid open transactions during external calls. Bonus: monitoring via Micrometer `hikaricp.*` metrics.
- Question 15: Must explain the problem: multiple instances run the same `@Scheduled` task simultaneously, causing duplicates. Solutions: (1) ShedLock — DB-backed distributed lock with TTL, annotations on @Scheduled methods; (2) Quartz Scheduler with DB job store — cluster-aware, one node runs each job; (3) Kubernetes CronJob — only one pod runs the job. Must explain that `@Scheduled` alone does not prevent concurrent execution across instances. Weak: suggests using a flag in the DB without addressing atomicity.
- Question 16: Must distinguish: Spring Application Events = in-process, synchronous by default (same JVM, same transaction — event lost if transaction rolls back), `@Async` makes them non-blocking but still in-process; Kafka/RabbitMQ = out-of-process, persisted, at-least-once delivery, decouples services across JVM boundaries. Key trade-off: in-process events are simple but not durable; message brokers add reliability at the cost of infrastructure. Bonus: transactional outbox pattern to guarantee events are only published after the DB commit.

## Concepts

- core concepts: rest, idempotency, versioning, pagination, http-status-codes, n-plus-one, fetch-strategy, transaction-rollback, lazy-loading, eager-loading
- practical usage: uri-versioning, filter-chain, dispatcher-servlet, transactional, rollback-for, join-fetch, entity-graph, dto-projection, hibernate, jpql, spring-security, aop-proxy, cacheable, async, controlleradvice, hikaricp, resilience4j, circuitbreaker, shedlock
- tradeoffs: uri-vs-header-versioning, cursor-vs-offset-pagination, lazy-vs-eager, join-fetch-vs-entity-graph, entity-vs-dto, checked-vs-unchecked-rollback, optimistic-vs-pessimistic-locking, in-process-vs-broker-events
- best practices: version-all-public-apis, paginate-all-list-endpoints, place-transactional-in-service, avoid-global-eager, use-distinct-with-join-fetch, dto-for-read-apis, never-swallow-exception-in-transaction, bounded-async-executor, transactional-outbox

## Warm-up Quests

### Level 0

1. Which HTTP methods are idempotent by definition?
A) POST and PATCH
B) POST and DELETE
C) GET, PUT, and DELETE
D) Only GET
Answer: C

2. What HTTP status code should a successful `GET /api/v1/orders` return?
A) 200 OK
B) 201 Created
C) 204 No Content
D) 202 Accepted
Answer: A

3. What does the JPA N+1 problem mean?
A) Only one database query is needed for all child associations
B) Queries always fail on the second attempt
C) Pagination adds one extra query per page
D) Fetching N parent entities triggers N additional queries for each child association
Answer: D

4. By default, which exceptions cause `@Transactional` to roll back?
A) All exceptions including checked ones
B) RuntimeException and Error only
C) Only IOException
D) No exceptions trigger rollback automatically
Answer: B

5. What is the main purpose of pagination in a list endpoint?
A) To enforce authentication on list results
B) To sort results alphabetically
C) To limit payload size and reduce database load
D) To cache responses more effectively
Answer: C

6. In the Spring Boot request lifecycle, where does `@Transactional` take effect?
A) Inside the filter chain before the controller
B) Directly on the controller method
C) At the database driver level
D) In a service-layer AOP proxy, after the controller calls the service
Answer: D

7. What does `@Cacheable` do in Spring?
A) Caches the method's return value keyed by its parameters
B) Stores the HTTP session in Redis automatically
C) Prevents duplicate database writes
D) Locks the method to one thread at a time
Answer: A

8. What is the purpose of `@Version` in JPA?
A) It sets the JPA specification version to use
B) It enables optimistic locking by tracking a version counter
C) It marks an entity as read-only
D) It configures schema migration versioning
Answer: B

9. What is a common silent failure of `@Async` in Spring?
A) @Async always throws a NullPointerException on startup
B) @Async methods always block the database connection pool
C) Calling an @Async method from within the same bean bypasses the proxy and runs synchronously
D) @Async only works with void return types in all versions
Answer: C

10. In the Spring request lifecycle, when does Spring Security run?
A) After the DispatcherServlet processes the request
B) Only during database transactions
C) Inside the controller method via annotation processing
D) Before the DispatcherServlet, as a servlet filter
Answer: D

### Level 1

1. Which statements about REST idempotency are correct?
A) GET is idempotent and safe
B) PUT is idempotent but not necessarily safe
C) POST can still be made retry-safe with an explicit idempotency-key strategy, even though POST itself is not idempotent by definition
D) DELETE is idempotent
Answer: A,B,C,D

2. Which statements about `@Transactional` rollback are correct?
A) RuntimeExceptions trigger rollback by default
B) Checked exceptions require explicit rollbackFor to trigger rollback
C) Swallowing an exception inside @Transactional can cause a silent commit
D) @Transactional on a private method works the same as on a public method
Answer: A,B,C

3. Which statements about the N+1 problem are correct?
A) It can cause severe database pressure on large datasets
B) It often appears when lazy associations are loaded one parent at a time
C) JOIN FETCH in JPQL can reduce multiple queries to one
D) It can be detected with Hibernate statistics logging
Answer: A,B,C,D

4. Which statements about pagination are correct?
A) Pagination adds no complexity and is always the same to implement
B) Offset pagination can slow significantly at deep pages
C) Cursor pagination is more consistent under concurrent inserts
D) Pagination metadata such as total count is useful for clients
Answer: B,C,D

5. Which statements about `@Cacheable` are correct?
A) It caches method return values keyed by parameters
B) Cache correctness still depends on invalidation or expiry strategy
C) A cached value can become stale if underlying data changes without eviction
D) @CacheEvict helps keep the cache consistent after writes
Answer: A,B,C,D

6. Which statements about Spring Security in the request lifecycle are correct?
A) It runs as a servlet filter before the DispatcherServlet
B) @PreAuthorize uses AOP and can be bypassed by self-invocation
C) JWT or session authentication typically happens in the filter chain
D) Spring Security always runs after the controller returns the response
Answer: A,B,C

7. Which statements about `@Async` are correct?
A) `@Async` works through a proxy and can be bypassed by self-invocation
B) Calling @Async from within the same bean bypasses the proxy
C) The default SimpleAsyncTaskExecutor creates unbounded threads
D) Calling .get() on a Future from @Async blocks the calling thread
Answer: A,B,C,D

8. Which statements about optimistic locking with `@Version` are correct?
A) No row lock is held between the read and the write
B) It detects conflicting concurrent writes at update time instead of blocking all readers up front
C) An OptimisticLockException is thrown when a concurrent update conflicts
D) The version field is updated automatically by JPA on each write
Answer: A,B,C,D

9. Which statements about HikariCP connection pool exhaustion are correct?
A) Pool exhaustion causes requests to wait or time out for a connection
B) Slow queries holding connections can contribute to exhaustion
C) Increasing maximumPoolSize always permanently solves exhaustion
D) Open transactions during external calls can waste pool connections
Answer: A,B,D

10. Which statements about transaction propagation are correct?
A) REQUIRED joins an existing transaction or starts a new one
B) REQUIRES_NEW always starts a new independent transaction
C) NESTED uses a savepoint inside the current transaction
D) All propagation modes behave identically in all scenarios
Answer: A,B,C

### Level 2

1. Explain idempotency in the context of REST and why it matters for retry logic.
Hint: Connect the property to safe retries and which HTTP methods provide it.
Answer: An idempotent operation produces the same server-side state no matter how many times it is applied. GET, PUT, and DELETE are idempotent — retrying them does not cause additional side effects. POST is not idempotent, so retrying a failed POST can create duplicates. This property matters for retry logic because a client or infrastructure layer can safely retry an idempotent request without checking whether the first attempt succeeded.

2. Walk through the Spring Boot request lifecycle from HTTP request to database and back.
Hint: Cover filter chain, security, DispatcherServlet, AOP proxy, and transaction boundary in order.
Answer: An incoming request first passes through the servlet filter chain, where Spring Security filters authenticate and authorize the request. The DispatcherServlet then matches the request to a controller method. The controller calls a service method. If that method is annotated with @Transactional, an AOP proxy intercepts the call and opens a transaction before delegating to the real method. The service calls the repository, which executes SQL. On successful return, the proxy commits the transaction. The controller assembles and returns the response.

3. Explain when `@Transactional` will not roll back and what causes a silent commit.
Hint: Cover checked exceptions and swallowed exceptions specifically.
Answer: By default @Transactional only rolls back for RuntimeException and Error. A checked exception thrown from a transactional method will not trigger rollback unless rollbackFor is configured explicitly. The other common cause of a silent commit is swallowing an exception inside the transactional method — if the code catches an exception and does not rethrow it, the transaction completes normally and commits even though an error occurred.

4. Explain the JPA N+1 problem and compare JOIN FETCH, @EntityGraph, and DTO projections as fixes.
Hint: Be concrete about what generates the extra queries and when each solution fits best.
Answer: The N+1 problem occurs when fetching N parent entities and JPA then issues one additional query for each parent to load a lazy association — N+1 total queries. JOIN FETCH rewrites the JPQL query to load the association in one query; it is good for ad-hoc cases but can produce a cartesian product when joining multiple collections. @EntityGraph is declarative and applied at the repository level without touching JPQL. DTO projections avoid loading full entities entirely and are best for read-heavy endpoints that need only a subset of fields.

5. Explain optimistic locking with `@Version` and what happens when two concurrent updates conflict.
Hint: Describe the WHERE clause trick and what gets thrown.
Answer: JPA adds a version column to the entity. When a thread reads an entity at version N and updates it, JPA issues UPDATE … WHERE id=? AND version=N and increments the version to N+1. If a second concurrent thread also read at version N and tries to update, its WHERE clause finds no matching row because the version is now N+1. JPA detects the zero-row update and throws an OptimisticLockException. No row lock is held between the read and the write, so this approach avoids blocking but detects conflicts only at commit time.

6. Explain cursor-based pagination versus offset-based pagination for a large dataset.
Hint: Focus on consistency under concurrent inserts and performance at depth.
Answer: Offset pagination uses LIMIT/OFFSET, which is simple but degrades at large offsets because the database must still scan and discard all prior rows. It also produces inconsistent results under concurrent inserts — a new row inserted in the middle of a result set shifts pages and can cause rows to appear twice or be skipped. Cursor pagination uses a WHERE clause such as WHERE id > last_seen_id, which the database can serve with an index seek regardless of depth and is consistent even when rows are inserted concurrently.

7. Explain the most common ways `@Async` can silently fail in a Spring application.
Hint: Cover proxy bypass and executor configuration.
Answer: The most common silent failure is calling an @Async method from within the same bean. Spring @Async works through an AOP proxy, so a call from the same object bypasses the proxy and the method runs synchronously with no error or warning. Another issue is the default SimpleAsyncTaskExecutor, which creates a new thread for every call with no bound — under load this produces unbounded thread creation. A third problem is calling .get() on the returned Future, which blocks the calling thread and can starve the Tomcat thread pool under concurrent load.

8. Explain how `@ControllerAdvice` and `@ExceptionHandler` should be used for centralized error handling.
Hint: Cover consistent error structure, HTTP codes, and what not to leak to clients.
Answer: A class annotated with @ControllerAdvice acts as a global exception handler. Methods annotated with @ExceptionHandler inside it intercept specific exception types thrown from any controller and return a standardized response body containing timestamp, status code, message, and path. The @ExceptionHandler method should return a ResponseEntity with the appropriate HTTP status — 400 for validation errors, 404 for not-found, 422 for business rule violations, 500 for server errors. Stack traces and internal details must not be included in the response body sent to clients.

9. Explain what REQUIRES_NEW transaction propagation does and when it solves a real problem.
Hint: Give a concrete audit log scenario.
Answer: REQUIRES_NEW always suspends the current transaction and starts a completely independent new one. The inner transaction commits or rolls back independently of the outer one. A practical use case is audit logging: if the audit write uses REQUIRES_NEW, it commits even when the outer business transaction is rolled back, so the failure is still recorded. If the audit used the default REQUIRED propagation, it would join the outer transaction and be rolled back along with it, losing the audit record.

10. Explain what the transactional outbox pattern solves and how it works.
Hint: Connect it to the problem of publishing an event after a database commit.
Answer: The problem is that publishing an event and writing to the database are two separate operations with no atomic guarantee. If the database write succeeds but the event publish fails, the event is lost. If the event is published first and the database write then fails, the event was sent but the state was not saved. The outbox pattern solves this by writing the event as a row in an outbox table in the same database transaction as the business data. A separate poller or CDC mechanism then reads the outbox and publishes the event after the transaction has committed, giving at-least-once delivery with no possibility of the event being lost due to a mid-transaction failure.
