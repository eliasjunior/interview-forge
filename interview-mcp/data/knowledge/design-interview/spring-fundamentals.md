# Spring Fundamentals

## Summary
This topic focuses on core Spring and Spring Boot mechanics that backend engineers should understand before moving into broader architecture or framework-specific integrations. A strong candidate should be able to explain how an incoming HTTP request moves through Spring MVC, why `DispatcherServlet` is central to that flow, how dependency injection and the application context wire the system together, how proxy-based features like `@Transactional` rely on AOP, and how operational concerns such as exception handling, caching, and Actuator fit into a production-ready service.

The goal is to test whether the candidate understands how Spring actually behaves at runtime, not just whether they can repeat annotations from memory. Good answers should connect concepts such as bean creation, request dispatching, proxy interception, and error mapping into one coherent mental model.

---

## Questions

1. What is Spring Boot, and why is it often a strong default for building backend services?
2. Explain dependency injection and inversion of control in Spring. What problem do they solve?
3. What is the Spring `ApplicationContext`, and what responsibilities does it have at runtime?
4. How are beans discovered, created, and wired together in a typical Spring Boot application?
5. Walk me through an incoming HTTP request in Spring Boot from the servlet container to the controller and back to the response. Mention `DispatcherServlet`.
6. What do `HandlerMapping`, `HandlerAdapter`, argument binding, and message conversion do in the Spring MVC request flow?
7. Where should transaction boundaries usually live in a Spring application, and why?
8. How do Spring AOP proxies work, and why do annotations like `@Transactional` and `@Async` depend on proxy behavior?
9. What is self-invocation in Spring, and why can it break `@Transactional`, `@Async`, or method-security annotations?
10. How should centralized exception handling be implemented in Spring Boot so APIs return consistent error responses?
11. How would you distinguish validation errors, business rule violations, and unexpected server failures in a Spring API?
12. How does Spring caching work at a high level? Explain `@Cacheable`, `@CachePut`, and `@CacheEvict`.
13. What are the main correctness risks when adding caching to a Spring service, and how would you reduce them?
14. What is Spring Boot Actuator, and why is it useful in production systems?
15. Which Actuator endpoints and metrics are most useful for operating a backend service, and what security concerns come with exposing them?
16. A Spring Boot service is slow in production. How would you use request-flow knowledge, exception mapping, caching insight, and Actuator data to narrow down the problem?

---

## Difficulty

- Question 1: foundation
- Question 2: foundation
- Question 3: foundation
- Question 4: foundation
- Question 5: foundation
- Question 6: intermediate
- Question 7: foundation
- Question 8: intermediate
- Question 9: intermediate
- Question 10: foundation
- Question 11: intermediate
- Question 12: foundation
- Question 13: intermediate
- Question 14: foundation
- Question 15: intermediate
- Question 16: advanced

---

## Evaluation Criteria

