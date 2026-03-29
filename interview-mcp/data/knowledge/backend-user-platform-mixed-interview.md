# Backend User Platform Mixed Interview

## Summary
This topic models a realistic backend interview that starts with a small Spring Boot user service and then branches into production concerns: relational database design, external service fallback, scaling, caching, resilience, observability, internal API security, deployment behavior, and short theory pivots across Java, Spring Boot, Docker, REST, CI/CD, and testing.

The context should be treated as a high-security environment such as a bank or regulated financial system. Candidates should favor stronger controls by default: service-to-service authentication with explicit trust boundaries, short-lived credentials, auditability, defense in depth, and designs that minimize the blast radius of credential leakage or stale authorization data.

A strong candidate does not treat these as isolated trivia questions. They should start with a pragmatic first version, then evolve the design under new constraints while explaining tradeoffs clearly. The key signal is whether they can move from "build a basic endpoint" to "operate this safely in production" without hand-waving on correctness, resilience, or architecture.

---

## Questions

1. Design a Spring Boot user service that exposes a basic endpoint to retrieve a user from a relational database. Walk through the API, service layer, persistence layer, and why Spring Boot is a good fit.
2. Why would you choose a relational database such as Oracle for this user service, and in what situations would Cassandra be a poor or better choice?
3. A user may also exist in an external `external API`. How would you design the fallback lookup so the local service can return the user if needed without tightly coupling itself to the external system?
4. The system now needs user permissions via roles. How would you model roles, role updates, and authorization checks in the API and database?
5. Walk me through what happens end to end when an HTTP request hits a Spring Boot controller. I want to hear about the request lifecycle, dependency injection, and `DispatcherServlet`.
6. How would you make this API scalable at the application layer? What changes if traffic increases 20x?
7. The API is horizontally scaled, but now the database becomes the bottleneck. What would you change in the database and data-access strategy before reaching for a different datastore?
8. Where would caching help in this service, and what correctness risks appear when a user can be disabled or have roles changed?
9. What resilience patterns would you apply around the call to `external API`, and in what order would you add them?
10. How would you instrument logging, metrics, tracing, and monitoring so an on-call engineer can quickly find whether a production issue is in this service, the database, or `external API`?
11. `PaymentsAPI` has its own user database and wants to push newly created users to this service via an API. How would you design that contract so it is secure, idempotent, and loosely coupled?
12. Only `PaymentsAPI` should be allowed to call the internal sync endpoint in a high-security environment such as a bank. How would you implement authentication and authorization for that endpoint?
13. What happens when you deploy a new version and one node goes down mid-rollout? Explain how you would keep the service available and what assumptions must hold.
14. Compare `Collection`, `List`, and `Set` in Java. In this user service, where would each abstraction make sense and why?
15. Explain how `HashMap` works internally and what tradeoffs matter if you rely on hash-based lookups heavily in a Java backend.
16. What testing strategy would you use for this service? Cover unit, integration, end-to-end, performance, and security testing, and explain how CI/CD should automate them.

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

