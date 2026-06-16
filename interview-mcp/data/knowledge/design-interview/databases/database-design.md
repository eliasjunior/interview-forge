# Database Design

## Summary
Database design is the process of structuring data so it is accurate, efficient, and maintainable. The core challenges are choosing the right relationships between entities, avoiding redundancy through normalization, and designing schemas that support the queries your application actually needs.

Key pillars:
- **Entity relationships**: one-to-one, one-to-many, many-to-many — identifying the correct cardinality drives the whole schema
- **Junction tables**: the standard solution for many-to-many relationships; they carry foreign keys to both sides and often store relationship-specific data (dates, roles, status)
- **Normalization**: reducing redundancy by decomposing tables so each fact is stored once — 1NF through 3NF covers most real-world cases
- **Foreign keys and referential integrity**: constraints that prevent orphaned records and enforce relationships at the database level
- **Query design**: JOINs across normalized tables — INNER, LEFT, and compound joins — and understanding what the query planner does with them
- **Indexing**: primary keys index automatically; foreign keys and frequently filtered columns often need explicit indexes to avoid full table scans

Common pitfalls: modelling a many-to-many as two one-to-many tables without a junction, storing repeated data in columns instead of rows, forgetting to index foreign keys, and designing for the data structure rather than the queries.

---

## Questions

1. You are building a property management system where tenants can live in multiple apartments over time and each apartment can have multiple tenants simultaneously. How would you model this relationship, and why is a single foreign key on either table not enough?
2. Your junction table `apartment_tenants` has a composite primary key of `(apartment_id, tenant_id)`. A colleague says this is wrong because it prevents the same tenant from ever returning to the same apartment. How do you fix the key, and what does the new primary key guarantee?
3. Write a query that returns every current tenant in apartment 1 — "current" means `end_date IS NULL`. Walk through each JOIN and explain what would happen if you used INNER JOIN versus LEFT JOIN on the tenants table.
4. A new requirement arrives: record the date a tenant moves out. Where in the schema does this change go, and why does adding a column to `apartments` or `tenants` not make sense?
5. You need to find all apartments where Alice has ever lived, including the move-in and move-out dates. Write the query, and explain the role of each JOIN clause.
6. Product wants a report showing each apartment with a count of how many tenants have ever lived there. Write the query using GROUP BY and explain what happens to apartments with zero tenants if you use INNER JOIN versus LEFT JOIN.
7. A colleague proposes storing the tenant list as a comma-separated string in an `apartments.tenant_ids` column to "keep the schema simple." What problems does this cause, and how does the junction table approach solve each one?
8. The `apartment_tenants` table has no index beyond the primary key. Queries filtering by `tenant_id` alone are slow. Why, and what index would fix it?
9. What does a foreign key constraint give you that application-level validation alone does not? Give a concrete example using the apartments/tenants schema where skipping the constraint causes silent data corruption.
10. You want to find all tenants who are currently assigned to more than one apartment — someone living in two places at once. Write the query, and explain why you need HAVING rather than WHERE for the count filter.
11. Product asks for a "tenant history" view: for each tenant, show their name, every apartment they have ever lived in, and the duration of each stay in days. Write the query, handle tenants who are still active (no end date), and explain how you compute duration.
12. Explain the difference between 1NF, 2NF, and 3NF using the apartment/tenant schema. Give a concrete example of a violation of each normal form and how you would fix it.

---

## Difficulty

- Question 1: foundation
- Question 2: foundation
- Question 3: foundation
- Question 4: foundation
- Question 5: intermediate
- Question 6: intermediate
- Question 7: intermediate
- Question 8: intermediate
- Question 9: intermediate
- Question 10: intermediate
- Question 11: advanced
- Question 12: advanced

---

## Evaluation Criteria

