# Exercise: ActiveCustomerReportRefactor

## Topic / Language / Difficulty
**Topic:** database-basics
**Language:** any
**Difficulty:** 3/5 — Medium
**Tags:** sql, cte, subquery, temporary-table, query-refactoring, reporting, query-planner

## Real-World Context
**Scenario:** You maintain a reporting service for a SaaS billing platform. A colleague has written a nested SQL query that identifies active customers who placed at least one order above $500 in the last 90 days, along with their total spend in that window. The query works, but it is hard to read, hard to test, and the query planner has flagged repeated subquery evaluation. Your task is to refactor it using an appropriate intermediate structure and document the trade-off you made.

### Why this matters in production
- Nested subqueries embedded inside SELECT and WHERE clauses are a common source of accidental performance regressions — the planner may evaluate them once per row rather than once per query.
- CTEs and temporary tables both name intermediate results, but they differ in when the data is materialized, how the planner reasons about them, and whether indexes are available — choosing wrong adds latency at scale.
- Senior engineers are expected to explain a structural decision to teammates, not just make it work — readability is a real constraint in production reporting code.
- Report queries are frequently re-used or composed; a poorly structured query becomes a maintenance liability the moment a second engineer needs to modify it.

## Learning Goal
Understand when a CTE is sufficient for readability alone, when a temporary table is worth the materialization cost, and how to articulate that trade-off in terms a team can act on.

## Prerequisites
_None — this is a self-contained exercise._

## Problem Statement
You are given the following nested query. It is correct but structurally poor.

```sql
SELECT
    c.id,
    c.name,
    c.email,
    (
        SELECT SUM(o.amount)
        FROM orders o
        WHERE o.customer_id = c.id
          AND o.created_at >= NOW() - INTERVAL '90 days'
          AND o.status = 'completed'
    ) AS total_spend_90d
FROM customers c
WHERE c.status = 'active'
  AND EXISTS (
      SELECT 1
      FROM orders o
      WHERE o.customer_id = c.id
        AND o.created_at >= NOW() - INTERVAL '90 days'
        AND o.status = 'completed'
        AND o.amount > 500
  )
ORDER BY total_spend_90d DESC;
```

**Your task:**

1. Identify the structural problems in the query above (repeated subquery logic, correlated evaluation risk, readability).
2. Rewrite the query using either a CTE (`WITH`) or a temporary table to introduce a single, clearly named intermediate result for the qualifying orders in the 90-day window.
3. Write a short explanation (3–5 sentences or a bullet list) justifying your structural choice: why CTE vs. temporary table, and what the materialization cost trade-off is for a table with ~1M customers and ~10M orders.
4. Identify at least one situation where your chosen approach would be the wrong choice and you should switch to the other.

## Implementation Steps
1. Read the original query and write down, in plain language, what each subquery is doing. Name the logical concept it represents (e.g. 'qualifying orders in the last 90 days').
2. Write a CTE called `recent_high_value_orders` that captures all completed orders above $500 placed in the last 90 days, grouped by customer_id with SUM(amount) and COUNT(*) as columns.
3. Rewrite the outer query to JOIN against that CTE instead of using the correlated subquery and EXISTS check. Confirm the result set is equivalent.
4. Read the rewritten query aloud (or trace it mentally). Ask: does every named intermediate step have an obvious purpose? If not, rename or split further.
5. Now consider scale: your table has 1M customers and 10M orders. Write down whether the CTE will be materialized once or re-evaluated per row in the databases you know (PostgreSQL, MySQL, etc.). State whether that changes your choice.
6. If the query were called from three different downstream reports that each needed the same 90-day order window, would you keep the CTE or promote it to a temporary table? Write a one-paragraph justification.
7. Optional: rewrite the query using a temporary table instead of a CTE. Compare the two versions side-by-side and note the differences in indexability, session scope, and readability.

## What a Good Solution Looks Like
- The intermediate result (`recent_high_value_orders` or equivalent) has a single, clear purpose — it is not a dumping ground for unrelated logic.
- The correlated subquery and the duplicated EXISTS/SUM logic are both eliminated in the rewrite.
- The candidate states explicitly whether the CTE is materialized or re-evaluated in their target database, and whether that is a problem at the given scale.
- The trade-off between CTE (readability, planner flexibility) and temporary table (materialized once, indexable, session-scoped) is stated clearly and correctly.
- The candidate identifies at least one concrete scenario where their chosen approach is the wrong default (e.g. CTE is wrong when the planner re-evaluates it per outer row; temp table is wrong for a one-shot throwaway query where setup overhead exceeds benefit).
- The final query is structurally easier to reason about than the original — a new engineer could read it top-to-bottom and understand the intent of each step.

## Hints
- If you are unsure whether a CTE is materialized: in PostgreSQL, CTEs are materialized by default since version 12 when referenced more than once; in MySQL, CTEs are generally not materialized. The behavior affects whether you are paying a one-time cost or a per-row cost.
- A temporary table lives for the duration of your session and can have its own index. A CTE is a named expression scoped to a single query. Use that distinction to drive your trade-off answer.
- The EXISTS subquery and the correlated SUM subquery both scan the same logical set of rows. If you can compute that set once and reuse it, you eliminate at least one redundant scan.

## Related Concepts
- database-basics: CTE, subquery, temporary table, query materialization, correlated subquery, query planner