- Question 1: Must include a layered design: controller, service, repository/data-access, and a relational data model for users. Must explain Spring Boot advantages concretely: auto-configuration, dependency injection, embedded server, actuator ecosystem, strong web/data integrations. Weak answer: only says "Spring Boot is fast to build with" without explaining why that matters architecturally.
- Question 2: Must justify an RDBMS for transactional consistency, constraints, joins, and predictable modeling of users/roles. Must explain Cassandra tradeoffs accurately: good for very high write throughput and denormalized query-specific access patterns, poor fit when ad hoc queries, strong relational consistency, or complex joins/constraints are needed. Weak answer: recommends Cassandra only because "it scales more."
- Question 3: Must describe local lookup first, then controlled fallback to `external API`, with clear timeout/error handling. Must address whether to persist fetched users locally, how to avoid tight coupling, and what to return if the external system is unavailable. Bonus: anti-corruption layer or adapter around the external API.
- Question 4: Must model roles as an authorization concern separate from identity basics. Must explain role storage, update semantics, and how authorization checks are enforced in the app. Strong answer mentions auditability for permission changes and avoiding stale authorization decisions.
- Question 5: Must mention HTTP request enters Spring MVC through `DispatcherServlet`, request mapping selects the controller method, argument binding/validation occurs, injected dependencies are used in the service layer, repository/database calls run, then a response is serialized back. Weak answer: skips `DispatcherServlet` or describes only "controller calls service" with no lifecycle detail.
- Question 6: Must explain stateless app instances behind a load balancer, externalized session/state, connection-pool sizing, and safe horizontal scaling. Must address that scaling app nodes alone is insufficient if downstream dependencies cannot keep up. Bonus: rate limiting, async work, or backpressure where appropriate.
- Question 7: Must distinguish app scaling from DB scaling. Acceptable answers include indexing, query tuning, read replicas for read-heavy flows, partitioning/sharding only when justified, careful connection-pool sizing, reducing chatty ORM behavior, and caching selective reads. Weak answer: immediately says "switch to Cassandra" without discussing access patterns or consistency tradeoffs.
- Question 8: Must explain where caching helps and the implications of stale data, especially if a disabled user or changed role remains cached as active/authorized. Must mention invalidation, TTL tradeoffs, or event-driven cache eviction. Weak answer: proposes caching without discussing stale-authorization risk.
- Question 9: Must propose layered resilience: timeout first, then bounded retries with backoff and jitter when safe, then circuit breaker / fail-fast behavior, plus fallback decisions. Must discuss what is safe to retry and what user-visible degradation looks like. Bonus: bulkhead isolation.
- Question 10: Must cover logs, metrics, and traces together rather than only one of them. Must explain correlation/request IDs, useful service-level metrics (latency, error rate, dependency failures), and how tracing helps identify whether the issue is the app, DB, or `external API`. Bonus: Actuator endpoints and actionable alerts.
- Question 11: Must design an internal API contract for `PaymentsAPI` that includes idempotency or deduplication, versioning/compatibility thinking, and clear ownership boundaries. Must discuss duplicate delivery, retries, and validation of pushed users. Bonus: consumer-driven contracts / Pact for integration safety.
- Question 12: Must explain machine-to-machine authentication and authorization for the internal endpoint in a high-security environment. Strong answers prioritize mTLS and/or OAuth2 client credentials with short-lived tokens, issuer and audience validation, credential rotation, and auditability. Must ensure only `PaymentsAPI` can call the endpoint, not arbitrary clients. A static shared secret header by itself is not sufficient for a bank-grade environment because it is harder to scope, rotate safely, and protect from replay or lateral movement. Weak answer: only says "add JWT" or "use an API key/shared secret" without explaining trust boundaries, token validation, or service-to-service identity.
- Question 13: Must explain rolling deployment expectations: health checks/readiness probes, multiple instances behind a load balancer, graceful shutdown/drain, and what happens to in-flight traffic if a node disappears. Must mention that resilience also depends on shared state and dependency behavior, not just app nodes. Bonus: zero-downtime migration considerations.
- Question 14: Must distinguish `Collection` as the broad contract, `List` as ordered/duplicated sequence, and `Set` as uniqueness-focused collection. Must ground the answer in this service, for example roles often fit a `Set`, ordered audit events might fit a `List`, and APIs may accept `Collection` for flexibility. Weak answer: purely textbook definitions with no design application.
- Question 15: Must explain `HashMap` in practical terms: hash, bucket selection, collision handling, average-case O(1), treeification in high-collision scenarios in modern JDKs, and the fact that it is not thread-safe. Strong answer relates this to lookup-heavy backend services and when `ConcurrentHashMap` matters instead.
- Question 16: Must describe a testing strategy across unit, integration, and end-to-end tests, then include performance and security testing rather than treating them as optional afterthoughts. Must explain how CI/CD automates them and why the test pyramid matters. Bonus: targeted use of TDD for logic-heavy or failure-prone flows.

---

## Concepts

- core concepts: spring-boot, user-service, relational-database, oracle, cassandra, external-api, dispatcher-servlet, dependency-injection, scalability, resilience, caching, observability, authorization, deployment, ci-cd
- practical usage: controller-service-repository, load-balancer, read-replica, connection-pool, timeout, retry, circuit-breaker, cache-invalidation, trace-id, actuator, role-based-access-control, mtls, oauth2-client-credentials, pact, dockerfile, hash-map, concurrenthashmap, test-pyramid
- tradeoffs: relational-vs-wide-column, consistency-vs-throughput, cache-freshness-vs-latency, retries-vs-duplication, horizontal-scaling-vs-database-bottleneck, loose-coupling-vs-sync-dependency, fast-feedback-vs-full-end-to-end-confidence
- best practices: start-simple-then-evolve, keep-app-nodes-stateless, protect-internal-endpoints, treat-disabled-users-as-correctness-sensitive, use-logs-metrics-and-traces-together, add-readiness-and-graceful-shutdown, automate-tests-in-ci, avoid-hand-wavy-database-decisions

