# REST API Growth and Data Trade-offs

## Summary
This topic evaluates how a candidate evolves a simple read endpoint into a production-grade backend API as scale, correctness, and operational pressure increase. It starts with a small in-memory dataset and progressively introduces remote data loading, large result sets, pagination, query efficiency, caching, throughput constraints, partitioning, and resilience around upstream dependencies.

A strong candidate does not jump straight to distributed systems jargon. They should begin with a pragmatic first version, explain why it works for a small dataset, then identify the point where that design breaks. The key signal is whether they can move work closer to the database, avoid loading unnecessary rows into application memory, reason about consistency and freshness, and explain the trade-offs introduced by each scaling step.

## Questions

1. You inherit a small Spring Boot service with this implementation:
   ```java
   public List<DataRecord> fetchData() {
       Instant loadedAt = Instant.now();
       return properties.getValues().stream()
               .map(value -> new DataRecord(value.getType(), value.getAmount(), loadedAt))
               .toList();
   }
   ```
   The dataset is only a few hundred records, changes rarely, and one internal UI needs to display it. Walk me through how you would expose this as a REST endpoint in a Spring Boot service. What layers would you create, and what would you deliberately keep simple in a first version?

   Evaluation criteria:
   - Must describe a straightforward layered design such as controller, service, and response model without unnecessary overengineering.
   - Strong answer explicitly defends a simple first version because the dataset is small, internal, and rarely changes.
   - Bonus: mentions DTOs, validation of query parameters if any are introduced, and clear separation between transport and domain models.

   Exercise fit: micro
   Exercise goal: Refactor a small in-memory read flow into a minimal service-layer boundary with a clean response model.
   Exercise owner: service/domain boundary
   Exercise scope: Start from the existing method and extract a small result model or DTO mapping without adding unnecessary architecture.
   Exercise constraints:
   - Keep this to a 20-minute exercise.
   - Focus on the core read path, not framework setup.
   - Do not make controller annotations or validation wiring the main task.
   Exercise acceptance:
   - The method no longer leaks raw configuration values directly.
   - The returned data shape is explicit and testable.
   - One focused unit test covers the mapping behavior.
   Exercise seed: Start from the in-memory `fetchData()` method and introduce a small response model around it.

2. The first version works well enough, but a teammate says, "This is bad design, we should move everything to a database now before it grows." Do you agree? Explain when the in-memory approach is still reasonable and what warning signs would tell you it is time to redesign it.

   Evaluation criteria:
   - Must reason pragmatically instead of treating "database" as automatically better design.
   - Must explain when the in-memory approach is still valid: small dataset, infrequent changes, predictable memory footprint, low operational complexity, and limited consumers.
   - Must identify clear redesign triggers such as data growth, more frequent updates, startup reload pain, correctness concerns, or broader product usage.

   Exercise fit: none

3. A few months later, the same endpoint must serve data that now comes from a remote source. The upstream dataset can grow to millions of rows, and fetching it on demand makes the endpoint slow and fragile. Walk me through what you would change first and why.

   Evaluation criteria:
   - Must explicitly say the application should stop loading the full remote dataset into memory on request.
   - Must separate ingestion or synchronization from read serving and explain why remote fetch per user request does not scale for latency, reliability, or cost reasons.
   - Strong answer walks through sensible first changes rather than jumping straight to the most complex architecture.

   Exercise fit: standard
   Exercise goal: Separate remote ingestion from read serving without building the full production pipeline.
   Exercise owner: service/application boundary
   Exercise scope: Introduce a sync boundary and a local read source contract so reads no longer depend on request-time upstream fetches.
   Exercise constraints:
   - Keep the exercise centered on the first architectural move.
   - Do not add scheduling, status endpoints, caching, or full persistence orchestration.
   - If controller changes are needed, mention them briefly as follow-up only.
   Exercise acceptance:
   - Reads no longer call the upstream directly.
   - The design has a distinct sync step and a distinct read step.
   - One focused test verifies that read serving uses the local source.
   Exercise seed: Start from a service that fetches remote data on each request and refactor it so synchronization happens separately from browsing.

4. Product wants to use this endpoint to drive a screen where users can browse the dataset. The current implementation still returns everything in one response. The first test with production-like data causes long response times, high memory usage, and a nearly unusable screen. How would you redesign the API contract and the backend behavior?

   Evaluation criteria:
   - Must explain why returning everything is unacceptable for memory, bandwidth, latency, and UI usability once the dataset becomes large.
   - Must redesign the API toward bounded browsing with constrained query parameters and server-side data access patterns that only return what the screen actually needs.
   - Weak answer: only says "it will be slow" without identifying where the cost shows up.

   Exercise fit: micro
   Exercise goal: Replace a full-list browse operation with bounded slice reads.
   Exercise owner: service layer
   Exercise scope: Refactor one full-list method into a slice-based method that returns only the requested window of data.
   Exercise constraints:
   - Keep this to the core browse behavior.
   - Do not add cursor migration, filtering, sorting options, or remote sync.
   - Do not make controller binding the main task.
   Exercise acceptance:
   - The service returns a bounded subset instead of the full dataset.
   - Repeated calls for the same slice return the same ordered items.
   - One focused unit test covers first-page and middle-slice behavior.
   Exercise seed: Start from a method that returns every record and change it to return only one requested slice.

