# Database Basics for Senior Backend Engineers

## Summary
This topic evaluates the relational database fundamentals a senior backend engineer must apply in production. It focuses on schema invariants, SQL query shape, joins and aggregation, indexing, transactions and concurrency, safe migrations, and evidence-based performance diagnosis.

A strong candidate should not treat the database as a black box behind an ORM. They should know which correctness rules belong in the database, how SQL result grain changes through joins and aggregation, how indexes match access patterns, and how transaction behavior differs under concurrency. The expected level is practical: state assumptions, use concrete SQL where useful, distinguish database guarantees from application conventions, verify claims with plans and metrics, and recognize when a locally correct design becomes expensive or unsafe at production scale.

## Questions

1. Design an `orders` table with customer, status, money, and timestamp fields. Which types and database constraints would protect its core invariants?

   Exercise fit: micro
   Exercise goal: Design a minimal relational table for a simple domain object.
   Exercise owner: data model
   Exercise scope: Define one table with key columns, constraints, nullability, and one related reference.
   Exercise constraints:
   - Keep this to one table and one related reference.
   - Do not design the full order system.
   - Focus on correctness and explicit constraints.
   Exercise acceptance:
   - The primary key is explicit.
   - Required and optional fields are justified.
   - At least one useful constraint is included.
   Exercise seed: Start from an `Order` object with `id`, `customerId`, `status`, `totalAmount`, `currency`, and `createdAt`.

2. A `users` table allows nullable email addresses but requires every non-null normalized email to be unique. How would you model and query this correctly given SQL `NULL` semantics?

   Exercise fit: micro
   Exercise goal: Enforce uniqueness for an optional normalized value.
   Exercise owner: schema and repository layer
   Exercise scope: Add one normalized email column, uniqueness rule, and lookup query.
   Exercise constraints:
   - Preserve the ability to store users without an email.
   - Define how case normalization is performed.
   - Account for database-specific behavior around multiple nulls and partial indexes.
   Exercise acceptance:
   - Two equivalent non-null emails cannot be stored.
   - Multiple users without email are handled intentionally.
   - The lookup predicate can use the supporting index.
   Exercise seed: Start from a nullable `email` column with application-only duplicate checks.

3. Write a basic query to list active customers created after a given date, sorted newest first, with a maximum of 50 rows. What details matter in this simple query?

   Exercise fit: micro
   Exercise goal: Write a bounded read query with filtering and deterministic ordering.
   Exercise owner: repository/query layer
   Exercise scope: Implement one simple filtered list query.
   Exercise constraints:
   - Keep this to `SELECT`, `WHERE`, `ORDER BY`, and `LIMIT`.
   - Do not add pagination beyond the first page.
   - Do not add complex joins.
   Exercise acceptance:
   - The query filters by status and creation date.
   - The query has deterministic ordering.
   - The query enforces a safe maximum row count.
   Exercise seed: Start from a repository method that returns all customers.

4. Explain the difference between `INNER JOIN` and `LEFT JOIN`. Give an example where choosing the wrong one would either lose rows or create misleading results.

   Exercise fit: none

5. A report query joins orders to order items and suddenly returns more rows than expected. What is row multiplication, why does it happen, and how do you fix or account for it?

   Exercise fit: micro
   Exercise goal: Diagnose and fix duplicate rows caused by joining a parent table to a child table.
   Exercise owner: query/report layer
   Exercise scope: Correct one parent-child join query.
   Exercise constraints:
   - Focus on one join path.
   - Do not redesign the schema.
   - Do not hide the issue with arbitrary `DISTINCT` unless justified.
   Exercise acceptance:
   - The cause of row multiplication is identified.
   - The corrected query returns the intended grain.
   - One test or sample dataset proves the result count.
   Exercise seed: Start from an `orders` to `order_items` join that returns one row per item instead of one row per order.

