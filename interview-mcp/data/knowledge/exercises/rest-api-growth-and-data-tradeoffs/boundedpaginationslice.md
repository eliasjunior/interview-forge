# Exercise: BoundedPaginationSlice

## Topic / Language / Difficulty
**Topic:** rest-api-growth-and-data-tradeoffs
**Language:** java
**Difficulty:** 2/5 — Easy
**Tags:** pagination, service-layer, safe-defaults, deterministic-ordering, rest-api

## Real-World Context
**Scenario:** A product catalogue service currently exposes a getAll() method that returns every item in memory. As the catalogue grows past a few thousand entries, the UI becomes unusable and large payloads start causing timeouts. Your task is to replace the unbounded method with a safe paginated slice — no framework magic, just plain service-layer logic.

### Why this matters in production
- Returning the full list is fine at 50 rows but silently catastrophic at 50 000 — the client has no idea it's asking for too much.
- Without a capped maximum, a client can pass limit=999999 and bring the service down; the server must own the safety contract.
- Non-deterministic ordering means repeated requests return different subsets — the UI shows duplicates or skips rows as the user pages forward.
- Establishing these constraints from day one costs almost nothing; retrofitting them after the API is public breaks every existing client.

## Learning Goal
Understand why the service layer — not the caller — must own page-size limits and ordering guarantees, and how to expose minimal but sufficient pagination metadata to the client.

## Prerequisites
_None — this is a self-contained exercise._

## Problem Statement
You are given a `ProductCatalogueService` that holds a `List<Product>` in memory and currently exposes:

```java
public List<Product> getAll() {
    return Collections.unmodifiableList(products);
}
```

Your job is to add a new method:

```java
public PageResult<Product> getPage(int page, int limit) { ... }
```

Requirements:
1. `page` is 0-based. `limit` is the number of items per page.
2. Cap `limit` to a MAX of 50 if the caller passes a larger value. Use a default of 20 if limit ≤ 0.
3. Ordering must be deterministic — sort by `product.id()` ascending before slicing.
4. Return a `PageResult<T>` record containing: `items` (the slice), `page` (current page), `totalPages`, and `hasNext`.
5. Do not touch `getAll()` — leave it in place.

`Product` is a simple record:
```java
public record Product(String id, String name, double price) {}
```

`PageResult` is a generic record you must define:
```java
public record PageResult<T>(List<T> items, int page, int totalPages, boolean hasNext) {}
```

## Implementation Steps
1. Define the PageResult<T> record with fields: items, page, totalPages, hasNext.
2. Add the constants MAX_LIMIT = 50 and DEFAULT_LIMIT = 20 to the service.
3. In getPage(), apply the limit cap: if limit > MAX_LIMIT use MAX_LIMIT; if limit <= 0 use DEFAULT_LIMIT.
4. Sort the full list by product.id() to guarantee deterministic ordering on every call.
5. Calculate the slice bounds: int from = page * limit; int to = Math.min(from + limit, sorted.size()); — guard against from >= size to return an empty slice.
6. Compute totalPages = (int) Math.ceil((double) products.size() / limit) and hasNext = (page + 1) < totalPages.
7. Return new PageResult<>(slice, page, totalPages, hasNext).
8. Write a unit test that seeds the service with 5 products, requests page=0 with limit=2, and asserts: items has 2 elements, hasNext is true, totalPages is 3.
9. Add a second test case: request page=0 with limit=200 and assert the returned slice is capped at MAX_LIMIT (or total items if fewer).

## What a Good Solution Looks Like
- MAX_LIMIT constant is defined and enforced — passing limit=200 returns at most 50 items.
- DEFAULT_LIMIT is applied when limit <= 0, not just when limit == 0.
- Sorting is applied to the full list before slicing, not to the slice after cutting.
- Slice bounds are computed correctly — no IndexOutOfBoundsException when the last page is not full.
- totalPages uses ceiling division, not truncating integer division.
- hasNext is derived from computed page position, not from whether the slice is full.
- PageResult carries items, page, totalPages, and hasNext — nothing more is required.
- At least one unit test verifies slice correctness and at least one verifies limit capping.

## Hints
- For safe subList: use products.subList(from, Math.min(from + limit, products.size())).
- Ceiling division without floating point: (total + limit - 1) / limit — but Math.ceil((double)total/limit) is clearer.
- Sort without mutating the stored list: new ArrayList<>(products) then Collections.sort(), or products.stream().sorted(...).toList().

## Related Concepts
- rest-api-growth-and-data-tradeoffs.md: pagination, bounded page size, deterministic ordering, safe defaults