5. You introduce server-side pagination so the UI can browse the data. What response shape would you return, and what limits would you enforce from day one to keep the API safe?

   Evaluation criteria:
   - Must describe server-side pagination with bounded page size, deterministic ordering, and safe defaults.
   - Strong answer includes practical response fields such as `items`, `nextCursor` or `page`, and explicitly avoids unbounded client-controlled limits.

   Exercise fit: micro
   Exercise goal: Implement bounded pagination behavior in the service layer for a browse use case.
   Exercise owner: service layer
   Exercise scope: Refactor a full-list service method into a paginated slice method with safe limits and deterministic ordering.
   Exercise constraints:
   - Keep this to a 20-minute exercise.
   - Focus on the core pagination logic, not framework wiring.
   - Do not make controller annotations, request-param binding, Spring `PageRequest`, repository integration, or HTTP tests the main task.
   - Do not add remote ingestion, scheduling, caching, filtering, sorting options, cursor migration, or database indexing.
   - If transport changes are needed, mention them briefly as follow-up only.
   Exercise acceptance:
   - Given an ordered collection of items, return only the requested bounded slice.
   - Cap oversized limits to a safe maximum.
   - Keep ordering deterministic so repeated requests are stable.
   - Include one focused unit test for slice behavior and limit capping.
   Exercise seed: Start from a service method that currently returns the full list. Introduce a paginated slice method that accepts pagination inputs and returns a bounded subset plus minimal pagination metadata.

6. At first pagination seems fine, but users start browsing very deep into the dataset, for example page 10,000. The query gets slower and slower even though each page still returns only 50 rows. Why does this happen, and how would you redesign it?

   Evaluation criteria:
   - Must explain why deep offset pagination degrades: the database still has to walk or skip many rows before returning the requested page.
   - Must redesign toward seek or cursor pagination when access goes deep into large datasets.
   - Strong answer ties the redesign to actual query cost, not just API preference.

   Exercise fit: micro
   Exercise goal: Replace deep offset pagination behavior with a seek/cursor-style approach.
   Exercise owner: pagination/query strategy
   Exercise scope: Refactor one paging method from offset semantics to cursor semantics for deep browsing.
   Exercise constraints:
   - Focus on the paging strategy only.
   - Do not combine this with filtering, caching, or full API redesign.
   - Keep transport changes brief and secondary.
   Exercise acceptance:
   - The redesigned method no longer depends on large offsets for deep pages.
   - The returned page can continue from a stable cursor token or anchor value.
   - One focused test covers continuation to the next page.
   Exercise seed: Start from a page-number/offset method that becomes slow at depth and convert it into a cursor-based continuation.

7. The dataset is updated while users are browsing. New rows are inserted and existing rows are updated. Users complain that items shift between pages, some entries appear twice, and others seem to disappear while scrolling. How would you redesign pagination to give a stable user experience, and what trade-off would you explain between consistency and freshness?

   Evaluation criteria:
   - Must identify the core problem as unstable pagination under concurrent writes or updates.
   - Must explain that stable browsing requires deterministic ordering and usually cursor-based pagination over stable sort keys.
   - Strong answer mentions duplicates or missing items as symptoms and may discuss snapshot or read-consistency strategies, while acknowledging the trade-off between perfect consistency and freshest data.

   Exercise fit: standard
   Exercise goal: Make a paginated browse flow stable while the underlying dataset changes.
   Exercise owner: pagination/query contract
   Exercise scope: Introduce deterministic ordering and stable continuation semantics for one browse path.
   Exercise constraints:
   - Keep the scope to one browse flow.
   - Do not build full snapshot infrastructure or distributed consistency mechanisms.
   - Do not combine with sharding, caching, or search indexing.
   Exercise acceptance:
   - Browsing no longer produces obvious duplicates or disappearing items across consecutive pages.
   - Ordering is explicit and stable.
   - One focused test simulates writes between page fetches.
   Exercise seed: Start from a paginated list where inserts during browsing cause items to shift between pages.