6. When should you use `GROUP BY` and `HAVING`, and how do they differ from `WHERE`? Use a sales summary example.

   Exercise fit: micro
   Exercise goal: Build one aggregate query with correct filtering before and after grouping.
   Exercise owner: query layer
   Exercise scope: Create a grouped sales summary query.
   Exercise constraints:
   - Keep this to one table or one simple join.
   - Include both pre-aggregation and post-aggregation filtering.
   - Do not add window functions.
   Exercise acceptance:
   - `WHERE` filters rows before grouping.
   - `HAVING` filters groups after aggregation.
   - The aggregate result has the intended grouping grain.
   Exercise seed: Start from an `orders` table and summarize total sales by customer.

7. Your ORM code loads 100 orders and then runs another query for each order's customer. What is the N+1 problem, how would you detect it, and what are reasonable fixes?

   Exercise fit: standard
   Exercise goal: Fix an N+1 read path without over-fetching unrelated data.
   Exercise owner: repository/data-access layer
   Exercise scope: Refactor one list endpoint that triggers N+1 queries.
   Exercise constraints:
   - Keep the fix to one endpoint.
   - Choose either projection, join fetch, or batch loading.
   - Do not change unrelated service behavior.
   Exercise acceptance:
   - Query count is reduced.
   - The endpoint still returns the same response data.
   - A test or log assertion demonstrates the improvement.
   Exercise seed: Start from a list-orders endpoint that lazily loads each customer.

8. Your team has a query `SELECT UPPER(name) FROM customer WHERE LOWER(email) = LOWER(?)`. The `email` column has an index. A colleague says the query is slow even though the index exists. What is causing the slowdown, and how would you fix it while still doing a case-insensitive match?

   Exercise fit: micro
   Exercise goal: Refactor a query so filtering remains index-friendly while computed display values stay in the result.
   Exercise owner: query layer
   Exercise scope: Adjust one query that applies a function to a filtered column.
   Exercise constraints:
   - Focus on one predicate.
   - Do not introduce full-text search.
   - Do not add a new platform dependency.
   Exercise acceptance:
   - The query avoids wrapping the indexed filter column in a function.
   - The computed display value can still be returned.
   - The reason for the performance improvement is explained.
   Exercise seed: Start from `WHERE LOWER(email) = LOWER(?)` on a table with an index on `email`.

9. Compare a subquery, a CTE, and a temporary table. When would each be reasonable, and what trade-offs should a senior engineer consider?

   Exercise fit: standard
   Exercise goal: Refactor a multi-step reporting query into a clearer intermediate structure.
   Exercise owner: query/report layer
   Exercise scope: Use a CTE or temporary table for one report calculation.
   Exercise constraints:
   - Keep this to one report query.
   - Do not use temporary tables just to hide unclear logic.
   - Explain the cost of materializing intermediate data.
   Exercise acceptance:
   - The intermediate result has a clear purpose.
   - The final query is easier to reason about.
   - The trade-off between readability and execution cost is stated.
   Exercise seed: Start from a nested report query that calculates active customers with recent high-value orders.

10. A query filters by `customer_id`, filters by `status`, and sorts by `created_at DESC`. How would you design an index for this query, and what could go wrong if you add indexes blindly?

   Exercise fit: micro
   Exercise goal: Choose one composite index for one concrete query shape.
   Exercise owner: data-access layer
   Exercise scope: Recommend or add one index for one filter-plus-sort query.
   Exercise constraints:
   - Keep this to one access pattern.
   - Do not create indexes for every column.
   - Explain write and storage costs.
   Exercise acceptance:
   - The proposed index matches the query shape.
   - The column order is justified.
   - The trade-off of maintaining the index is explained.
   Exercise seed: Start from `WHERE customer_id = ? AND status = ? ORDER BY created_at DESC LIMIT 50`.

