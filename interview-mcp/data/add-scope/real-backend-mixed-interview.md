# Real Backend Mixed Interview

This scope captures a real-interview-style backend round where the interviewer starts from a small Spring Boot API, then expands into scalability, resilience, data design, external integrations, deployment behaviour, and short Java/platform theory pivots.

The goal is not to stay on one narrow topic. The candidate should be able to design a pragmatic service, explain tradeoffs under production constraints, and handle subject changes without losing technical depth.

## Core scenario

Build a Java Spring Boot backend service that exposes a basic user endpoint backed by a relational database such as Oracle.

The service must support retrieving a user from the local system. If the user does not exist locally, the service may need to fetch that user from an external dependency named `LendingAPI`.

The service should be containerised with Docker and designed so it can later run as multiple instances.

## Endpoints

* GET /api/users/{userId} (retrieve a user from the local system, or from LendingAPI if needed)
* POST /api/users (create a new local user)
* PATCH /api/users/{userId}/roles (update the user's roles or permissions)
* POST /api/internal/payments-users (internal endpoint used by PaymentsAPI to push newly created users to this service)

## Data model

The user contains at least the fields:

- userId (UUID)
- externalId (String)
- email (String)
- fullName (String)
- status (ENUM: ACTIVE, DISABLED)
- roles (Collection<String>)
- sourceSystem (ENUM: LOCAL, LENDING_API, PAYMENTS_API)
- createdAt (Timestamp)
- updatedAt (Timestamp)

The role update request contains at least the fields:

- roles (Collection<String>)
- changedBy (String)

The internal PaymentsAPI sync request contains at least the fields:

- externalUserId (String)
- email (String)
- fullName (String)
- status (String)
- sourceTimestamp (Timestamp)

## Baseline expectations

- Use Spring Boot as the application framework.
- Use a relational database such as Oracle as the primary source of truth.
- Explain why a relational database is a good default here.
- Be prepared to explain why Cassandra would or would not be appropriate instead.
- Use Docker to package the service.
- Keep the first version simple, but make the design evolvable.

## Business rules

- The service must not create duplicate users for the same external identity.
- A disabled user must not continue to be treated as active because of stale cache entries.
- Only PaymentsAPI is allowed to call the internal user-import endpoint.
- If a user is not found locally, the service may call LendingAPI before deciding the final response.
- The API should remain available during deployments or single-node failures.

## Follow-up expansion areas

These are not separate interviews. They are expected pivots inside the same round.

1. Start with a basic endpoint and data model.
2. Add user permissions via roles.
3. Make the API scalable and discuss what changes in the application layer and in the database layer.
4. Integrate with LendingAPI for fallback user lookup.
5. Discuss optimisations.
6. Discuss resilience patterns and failure handling.
7. Add caching and explain correctness implications, especially when a user becomes disabled.
8. Explain logging, monitoring, tracing, and how to locate the real source of a production issue.
9. Design how PaymentsAPI can send new users to this service through an API contract.
10. Add authentication and authorisation so only PaymentsAPI can call the internal endpoint.
11. Explain what happens during deployment or when one node goes down.

## Variation prompts

Use some of these to vary repeated sessions while staying inside the same scenario:

- Assume read traffic is much higher than write traffic.
- Assume disabled users must propagate within seconds.
- Assume LendingAPI is slow and intermittently unavailable.
- Assume PaymentsAPI retries aggressively and may send duplicate requests.
- Assume one region is under heavier load than the others.
- Assume the database is now the main bottleneck rather than the application nodes.
- Assume auditability is mandatory for permission changes.

## Architecture prompts

The interviewer may ask the candidate to describe or compare common backend architecture patterns.

- layered architecture
- hexagonal / ports-and-adapters
- event-driven integration

For each pattern, the candidate should explain:

- when they would use it
- what tradeoffs it introduces
- how they would implement it in this service

## Technical pivot questions

The interviewer may temporarily switch away from the main scenario and ask targeted theory questions. The candidate should answer clearly and then reconnect the answer back to the running service where possible.

### Java

- What are the advantages of Java and Spring Boot for this kind of service?
- What is the difference between `Collection` and `List`?
- How is `HashMap` implemented internally?
- How would you sort a collection, and what tradeoffs matter?
- What concurrency concerns matter in a Spring Boot backend?

### Spring Boot

- What is Spring Boot?
- How does dependency injection work?
- Describe an end-to-end incoming HTTP call and mention `DispatcherServlet`.
- What is Spring Boot Actuator used for?

### Docker

- What is the structure of a good Dockerfile for this service?
- What would you optimise in the image build?

### Databases

- Why choose an RDBMS here?
- In what situations would Cassandra be a better fit?
- What changes if the database becomes the scaling bottleneck?

### REST and integration

- What does loose coupling mean here?
- What is idempotency and where is it required in this design?
- What are consumer-driven contracts and PACT?

### Delivery and testing

- What is the goal of CI/CD?
- How do you update a specific transitive Maven dependency?
- What testing strategy would you use?
- Explain unit, integration, end-to-end, performance, and security testing.
- Explain the test pyramid and how you would automate it.
- What is TDD and when is it useful?

## Evaluation anchors

Strong candidates usually:

- start simple, then evolve the design with clear tradeoffs
- distinguish stateless app scaling from stateful database scaling
- recognise that caching disabled users introduces correctness risk
- treat internal API authentication, idempotency, and retries as first-class concerns
- discuss observability as logs, metrics, and traces together
- explain resilience at both runtime and deployment time
- answer Java and Spring fundamentals concretely rather than with memorised buzzwords

Weak candidates usually:

- jump to distributed systems complexity without a clean first version
- propose caching without discussing invalidation or stale-authorisation risk
- talk about scaling only at the application layer and ignore the database
- suggest Cassandra without grounding the access patterns or consistency tradeoffs
- describe Spring Boot only at a marketing level and miss the request lifecycle
- treat testing as only unit tests