8. Product now wants filtering and sorting by fields such as amount, type, region, category, and effective date. The current implementation fetches one page and filters it in memory before returning the response. Why is that a bad design, and what would you change?

   Evaluation criteria:
   - Must reject in-memory filtering and sorting as a bad design once datasets become large.
   - Must push those operations to the database or serving layer and explain why doing it in the application wastes memory, CPU, bandwidth, and can produce incorrect partial results.

   Exercise fit: micro
   Exercise goal: Move filtering and sorting from in-memory post-processing into the query or serving layer.
   Exercise owner: repository/query layer
   Exercise scope: Refactor one read path so filtering and sorting are applied before pagination results are returned.
   Exercise constraints:
   - Focus on one query path only.
   - Do not combine with index tuning, caching, or broad API redesign.
   - Keep controller wiring secondary.
   Exercise acceptance:
   - Filtering and sorting no longer happen after a partial page has already been loaded.
   - The results reflect the full dataset ordering/filter semantics.
   - One focused test verifies the corrected behavior.
   Exercise seed: Start from a paginated read that filters one page in memory and move that logic down to the source query.

9. After adding filtering and sorting, some combinations become slow in production. How would you reason about database design and indexing here, and how do you decide which indexes are worth adding versus which query patterns should be restricted?

   Evaluation criteria:
   - Must explain index fundamentals in practical terms: indexes speed reads by reducing scans, but increase write cost, storage usage, and maintenance overhead.
   - Strong answer discusses composite indexes aligned to common filter-plus-sort patterns, recognizes that some query combinations should be disallowed or narrowed, and makes it clear that index design follows access patterns.

   Exercise fit: micro
   Exercise goal: Improve one slow filter-plus-sort path by aligning it with one concrete index decision.
   Exercise owner: data access layer
   Exercise scope: Pick one real query pattern, add one index or index recommendation, and validate the intended effect.
   Exercise constraints:
   - Keep this to one access pattern only.
   - Do not turn it into a full indexing strategy for the whole system.
   - Focus on why this index exists, not on framework boilerplate.
   Exercise acceptance:
   - The chosen query pattern is explicit.
   - The proposed index matches the filter-plus-sort shape.
   - One focused test or measurement captures the improvement rationale.
   Exercise seed: Start from one browse query that filters by a field and sorts by another field, then make the access pattern explicit in the index choice.

10. Suppose the endpoint is now receiving 5,000 requests per second. What is most likely to break first, and how would you scale the read path before making the system overly complex?

   Evaluation criteria:
   - Must identify likely bottlenecks first: database read pressure, connection pool exhaustion, expensive queries, cache miss storms, and serialization or network overhead.
   - Strong answer scales incrementally: query tuning, page-size control, connection-pool review, read caching where valid, and possibly read replicas before introducing more distributed complexity.

   Exercise fit: none

11. Traffic is highly read-heavy, so the team wants to add caching. Where would you cache, what would you cache exactly, and what could go wrong if the cache strategy is too naive?

   Evaluation criteria:
   - Must treat caching as a correctness and architecture decision rather than an automatic optimization.
   - Good answer discusses where to cache and what to cache: query results, hot reference data, or API responses depending on traffic shape.
   - Must explain concrete risks such as stale reads, invalidation difficulty, and cache stampedes.
   - Weak answer: says only "add Redis" without explaining what is cached and why.

   Exercise fit: standard
   Exercise goal: Add caching to one hot read path with explicit freshness and invalidation rules.
   Exercise owner: service/cache boundary
   Exercise scope: Cache one concrete read operation and define when cached data is reused or invalidated.
   Exercise constraints:
   - Keep this to one endpoint or one service method.
   - Do not build a platform-wide caching layer.
   - Do not combine with distributed system concerns outside the chosen read path.
   Exercise acceptance:
   - The cached key/value shape is explicit.
   - The freshness rule is explicit.
   - One focused test covers cache hit and stale/refresh behavior.
   Exercise seed: Start from one frequently repeated browse query and add a small cache-aside layer around it.

12. The data changes frequently, and users care about seeing recent values. At the same time, the database cannot handle every read directly at peak traffic. How do you balance freshness and performance without serving dangerously stale data?

   Evaluation criteria:
   - Must explain the trade-off between freshness and latency.
   - Strong answer includes options such as TTL, explicit invalidation, refresh-ahead, event-driven updates, or bypass rules for correctness-sensitive reads and ties the decision to business tolerance for stale data.

   Exercise fit: micro
   Exercise goal: Encode one freshness policy for one read path.
   Exercise owner: service policy layer
   Exercise scope: Implement one small decision rule around strict reads, TTL reads, or bypass-on-sensitive-read behavior.
   Exercise constraints:
   - Focus on policy logic, not infrastructure rollout.
   - Do not combine with broad cache implementation work.
   - Keep the exercise to one read path and one business rule.
   Exercise acceptance:
   - The freshness rule is explicit and testable.
   - The behavior changes depending on the read sensitivity or staleness tolerance.
   - One focused test verifies the policy branch.
   Exercise seed: Start from a cached read path and add a rule that bypasses or refreshes the cache for freshness-sensitive requests.

