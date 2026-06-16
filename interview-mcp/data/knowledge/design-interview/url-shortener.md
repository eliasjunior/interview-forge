# URL Shortener System Design

## Summary
A URL shortener (e.g. bit.ly, TinyURL) translates a long URL into a short alias and redirects users when they visit the alias. The system is read-heavy: shortening happens once but redirects happen millions of times. Core challenges are generating unique short codes without collisions, storing mappings efficiently, and serving redirects at low latency with caching. Analytics (click counts, geo, device) are usually a secondary concern layered on top of the redirect path.

Key properties:
- **Read-heavy**: redirect volume dwarfs write volume — optimise the read path
- **Globally unique short codes**: must avoid collisions across concurrent writes
- **Low-latency redirect**: target < 10 ms p99 for cache hit, achieved via CDN/Redis
- **Idempotency question**: same long URL — one or many short codes? Both are valid designs with different trade-offs

A strong candidate understands not just the happy path but the failure modes: cache stampede on a viral URL, hot partition on a popular short code, and the analytics vs. caching tension from 301 vs. 302 redirect semantics.

---

## Questions

1. Describe the high-level architecture of a URL shortener. What are the main services and how do they interact?
2. How would you generate unique short codes? Compare at least two approaches and explain the trade-offs.
3. How would you make redirects fast at scale? Where would you add caching, and what are the cache invalidation risks?
4. Design the data model for storing URL mappings and recording basic click analytics.
5. Should shortening the same long URL always return the same short code? Argue both sides and pick one.
6. What HTTP status code should a redirect return — 301 or 302? How does this choice affect caching and analytics?
7. How would you handle a viral URL that generates 1 million redirect requests per minute to the same short code?
8. How would you implement custom aliases (e.g. bit.ly/my-brand) while keeping auto-generated codes unique?
9. How would you design expiry and deletion for short codes? What are the edge cases?
10. How would you implement URL validation to prevent shortening malicious URLs?
11. How would you design the analytics pipeline to record click events without adding latency to the redirect path?
12. How would you handle multi-region deployment so that redirects are fast globally?
13. How would you prevent abuse — spam, phishing links, or bots generating millions of short codes?
14. How would you design a URL shortener that can scale to 100 billion stored URLs while keeping redirect latency under 10 ms?
15. How would you implement a feature that lets users preview the destination URL before following the redirect?
16. How would you design the system if short codes must be entirely collision-free without any retry or uniqueness check at write time?

---

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
- Question 12: intermediate
- Question 13: advanced
- Question 14: advanced
- Question 15: advanced
- Question 16: advanced

---

## Evaluation Criteria

