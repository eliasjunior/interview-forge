# Scalable REST API Design

## Summary

Covers the practical pillars a senior backend engineer needs to keep a REST API alive and observable under real production load. Topics include horizontal scaling, protection patterns (rate limiting, circuit breakers, bulkheads, timeouts), caching trade-offs, cascade failure mechanics, observability (RED metrics, p99), health check design, and consumer-driven contract testing (Pact vs Swagger). All questions are MCQ — some single-answer, some multi-select. Strong candidates understand not just the name of each pattern but the problem it solves, what breaks without it, and the trade-offs it introduces.

---

## Questions

All questions are in the Warm-up Quests section below, organized by difficulty level.

---

## Difficulty

- Foundation: Questions 1–6 (Level 0)
- Intermediate: Questions 7–14 (Level 1)
- Advanced: Questions 15–20 (Level 2)

---

## Evaluation Criteria

Scoring guidance per level:

- **Foundation**: Single correct answer. Full credit for correct letter. Partial credit if candidate explains correct reasoning but picks wrong letter.
- **Intermediate**: Multi-select. Full credit = all correct letters, no extras. Partial credit = majority correct with explanation. Selecting a clearly wrong option with no justification = weak.
- **Advanced**: Multi-select with plausible distractors. Full credit = all correct letters with brief justification. Strong answers name the specific failure mode or trade-off, not just the pattern name.

---

## Concepts

- core concepts: stateless scaling, rate limiting, circuit breaker, bulkhead, timeout, short TTL cache
- practical usage: Redis session store, load balancer health checks, 429 Too Many Requests, Retry-After header, 202 Accepted
- tradeoffs: stale cache vs error, timeout duration vs false failures, per-user vs global rate limiting, Swagger vs Pact
- best practices: RED metrics, p99 latency, distributed rate limiting, graceful degradation, consumer-driven contracts

---

## Warm-up Quests

### Level 0 — Foundation (single correct answer)

1. Your API keeps users logged out after adding a second instance behind a load balancer. What is the root cause?
   A) Health checks are failing on the new instance
   B) Session state is stored in memory on each instance
   C) The load balancer is misconfigured
   D) The database connection pool is exhausted
   Answer: B

2. A client hits your API 500 req/s and starves other users. What mechanism protects you, and what HTTP status signals it?
   A) Circuit breaker — 503
   B) Bulkhead — 503
   C) Timeout — 408
   D) Rate limiting — 429
   Answer: D

3. You cache product prices for 10 minutes. What trade-off do you accept?
   A) Cache misses increase DB write load
   B) Higher memory usage per instance
   C) Responses may serve slightly stale data
   D) You can no longer use a CDN
   Answer: C

4. Your `/health` endpoint calls the database and takes 200ms. Why is this dangerous?
   A) It violates REST conventions for health endpoints
   B) It exposes internal schema to external clients
   C) It increases database replication lag
   D) It can fail under load and cause the load balancer to drop healthy instances
   Answer: D

5. Average latency is 80ms but users report slowness. Which metric reveals the real problem?
   A) Requests per second
   B) p99 latency
   C) Error rate
   D) Mean response time
   Answer: B

6. Without a circuit breaker, a downstream goes down. What happens to your API?
   A) The load balancer removes the downstream from rotation automatically
   B) Rate limiting kicks in and protects throughput
   C) Requests automatically reroute to a fallback
   D) Threads block waiting, pool exhausts, and healthy endpoints start failing
   Answer: D

### Level 1 — Intermediate (select all that apply)

7. Which are valid problems caused by naive immediate retries on a degraded dependency? (select all that apply)
   A) Circuit breakers cannot open while retries are in flight
   B) Retries amplify load on an already struggling service
   C) Each retry holds a thread, worsening pool exhaustion
   D) Retries with no jitter cause synchronized thundering herd spikes
   Answer: B, C, D

8. Without a bulkhead, a slow payment service causes which of the following? (select all that apply)
   A) New requests queue behind blocked threads until the pool is exhausted
   B) The circuit breaker opens on all routes, not just payment
   C) Unrelated endpoints like /users start degrading
   D) Payment threads consume the shared thread pool
   Answer: A, C, D