- Question 1: Must identify that the relationship is many-to-many — one tenant can be in many apartments and one apartment can have many tenants. Must explain that a foreign key on apartments (e.g. `tenant_id`) allows only one tenant per apartment, and a foreign key on tenants (e.g. `apartment_id`) allows only one apartment per tenant — both are wrong. Must propose a junction table (`apartment_tenants`) with foreign keys to both sides. Strong answer also notes that the junction table is where relationship-specific data (like `start_date`, `end_date`) naturally belongs. Weak answer: proposes one-to-many without explaining the cardinality problem.
- Question 2: Must identify the problem: `(apartment_id, tenant_id)` as composite PK prevents a tenant from ever returning to the same apartment (same pair would be a duplicate). Must propose adding `start_date` to the key: `PRIMARY KEY (apartment_id, tenant_id, start_date)`. Must explain the new guarantee: the same tenant can re-enter the same apartment as long as each stay has a distinct start date. Strong answer notes that `start_date` should be NOT NULL because it is part of the key. Weak answer: identifies the problem but proposes a surrogate key without explaining the semantic constraint being enforced.
- Question 3: Must write a correct query joining `apartments` to `apartment_tenants` to `tenants` with `WHERE at.end_date IS NULL AND a.id = 1`. Must explain that INNER JOIN returns only rows with matches on both sides — if a tenant record were missing, that row disappears silently. LEFT JOIN on tenants would keep the `apartment_tenants` row even with no matching tenant, producing NULLs. Strong answer explains when each choice is appropriate in this context. Weak answer: writes a query but cannot explain the JOIN semantics difference.
- Question 4: Must say the `end_date` column already exists (or belongs) in `apartment_tenants`. Must explain that `end_date` is a property of the *relationship* (a specific stay), not of the apartment or the tenant. An apartment or tenant can have many end dates across many stays — storing it on either entity would require multiple rows or a single overwritten value, both wrong. Strong answer frames it as: the junction table models the stay, so the stay's attributes belong there. Weak answer: proposes adding a column to apartments or tenants without recognizing the one-to-many problem this creates.
- Question 5: Must correctly join `tenants` to `apartment_tenants` to `apartments` and filter by tenant name or id. Must include `at.start_date` and `at.end_date` in the SELECT. Must explain each JOIN: first join links the tenant to their stay records, second join links stay records to apartment details. Strong answer notes that filtering by name (`WHERE t.name = 'Alice'`) is safe here but production code should use an id to avoid matching multiple tenants with the same name. Weak answer: writes the query but cannot explain what each JOIN resolves.
- Question 6: Must use LEFT JOIN from `apartments` to `apartment_tenants` to keep apartments with zero tenants. Must use `COUNT(at.tenant_id)` not `COUNT(*)` — the latter counts the NULL row for apartments with no tenants as 1. Must use GROUP BY `a.id`. Must explain the INNER JOIN vs LEFT JOIN difference: INNER drops apartments with no tenants from the result, LEFT keeps them with count 0. Weak answer: uses INNER JOIN or `COUNT(*)` without explaining the zero-tenant case.
- Question 7: Must identify at least three concrete problems with the comma-separated approach: cannot query by individual tenant without LIKE hacks (not indexable), cannot enforce foreign key referential integrity, cannot store per-tenant data (like move-in date), violates 1NF (non-atomic values), and becomes a maintenance nightmare when the list grows. Must connect each problem to how the junction table solves it: each tenant gets its own row, FK constraints work, per-tenant attributes are natural columns, and queries use standard JOINs and indexes. Weak answer: says "it's bad practice" without identifying specific failure modes.
- Question 8: Must explain that the composite PK `(apartment_id, tenant_id, start_date)` creates an index ordered by `apartment_id` first — a query filtering only by `tenant_id` cannot use this index and does a full table scan. Must propose a separate index on `(tenant_id)` or `(tenant_id, apartment_id)`. Strong answer explains that most databases do not automatically index foreign keys and that the missing index on `tenant_id` is a common production performance issue. Bonus: mention covering index if the query also selects `start_date` and `end_date`. Weak answer: says "add an index" without explaining why the existing PK index does not help.
- Question 9: Must explain that a database foreign key constraint is enforced atomically by the engine regardless of which process or connection inserts the data — application code can be bypassed (migrations, manual inserts, bugs, concurrent transactions). Must give a concrete example: inserting a row into `apartment_tenants` with a `tenant_id` that does not exist in `tenants` — without the FK constraint, the row is stored silently; queries joining to `tenants` then return no name for that tenant, corrupting reports. Strong answer mentions cascade behavior (ON DELETE CASCADE vs RESTRICT) as a related design decision. Weak answer: says "it prevents bad data" without explaining the bypass scenario or a concrete corruption example.
- Question 10: Must write a query that joins `tenants` to `apartment_tenants`, filters `WHERE at.end_date IS NULL`, groups by tenant, and uses `HAVING COUNT(at.apartment_id) > 1`. Must explain that WHERE filters individual rows before grouping — it cannot reference aggregate counts. HAVING filters groups after aggregation, which is the right level to apply the count condition. Strong answer notes this query is useful for detecting data anomalies (tenants with overlapping active assignments). Weak answer: uses WHERE with a subquery instead and cannot explain the conceptual difference.
- Question 11: Must write a query joining all three tables, selecting `t.name`, `a.address`, `a.unit_number`, `at.start_date`, `at.end_date`. Must handle NULL `end_date` for active tenants using COALESCE or CASE: `COALESCE(at.end_date, CURRENT_DATE)` to compute duration. Duration in days: `julianday(COALESCE(at.end_date, 'now')) - julianday(at.start_date)` in SQLite or `DATE_PART('day', COALESCE(end_date, NOW()) - start_date)` in PostgreSQL. Must order by tenant for readability. Strong answer acknowledges the date function is database-specific and explains the COALESCE substitution logic. Weak answer: writes the JOIN correctly but ignores the NULL end_date case or computes duration incorrectly.
- Question 12: Must define each normal form with a concrete example from the schema. 1NF: each column holds atomic values — violation example: storing `tenant_ids = '1,2,3'` in apartments; fix: one row per relationship. 2NF: no non-key attribute depends on only part of a composite key — violation example: storing `tenant_name` in `apartment_tenants` where it depends only on `tenant_id`, not the full key; fix: keep name only in `tenants`. 3NF: no non-key attribute depends on another non-key attribute (transitive dependency) — violation example: storing `tenant_email_domain` derived from `tenant_email` in `tenants`; fix: remove the derived column. Strong answer explains each in plain language before the example. Weak answer: recites definitions without a schema-grounded example for each.

