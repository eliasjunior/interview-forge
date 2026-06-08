# Exercise: OrderReportRowMultiplication

## Topic / Language / Difficulty
**Topic:** database-basics
**Language:** any
**Difficulty:** 2/5 — Easy
**Tags:** sql, joins, aggregation, reporting, row-multiplication, grain

## Real-World Context
**Scenario:** You are the backend engineer responsible for a nightly revenue report. A stakeholder reports the total revenue figure is wildly inflated. You open the query and find it joins `orders` to `order_items` — but the grain is wrong.

### Why this matters in production
- A naive parent→child join inflates aggregate results silently — no error, just wrong numbers.
- The bug hides until someone cross-checks the report against a known total; in production this can mean incorrect billing, finance reconciliation failures, or wrong KPIs.
- Understanding join grain — the unit of uniqueness a result set represents — is required to write any multi-table report correctly.
- The fix is not arbitrary DISTINCT; it requires understanding what grain you actually want and choosing the right query structure to enforce it.

## Learning Goal
Understand why joining a one-to-many relationship multiplies parent rows, identify the inflated grain, and produce a corrected query that returns exactly one row per order with accurate aggregates — backed by a sample dataset that proves the result count.

## Prerequisites
_None — this is a self-contained exercise._

## Problem Statement
The following query feeds the nightly revenue report:

```sql
SELECT
    o.id          AS order_id,
    o.customer_id,
    o.created_at,
    oi.product_id,
    oi.quantity,
    oi.unit_price
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.created_at >= '2024-01-01';
```

**Sample data:**

orders
| id | customer_id | created_at |
|----|-------------|------------|
| 1  | 42          | 2024-03-10 |
| 2  | 17          | 2024-03-11 |

order_items
| id | order_id | product_id | quantity | unit_price |
|----|----------|------------|----------|------------|
| 1  |    1     |   101      |    2     |   15.00    |
| 2  |    1     |   202      |    1     |   40.00    |
| 3  |    2     |   303      |    3     |   10.00    |

**The stakeholder wants:** one row per order, with total revenue (sum of quantity × unit_price) for that order.

**Your tasks:**
1. Run (or mentally execute) the query above on the sample data. Count the rows returned and explain why that count is wrong for the intended report grain.
2. Identify the root cause: what structural property of the join produces extra rows?
3. Rewrite the query so it returns exactly one row per order with a `total_revenue` column that is correct for each order.
4. Verify your fix using the sample data — write out the expected result set and confirm the row count and revenue values.

## Implementation Steps
1. Step 1 — Trace the join manually: apply the query to the sample data row by row and write out every row the JOIN produces. Count them. How many rows did you expect vs. what do you get?
2. Step 2 — Name the problem: what is the relationship cardinality between orders and order_items? Why does this cardinality cause the row count to exceed the number of orders?
3. Step 3 — State the intended grain: what column (or set of columns) should uniquely identify each row in the report output?
4. Step 4 — Rewrite the query: restructure it so the result has one row per order. Use aggregation (GROUP BY + SUM) rather than hiding the problem with DISTINCT. Keep customer_id and created_at in the output.
5. Step 5 — Verify with the sample data: write the expected result set for your corrected query (2 rows, one per order). Compute total_revenue for each order by hand and confirm the query produces those values.
6. Step 6 (bonus) — Explain when DISTINCT would be wrong here: if you had used SELECT DISTINCT o.id … without removing oi columns, what would happen? When, if ever, is DISTINCT a valid fix?

## What a Good Solution Looks Like
- Correctly traces the original query to 3 result rows (one per order_item) against 2 orders, and explains the discrepancy.
- Names the cause: orders has a one-to-many relationship to order_items; the JOIN produces one output row per matching child row, not per parent row.
- States the intended grain clearly: one row per order (order_id is the unique key in the report).
- Rewrites the query using GROUP BY o.id (and any other SELECT columns) with SUM(oi.quantity * oi.unit_price) AS total_revenue.
- Produces the correct expected result: order 1 → total_revenue = 70.00; order 2 → total_revenue = 30.00; exactly 2 rows returned.
- Explains why arbitrary DISTINCT does not fix the problem (the oi columns still differentiate rows) and when it would be valid (only if you genuinely want distinct combinations of the selected columns with no aggregation).

## Hints
- Hint 1: Before rewriting anything, just list every row the JOIN produces — one match per (order row, matching order_item row). Count them.
- Hint 2: Think about what makes each output row unique in the original query vs. what you want to be unique in the report.
- Hint 3: If you know the grain you want is 'one row per order_id', that column belongs in a GROUP BY clause.
- Hint 4: Revenue per order = SUM(quantity * unit_price) grouped by order_id.

## Related Concepts
- database-basics: join grain, one-to-many joins, row multiplication, GROUP BY aggregation, DISTINCT misuse
