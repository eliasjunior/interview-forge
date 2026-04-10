# Exercise: CursorPaginationMigration

## Topic / Language / Difficulty
**Topic:** rest-api-growth-and-data-tradeoffs
**Language:** any
**Difficulty:** 2/5 — Easy
**Tags:** pagination, cursor, offset, sql, performance, api-design

## Real-World Context
**Scenario:** A product catalogue service exposes GET /products?page=N&size=50. Works fine on launch with 10k rows. Six months later the table has 2 million rows and customer support is getting complaints: browsing past page 5,000 takes 8–12 seconds per page flip. Engineering is asked to fix it without breaking existing clients immediately.

### Why this matters in production
- OFFSET N in SQL forces the database to read and discard the first N rows before returning the next page — it cannot jump directly to row 500,000.
- The query cost grows linearly with depth: page 1 costs ~50 row reads, page 10,000 costs ~500,050 row reads even though only 50 rows are returned.
- Cursor pagination replaces the offset with a WHERE clause on an indexed column, making every page fetch O(1) regardless of depth.
- This is a very common production failure: offset-based pagination feels fine in dev/test and only breaks in production after data grows.

## Learning Goal
Understand why OFFSET pagination degrades at depth by tracing the actual rows the database must visit, and be able to redesign the endpoint to seek-based cursor pagination that keeps every page fetch constant-cost.

## Prerequisites
_None — this is a self-contained exercise._

## Problem Statement
You have a products table with 2 million rows and an existing REST endpoint: GET /products?page=N&size=50.

**Part 1 — Diagnose the problem**
Write or describe the SQL that the current endpoint generates for page 1 and for page 10,000. Annotate each query with the number of rows the database must read to satisfy it. Explain in one sentence why the cost grows with page depth.

**Part 2 — Redesign with cursor pagination**
Redesign the endpoint to use cursor-based pagination. Your new endpoint should be: GET /products?after=<cursor>&size=50, where cursor encodes the last item seen on the previous page.

Specify:
- What column(s) to use as the cursor (justify your choice).
- The SQL the redesigned endpoint generates for the equivalent of "page 10,000" (assuming the client holds the cursor from the previous response).
- How the server encodes and decodes the cursor in the response (opaque token vs raw value — trade-offs).
- What the response envelope looks like (include a nextCursor field).

**Part 3 — Dual-mode migration (bonus)**
The mobile app cannot be updated immediately. Describe how you would run both the old ?page= interface and the new ?after= interface in parallel for one release cycle, and what you would log or monitor to track when it is safe to retire the old interface.

## Implementation Steps
1. Write the OFFSET SQL for page 1 (SELECT ... LIMIT 50 OFFSET 0) and page 10,000 (LIMIT 50 OFFSET 499,950). Count the rows the DB must visit for each and write it as a comment next to the query.
2. Explain in one sentence why a table scan/index scan cannot skip directly to row 499,950 without reading preceding rows (no random-access into an ordered set by position).
3. Choose a cursor column. Consider: is it unique? is it indexed? is it stable (not updated after insert)? id (auto-increment) or created_at+id composite are both valid — pick one and justify.
4. Write the cursor SQL: SELECT * FROM products WHERE id > :lastSeenId ORDER BY id ASC LIMIT 50. Count the rows the DB must visit now and compare.
5. Design the response envelope: { data: [...], nextCursor: "<opaque token>", hasMore: true }. Decide whether nextCursor is a base64-encoded JSON of the last row's cursor fields or the raw id — document the trade-off.
6. For the migration bonus: sketch two handler branches inside the same controller method — one for ?page= (legacy, logs a deprecation warning + emits a metric) and one for ?after= (new path). Define the monitoring signal you would watch to decide when page= traffic drops to zero.

## What a Good Solution Looks Like
- Correctly shows that OFFSET 499950 forces the DB to read ~500k rows and discards all but 50 — not just states it, but annotates the SQL with the row counts.
- Cursor SQL uses a WHERE id > :cursor predicate on an indexed column, making the page fetch seek directly to the right position regardless of depth.
- Cursor column choice is justified: unique, indexed, immutable after insert — candidate explains why updated_at alone is unsafe.
- Response envelope includes an opaque nextCursor field; candidate addresses whether to expose raw ids or encode them and names at least one reason for opacity (avoid leaking schema, allow changing cursor definition without client changes).
- Bonus: migration plan includes a deprecation log/metric on the old ?page= path and a concrete observable signal for when to retire it.

## Hints
- If you are stuck on Part 1: run EXPLAIN on the two queries mentally — what does the query planner have to do before it can return the 50 rows?
- For cursor column choice: ask yourself what happens if two products share the same created_at timestamp. How would the cursor break?
- For the opaque token: think about what breaks if a client hard-codes the raw numeric id rather than treating the cursor as an opaque string.

## Related Concepts
- rest-api-growth-and-data-tradeoffs.md: pagination, offset pagination, cursor pagination, query cost, index seek
