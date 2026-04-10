# Exercise: SafePaginatedEndpoint

## Topic / Language / Difficulty
**Topic:** rest-api-growth-and-data-tradeoffs
**Language:** java
**Difficulty:** 2/5 — Easy
**Tags:** pagination, response-contract, spring-data, safe-defaults, rest-api

## Real-World Context
**Scenario:** You maintain a Spring Boot REST API for a product catalogue. The GET /products endpoint currently fetches and returns every row in the table. As the catalogue grows past 50k rows, the response has become too large to be useful. Your task: refactor it to accept bounded pagination inputs and return a well-shaped response contract — without touching the database schema, adding caching, or building filtering logic.

### Why this matters in production
- An unbounded endpoint will eventually OOM the server or the client — pagination is a safety contract, not a UI nicety.
- Clients that depend on the full-list response today will break silently if you change the shape without versioning your defaults — safe defaults prevent this.
- Without a server-enforced max page size, a single client can trivially DoS the API by requesting limit=100000.
- Deterministic ordering is required for stable pagination — without it, items skip or repeat across pages as the underlying data changes.

## Learning Goal
Understand how to design and enforce a safe paginated response contract: bounded and defaulted request parameters, a stable response shape with items plus metadata, and server-side limits that cannot be overridden by the client.

## Prerequisites
_None — this is a self-contained exercise._

## Problem Statement
Start from this controller method that returns the full list:

```java
@GetMapping("/products")
public List<Product> getAllProducts() {
    return productRepository.findAll();
}
```

Refactor it so that:
1. The endpoint accepts `page` (0-indexed, default 0) and `limit` (default 20, max 100) as query parameters.
2. The server enforces the cap — if the client sends `limit=500`, it is silently clamped to 100.
3. The response is no longer a bare `List<Product>` but a wrapper object containing:
   - `items` — the page of products
   - `page` — the current page index
   - `limit` — the effective limit used (after clamping)
   - `total` — total number of matching records
4. The endpoint orders results by a stable field (e.g. `id` ascending) so pages are deterministic.
5. Write one focused test that verifies the cap: a request with `limit=500` must return at most 100 items and report `limit=100` in the response body.

## Implementation Steps
1. Create a PagedResponse<T> wrapper class with fields: items, page, limit, total.
2. Add a constant MAX_PAGE_SIZE = 100 and a helper that clamps the incoming limit: effectiveLimit = Math.min(requested, MAX_PAGE_SIZE).
3. Update the controller signature to accept @RequestParam(defaultValue="0") int page and @RequestParam(defaultValue="20") int limit.
4. Apply the clamp inside the controller before passing to the service layer.
5. Switch from findAll() to a Pageable-backed query: PageRequest.of(page, effectiveLimit, Sort.by("id")).
6. Populate the PagedResponse from the Page<Product> result (page.getContent(), page.getTotalElements()).
7. Write a @WebMvcTest that seeds 150 products, calls GET /products?limit=500, and asserts: HTTP 200, response body limit == 100, items.size() <= 100.

## What a Good Solution Looks Like
- PagedResponse wrapper exists and contains items, page, limit, and total fields.
- Server enforces MAX_PAGE_SIZE = 100 — client cannot receive more than 100 items regardless of the limit parameter sent.
- Default values are applied server-side (page=0, limit=20) so the endpoint is safe to call with no parameters.
- Results are ordered by a stable field — the sort is explicit in the Pageable construction, not left to the database default.
- The test verifies the cap contract specifically: limit=500 input → limit=100 in the response body.
- No unbounded findAll() call remains in the production code path.

## Hints
- Spring Data's Pageable and PageRequest handle the offset math for you — you only need to construct PageRequest.of(page, effectiveLimit, Sort.by("id")).
- The clamping logic is one line: int effectiveLimit = Math.min(limit, MAX_PAGE_SIZE); — put it at the top of the controller method before any service call.
- Page<T>.getTotalElements() gives you the total count without a second query.

## Related Concepts
- rest-api-growth-and-data-tradeoffs: pagination, bounded page size, response contract, safe defaults