## Warm-up Quests

### Level 0 — Spark (MCQ, foundation)

1. Why is Spring Boot often a strong default for a backend API?
   A) It avoids needing any configuration across all environments
   B) It provides auto-configuration and integrates common backend components quickly
   C) It guarantees horizontal scalability as long as the app uses Docker
   D) It is only useful when the service has no external dependencies
   Answer: B

2. Why is an RDBMS often a good fit for a user-and-roles service?
   A) Because it is always faster than any NoSQL database
   B) Because joins, constraints, and transactional consistency are useful for this model
   C) Because it never needs indexing
   D) Because it avoids schema design entirely
   Answer: B

3. What is the main risk of caching user authorization data carelessly?
   A) The API may become harder to unit test locally
   B) Disabled users or changed roles may remain incorrectly authorized for a while
   C) Database indexing becomes unnecessary
   D) The HTTP controller layer can no longer validate input
   Answer: B

4. What does `DispatcherServlet` do in Spring MVC?
   A) It manages dependency versions in the Maven build
   B) It routes incoming HTTP requests through the Spring MVC request-handling flow
   C) It replaces controller mappings by calling repositories directly
   D) It is responsible only for opening database connections before each request
   Answer: B

5. In a high-security environment, `PaymentsAPI` is the only service allowed to call an internal user-sync endpoint. What is the most appropriate first line of defense?
   A) Strong service-to-service authentication and authorization, such as mTLS or OAuth2 client credentials
   B) A longer request timeout so other callers give up
   C) A local in-memory cache of accepted callers without real credential checks
   D) Hiding the endpoint path so only trusted teams know it exists
   Answer: A

6. What is the primary purpose of a circuit breaker around a call to `external API`?
   A) To retry every failed request indefinitely until it succeeds
   B) To stop sending requests to a failing dependency so local failures do not cascade
   C) To upgrade the HTTP connection to a persistent socket
   D) To cache all responses from `external API` permanently
   Answer: B

7. Which of the following best describes a stateless application node?
   A) A node that stores session data in local memory between requests
   B) A node that keeps no user-specific state in memory, so any instance can handle any request
   C) A node that never writes to a database
   D) A node that processes only one request at a time
   Answer: B

8. In the context of observability, what does a distributed trace give you that logs alone cannot?
   A) A complete list of all deployed Docker image versions
   B) The end-to-end timing and flow of a single request across multiple services
   C) A summary of monthly API usage by endpoint
   D) A list of all database tables accessed during the day
   Answer: B

---

### Level 1 — Padawan (MCQ multi-select, foundation)

1. Which statements about horizontally scaling application nodes are correct?
   A) Stateless instances can have any node handle any request without session affinity
   B) A load balancer alone is sufficient to scale if the database has no limits
   C) Externalizing session state or avoiding it is required for true stateless scaling
   D) Horizontal scaling of app nodes does not automatically resolve a database bottleneck
   Answer: A,C,D

2. Which statements about the Spring MVC request lifecycle are correct?
   A) `DispatcherServlet` is the central entry point for incoming HTTP requests
   B) Request mapping selects the correct controller method before argument binding occurs
   C) Dependency injection in the service layer happens fresh per request at runtime
   D) The response is serialized back after the controller returns
   Answer: A,B,D

3. Which statements about caching user or role data are correct?
   A) A disabled user cached as active may continue to be authorized after revocation
   B) TTL-based expiry alone eliminates stale-authorization risk
   C) Cache invalidation on role change reduces the window of incorrect authorization
   D) Event-driven eviction is one strategy to proactively remove stale entries
   Answer: A,C,D

4. In a high-security environment such as a bank, which options are appropriate for authenticating `PaymentsAPI` to an internal endpoint?
   A) mTLS, where both sides present certificates
   B) OAuth2 client credentials flow, where the caller presents a short-lived token
   C) Hiding the endpoint path and relying on obscurity
   D) A long-lived shared secret header validated by the receiving service
   Answer: A,B

5. Which statements about database read scaling are correct?
   A) Read replicas offload read traffic from the primary
   B) Switching to a different datastore is always the first step when reads are slow
   C) Indexing and query tuning should be addressed before considering architectural changes
   D) Caching selective reads can reduce database load if stale-data risk is managed
   Answer: A,C,D

6. Which statements about resilience patterns around `external API` are correct?
   A) A timeout prevents the caller from waiting indefinitely on a slow response
   B) Retries with backoff are safe for any request regardless of side effects
   C) A circuit breaker can stop forwarding requests after repeated failures
   D) A fallback response is appropriate when the external system is unavailable
   Answer: A,C,D