- Question 1: Must explain Spring Boot concretely: auto-configuration, starter dependencies, embedded server, externalized configuration, and fast integration of web/data/ops features. Weak answer: only says it is "easy" or "quick."
- Question 2: Must explain inversion of control as the container managing object creation and wiring instead of application code doing it manually. Must explain dependency injection as the mechanism for supplying collaborators. Weak answer: treats DI as only constructor parameters without explaining why it matters.
- Question 3: Must explain that `ApplicationContext` is the central Spring container responsible for bean creation, dependency resolution, lifecycle management, configuration, and access to framework services. Bonus: mentions profiles, events, or environment abstraction.
- Question 4: Must cover component scanning and/or explicit configuration via `@Configuration` and `@Bean`. Must explain that beans are instantiated, dependencies resolved, and injected by the container. Strong answer mentions singleton default scope and lifecycle callbacks. Weak answer: implies beans are created "when the code imports them."
- Question 5: Must describe the flow in order: servlet container receives request -> `DispatcherServlet` acts as the Spring MVC front controller -> handler mapping selects the controller method -> arguments are bound/validated -> controller calls service -> response body is converted and written back. Weak answer: skips `DispatcherServlet` or collapses the flow to "controller then service."
- Question 6: Must explain each piece: `HandlerMapping` chooses the handler, `HandlerAdapter` invokes it, argument binding maps request input into method parameters, and message converters serialize/deserialize request and response bodies. Weak answer: names the components but cannot describe their role.
- Question 7: Must say transactions usually belong in the service layer because business operations live there and multiple repository calls may need one unit of work. Weak answer: places transaction boundaries at the controller by default.
- Question 8: Must explain that Spring commonly wraps beans in proxies so cross-cutting concerns can run before/after method execution. Must connect this to `@Transactional`, `@Async`, caching, or method security. Weak answer: says AOP is "for logging" only and misses proxy-based interception.
- Question 9: Must explain that self-invocation means one method in a bean calling another method on the same bean instance directly, bypassing the proxy. Must explain why this causes annotations implemented through proxies to be skipped. Weak answer: only says "it does not work sometimes."
- Question 10: Must propose `@ControllerAdvice` plus `@ExceptionHandler`, with a standardized error body and correct HTTP statuses via `ResponseEntity` or status annotations. Must avoid leaking stack traces or internal details to clients.
- Question 11: Must distinguish categories clearly: validation errors as client input issues, business rule violations as domain-level rejections, unexpected failures as server errors. Strong answer maps them to appropriate status codes such as 400, 422, and 500, and explains why consistency matters.
- Question 12: Must explain that Spring caching stores method results based on keys, typically derived from method parameters. Must distinguish `@Cacheable` from `@CachePut` and `@CacheEvict`. Weak answer: treats caching as an HTTP concern only.
- Question 13: Must identify stale data, bad invalidation, cache stampede, or inconsistent multi-node cache behavior as real risks. Must propose mitigations such as TTLs, targeted eviction, careful cache boundaries, or distributed cache choices. Weak answer: suggests caching everything without discussing correctness.
- Question 14: Must explain that Actuator exposes operational endpoints and metrics for health, observability, and runtime inspection. Strong answer mentions production visibility rather than treating it as a developer-only feature.
- Question 15: Must mention useful endpoints such as health, info, metrics, prometheus, loggers, or env/config-related endpoints with care. Must explicitly mention that management endpoints can expose sensitive internals and need proper scoping, authentication, and selective exposure.
- Question 16: Must use a structured troubleshooting flow: inspect request path behavior, correlate logs/metrics/traces, check exception patterns, verify whether caches are helping or hiding stale issues, and use Actuator data such as health and metrics to narrow the bottleneck. Weak answer: jumps straight to changing random config values.

## Concepts

- core concepts: spring-boot, inversion-of-control, dependency-injection, application-context, bean-lifecycle, dispatcher-servlet, spring-mvc, handler-mapping, handler-adapter, message-converter, aop, proxy, transaction-boundary, controller-advice, cacheable, actuator
- practical usage: component-scan, configuration-class, bean-definition, constructor-injection, request-mapping, validation, responseentity, exception-handler, cache-evict, cache-put, management-endpoints, health-endpoint, prometheus, metrics, loggers
- tradeoffs: auto-configuration-vs-explicit-configuration, constructor-injection-vs-field-injection, service-layer-transaction-vs-controller-layer-transaction, local-cache-vs-distributed-cache, broad-endpoint-exposure-vs-secure-actuator-scope
- best practices: prefer-constructor-injection, keep-transaction-boundaries-in-services, understand-proxy-limitations, centralize-error-mapping, cache-only-what-you-can-invalidate, expose-actuator-selectively, learn-request-flow-not-just-annotations

## Warm-up Quests

### Level 0

1. What problem does dependency injection solve in Spring?
A) It automatically writes SQL queries for repositories
B) It lets the container provide an object's dependencies instead of the object creating them itself
C) It removes the need for interfaces
D) It makes all beans request-scoped by default
Answer: B

2. What is `DispatcherServlet` in Spring MVC?
A) The embedded database migration runner
B) The central front controller for incoming HTTP requests
C) The thread pool that executes `@Async` methods
D) The default cache provider
Answer: B

