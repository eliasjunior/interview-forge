# REST API Design & Mortgage Service (Java + Spring Boot)

## Summary
This exercise evaluates the ability to design and implement a simple RESTful service using Java and Spring Boot, focusing on API design, in-memory data modeling, and applying business rules. The system exposes two endpoints: one for retrieving mortgage interest rates and another for checking mortgage feasibility.

The application initializes a list of mortgage rates in memory at startup. The `GET /api/interest-rates` endpoint returns available rates, while `POST /api/mortgage-check` evaluates whether a mortgage is feasible based on business constraints and calculates monthly costs.

Key aspects include proper REST design, input validation, domain modeling, separation of concerns (controller/service), and handling financial calculations accurately.

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

## Concepts

- core concepts: rest-api, spring-boot, controller, service-layer, domain-modeling, validation, dependency-injection
- practical usage: commandlinerunner, postconstruct, bean-lifecycle, requestbody, responseentity, bigdecimal, exception-handling
- tradeoffs: in-memory-vs-persistent-storage, precision-vs-performance, simplicity-vs-extensibility
- best practices: separation-of-concerns, validate-input, use-bigdecimal-for-money, keep-controllers-thin, design-for-testability
