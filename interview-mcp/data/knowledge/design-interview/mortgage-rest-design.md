# REST API Design & Mortgage Service (Java + Spring Boot)

## Summary
This topic evaluates whether a senior backend engineer can reason clearly about a deliberately simple but production-minded Spring Boot service. A strong candidate should be able to explain why the current design is readable and maintainable, defend choices like layered responsibilities, `BigDecimal`, immutable records, and explicit exception handling, and also identify where an MVP should evolve next without over-engineering the first version.

## Questions
1. This is a Spring Boot mortgage-check service. The service layer calls `InterestRateService`, which delegates rate lookups to a `MortgageRateProvider`. Right now the only implementation holds rates in memory, but the system was designed so a future implementation could fetch rates from an external HTTP endpoint instead — without changing the service layer.

   ```java
   public interface MortgageRateProvider {
       List<MortgageRate> getRates();
   }
   ```

   ```java
   @Component
   public class InMemoryMortgageRateProvider implements MortgageRateProvider {
       @Override
       public List<MortgageRate> getRates() {
           return rates;
       }
   }
   ```

   Two questions: (a) Why is introducing this interface a good design decision — what principle is it applying and what does it buy you? (b) If you replaced `InMemoryMortgageRateProvider` with an `HttpMortgageRateProvider` that calls an external service, what new production concerns would you need to address?

2. Review the mortgage calculation below. What is correct about this implementation for an MVP, what assumptions is it making, and how would you explain the gap between this formula and a real mortgage amortization model?

   ```java
   private BigDecimal calculateMonthlyCosts(BigDecimal loanValue, BigDecimal annualRatePercent) {
       return loanValue
               .multiply(annualRatePercent)
               .divide(HUNDRED.multiply(MONTHS_IN_YEAR), 2, RoundingMode.HALF_UP);
   }
   ```

3. The API returns `200 OK` for an infeasible mortgage, but `422` when there is no interest rate for the requested maturity period. Do you agree with that contract? Explain the distinction between business outcomes, validation failures, and domain errors in this service.

4. The README emphasizes "solve the problem clearly, nothing more" while still documenting future evolution points like caching, circuit breakers, auth, rate limiting, and DTOs. How do you decide what belongs in the first version of a backend service versus what should remain an explicit future concern?

6. Look at the controller and service split below.

   ```java
   @PostMapping("/mortgage-check")
   public ResponseEntity<MortgageCheckResponse> checkMortgage(@Valid @RequestBody MortgageCheckRequest request) {
       return ResponseEntity.ok(mortgageService.check(request));
   }
   ```

   ```java
   public MortgageCheckResponse check(MortgageCheckRequest request) {
       MortgageRate rate = interestRateService.findByMaturityPeriod(request.maturityPeriod());
       boolean feasible = isFeasible(request);
       BigDecimal monthlyCosts = feasible
               ? calculateMonthlyCosts(request.loanValue(), rate.interestRate())
               : BigDecimal.ZERO;
       return new MortgageCheckResponse(feasible, monthlyCosts);
   }
   ```

   (a) The controller passes `MortgageCheckRequest` — a class annotated with Bean Validation and designed as an HTTP request model — directly into the service. Is that a problem today? What would make you change it?

   (b) `MortgageService` is a concrete class injected directly into the controller. What are your thoughts on that?

7. `InterestRateService.findByMaturityPeriod()` currently calls `provider.getRates()` — which returns an in-memory list — and then streams over it to find a match. Right now the list has around 5–10 fixed entries.

   ```java
   public MortgageRate findByMaturityPeriod(int maturityPeriod) {
       return provider.getRates().stream()
               .filter(r -> r.maturityPeriod() == maturityPeriod)
               .findFirst()
               .orElseThrow(() -> new MaturityPeriodNotFoundException(maturityPeriod));
   }
   ```

   Evaluate this implementation. Is it acceptable as-is? Then consider each of the following changes and explain what you would redesign and why:

   - **Data grows:** the list goes from 10 entries to 100,000 mortgage rate records.
   - **External source:** `getRates()` is replaced by an HTTP call to an upstream service — every invocation of `findByMaturityPeriod` now goes over the wire and fetches the full list before filtering.
   - **Duplicate maturity periods:** the upstream starts returning multiple `MortgageRate` entries with the same `maturityPeriod` value (e.g. different products for the same term). What does the current code do, and is that acceptable?