11. `EXPLAIN ANALYZE` shows a sequential scan and a large gap between estimated and actual rows. How would you determine whether the scan, stale statistics, or the query shape is the real problem?

   Exercise fit: micro
   Exercise goal: Use a query plan to reason about one slow query.
   Exercise owner: performance investigation
   Exercise scope: Inspect one slow query and propose one targeted improvement.
   Exercise constraints:
   - Do not jump straight to adding an index.
   - Check predicates, row estimates, selected columns, and data volume.
   - Keep the investigation focused.
   Exercise acceptance:
   - The suspected bottleneck is identified.
   - At least one non-schema issue is considered.
   - The proposed fix is tied to the observed plan.
   Exercise seed: Start from a slow customer lookup query with a full table scan.

12. An endpoint uses `OFFSET 500000 LIMIT 50` and gets slower as users browse deeper. Why does this happen, and when would cursor pagination be a better design?

   Exercise fit: standard
   Exercise goal: Replace deep offset pagination with cursor pagination over a stable key.
   Exercise owner: pagination/query contract
   Exercise scope: Refactor one browse query from offset to cursor semantics.
   Exercise constraints:
   - Keep this to one endpoint.
   - Use a stable ordering key.
   - Do not add unrelated filtering or caching.
   Exercise acceptance:
   - The query no longer depends on scanning past a large offset.
   - The response includes a continuation cursor or anchor.
   - One test covers fetching the next page.
   Exercise seed: Start from an order history endpoint using page number and offset.

13. Two requests perform a read-modify-write on the same account balance and one update is lost. How would you choose among an atomic conditional update, optimistic locking, and row locking?

   Exercise fit: standard
   Exercise goal: Prevent lost updates while preserving an account invariant.
   Exercise owner: transaction/write path
   Exercise scope: Add atomic, optimistic, or pessimistic protection to one update operation.
   Exercise constraints:
   - Focus on one record update scenario.
   - Do not build distributed locking.
   - Keep the transaction boundary explicit.
   - Explain why the chosen atomicity or locking strategy fits.
   Exercise acceptance:
   - Concurrent updates cannot silently overwrite each other.
   - Insufficient funds or version conflicts are handled explicitly.
   - One test simulates concurrent update attempts.
   Exercise seed: Start from a read-modify-write balance update with no version check.

14. Explain dirty reads, non-repeatable reads, phantoms, and write skew with practical examples. How would you verify what a specific database actually guarantees at each isolation level?

   Exercise fit: none

15. You need to add a non-null column to a large production table without downtime. What migration steps would you take to keep old and new application versions working?

   Exercise fit: standard
   Exercise goal: Plan a backward-compatible schema migration.
   Exercise owner: database migration/application rollout
   Exercise scope: Add one required column safely across multiple deploy steps.
   Exercise constraints:
   - Avoid table rewrites or long blocking operations when possible.
   - Support old and new application versions during rollout.
   - Include backfill and constraint validation timing.
   Exercise acceptance:
   - The migration is broken into safe phases.
   - Existing rows are handled.
   - Application compatibility is preserved during deployment.
   Exercise seed: Start from adding `customer_tier` as a required column to a large `customers` table.

16. A team wants to denormalize several fields into a read table because joins are getting expensive. How would you decide whether denormalization, a materialized view, or a separate read model is justified?

   Exercise fit: none

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
- Question 12: advanced
- Question 13: advanced
- Question 14: advanced
- Question 15: advanced
- Question 16: advanced

## Evaluation Criteria

