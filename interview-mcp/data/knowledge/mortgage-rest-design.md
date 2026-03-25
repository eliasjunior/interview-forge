# REST API Design & Mortgage Service (Java + Spring Boot)

## Summary
This exercise evaluates the ability to design and implement a simple RESTful service using Java and Spring Boot, focusing on API design, in-memory data modeling, and applying business rules. The system exposes two endpoints: one for retrieving mortgage interest rates and another for checking mortgage feasibility.

The application initializes a list of mortgage rates in memory at startup. The `GET /api/interest-rates` endpoint returns available rates, while `POST /api/mortgage-check` evaluates whether a mortgage is feasible based on business constraints and calculates monthly costs.

Key aspects include proper REST design, input validation, domain modeling, separation of concerns (controller/service), and handling financial calculations accurately. Advanced questions probe scalability, versioning, observability, resilience, and distributed-system concerns.

---

## Questions

1. How would you design a Spring Boot application exposing:
   - `GET /api/interest-rates`
   - `POST /api/mortgage-check`?

2. How would you model the domain objects for:
   - MortgageRate
   - MortgageCheckRequest
   - MortgageCheckResponse?

3. How do you initialize in-memory data on application startup in Spring Boot?

4. Walk me through how you would implement the mortgage feasibility logic.

5. How would you calculate monthly mortgage costs?

6. How would you validate incoming request data in Spring Boot?

7. How would you structure the application layers (controller, service, etc.)?

8. What edge cases or failure scenarios would you handle?

9. How would you design the API contract so it remains maintainable as new mortgage rules, fields, and response details are introduced over time?

10. How would you structure the code so business rules, calculation logic, and transport concerns can evolve independently without creating a tightly coupled service?

11. If this service becomes heavily used by multiple clients, what changes would you make to improve scalability, reliability, and operational robustness?

12. How would you approach versioning and backward compatibility for this API once external consumers depend on it?

13. What observability would you add to diagnose production issues in mortgage checks without exposing sensitive financial data?

14. How would you test this service to give confidence in correctness, regression safety, and long-term maintainability as the codebase grows?

15. What concurrency concerns would you evaluate if mortgage rates can be updated while requests are being processed, and how would you keep calculations consistent?

16. How would you design this service to remain resilient if a downstream dependency, such as a rate source or audit system, becomes slow or unavailable?

17. How would you implement centralized error handling so clients receive consistent error responses while the code stays maintainable?

18. What failure modes would you expect under load, and how would you protect the service from cascading failures or resource exhaustion?

19. If multiple instances of this service are deployed, what design decisions become important to preserve correctness, predictability, and operability?

20. How would you decide which errors should be retried, which should fail fast, and which should be surfaced as business validation errors?

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
- Question 13: intermediate
- Question 14: intermediate
- Question 15: intermediate
- Question 16: advanced
- Question 17: advanced
- Question 18: advanced
- Question 19: advanced
- Question 20: advanced

---

## Evaluation Criteria