- Question 1: Must identify at minimum: a write/shorten service (creates short code, persists mapping), a read/redirect service (looks up code, returns HTTP 301 or 302), and a persistent store. Bonus: separate analytics service, CDN layer, rate limiting on writes.
- Question 2: Must compare at least two strategies. Strong answers cover: (a) hash the long URL (MD5/SHA → take first 7 chars of base62) with collision retry; (b) distributed atomic counter converted to base62 (e.g. Snowflake ID or DB auto-increment); (c) random string with uniqueness check. Must discuss collision probability, scalability, and URL length. Weak answer: proposes only one approach without trade-offs.
- Question 3: Must mention Redis (or equivalent) caching of shortCode→longURL. Must distinguish 301 (permanent, browser caches — fewer server hits but can't track analytics) vs 302 (temporary, every redirect hits the server — accurate analytics). Must address TTL and what happens on cache miss. Bonus: CDN caching at the edge.
- Question 4: Must include a URL table with at minimum: short_code (PK), long_url, created_at, owner/user_id. For analytics: clicks table with short_code FK, timestamp, user_agent, ip/geo — or increment a counter column. Bonus: discuss SQL vs NoSQL trade-offs and why a key-value store suits the redirect lookup.
- Question 5: No single right answer — must argue both sides. Deduplication pros: storage efficiency, consistent short code for same content. Cons: different owners sharing one code causes deletion/expiry conflicts, privacy (user A sees B's short code). Non-deduplication pros: isolation, simpler deletion. Strong answer picks one with justification. Weak answer: picks one without acknowledging trade-offs.
- Question 6: Must explain: 301 Moved Permanently — browser caches the redirect and never hits the server again for that code (good for reducing load, bad for analytics because clicks are not counted server-side); 302 Found — browser always re-hits the server (accurate click tracking, higher server load). Must not treat them as equivalent. Correct choice depends on whether analytics accuracy or server load matters more. Bonus: 307 Temporary Redirect as a method-preserving alternative to 302.
- Question 7: Must identify the hot key problem: all requests hit the same cache entry, which is fine if the entry exists, but on cache miss or restart, all requests simultaneously miss and hammer the DB (cache stampede). Solutions: (1) cache warm-up on deployment; (2) probabilistic early refresh — refresh cache before TTL expires based on hit rate; (3) request coalescing / single-flight — only one request fetches from DB, others wait and reuse the result; (4) multi-tier cache (CDN edge → regional Redis → origin). Bonus: pre-populate CDN for known viral URLs.
- Question 8: Must describe: custom aliases are stored in the same table as auto-generated codes; uniqueness constraint on short_code column prevents collision between custom and auto-generated; validation: reserved words (api, admin, login) must be blocked; length limits; character allowlist. Generation: when creating an auto-generated code, prefix or namespace it (e.g. random 7-char base62) to avoid collision with typical human-chosen aliases. Must address: custom alias namespace should be separated from auto-generated namespace to allow predictable generation without collision checks.
- Question 9: Must describe: expiry stored as expires_at timestamp on the URL record; redirect service checks expiry on cache miss (or on every hit if TTL <= cache TTL); expired codes return 404. Deletion edge cases: (1) cache may still serve a deleted/expired code until TTL expires — use 302 so browser doesn't permanently cache; (2) should deleted short codes be reused? Answer: no — tombstone the short_code or enforce a grace period to avoid confusion. Bonus: background job sweeps expired records to free storage, but must not delete the short_code row to prevent reuse.
- Question 10: Must describe URL validation layers: (1) syntactic validation — valid URL format, scheme must be http/https; (2) domain allowlist/blocklist — block known phishing, malware, and spam domains (Google Safe Browsing API); (3) redirect chain following — follow redirects to check the final destination; (4) content scanning — optional for high-risk domains. Must address: validation adds latency — run async and mark URL as PENDING until validated, or do synchronous validation with a timeout. Bonus: user reporting mechanism to flag malicious URLs after the fact.
- Question 11: Must explain: recording a click event in the synchronous redirect path adds DB write latency (bad for p99). Solution: fire-and-forget — publish a click event to a queue (Kafka, SQS) and return the redirect immediately; an async consumer writes to the analytics store. Must distinguish: the redirect HTTP response must not wait for analytics to be recorded. Bonus: batch writes to the analytics DB to reduce write amplification; use a separate read replica or time-series DB (ClickHouse, TimescaleDB) for analytics queries so they don't contend with redirect reads.
- Question 12: Must describe: deploy the redirect service in multiple regions (e.g. AWS multi-region or Cloudflare Workers); use a CDN or anycast routing so users hit the closest edge node; cache the shortCode→longURL mapping at the edge. The challenge is write propagation: when a new short code is created, it must be replicated to all regions before the creator shares the link. Solutions: (1) eventual consistency with short TTL — accept a brief window where the link may 404 in other regions; (2) strong consistency via a global DB (CockroachDB, Spanner) at higher cost. Bonus: read-your-own-writes: redirect the creator through the origin region briefly to avoid 404 on fresh links.
- Question 13: Must address: rate limiting on the shorten endpoint by IP, API key, or account — token bucket per user; captcha for anonymous requests. URL validation: block known spam domains and phishing URLs (Safe Browsing API). Bot detection: high-frequency requests with rotating IPs — apply progressive rate limiting and require API keys above a threshold. Honeypot short codes: create reserved codes that are never advertised — any click on them indicates bot/scraper activity. Bonus: HMAC-signed short codes so the server can verify the code was generated by its own system, preventing enumeration.
- Question 14: Must address the data scale challenge: 100 billion URLs × ~100 bytes each ≈ 10 TB of raw data — too large for a single relational DB. Solution: horizontal sharding by short_code (hash-based or range-based) across many nodes; or a distributed KV store (DynamoDB, Cassandra) where the short_code is the partition key. Redirect latency: read path must be cache-heavy — CDN caches at edge, Redis caches in origin region, DB is rarely hit. Code generation at scale: Snowflake IDs or pre-generated code pools distributed to shorten servers avoid distributed coordination. Bonus: separate hot and cold storage — active URLs in Redis/SSD, archived URLs in cheaper object storage, with a tiering policy.
- Question 15: Must describe: instead of an immediate 302 redirect, the server renders a preview page (HTML) showing the destination URL domain, title, thumbnail, and a "Continue" button; the actual redirect happens only after the user clicks. Implementation: on redirect, detect if the `nopreview` flag is absent → render preview; after user clicks → redirect with a short-lived signed token to prevent re-entry. Cache the preview metadata (title, thumbnail) separately from the redirect. Must address: preview page must clearly show the real destination URL to be useful for safety; bots (search crawlers) should still get a redirect (User-Agent sniffing or bot detection).
- Question 16: Must explain: collision-free without a uniqueness check requires deterministic, globally unique ID generation before writing. Options: (1) distributed counter with pre-allocated blocks — each shorten server gets a block of IDs (e.g. 1000–2000) from a central coordinator; encodes the block ID into base62 without any collision check; (2) UUID-derived code — take a 128-bit UUID and encode the first 42 bits as a 7-character base62 string — collision probability is ~1/4 trillion per code pair; (3) hash-ring partition — assign short code ranges to servers based on consistent hashing, each server auto-increments within its range. Must address: the tradeoff is operational complexity (block allocation, coordination) vs. the simplicity of a uniqueness check on write.

## Concepts
- core concepts: short-code, base62-encoding, redirect, hash, collision, idempotency, read-heavy, hot-key, cache-stampede
- practical usage: caching, redis, cdn, analytics, rate-limiting, http-301-vs-302, kafka, safe-browsing-api, snowflake-id, sharding, consistent-hashing
- tradeoffs: deduplication-vs-isolation, 301-vs-302, hash-vs-counter, sql-vs-nosql, sync-vs-async-analytics, strong-vs-eventual-consistency, preview-vs-direct-redirect
- best practices: atomic-counter, cache-aside, ttl, write-once-read-many, short-expiry-for-302, fire-and-forget-analytics, validate-before-shortening, tombstone-deleted-codes

## Warm-up Quests

### Level 0 — Spark (MCQ, foundation)
1. In a large-scale URL shortener, why is the redirect path usually the main thing to optimize?
   A) Because creating short links happens more often than redirects
   B) Because redirect traffic is much higher and directly affects user-perceived latency
   C) Because redirect responses are larger than shorten responses
   D) Because analytics queries run before every redirect
   Answer: B