7. Which statements about idempotency in the `PaymentsAPI` sync endpoint are correct?
   A) The same user pushed twice should not create two records
   B) A unique key derived from the external user identity serves as the deduplication handle — it is what you check against before inserting, not a mechanism that prevents duplicates on its own
   C) Aggressive retries from the caller make idempotency a nice-to-have, not a requirement
   D) Deduplication logic must be applied before writing to the database, typically as an existence check or a database-level unique constraint
   Answer: A,B,D

8. Which statements about observability are correct?
   A) Structured logs with a request or trace ID help correlate events across a single request
   B) Metrics such as error rate and latency per dependency help identify where a failure originated
   C) Distributed tracing alone replaces the need for structured logs and metrics
   D) Knowing whether an issue is in the app, the database, or `external API` requires signals from all three layers
   Answer: A,B,D

---

### Level 2 — Forge (Guided Answer, intermediate)

1. You have a basic Spring Boot user endpoint working locally. Explain how you would evolve it toward production readiness.
   Hint: Start with API and persistence basics, then move to scaling, resilience, observability, and deployment behavior. Discuss what each evolution adds and why the order matters.

2. Explain why an RDBMS is a reasonable default for this service, then describe the narrow cases where Cassandra might become attractive.
   Hint: Ground the answer in data shape, access patterns, consistency requirements, and operational complexity rather than performance claims alone.

3. A user can come from the local DB or from `external API`. Walk through a safe fallback design.
   Hint: Cover local-first lookup, timeout behavior, error handling, coupling boundaries, whether you would persist the fetched user locally, and what to return if `external API` is unavailable.

4. Explain the risk of caching users or roles in this system and how you would manage it.
   Hint: Focus on stale authorization, disabled users becoming reactivated by cache, invalidation strategy, TTL tradeoffs, and event-driven eviction versus passive expiry.

5. Design the internal sync endpoint that accepts users pushed from `PaymentsAPI`.
   Hint: Cover bank-grade service-to-service authentication such as mTLS or OAuth2 client credentials, short-lived credentials, auditability, idempotency or deduplication, validation of incoming data, handling of retries and duplicate delivery, and how to keep the contract loosely coupled.

6. How would you instrument this service so an on-call engineer can quickly tell whether a production incident is in the app layer, the database, or `external API`?
   Hint: Cover structured logs with request IDs, service-level metrics (latency, error rate, dependency health), distributed tracing, and what actionable alerts would look like.

---

### Level 3 — Crucible (Open-ended, advanced)

1. Your service is deployed across multiple nodes behind a load balancer. A rolling deployment is in progress and one node crashes mid-rollout. Walk through exactly what happens to in-flight and new requests, what must hold true in the infrastructure for the service to remain available, and what application-level choices influence the outcome.
   Note: No hints. Expect a complete answer covering readiness probes, graceful shutdown, connection draining, load balancer behavior, and any assumptions about shared state or database migrations.

2. Compare layered architecture, hexagonal (ports-and-adapters), and event-driven integration. For each: explain when you would reach for it, what problem it solves that the others do not, and how it would manifest concretely in this user service.
   Note: No hints. A strong answer grounds each pattern in the specific endpoints and integrations of this service rather than giving generic definitions.

3. `external API` is now slow and intermittently unavailable. Walk through the full resilience strategy you would apply to protect this service, in the order you would add each layer, explaining what each layer contributes and what it cannot protect against.
   Note: No hints. Cover timeouts, retries with backoff and jitter, circuit breaker, fallback behavior, bulkhead isolation, and the user-visible degradation that remains after all layers are in place.

4. `PaymentsAPI` retries aggressively and may send the same user creation event multiple times within seconds. At the same time, another team is pushing role updates through a separate channel. Walk through how you would design the data layer and API contract to guarantee consistency, avoid duplicates, and handle concurrent updates without corrupting the user record.
   Note: No hints. Expected to cover idempotency keys, optimistic or pessimistic locking, upsert semantics, event ordering, and how the database schema supports or constrains these choices.

5. The database is now the confirmed bottleneck under peak load. Walk through every lever you would pull before considering a datastore migration, explaining the tradeoffs of each. Then explain under what specific conditions a migration to a different datastore would actually be justified for this service.
   Note: No hints. Expected to cover indexing, query tuning, ORM behavior, connection pool sizing, read replicas, caching (with correctness implications), partitioning, and finally datastore-switch criteria grounded in access patterns and consistency requirements.