- Question 1: Must define GET /api/interest-rates returning a list of rates and POST /api/mortgage-check accepting a request body and returning a result. Should follow REST conventions (resource naming, HTTP verbs, status codes). Bonus: versioning (/api/v1/...). Weak: unclear endpoint responsibilities or logic in the controller.
- Question 2: Must define MortgageRate (maturityPeriod int, interestRate BigDecimal, lastUpdate timestamp), MortgageCheckRequest (income, maturityPeriod, loanValue, homeValue), MortgageCheckResponse (feasible boolean, monthlyCosts BigDecimal). Should prefer BigDecimal for monetary values. Weak: using double for money without justification.
- Question 3: Must mention @PostConstruct, CommandLineRunner, or ApplicationRunner to initialize in-memory data (List or Map) at startup. Bonus: immutability or thread-safety. Weak: hardcoding in controller or lazy initialization.
- Question 4: Must implement feasibility rules — loanValue <= 4 × income AND loanValue <= homeValue — and return feasible=false if any rule fails. Logic must live in the service layer. Bonus: extensible rule design (strategy pattern, validators). Weak: logic in controller or non-reusable.
- Question 5: Must use an annuity-based mortgage formula considering interest rate and maturity period in months. Bonus: awareness of BigDecimal precision and rounding modes. Weak: naive division ignoring interest.
- Question 6: Must use @Valid, @NotNull, @Positive on request fields and return 400 for invalid input. Bonus: custom validator annotations. Weak: no validation or manual if-checks scattered everywhere.
- Question 7: Must define clear layers — Controller (HTTP handling), Service (business logic), optional Repository (not needed for in-memory). Should emphasize separation of concerns. Weak: fat controller or god-class service.
- Question 8: Must consider zero/negative income, missing interest rate for given maturity, extremely large values (overflow), and rounding issues. Bonus: fallback/default strategy when no rate is found. Weak: no error handling for missing rate.
- Question 9: Must mention versioned DTOs (separate request/response from domain), avoid leaking internal model to API, and design for additive changes. Bonus: API changelog or deprecation strategy. Weak: domain objects used directly as DTOs, changes break existing clients.
- Question 10: Must propose separating business rules into a dedicated module or strategy, calculation logic into a pure function or value object, and keep controllers thin. Bonus: hexagonal/ports-and-adapters framing. Weak: all logic in the service or controller without clear seams.
- Question 11: Must address statelessness (since data is in-memory), caching for rate lookups, load balancing, and rate limit considerations. Bonus: mentions distributed caching if persistence is added. Weak: just says "add more instances" without addressing shared state or in-memory rate consistency.
- Question 12: Must mention URI versioning (/v1/, /v2/) or header-based versioning, maintaining old endpoints during a deprecation window, and communication strategy for consumers. Bonus: semantic versioning distinction between additive vs breaking changes. Weak: no plan for existing clients or no deprecation window.
- Question 13: Must mention structured logging (MDC for correlation IDs), metrics (request count, latency, error rate), and masking of sensitive fields (income, loan values) in logs. Bonus: distributed tracing (Micrometer, OpenTelemetry). Weak: logging raw financial data or no structured log format.
- Question 14: Must cover unit tests for business rules (feasibility, calculation), integration tests for endpoints (MockMvc or @SpringBootTest), and contract tests if external consumers exist. Bonus: parameterized tests for edge cases, mutation testing. Weak: only happy-path tests or no separation between unit and integration tests.
- Question 15: Must identify the race condition between rate reads and updates on a shared in-memory list, and propose synchronization (ReadWriteLock, ConcurrentHashMap, immutable snapshots, or copy-on-write). Bonus: lock-free approaches or compare-and-swap. Weak: no awareness of thread safety or suggesting synchronized on the service method without justification.
- Question 16: Must mention circuit breakers (Resilience4j), timeouts, fallback strategies (cached rates, degraded mode), and bulkhead patterns. Bonus: distinction between read and write paths and different resilience strategies for each. Weak: no timeout or fallback — just let requests hang.
- Question 17: Must define a @ControllerAdvice / @ExceptionHandler returning a standardized error body (timestamp, status, message, path). Bonus: error code enum for machine-readable errors. Weak: inconsistent error formats per endpoint or exceptions leaking stack traces to clients.
- Question 18: Must identify thread-pool exhaustion, connection pool saturation, and memory pressure from large request volumes. Propose bulkheads (thread pool isolation), rate limiting (Bucket4j, API gateway), and graceful degradation. Bonus: backpressure and queue bounding. Weak: no awareness of resource exhaustion or just scaling horizontally without protecting the service.
- Question 19: Must address shared-nothing architecture for stateless paths, sticky session or distributed cache if any state must be shared, and health-check endpoints for load balancer integration. Bonus: distributed tracing across instances. Weak: assuming in-memory state is safe across instances without acknowledging the problem.
- Question 20: Must distinguish retriable errors (transient network, 503 with Retry-After), fail-fast errors (invalid input, missing rate — 400/404), and business validation errors surfaced as 422 with details. Bonus: idempotency keys for retried mortgage checks. Weak: retrying on 400s or not distinguishing client vs server errors.

## Concepts

- core concepts: rest-api, spring-boot, controller, service-layer, domain-modeling, validation, dependency-injection
- practical usage: commandlinerunner, postconstruct, bean-lifecycle, requestbody, responseentity, bigdecimal, exception-handling
- tradeoffs: in-memory-vs-persistent-storage, precision-vs-performance, simplicity-vs-extensibility, stateless-vs-stateful, retry-vs-fail-fast
- best practices: separation-of-concerns, validate-input, use-bigdecimal-for-money, keep-controllers-thin, design-for-testability, version-your-api, mask-sensitive-data-in-logs, circuit-breaker-pattern