2. Which short-code generation approach gives globally unique IDs without depending on collision retries for every write?
   A) A distributed counter or Snowflake-style ID encoded in base62
   B) Hash the long URL and retry on collision
   C) Random strings with a uniqueness check on each write
   D) UUID of the long URL truncated to 7 characters with collision retry
   Answer: A

3. What is the most important backend tradeoff between returning HTTP 301 and 302 for redirects?
   A) 301 reduces repeated server hits through caching, while 302 preserves better server-side click visibility
   B) 301 preserves server-side analytics, while 302 causes browsers to cache the redirect permanently
   C) 301 is for custom aliases, while 302 is for generated aliases
   D) 301 prevents collisions, while 302 prevents abuse
   Answer: A

4. What is the main danger of a hot key in a URL shortener after a cache miss or cache restart?
   A) Many requests miss together and overload the database or origin store
   B) The analytics queue falls out of order for the popular URL
   C) The Redis cluster evicts the hot key and blocks all other reads
   D) Browser redirects permanently cache the wrong destination
   Answer: A

5. Why might a system intentionally avoid returning the same short code for the same long URL every time?
   A) Because databases cannot store the same long URL twice
   B) Because deduplication makes redirects slower than SQL joins
   C) Because 302 redirects require a unique short code per request
   D) Because separate users may need different ownership, expiry, deletion, or privacy boundaries
   Answer: D