8. Suppose the mortgage rates are moved to an external upstream that is slow, occasionally unavailable, and rate-limited. Design the next version of this component. Where would you put caching, retry behavior, circuit breaking, timeouts, observability, and fallback logic, and what failure modes would you expose to API consumers?

9. The README calls out several security and operational gaps: open endpoints, no rate limiting, permissive validation boundaries, and actuator exposure. If this service were going live next month, what would you prioritize first, and why? Be specific about risk, implementation order, and what you would defer.

10. Right now the domain records are also used as HTTP contract models. Imagine the business now asks for API versioning, an external rate source, auditability, and a more realistic payment calculation, while keeping current clients stable. How would you evolve this codebase without losing the simplicity that makes it maintainable today?

11. The README says the current `monthlyCosts` formula is an explicit assumption and that only `MortgageService.calculateMonthlyCosts()` should need to change when the business clarifies the rule. How would you validate whether that boundary is still good enough once amortization, fees, insurance, or country-specific lending rules are introduced?

12. The README intentionally delays a DTO layer until the API and domain no longer match. Walk through the decision point where you would introduce `controller/dto` classes here. What concrete changes in requirements would justify that move, and how would you add DTOs without creating unnecessary mapping ceremony?

13. The `Known Evolution Points` section says resilience concerns like caching and circuit breaking should be added directly to the external provider implementation. Do you agree with that placement? Explain how you would keep resilience close to the integration boundary without leaking infrastructure behavior into the domain and service layers.

## Difficulty
- Question 1: foundation
- Question 2: intermediate
- Question 3: intermediate
- Question 4: advanced
- Question 6: intermediate
- Question 7: intermediate
- Question 8: advanced
- Question 9: advanced
- Question 10: advanced
- Question 11: advanced
- Question 12: advanced
- Question 13: advanced