13. The remote upstream that provides the data is sometimes slow or unavailable. Requests begin to pile up in your service because each request waits on the upstream call. What would you change so your service stays healthy even when the dependency is failing?

   Evaluation criteria:
   - Must include timeouts, bounded retries, circuit breakers, bulkheads or concurrency protection, and observability around the remote dependency.
   - Must explain the failure mode where waiting requests pile up and exhaust threads or connections.
   - Strong answer avoids retry storms and distinguishes between synchronous dependency calls and preloading or asynchronous ingestion approaches.

   Exercise fit: standard
   Exercise goal: Protect one remote dependency path from slow or failing upstream behavior.
   Exercise owner: remote client/service boundary
   Exercise scope: Add timeout, bounded retry, and fail-fast protection to one upstream call path.
   Exercise constraints:
   - Keep it to one dependency path.
   - Do not build a full resilience platform.
   - Observability can be mentioned briefly but should not dominate the task.
   Exercise acceptance:
   - Calls do not wait indefinitely on the upstream.
   - Retry behavior is bounded.
   - The service fails fast instead of piling up waiting work.
   Exercise seed: Start from a client call that waits on a slow supplier API and harden it with simple protective boundaries.

14. The dataset no longer fits comfortably on a single database node. Writes and reads both keep growing. How would you think about partitioning or sharding this data, and what shard keys might make sense for a real system?

   Evaluation criteria:
   - Must explain partitioning or sharding as a response to storage or throughput limits on a single node.
   - Must suggest plausible shard keys such as region, category, source system, or effective-date range and explain that bad keys create hotspots or make common queries expensive.
   - Weak answer: names sharding without relating it to access patterns.

   Exercise fit: none

15. After sharding, product still wants one screen with globally sorted data across all partitions and flexible filtering over the full dataset. Why does this become difficult, and when would you consider a separate search or indexing system instead of forcing the primary database to do everything?

   Evaluation criteria:
   - Must clearly explain why global ordering and broad filtering across shards are hard: the data is distributed, so queries become coordination problems.
   - Strong answer discusses scatter-gather queries, precomputed views, narrowing requirements, or a dedicated search/indexing system when product demands exceed what the primary OLTP path handles well.
   - Must also explain the new costs of that search layer: eventual consistency, extra pipelines, and operational complexity.

   Exercise fit: none

16. You now have pagination, filtering, caching, resilience logic, and a large dataset. What testing strategy would you use to prove this endpoint behaves correctly under normal use, edge cases, and failure scenarios?

   Evaluation criteria:
   - Must propose layered testing: controller tests for contract and validation, service tests for business rules, repository or integration tests for query correctness and pagination stability, cache tests for freshness behavior, resilience tests for timeout and retry behavior, and performance-focused tests for large result sets or frequent reads.
   - Strong answer recognizes that query and pagination behavior often require integration-style tests against a real database engine and realistic data volume.

   Exercise fit: micro
   Exercise goal: Write one focused test suite for a high-risk browse behavior.
   Exercise owner: test layer
   Exercise scope: Pick one behavior cluster such as pagination stability, filter correctness, or resilience fallback and cover it with realistic tests.
   Exercise constraints:
   - Keep the exercise to one behavior cluster.
   - Do not attempt full endpoint coverage.
   - Prefer realistic data and assertions over broad framework scaffolding.
   Exercise acceptance:
   - The chosen risk area is explicit.
   - The tests prove one real edge case or failure behavior.
   - The assertions would catch a meaningful regression.
   Exercise seed: Start from a browse endpoint with pagination or failure-path risk and write a compact integration-style test around that behavior.

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
- Question 11: advanced
- Question 12: advanced
- Question 13: advanced
- Question 14: advanced
- Question 15: advanced
- Question 16: advanced

## Concepts

- core concepts: rest-api, spring-boot, pagination, cursor-pagination, offset-pagination, filtering, sorting, database-index, query-planning, caching, sharding, resilience
- practical usage: controller-service-repository, page-size-limit, stable-ordering, next-cursor, composite-index, read-replica, cache-aside, ttl, invalidation, circuit-breaker, timeout, retry, connection-pool, backpressure
- tradeoffs: simplicity-vs-scale, offset-vs-cursor, freshness-vs-latency, read-performance-vs-write-cost, cache-hit-rate-vs-correctness, single-node-vs-distributed-complexity, scatter-gather-vs-precomputed-view, oltp-vs-search-index
- best practices: push-work-to-db, avoid-in-memory-full-loads, constrain-query-shapes, design-for-access-patterns, measure-before-optimizing, treat-caching-as-a-correctness-decision, add-observability-before-tuning, test-failure-paths