6. Which design best keeps analytics from slowing down redirects?
   A) Write click events synchronously before returning the redirect
   B) Batch analytics writes every 60 seconds inside the redirect handler
   C) Only record analytics when Redis is unavailable
   D) Publish click events asynchronously to a queue and process them off the critical path
   Answer: D

7. Why is it useful to separate custom aliases from the auto-generated short-code namespace?
   A) So custom aliases can use a different HTTP status code
   B) So Redis can store custom aliases in a dedicated cluster region
   C) So generated codes remain predictable and collision-safe without conflicting with human-chosen names
   D) So custom aliases never need URL validation
   Answer: C

8. What is the safest default treatment for deleted or expired short codes?
   A) Reuse them immediately so the namespace stays compact
   B) Archive them to cold storage and reuse after 24 hours
   C) Tombstone them or delay reuse to avoid stale-cache and user-confusion issues
   D) Convert them into admin-owned aliases and log the original owner
   Answer: C

### Level 1 — Padawan (MCQ multi-select, foundation)

1. Which components belong in a practical first version of a URL shortener?
   A) A shorten endpoint that creates and stores a code-to-URL mapping
   B) A redirect endpoint that resolves a short code and returns an HTTP redirect
   C) A persistent store with a uniqueness rule for short codes
   D) A globally distributed analytics warehouse before the first redirect can work
   Answer: A,B,C

2. Which statements about short-code generation are correct?
   A) Random base62 strings need collision handling or a uniqueness constraint
   B) A distributed unique ID can be encoded in base62 without hashing the long URL
   C) Truncating a hash makes collisions mathematically impossible
   D) Code length, coordination cost, predictability, and collision handling are real design trade-offs
   Answer: A,B,D

3. Which statements about the redirect read path are correct?
   A) A cache can serve hot code-to-URL mappings without querying the primary store every time
   B) A cache miss should fall back to the persistent mapping store
   C) The redirect response should wait for the analytics database write to finish
   D) Negative caching can reduce repeated database lookups for invalid short codes
   Answer: A,B,D

4. Which statements correctly describe the 301 versus 302 trade-off?
   A) A 301 can be cached aggressively by browsers and intermediaries
   B) A 302 usually preserves more server-side visibility because clients continue hitting the redirect service
   C) A 301 is always the correct choice for a URL shortener
   D) The choice depends on whether load reduction or redirect control and analytics matter more
   Answer: A,B,D

5. Which problems can appear when one long URL is always deduplicated to one short code?
   A) Different owners may need independent expiry or deletion behavior
   B) Sharing one code can reveal that another user already shortened the destination
   C) Per-campaign analytics become harder when campaigns share the same code
   D) The redirect service can no longer use caching
   Answer: A,B,C

6. Which techniques help protect the primary store during a viral-link traffic spike?
   A) Edge or CDN caching for popular redirects
   B) Request coalescing so one cache miss loads the mapping while other requests wait
   C) Cache warming or early refresh for known hot keys
   D) Expiring the hot mapping more frequently so the database is consulted more often
   Answer: A,B,C

7. Which statements about redirect analytics are correct?
   A) Publishing click events to a queue keeps analytics writes off the redirect critical path
   B) Analytics consumers can batch writes into a store designed for reporting
   C) Losing or duplicating events should be considered when designing the event pipeline
   D) The redirect must fail whenever the analytics system is unavailable
   Answer: A,B,C

8. Which controls belong in a production abuse-prevention design?
   A) Rate limits by account, API key, or IP
   B) Validation that permits only supported schemes such as HTTP and HTTPS
   C) Malware or phishing checks plus a reporting and takedown path
   D) Trusting any destination once it passes a URL regex
   Answer: A,B,C

### Level 2 — Forge (Guided Answer, intermediate)

1. Explain the high-level backend architecture of a URL shortener. Use this structure: [shorten path → persistence model → redirect path → analytics offload].
   Hint: Start with a simple version that works, then explain why the redirect and analytics paths should evolve separately.
   Answer: A strong answer separates the write path from the read path. The shorten service validates the destination, generates a unique code, and stores the mapping. The redirect service resolves the code through cache and then persistent storage before returning a redirect. Click events are published asynchronously so analytics failures or write latency do not delay the redirect.

