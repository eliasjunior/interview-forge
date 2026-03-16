# URL Shortener System Design

## Summary
A URL shortener (e.g. bit.ly, TinyURL) translates a long URL into a short alias and
redirects users when they visit the alias. The system is read-heavy: shortening happens
once but redirects happen millions of times. Core challenges are generating unique short
codes without collisions, storing mappings efficiently, and serving redirects at low
latency with caching. Analytics (click counts, geo, device) are usually a secondary
concern layered on top of the redirect path.

Key properties:
- **Read-heavy**: redirect volume dwarfs write volume — optimise the read path
- **Globally unique short codes**: must avoid collisions across concurrent writes
- **Low-latency redirect**: target < 10 ms p99 for cache hit, achieved via CDN/Redis
- **Idempotency question**: same long URL — one or many short codes? Both are valid designs with different trade-offs

## Questions
1. Describe the high-level architecture of a URL shortener. What are the main services and how do they interact?
2. How would you generate unique short codes? Compare at least two approaches and explain the trade-offs.
3. How would you make redirects fast at scale? Where would you add caching, and what are the cache invalidation risks?
4. Design the data model for storing URL mappings and recording basic click analytics.
5. Should shortening the same long URL always return the same short code? Argue both sides and pick one.

## Evaluation Criteria
- Question 1: Must identify at minimum: a write/shorten service (creates short code, persists mapping), a read/redirect service (looks up code, returns HTTP 301 or 302), and a persistent store. Bonus: separate analytics service, CDN layer, rate limiting on writes.
- Question 2: Must compare at least two strategies. Strong answers cover: (a) hash the long URL (MD5/SHA → take first 7 chars of base62) with collision retry; (b) distributed atomic counter converted to base62 (e.g. Snowflake ID or DB auto-increment); (c) random string with uniqueness check. Must discuss collision probability, scalability, and URL length. Weak answer: proposes only one approach without trade-offs.
- Question 3: Must mention Redis (or equivalent) caching of shortCode→longURL. Must distinguish 301 (permanent, browser caches — fewer server hits but can't track analytics) vs 302 (temporary, every redirect hits the server — accurate analytics). Must address TTL and what happens on cache miss. Bonus: CDN caching at the edge.
- Question 4: Must include a URL table with at minimum: short_code (PK), long_url, created_at, owner/user_id. For analytics: clicks table with short_code FK, timestamp, user_agent, ip/geo — or increment a counter column. Bonus: discuss SQL vs NoSQL trade-offs and why a key-value store suits the redirect lookup.
- Question 5: No single right answer — must argue both sides. Deduplication pros: storage efficiency, consistent short code for same content. Cons: different owners sharing one code causes deletion/expiry conflicts, privacy (user A sees B's short code). Non-deduplication pros: isolation, simpler deletion. Strong answer picks one with justification. Weak answer: picks one without acknowledging trade-offs.

## Concepts
- core concepts: short-code, base62-encoding, redirect, hash, collision, idempotency
- practical usage: caching, redis, cdn, analytics, rate-limiting, http-301-vs-302
- tradeoffs: deduplication-vs-isolation, 301-vs-302, hash-vs-counter, sql-vs-nosql
- best practices: atomic-counter, cache-aside, ttl, write-once-read-many, short-expiry-for-302