- Question 1: Must identify a primary key, customer foreign key, exact numeric representation for money, currency representation, nullability, status and amount checks, timestamps, and deliberate delete/update actions. Strong answer distinguishes business identifiers from surrogate keys and explains constraints as correctness guards. Weak answer uses floating point for money or leaves invariants entirely to application code.
- Question 2: Must explain that `NULL` means unknown or absent rather than an ordinary value, that `= NULL` is incorrect, and that uniqueness behavior for nullable columns is database-specific. Strong answer proposes normalized storage plus a unique or partial unique index, uses `IS NULL`, and avoids a check-then-insert race in application code.
- Question 3: Must include bounded result size, filtering, deterministic ordering, and parameterized inputs. Strong answer mentions that simple queries still need predictable limits and stable ordering.
- Question 4: Must distinguish `INNER JOIN` as requiring matches on both sides and `LEFT JOIN` as preserving rows from the left side. Strong answer gives a concrete case where optional related data should not remove the parent row.
- Question 5: Must explain that joining one parent to many children changes the result grain. Strong answer fixes the query by aggregating, selecting the intended grain, or splitting parent and child retrieval intentionally.
- Question 6: Must explain that `WHERE` filters rows before grouping, while `HAVING` filters aggregate groups after grouping. Strong answer uses a sales summary example correctly.
- Question 7: Must identify N+1 as one initial query plus one query per row or association. Strong answer discusses detection through logs/metrics and fixes such as projections, join fetch, batch loading, or explicit query design.
- Question 8: Must explain that wrapping an indexed column in a function can make a normal index unusable or less useful. Strong answer preserves semantics through normalized stored values, an expression index, a database-native case-insensitive type or collation, or a justified query rewrite rather than blindly removing the function.
- Question 9: Must compare subqueries, CTEs, and temporary tables by readability, reuse, optimizer behavior, materialization, and lifetime. Strong answer avoids treating any one option as universally best.
- Question 10: Must explain composite index design around equality filters followed by sort or range needs. Strong answer explains index maintenance cost, write overhead, storage, and why access patterns drive indexes.
- Question 11: Must not assume a sequential scan is automatically wrong. Strong answer compares estimated and actual rows, checks selectivity, statistics, predicate sargability, data volume, loops, timing, and buffer or I/O evidence where available, then validates any change with another measured plan.
- Question 12: Must explain that deep offset requires the database to walk or discard preceding rows. Strong answer proposes cursor or seek pagination over stable ordering and explains trade-offs.
- Question 13: Must identify lost update from unsafe read-modify-write. Strong answer first considers one atomic conditional `UPDATE`, then compares optimistic version checks with `SELECT ... FOR UPDATE`, keeps the transaction short, preserves invariants such as non-negative balance, and explains retry or conflict behavior.
- Question 14: Must describe dirty reads, non-repeatable reads, phantoms, and write skew in practical terms. Strong answer recognizes that SQL isolation names do not imply identical behavior across engines, distinguishes lock-based and MVCC behavior, and verifies guarantees in the target database documentation and with concurrent tests.
- Question 15: Must propose phased migration: add nullable column, deploy code that writes both or handles default, backfill, validate, then enforce non-null. Strong answer considers old and new app compatibility and lock risk.
- Question 16: Must explain denormalization as a deliberate read optimization with consistency cost. Strong answer compares denormalized columns, materialized views, read models, replication lag, refresh strategy, and operational complexity.

## Warm-up Quests

### Level 0

1. What is the main purpose of a primary key?
   A) It stores the largest text value in a table
   B) It uniquely identifies each row in a table
   C) It automatically sorts every query result
   D) It prevents all duplicate values in every column
   Answer: B

2. Which clause filters rows before aggregation?
   A) `HAVING`
   B) `ORDER BY`
   C) `WHERE`
   D) `GROUP BY`
   Answer: C

3. Which join preserves rows from the left table even when no matching row exists on the right?
   A) `INNER JOIN`
   B) `LEFT JOIN`
   C) `CROSS JOIN`
   D) `FULL TEXT JOIN`
   Answer: B

4. What is the main reason to add an index?
   A) To make every write faster
   B) To help the database find matching rows without scanning as much data
   C) To remove the need for transactions
   D) To make all queries return unique rows
   Answer: B

