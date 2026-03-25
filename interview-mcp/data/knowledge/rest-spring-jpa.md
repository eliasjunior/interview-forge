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