9. Which statements about an open circuit breaker are correct? (select all that apply)
   A) A single successful probe in half-open state closes the circuit
   B) The load balancer automatically reroutes traffic to healthy upstreams
   C) After a configured time, it moves to half-open to test recovery
   D) Requests fail immediately without calling the dependency
   Answer: A, C, D

10. You have a 2s timeout but no circuit breaker. A dependency fails for 3 minutes. Which problems still occur? (select all that apply)
    A) None of the above — timeouts alone are sufficient protection
    B) Thread pool exhaustion can cascade to healthy endpoints
    C) The error rate appears lower than actual because timeouts return 200
    D) Every request blocks a thread for 2s before failing
    Answer: B, D

11. Your per-user rate limit is bypassed by a DDoS from 50,000 IPs. Which additions would help? (select all that apply)
    A) Increasing per-user limit to 1000 req/min
    B) Anomaly detection on traffic shape
    C) Global rate limiting across all clients
    D) IP-level rate limiting
    Answer: B, C, D

12. Which statements are true about Swagger (OpenAPI) vs Pact? (select all that apply)
    A) Swagger automatically generates consumer code guaranteed to match production
    B) Pact requires both consumer and provider to participate in verification
    C) Pact tests can catch a breaking change that Swagger validation would miss
    D) Swagger documents what the provider offers; Pact documents what consumers actually need
    Answer: B, C, D

13. p99 latency spikes Monday mornings but average looks fine. Which are plausible causes? (select all that apply)
    A) Thread pool exhaustion from a slow downstream warming up
    B) Average latency is calculated incorrectly — it should also spike
    C) DB connection pool contention under higher morning load
    D) GC pauses triggered by weekend batch jobs that haven't cleared
    Answer: A, C, D

14. Which are acceptable strategies when a circuit breaker opens on a payment service? (select all that apply)
    A) Silently succeed and process the payment when the service recovers
    B) Queue the request for async processing and return 202 Accepted
    C) Serve stale cached payment status if it is safe for the use case
    D) Return 503 with a Retry-After header
    Answer: B, C, D

### Level 2 — Advanced (select all that apply)

15. Each of 5 instances enforces 100 req/min per user locally. Which statements are true? (select all that apply)
    A) Sticky sessions would fully solve this without Redis
    B) This approach works correctly only if the load balancer uses consistent hashing per user
    C) Moving the counter to Redis fixes the distributed consistency problem
    D) A user can send up to 500 req/min total across all instances
    Answer: B, C, D

16. 4 services are called sequentially, each with 99% reliability. Which are true? (select all that apply)
    A) Adding a retry on each service call always improves overall reliability
    B) Reducing to 2 services raises composite success rate to approximately 98%
    C) Calling services in parallel instead of sequentially improves the success rate
    D) Composite success rate is approximately 96%
    Answer: B, D

17. You set timeout to 100ms on a dependency that normally responds in 50ms but spikes to 2s under load. Which are true? (select all that apply)
    A) None of the above — 100ms is always the safer choice
    B) Error rate increases during load spikes even if the dependency is technically healthy
    C) Thread protection improves — threads are released faster
    D) Legitimate slow-but-valid requests get rejected under load
    Answer: B, C, D

18. Which signals belong to the RED method for service observability? (select all that apply)
    A) Database connection pool size
    B) Duration (p99 latency)
    C) Error rate
    D) Request rate
    Answer: B, C, D

19. Pact tests pass in CI but the integration breaks in staging. Which are likely root causes? (select all that apply)
    A) Pact does not support JSON response validation
    B) The Pact broker was not updated after the latest provider release
    C) The provider deployed a breaking change without running Pact verification
    D) The consumer Pact was written against a different provider version than what is deployed in staging
    Answer: B, C, D

20. Circuit breaker opens and cached data is 20 minutes stale. Which statements correctly describe when to serve stale vs return an error? (select all that apply)
    A) Always serve stale — availability is always more important than consistency
    B) Document the staleness window in the API contract so consumers can make informed decisions
    C) Return an error when staleness could cause incorrect financial or safety decisions
    D) Serve stale for read-heavy, non-critical data where small staleness is acceptable
    Answer: B, C, D