3. Where do transaction boundaries usually belong in a Spring application?
A) In the browser client
B) In the service layer
C) In the entity classes
D) In the build script
Answer: B

4. Why can self-invocation break `@Transactional` in Spring?
A) Because Spring MVC disables transactions for internal calls
B) Because internal method calls bypass the proxy that applies the annotation behavior
C) Because the JVM forbids nested method calls
D) Because only static methods can be transactional
Answer: B

5. What does `@ControllerAdvice` primarily help with?
A) Scheduling background jobs
B) Centralized exception handling for controllers
C) Managing bean scopes
D) Replacing `DispatcherServlet`
Answer: B

6. What does `@Cacheable` do?
A) It stores a method result in a cache so repeated calls with the same key can reuse it
B) It encrypts cached HTTP responses automatically
C) It forces every method call to hit the database first
D) It creates a transaction around the method
Answer: A

7. What is Spring Boot Actuator mainly used for?
A) Building Docker images
B) Exposing operational endpoints and metrics for running applications
C) Creating JPA entities
D) Replacing logging frameworks
Answer: B

8. In Spring MVC, what selects the controller method for a request?
A) `HandlerMapping`
B) `DataSource`
C) `CacheManager`
D) `BeanPostProcessor`
Answer: A

9. Which injection style is usually preferred in Spring services?
A) Constructor injection
B) Random static lookup
C) Manual singleton lookup
D) Field injection in every case
Answer: A

10. Why should Actuator endpoints be exposed carefully in production?
A) Because they can reveal internal runtime and configuration details
B) Because they stop the JVM garbage collector
C) Because they automatically disable caching
D) Because they convert all requests to synchronous I/O
Answer: A

### Level 1

1. Which statements about Spring Boot are correct?
A) It commonly uses starter dependencies and auto-configuration
B) It usually runs with an embedded server for web apps
C) It removes the need to understand the request lifecycle
D) It supports externalized configuration
Answer: A,B,D

2. Which statements about dependency injection and the `ApplicationContext` are correct?
A) The container manages bean creation and wiring
B) Constructor injection makes dependencies explicit
C) The `ApplicationContext` is irrelevant after startup
D) Spring can create beans from component scanning or `@Bean` methods
Answer: A,B,D

3. Which statements about the Spring MVC request flow are correct?
A) `DispatcherServlet` is the front controller
B) `HandlerMapping` helps locate the correct handler
C) Message converters help serialize and deserialize bodies
D) Request handling skips argument binding when using controllers
Answer: A,B,C

4. Which statements about proxy-based behavior in Spring are correct?
A) `@Transactional` often relies on proxy interception
B) Self-invocation can bypass proxy-based behavior
C) `@Async` can also be affected by proxy boundaries
D) AOP in Spring never affects runtime method calls
Answer: A,B,C

5. Which statements about centralized exception handling are correct?
A) `@ControllerAdvice` can apply across controllers
B) `@ExceptionHandler` methods can map exceptions to structured responses
C) All errors should be returned as 200 with an error message body
D) Internal stack traces should generally not be exposed to API clients
Answer: A,B,D

6. Which statements about Spring caching are correct?
A) `@Cacheable` can skip method execution on a cache hit
B) `@CacheEvict` helps remove stale cached entries
C) Caching has no correctness risks if the service is simple
D) TTL and invalidation strategy both matter
Answer: A,B,D

7. Which statements about Actuator are correct?
A) Health and metrics endpoints help operations teams understand runtime behavior
B) Sensitive endpoints may need authentication and selective exposure
C) Actuator replaces application logs completely
D) Prometheus scraping is a common metrics integration pattern
Answer: A,B,D

8. Which statements about transaction boundaries are correct?
A) Service-layer transactions usually align better with business operations
B) Putting transactions only in repositories always solves boundary issues
C) One service method may coordinate several repository calls in a single unit of work
D) Understanding transaction boundaries matters for correctness
Answer: A,C,D

### Level 2