2. Explain two different short-code generation strategies. Use this structure: [strategy one → strategy two → collision or coordination behavior → which one you would choose].
   Hint: Compare random base62 codes with a globally unique numeric ID encoded in base62.
   Answer: A strong answer explains that random base62 codes are simple and hard to predict but require a uniqueness constraint and retry on collision. A distributed counter or Snowflake-style ID produces unique numeric values that can be encoded in base62 without collision retries, but introduces coordination, predictability, or ID-allocation concerns. The choice should follow scale, security, and operational requirements rather than assuming one universal winner.

3. Explain how to keep redirects fast under heavy traffic. Use this structure: [cache hierarchy → origin fallback → hot-key failure mode → mitigation].
   Hint: Cover both the normal cache-hit path and what happens when a popular key is absent or expires.
   Answer: A strong answer uses an edge or CDN cache where appropriate, a regional cache such as Redis, and the mapping store as the final fallback. A viral key is cheap while cached but dangerous during expiry or restart because simultaneous misses can overload the origin. Request coalescing, cache warming, early refresh, bounded fallback traffic, and negative caching protect the store.

4. Explain the backend trade-off between HTTP 301 and 302 in a URL shortener. Use this structure: [client caching → load implications → analytics and control implications → when to prefer each].
   Hint: Avoid presenting either status code as automatically correct for every product.
   Answer: A strong answer explains that a 301 can move repeated redirect traffic away from the service through browser or intermediary caching, reducing load but also reducing server-side visibility and making destination changes harder. A 302 keeps clients returning to the service, preserving analytics and redirect control at higher infrastructure cost. The product's mutability, safety, and analytics requirements should drive the choice.

5. Explain whether the same long URL should always return the same short code. Use this structure: [deduplication benefit → isolation benefit → ownership, expiry, privacy, and analytics → decision].
   Hint: Treat this as a product and data-ownership decision, not only a storage optimization.
   Answer: A strong answer recognizes that deduplication saves mappings and gives a stable code, but it couples different users and campaigns to shared ownership, expiry, deletion, privacy, and analytics behavior. Returning a new code per request or owner provides isolation and clearer lifecycle control at the cost of more records. A common practical choice is owner-scoped or idempotency-key-scoped reuse rather than global deduplication.

6. Explain how click analytics should work without slowing redirects. Use this structure: [event creation → queue → consumer and storage → delivery trade-offs].
   Hint: Include what happens when the analytics dependency is slow or temporarily unavailable.
   Answer: A strong answer creates a small click event in the redirect service and publishes it asynchronously to a durable queue. Consumers batch or stream events into an analytics-oriented store without competing with mapping lookups. The design acknowledges duplicate or lost-event risks, chooses an appropriate delivery guarantee, and keeps redirect availability independent from analytics availability.

7. Explain how you would support newly created short links across multiple regions. Use this structure: [global routing → regional reads → mapping replication → fresh-link consistency].
   Hint: The difficult case is a user creating a link in one region and immediately opening it from another.
   Answer: A strong answer routes users to nearby redirect instances and serves mappings from regional or edge caches. New mappings must propagate through a global database or an asynchronous replication stream. Strong consistency reduces fresh-link failures but costs more latency and coordination; eventual consistency is simpler but needs a mitigation such as routing fresh links to the write region, read-through fallback, or accepting a brief propagation window.

8. Explain how you would design abuse prevention for a production URL shortener. Use this structure: [input validation → identity and rate limits → destination reputation → monitoring and takedown].
   Hint: Think beyond URL syntax. The system will attract phishing, spam campaigns, automated creation, and attempts to hide malicious redirect chains.
   Answer: A strong answer validates supported schemes and destination shape, applies quotas and rate limits by identity and network signals, checks destination reputation or scans suspicious links, and follows redirect chains carefully with SSRF protections. It also includes monitoring, user reporting, fast takedown, audit history, and a policy for already cached malicious redirects.
