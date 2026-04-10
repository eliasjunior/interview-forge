# Exercise: SupplierCatalogSyncStore

## Topic / Language / Difficulty
**Topic:** data-access-tradeoffs-growing-complexity
**Language:** java
**Difficulty:** 3/5 — Medium
**Tags:** rest-api, data-sync, ingestion, pagination, local-cache, background-job

## Real-World Context
**Scenario:** Your team runs a `/products/search` endpoint that calls a third-party supplier API on every request to fetch the full catalog. Six months ago the supplier had ~5 000 products — it was fine. Today they have 2.3 million. The endpoint now times out under load, any supplier outage takes the whole search page down, and your cloud bill jumped because you are paying egress fees per request. Engineering has told you to fix it before next sprint ends.

### Why this matters in production
- On-demand remote fetches couple your latency to the supplier's — one slow response and every user waits
- A supplier outage cascades directly to your users with no buffer or fallback
- Fetching 2M rows per user request is never going to be fast or cheap regardless of optimisation
- Separating ingestion from serving lets each half scale, fail, and be monitored independently

## Learning Goal
Understand why a read endpoint must never own data ingestion from a remote source at scale, and how to introduce a local store + background sync job as the minimum viable fix

## Prerequisites
_None — this is a self-contained exercise._

## Problem Statement
Build the following three pieces and wire them together:

1. **`LocalProductStore`** — an in-memory store (a `ConcurrentHashMap<String, Product>` is fine) that holds the local snapshot of the catalog. Expose `upsert(Product)`, `findByKeyword(String)`, and `count()`.

2. **`SupplierCatalogClient`** — a stub that simulates the remote supplier. It must support paginated access: `fetchPage(int page, int pageSize): List<Product>` and `getTotalCount(): int`. Do NOT make it a real HTTP call — return hardcoded or randomly generated data. Include a configurable artificial delay (e.g. 50 ms per page) to simulate network cost.

3. **`CatalogSyncJob`** — a component that, when `sync()` is called, pages through `SupplierCatalogClient` and writes every product into `LocalProductStore`. It must log how many products were synced and how long it took. It must not load all pages into a single list before writing.

Finally, update (or write) a `ProductController` with a `GET /products/search?q=` endpoint that reads **only** from `LocalProductStore`. If the store is empty, return `503 Service Unavailable` with a message like `"Catalog not yet loaded"` rather than falling back to the remote client.

## Implementation Steps
1. Define the `Product` record (id, name, category, price) and write `LocalProductStore` with `ConcurrentHashMap` — add a simple unit test for `findByKeyword`
2. Write `SupplierCatalogClient` with pagination support and a configurable delay field — verify that calling `fetchPage(0, 100)` returns exactly 100 items
3. Implement `CatalogSyncJob.sync()`: loop page by page, call `store.upsert()` for each product, log progress every 10 pages — run it and assert `store.count()` matches `client.getTotalCount()`
4. Write `ProductController` reading only from the store; add the 503 guard when the store is empty; manually trigger `sync()` in a `@PostConstruct` method or a test setup so you can hit the endpoint and see results
5. Add a `GET /products/sync-status` endpoint that returns `{ count, lastSyncedAt }` — useful for ops visibility without touching the sync logic itself
6. Reflect: measure how long `sync()` takes with 10 000 fake products and a 50 ms delay per page of 100 — what would you change to run this on a schedule without blocking startup?

## What a Good Solution Looks Like
- The search endpoint calls only `LocalProductStore` — zero calls to `SupplierCatalogClient` on the read path
- Sync iterates page by page and never accumulates all pages in memory at once before writing
- The 503 guard is present and returns a meaningful message when the store is empty rather than a NullPointerException or silent empty list
- `CatalogSyncJob` is a separate class from the controller — ingestion and serving have no shared control flow
- Candidate can explain why adding retries or caching to the on-demand fetch would not fix the root problem
- Bonus: sync job logs elapsed time and product count so a future scheduler or health check can observe it

## Hints
- Start with `LocalProductStore` — get its tests green before touching the client or controller
- For the sync loop, the exit condition is `page * pageSize >= client.getTotalCount()`, not an empty response — empty pages are ambiguous
- If `ConcurrentHashMap` feels too simple, that is fine — the point is isolation, not the storage technology
- The 503 guard can be as simple as `if (store.count() == 0) return ResponseEntity.status(503).body(...)`

## Related Concepts
- data-access-tradeoffs-growing-complexity.md: remote-fetch latency coupling, ingestion vs serving separation, graceful degradation