1. A request enters a Spring Boot API. Walk through the end-to-end Spring MVC request flow.
Hint: Start at the servlet container, include `DispatcherServlet`, handler selection, binding/validation, controller-to-service interaction, and response serialization.
Answer: The servlet container receives the HTTP request and routes it to Spring MVC through `DispatcherServlet`, which acts as the front controller. `DispatcherServlet` asks `HandlerMapping` to find the matching controller method. The chosen handler is invoked through a `HandlerAdapter`, while Spring binds request parameters, path variables, headers, or request bodies into method arguments and runs validation where configured. The controller delegates to the service layer, which performs business logic and may call repositories or other dependencies. When the controller returns, Spring uses message converters to serialize the response object into JSON or another response format and writes it back to the client.

2. Explain dependency injection, inversion of control, and the role of the `ApplicationContext`.
Hint: Explain what the container controls and why that improves maintainability and testing.
Answer: Inversion of control means the framework container, not application code, controls object creation and wiring. Dependency injection is the mechanism Spring uses to provide each object with the collaborators it needs, usually through constructor arguments. The `ApplicationContext` is the central container that creates beans, resolves dependencies, applies configuration, manages lifecycle concerns, and exposes framework services such as events and environment properties. This improves maintainability because object relationships are declared rather than manually assembled everywhere, and it improves testability because dependencies can be substituted cleanly.

3. Explain how proxy-based behavior works in Spring and why self-invocation causes problems.
Hint: Connect the explanation to `@Transactional`, `@Async`, or method security.
Answer: Spring often implements cross-cutting features by wrapping a bean in a proxy that intercepts method calls. The proxy can start and commit a transaction, dispatch a method onto an async executor, apply method-security checks, or perform caching behavior before delegating to the real bean. Self-invocation breaks this because a method inside the bean calling another method on the same instance does not go through the proxy. Since the proxy is bypassed, the annotation-driven behavior is skipped, which is why `@Transactional`, `@Async`, and method-security annotations can appear to do nothing in that situation.

4. Design a consistent API error-handling approach for a Spring Boot service.
Hint: Cover `@ControllerAdvice`, exception categories, HTTP status codes, and what the response body should contain.
Answer: A consistent approach uses `@ControllerAdvice` as a global error-mapping layer with `@ExceptionHandler` methods for specific exception categories. Validation failures should map to 400 responses with field-level details where useful. Business rule violations should map to an appropriate domain-level status such as 422 when the request is syntactically valid but unacceptable in the business context. Unexpected failures should map to 500 responses with a safe generic message. The response body should be structured consistently, for example including timestamp, status, code, message, and request path. Internal stack traces and implementation details should stay in logs, not in the API response.

5. Explain the difference between `@Cacheable`, `@CachePut`, and `@CacheEvict`, and describe when caching becomes dangerous.
Hint: Focus on method-result caching, invalidation, stale data, and multi-node correctness concerns.
Answer: `@Cacheable` checks the cache before executing the method and stores the result on a miss. `@CachePut` always executes the method and then updates the cache with the new result. `@CacheEvict` removes entries, typically when writes make old cached values invalid. Caching becomes dangerous when stale data creates incorrect behavior, such as serving outdated authorization or business state, or when multi-node deployments have inconsistent caches. To reduce risk, the service should cache only data with acceptable freshness tradeoffs, define clear eviction points, use TTLs where appropriate, and choose local versus distributed cache designs intentionally.

6. Explain what Spring Boot Actuator gives you in production and how you would expose it safely.
Hint: Cover health, metrics, debugging value, and security boundaries around management endpoints.
Answer: Spring Boot Actuator provides operational visibility into a running service through endpoints and metrics such as health, info, metrics, and Prometheus output. It helps teams understand whether the app is alive, whether dependencies are healthy, what the latency and error-rate patterns look like, and what runtime signals point to an incident. It should be exposed safely by enabling only the endpoints that are actually needed, separating management traffic where appropriate, and protecting sensitive endpoints with authentication and authorization. Endpoint exposure should be deliberate because some Actuator data can reveal internal topology, configuration, or debugging details that should not be public.