## Evaluation Criteria
- Question 1: A strong answer explains dependency inversion, stable service boundaries, testability, and how the provider isolates data-source changes from controllers and business logic. It should mention likely follow-ups for an external dependency such as timeouts, retries, caching, circuit breaking, monitoring, and failure semantics. A weak answer only says "interfaces are good" without tying the abstraction to this codebase. Bonus points for explaining why this seam is justified while broader abstractions would not be.
- Question 2: A strong answer recognizes that `BigDecimal` and explicit rounding are correct for financial calculations, but also calls out that the current formula computes simple monthly interest rather than a full amortized payment. It should explain that the README intentionally documents this as an assumption and that only one method needs to change when the business clarifies the real rule. A weak answer either blindly accepts the formula as "the mortgage payment" or rejects it without acknowledging MVP scope. Bonus points for discussing precision, rounding policy ownership, and test cases around edge values.
- Question 3: A strong answer distinguishes invalid input (`400`), unsupported but syntactically valid domain requests (`422`), and valid business outcomes (`200` with `feasible: false`). It should explain why infeasibility is part of normal business behavior, not a transport error. A weak answer collapses all failures into `400` or `500`, or treats every negative outcome as an exception. Bonus points for discussing API consumer ergonomics and contract clarity.
- Question 4: A strong answer shows judgment under uncertainty: keep the first version simple when requirements are stable and local, but document clear seams for scaling, resilience, and security as they become necessary. It should explain how to defer complexity responsibly rather than ignore it, using the README's evolution points as examples of intentional boundaries. A weak answer either over-engineers the MVP with speculative infrastructure or dismisses production concerns entirely. Bonus points for framing decisions in terms of cost of change, operational risk, and signal from actual requirements.
- Question 6: A strong answer explains that the current controller is appropriately thin because HTTP concerns stay in the controller and business rules stay in the service. It should also recognize the failure modes on both sides: controllers that become orchestration-heavy and services that become dumping grounds for transport logic. A weak answer argues from dogma rather than this specific codebase. Bonus points for discussing when a separate application service, mapper, or DTO layer becomes justified.
- Question 7: A strong answer says the current list scan is acceptable for a tiny fixed in-memory dataset, especially because readability beats premature optimization here. It should also explain the redesign triggers: larger datasets, repeated upstream calls, stricter latency goals, duplicate maturity periods, or a provider contract that should offer direct lookup semantics. A weak answer either overreacts to O(n) in a five-item list or ignores how the design would change under scale. Bonus points for discussing normalization, uniqueness guarantees, and whether lookup responsibility belongs in the provider or service.
- Question 8: A strong answer places resilience primarily at the external integration boundary, not spread across controllers and core business logic. It should cover connection and read timeouts, bounded retries only for safe failure classes, caching with explicit TTLs, circuit breaking, metrics, structured logs, and clear API behavior when the upstream is unavailable or stale data is used. A weak answer throws infrastructure buzzwords at the problem without explaining ownership or failure semantics. Bonus points for discussing cache invalidation, startup behavior, and whether stale-but-recent data is acceptable.
- Question 9: A strong answer prioritizes by concrete risk: authentication and authorization, endpoint exposure, rate limiting, and input hardening ahead of lower-value refinements. It should give an implementation order that reflects delivery reality and explain what can still safely wait. A weak answer treats every listed issue as equally urgent or proposes a broad platform rewrite. Bonus points for distinguishing application-layer controls from gateway or infrastructure controls.
- Question 10: A strong answer proposes incremental evolution: introduce DTOs when API and domain diverge, preserve existing contracts, isolate new payment logic behind a dedicated policy or calculator, keep the provider seam intact, and add tests around compatibility boundaries. It should show how to change one axis at a time without turning the codebase into a framework. A weak answer jumps straight to a large rewrite or leaves everything coupled and hopes it holds. Bonus points for discussing migration strategy, contract tests, and where audit concerns should live.
- Question 11: A strong answer explains that the current boundary is good because the calculation is isolated, but also tests whether new requirements would overload a single service method. It should describe when to extract a dedicated calculator or policy abstraction, how to preserve contract stability, and how to separate business rules from financial formulas as complexity grows. A weak answer either keeps everything in one method forever or introduces a full pricing engine prematurely. Bonus points for discussing test strategy around regulatory variants, rounding ownership, and backward compatibility.
- Question 12: A strong answer identifies concrete triggers for DTOs: hidden internal fields, renamed public fields, multiple API versions, or divergent validation and serialization needs. It should propose a measured introduction where mapping happens at the edge and domain code remains clean, rather than spreading translation logic everywhere. A weak answer says DTOs are always required or never required. Bonus points for discussing mapper scope, compatibility testing, and how to avoid duplicating business validation across layers.
- Question 13: A strong answer agrees that resilience belongs near the external dependency boundary because that is where latency, retryability, stale data, and fallback semantics are known. It should explain how to expose clean domain-level failures upward while keeping annotations, clients, caches, and circuit breakers out of core business logic. A weak answer either scatters resilience across the whole stack or ignores the need to localize integration concerns. Bonus points for discussing how provider contracts change when stale or fallback data is allowed.

## Concepts
- core concepts: layered architecture, dependency inversion, domain boundaries, immutability, financial precision, API contracts, evolutionary design
- practical usage: Spring Boot, Bean Validation, Problem Details, provider abstraction, service orchestration, resilience patterns, edge mapping
- tradeoffs: MVP scope, abstraction cost, simple interest vs amortization, direct domain exposure, open endpoints, lookup design, DTO timing
- best practices: explicit contracts, typed exceptions, coverage gates, narrow seams, documented evolution points, incremental hardening, localized integration concerns
