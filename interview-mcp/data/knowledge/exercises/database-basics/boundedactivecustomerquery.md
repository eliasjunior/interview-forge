# Exercise: BoundedActiveCustomerQuery

## Topic / Language / Difficulty
**Topic:** database-basics
**Language:** any
**Difficulty:** 2/5 — Easy
**Tags:** sql, query-layer, filtering, ordering, bounded-reads, repository

## Real-World Context
**Scenario:** You are building a customer admin dashboard. A support tool needs to display recently onboarded active customers so an agent can quickly spot new accounts. The repository currently exposes a method that returns every customer with no filters — you need to replace it with a safe, focused query.

### Why this matters in production
- Unbounded queries against large customer tables cause slow page loads and unexpected memory spikes — a row limit is a hard safety net, not a nice-to-have.
- Filtering inactive customers at the database layer avoids pulling dead rows over the wire and into application memory.
- ORDER BY on the creation timestamp makes the result set deterministic; without it, the database may return rows in any order and the UI will be inconsistent across page loads.
- A date-range filter on created_at requires the right column type and index to stay fast as the table grows — choosing the correct comparison operator matters.

## Learning Goal
Understand the four decisions that make a simple list query production-safe: what to filter (status + date), how to order (deterministic column), how to bound (LIMIT), and which comparison operator to use on the date boundary.

## Prerequisites
_None — this is a self-contained exercise._

## Problem Statement
You have a `customers` table with at least these columns:

```
customers
  id          BIGINT PRIMARY KEY
  email       VARCHAR
  status      VARCHAR   -- values: 'active', 'inactive', 'suspended'
  created_at  TIMESTAMP WITH TIME ZONE
```

A repository method currently looks like this (pseudocode — use SQL or your language's query builder):

```sql
-- current (unsafe) implementation
SELECT * FROM customers;
```

**Your task:** replace this with a query that:
1. Returns only customers where `status = 'active'`
2. Returns only customers created **after** a caller-supplied cutoff timestamp (exclusive lower bound)
3. Orders results newest-first (most recently created appears first)
4. Returns at most 50 rows

Write the final SQL query. Then answer these two follow-up questions in a short comment or note:
- Why is `ORDER BY created_at DESC` important here, not just a convenience?
- What happens if you omit `LIMIT 50` in a table that grows to 10 million rows?

## Implementation Steps
1. Start from the unsafe baseline: `SELECT * FROM customers;` — identify the three things wrong with it (no filter, no order, no limit).
2. Add the status filter: `WHERE status = 'active'` — confirm you are comparing against the string literal, not a numeric code.
3. Add the date filter: `AND created_at > :cutoff_date` — use `>` (exclusive) because the cutoff date itself is the boundary, not the first row to include.
4. Add deterministic ordering: `ORDER BY created_at DESC` — newest row first so the top of the result is always the most recently onboarded customer.
5. Add the row cap: `LIMIT 50` — hard ceiling so a sudden burst of new signups never floods the caller.
6. Review the final query end-to-end and confirm: filter columns match indexed columns, the comparison operator is correct, ordering column is unambiguous, and the limit is present.

## What a Good Solution Looks Like
- Query filters on `status = 'active'` — inactive and suspended rows are excluded at the database layer, not in application code.
- Date comparison uses `>` (strictly greater than), not `>=`, matching the 'after a given date' requirement.
- ORDER BY is on `created_at DESC` — newest first, using the same column as the date filter.
- LIMIT 50 is present and is the final clause — the row cap is enforced by the database, not by truncating an in-memory list.
- Candidate can explain why ORDER BY is not optional: without it the database returns rows in undefined order and the result is non-deterministic across executions.
- Candidate can explain the consequence of omitting LIMIT: the query will return every matching row as the table grows, causing memory pressure, slow response times, and potential OOM in the application layer.

## Hints
- If you are unsure about the date operator: think about what 'created after date X' means — does date X itself count?
- If ordering feels optional: run the query twice on a live database after inserting a new row and observe whether the row appears in the same position both times without ORDER BY.
- If you reach for application-side truncation (e.g. `.subList(0, 50)` in Java): ask yourself whether the database has already done more work than needed to produce that full list.

## Related Concepts
- database-basics.md: SELECT, WHERE, ORDER BY, LIMIT, query safety, deterministic ordering