5. A query has no `LIMIT` clause and the table has millions of rows. What risk does that introduce?
   A) The query can return millions of rows, exhausting memory and saturating the network
   B) Duplicate primary keys can be inserted
   C) Dirty reads become possible
   D) Foreign key constraints are silently dropped
   Answer: A

6. What does a foreign key express?
   A) A relationship from one table to another table
   B) A temporary column created during a query
   C) A column that is always encrypted
   D) A value that cannot be indexed
   Answer: A

7. What is a transaction used for?
   A) Grouping work so it commits or rolls back consistently
   B) Making every query faster
   C) Hiding table names from the application
   D) Automatically creating indexes
   Answer: A

8. Which type is generally appropriate for storing a fixed-precision monetary amount?
   A) `FLOAT`
   B) `BOOLEAN`
   C) `DECIMAL` or an integer in the smallest currency unit
   D) Unvalidated free-form text
   Answer: C

9. Which predicate correctly checks for missing values in SQL?
   A) `email = NULL`
   B) `email IS NULL`
   C) `email == NULL`
   D) `email EQUALS NULL`
   Answer: B

### Level 1

1. Which statements about indexes are correct?
   A) Indexes can speed up reads for matching access patterns
   B) Indexes usually add write and storage cost
   C) Every column should always have an index
   D) Composite index column order can matter
   Answer: A,B,D

2. Which query shapes are likely to cause trouble at scale?
   A) `WHERE customer_id = ? ORDER BY created_at DESC LIMIT 50`
   B) `SELECT * FROM orders` with no limit on a large table
   C) `WHERE LOWER(email) = ?` when only a normal index on `email` exists
   D) `OFFSET 500000 LIMIT 50` for deep browsing
   Answer: B,C,D

3. Which statements about joins are correct?
   A) Joining parent rows to child rows can multiply result rows
   B) `LEFT JOIN` can preserve parent rows with missing child rows
   C) `INNER JOIN` always returns every row from the left table
   D) Aggregation may be needed to return one row per parent after joining children
   Answer: A,B,D

4. Which are reasonable fixes for an N+1 query problem?
   A) Use a projection query that fetches exactly the needed columns
   B) Use a join fetch when the association is actually needed
   C) Ignore it if the endpoint returns correct JSON
   D) Batch association loading where appropriate
   Answer: A,B,D

5. Which steps belong in a safe production migration that adds a required column?
   A) Add the column in a way old code can tolerate
   B) Backfill existing rows
   C) Enforce `NOT NULL` only after data and app behavior are ready
   D) Drop old code paths before the database supports the new column
   Answer: A,B,C

6. Which symptoms can indicate database performance or contention problems?
   A) Slow query logs show long-running reads
   B) Connection pool waits increase
   C) Lock wait time rises
   D) More indexes always eliminate the problem
   Answer: A,B,C

7. Which statements about temp tables or CTEs are correct?
   A) They can make multi-step logic easier to read
   B) They are always faster than a direct query
   C) They can introduce materialization or extra write/read cost
   D) They should be chosen based on query clarity and execution behavior
   Answer: A,C,D

8. Which statements about database transactions are correct?
   A) A transaction lets you group writes that commit or roll back together
   B) Rolling back a transaction undoes all changes made within it
   C) Transactions prevent partial writes from being visible to other sessions mid-flight
   D) Transactions eliminate the need for indexes
   Answer: A,B,C

9. Which statements about preventing lost updates are correct?
   A) A version column can detect whether a record was changed before your write lands
   B) `SELECT FOR UPDATE` locks a row until the transaction commits
   C) Retrying after a conflict is a valid strategy with optimistic locking
   D) Lost updates only happen in distributed databases
   Answer: A,B,C

10. Which statements about pagination are correct?
    A) Deep `OFFSET` queries can get slower as the offset grows
    B) Cursor pagination uses a stable reference point from the last fetched row
    C) `OFFSET` pagination is always the correct default for any dataset size
    D) Cursor pagination requires a stable, ordered key
    Answer: A,B,D