---

## Concepts

- core concepts: entity, relationship, cardinality, one-to-many, many-to-many, junction-table, primary-key, composite-key, foreign-key, referential-integrity, normalization, 1NF, 2NF, 3NF
- practical usage: JOIN, INNER-JOIN, LEFT-JOIN, GROUP-BY, HAVING, COUNT, COALESCE, IS-NULL, index, composite-index, covering-index, date-arithmetic
- tradeoffs: normalization-vs-denormalization, surrogate-vs-natural-key, cascade-vs-restrict, query-readability-vs-performance, application-vs-database-integrity
- best practices: index-foreign-keys, store-relationship-attributes-in-junction-table, avoid-multi-valued-columns, prefer-NOT-NULL-with-defaults, use-FK-constraints-not-just-app-validation

---

## Warm-up Quests

### Level 0

1. In a property management system, one tenant can live in many apartments over time, and one apartment can have many tenants simultaneously. What kind of relationship is this?
A) One-to-one
B) One-to-many (apartment owns tenants)
C) Many-to-many
D) Many-to-one (many apartments, one tenant)
Answer: C

2. Which table structure is the standard solution for a many-to-many relationship?
A) Add a foreign key column on both tables pointing to each other
B) Add a junction (bridge) table with foreign keys to both sides
C) Store IDs as a comma-separated list in one column
D) Duplicate the data in both tables
Answer: B

3. Why does the composite primary key `(apartment_id, tenant_id)` cause a problem when a tenant moves back into the same apartment?
A) Because composite keys are not supported in SQLite
B) Because the same pair would already exist, violating the uniqueness constraint
C) Because foreign keys cannot reference composite keys
D) Because the primary key must always be a single auto-increment integer
Answer: B

4. Which SQL clause filters rows AFTER grouping, based on aggregate values like COUNT?
A) WHERE
B) ORDER BY
C) HAVING
D) GROUP BY
Answer: C

5. What is the main problem with storing a tenant list as `tenant_ids = '1,3,7'` in an apartments column?
A) Integers cannot be stored as text
B) You cannot query, index, or enforce referential integrity on individual values inside that string
C) The column name must end in `_id` for foreign keys to work
D) It only works if there are fewer than 10 tenants
Answer: B

6. An `apartment_tenants` table has a composite primary key on `(apartment_id, tenant_id, start_date)`. Queries that filter only by `tenant_id` are slow. Why?
A) The composite index is ordered by `apartment_id` first, so filtering by `tenant_id` alone cannot use it efficiently
B) Composite keys disable all indexing on the table
C) SQLite does not support indexes on junction tables
D) The `tenant_id` column must be unique before it can be indexed
Answer: A

7. In the `apartment_tenants` junction table, `apartment_id` and `tenant_id` are declared as foreign keys AND listed in `PRIMARY KEY (apartment_id, tenant_id)`. How is that possible?
A) It is not — a column can only have one role: either FK or PK, never both
B) A column can serve two roles at once: FK enforces that the value exists in the parent table, while the composite PK enforces uniqueness of the pair within this table
C) Declaring them as FKs automatically makes them the primary key — there is no need to list them separately
D) The composite PK overrides the FK constraint, so referential integrity is no longer enforced
Answer: B

### Level 1

1. Which statements about foreign key constraints are correct?
A) They are enforced by the database engine regardless of which application or tool inserts the data
B) They prevent inserting a row with a reference to a non-existent parent row
C) Application-level validation is sufficient to replace them in production
D) They can be configured with CASCADE to automatically delete child rows when a parent is deleted
Answer: A,B,D

2. Which statements about LEFT JOIN versus INNER JOIN are correct in a query joining `apartments` to `apartment_tenants`?
A) INNER JOIN drops apartments that have no rows in `apartment_tenants`
B) LEFT JOIN keeps all apartments, producing NULLs for missing junction rows
C) LEFT JOIN and INNER JOIN always return the same rows when every apartment has at least one tenant
D) LEFT JOIN is always slower than INNER JOIN
Answer: A,B,C

3. Which statements about the junction table `apartment_tenants` are correct?
A) It is the right place to store the `start_date` and `end_date` of a tenant's stay
B) Storing `tenant_name` in the junction table would violate 2NF if the PK is composite
C) A separate index on `tenant_id` is usually needed for queries filtering by tenant
D) The junction table cannot have columns beyond the two foreign keys
Answer: A,B,C

4. Which statements about normalization are correct?
A) 1NF requires each column to hold atomic (single) values
B) 2NF eliminates partial dependencies on a composite primary key
C) 3NF eliminates transitive dependencies between non-key columns
D) A fully normalized schema always outperforms a denormalized one for read-heavy workloads
Answer: A,B,C