11. Which statements about denormalization are correct?
    A) It can reduce join overhead for read-heavy queries
    B) Denormalized data requires keeping multiple copies in sync on writes
    C) It always improves both read and write performance
    D) Materialized views are one way to manage pre-computed read data
    Answer: A,B,D

12. Which schema design decisions help prevent bugs in production?
    A) Adding `NOT NULL` constraints catches incorrect data at the boundary
    B) Using `DECIMAL` for money instead of `FLOAT` prevents rounding errors
    C) Making every field nullable avoids migration pain safely
    D) A version column on a row can support optimistic concurrency control
    Answer: A,B,D

13. Which statements about database constraints and concurrent writes are correct?
    A) An application check followed by an insert can race with another request
    B) A unique constraint can provide the final concurrency-safe guarantee
    C) Foreign-key delete behavior should be chosen explicitly
    D) `NULL = NULL` evaluates to true in normal SQL predicates
    Answer: A,B,C

14. Which evidence makes an execution-plan diagnosis more reliable?
    A) Actual row counts compared with estimates
    B) Loop counts and time spent in plan nodes
    C) Buffer or I/O information when the database exposes it
    D) Assuming every sequential scan requires an index
    Answer: A,B,C

### Level 2

1. Explain how you would model an `orders` table. Use this structure: keys and relationships -> money and status types -> required constraints -> foreign-key actions.
   Hint: Focus on invariants the database can enforce, including what should happen if a referenced customer is deleted.
   Answer: A strong answer defines an `orders` table with a primary key, customer foreign key, fixed-precision amount, currency, constrained status, and timestamps. Required fields are non-null, amounts cannot violate domain rules, and delete or update actions are deliberate rather than defaulted accidentally. It distinguishes a surrogate row identifier from any externally meaningful idempotency or order number.

2. Explain how you would diagnose and fix an N+1 query problem. Use this structure: symptom -> detection -> fix options -> trade-off.
   Hint: Name at least two possible fixes instead of assuming one universal ORM setting.
   Answer: A strong answer identifies many repeated queries after an initial list query, confirms it through SQL logs or metrics, and fixes it with an explicit projection, join fetch, or batch loading depending on what data is needed. It also notes that fetching too much can be a separate performance problem.

3. Explain how you would design an index for `WHERE customer_id = ? AND status = ? ORDER BY created_at DESC LIMIT 50`. Use this structure: equality filters -> ordering column -> trade-offs.
   Hint: Explain why adding indexes blindly is not senior engineering.
   Answer: A strong answer proposes a composite index aligned to the equality predicates and sort, such as `(customer_id, status, created_at DESC)`, while explaining that indexes add storage and write maintenance cost. The index should exist because this access pattern is important, not because every column deserves an index.

4. Explain why `WHERE LOWER(email) = LOWER(?)` may be slower than expected and how you could fix it. Use this structure: function on column -> index impact -> safer alternatives.
   Hint: The issue is not the function itself; it is where the function is applied.
   Answer: A strong answer explains that wrapping the indexed column in a function can prevent use of a normal index on `email`. Fixes include storing normalized email, comparing against a normalized parameter, adding an expression index if the database supports it, or using a case-insensitive column or type where appropriate.

5. Explain how you would add a required column to a large production table safely. Use this structure: expand -> backfill -> application compatibility -> enforce.
   Hint: Avoid one big migration that blocks the table and breaks old app versions.
   Answer: A strong answer adds the column in a backward-compatible way, deploys code that can handle old and new shapes, backfills existing rows, validates data, and only then enforces `NOT NULL` or stricter constraints. It considers lock risk and old/new application versions during rollout.

6. Explain why deep offset pagination degrades and how you would replace it with cursor pagination. Use this structure: why offset is slow -> what a cursor is -> how next-page works -> trade-offs.
   Hint: Focus on what the database must do for OFFSET 500000 vs fetching from a known row position.
   Answer: A strong answer explains that deep offset forces the database to scan and discard all preceding rows, making later pages progressively slower. Cursor pagination uses a stable value from the last fetched row (e.g. id or created_at) as a WHERE anchor, so the next page becomes WHERE id > ? ORDER BY id LIMIT 50 with no scan overhead. It notes the trade-offs: no random page access, and the ordering key must be stable and indexed.

7. Explain how a lost update happens and how you would prevent it. Use this structure: how the bug occurs -> atomic update -> optimistic approach -> pessimistic approach.
   Hint: First ask whether the invariant can be enforced in one conditional SQL statement.
   Answer: A strong answer identifies that two transactions read the same row and later overwrite each other. It first considers an atomic statement such as updating the balance only when sufficient funds remain and checking the affected-row count. Optimistic locking adds a version predicate and retries or reports a conflict when no row is updated. Pessimistic locking uses `SELECT FOR UPDATE` inside a short transaction when conflicts are frequent or the operation spans multiple dependent reads and writes.

8. Explain common isolation anomalies. Use this structure: dirty read -> non-repeatable read -> phantom -> write skew -> database-specific verification.
   Hint: Isolation-level names are not enough; engines may implement them differently.
   Answer: A strong answer describes a dirty read as observing uncommitted data, a non-repeatable read as seeing a row change between reads, a phantom as seeing a predicate return a different row set, and write skew as concurrent transactions each preserving a local check while jointly violating an invariant. It explains that stronger isolation can add blocking, aborts, or snapshot overhead and verifies exact guarantees for the chosen engine with documentation and concurrent integration tests.

9. Explain the practical difference between INNER JOIN and LEFT JOIN, with a concrete case where the wrong choice silently drops or distorts results. Use this structure: what each does -> the dangerous case -> how to catch it.
   Hint: Think about optional relationships — what happens to the parent row when the related row does not exist yet.
   Answer: A strong answer explains that INNER JOIN returns only rows where both sides match, silently dropping parent rows with no match, while LEFT JOIN preserves all parent rows with nulls on the right when no match exists. The dangerous case is joining orders to shipping records with INNER JOIN, which silently omits unshipped orders and makes counts or totals wrong with no error. Catching it means deciding whether the right-side relationship is required or optional before choosing join type, then validating with row counts.

10. Explain how you would use EXPLAIN to investigate a slow query. Use this structure: what to look for -> what a sequential scan means -> when it is acceptable -> one concrete next step.
    Hint: A sequential scan is not always a bug — the answer depends on row count and selectivity.
    Answer: A strong answer explains that EXPLAIN shows the query plan: access method, estimated row counts, join order, and relative cost. A sequential scan means the planner chose to read all rows rather than use an index, which is optimal on small tables or when many rows match. It is a problem when the table is large and very few rows should match. Next steps include verifying the filtered column is indexed, checking that predicates are not wrapped in functions that prevent index use, confirming statistics are current, and assessing whether column selectivity is high enough for an index to help.

## Concepts

- core concepts: relational-model, primary-key, foreign-key, unique-constraint, check-constraint, null-semantics, three-valued-logic, transaction, isolation-level, mvcc
- practical usage: select, where, order-by, limit, join, group-by, having, projection, cte, temp-table, atomic-update, optimistic-locking, row-locking, query-plan, explain-analyze
- tradeoffs: normalization-vs-denormalization, surrogate-vs-natural-key, index-read-write-cost, offset-vs-cursor-pagination, eager-vs-lazy-loading, consistency-vs-concurrency, materialization-cost
- best practices: exact-money-types, parameterized-queries, deterministic-ordering, bounded-reads, database-enforced-invariants, explicit-foreign-key-actions, avoid-n-plus-one, index-by-access-pattern, phased-migrations, compare-estimated-actual-rows
