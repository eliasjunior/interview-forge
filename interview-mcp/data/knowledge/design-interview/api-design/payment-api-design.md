# Payment API Design

## Summary
A production payment API requires four design pillars: (1) Idempotency — use an Idempotency-Key header or clientPaymentRef to prevent double-processing on client retries; (2) Persist-before-external-call — write the payment record with status PENDING_FRAUD to the DB and commit before calling the fraud service, creating an audit trail and crash-recovery point; (3) Two-transaction pattern — Tx1 persists and commits, the external fraud call happens outside any DB transaction, Tx2 writes the final status; holding a DB connection open during a network call exhausts the connection pool; (4) Optimistic locking — @Version field detects concurrent execute requests at commit time without pre-locking rows. HTTP semantics: 202 Accepted for async processing, 504 Gateway Timeout for upstream timeouts, 409 Conflict for concurrent modification. Status machine: INITIATED → PENDING_FRAUD → PROCESSING → APPROVED / REJECTED / FAILED.

A strong candidate understands not just the happy path but the failure modes: what happens when the fraud service is down mid-payment, how to reconcile orphaned PENDING records, and how idempotency interacts with retries, partial failures, and distributed state.

---

## Questions

1. Design a payment processing endpoint that is idempotent, calls an external fraud service, and handles concurrent requests safely. Walk through your full design.
2. Why must you persist the payment record before calling the external fraud service? Explain the two-transaction pattern and why it matters.
3. Explain two idempotency strategies for a payment API. What happens without idempotency when a client retries after a network timeout?
4. Two concurrent POST requests arrive for the same payment execute endpoint. How do you handle this safely with JPA, and what HTTP status do you return to the losing request?
5. When should a payment endpoint return 201, 202, 409, 503, or 504? Give a concrete payment scenario for each status code.
6. How would you design the payment status state machine? What are the valid state transitions and what prevents invalid ones?
7. How would you handle a fraud service that times out 30% of the time? What resilience patterns would you apply and in what order?
8. What is the transactional outbox pattern and when would you use it in a payment system?
9. How would you design a reconciliation job to detect and recover orphaned PENDING payments?
10. How would you implement rate limiting on a payment API to prevent abuse while allowing legitimate bursts?
11. How would you design audit logging for a payment API to meet compliance requirements?
12. How would you version a payment API so that existing clients are not broken when you introduce new fields or status codes?
13. How would you design a payment refund flow that reuses the idempotency and state machine patterns from the original payment?
14. How would you handle partial failures in a multi-step payment flow where a charge succeeds but a downstream inventory update fails?
15. How would you design a webhook delivery system to notify merchants when a payment status changes, with guaranteed at-least-once delivery?
16. How would you scale a payment API to handle 10,000 requests per second without sacrificing consistency or idempotency guarantees?

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

- Question 1: Must include all of: (1) idempotency key or clientPaymentRef with unique DB constraint; (2) persist PENDING_FRAUD to DB and commit before calling fraud (two-transaction pattern); (3) call fraud service outside any DB transaction; (4) 202 Accepted for async processing when fraud result is not immediate; (5) @Version for concurrent execute requests returning 409 or 200 with current status; (6) minimal status machine (PENDING_FRAUD → PROCESSING → APPROVED/REJECTED/FAILED). Bonus: two-step design (POST /payments/init returns paymentId, POST /payments/{id}/execute transitions and calls fraud) with EXPIRED cleanup via scheduler after TTL (e.g. 24h).
- Question 2: Must explain: if the service crashes after fraud returns OK but before the DB write, the approved outcome is lost — creating risk of double-charge or lost payment. Persisting first creates an audit trail and a crash-recovery point that any reconciliation job can use. Two-transaction pattern: Tx1 = persist + commit (DB connection released), then call fraud service with no transaction held, then Tx2 = update final status + commit. Must say: never hold a DB transaction open during a network call — it ties up a DB connection for the full fraud service latency, exhausting the pool under load.
- Question 3: Must describe two strategies: (1) Idempotency-Key header — client generates a UUID before the request, sends it as a header, server stores it with a unique constraint, on retry server returns the same paymentId and current status instead of creating a new payment; (2) clientPaymentRef in the request body — a client-side reference stored with a unique constraint per client. Key scenario: client POSTs, network times out, client has no response and no paymentId — without idempotency, retry creates a second payment charge. Must define validity window (e.g. 24h) and what to return on retry (same resource + current status, not an error).
- Question 4: Must describe: JPA @Version field on the Payment entity (optimistic locking). First execute request reads entity at version=N, transitions INITIATED → PROCESSING, saves — JPA issues UPDATE ... WHERE id=? AND version=N, sets version=N+1. Second concurrent request also reads at version=N, tries to save, JPA WHERE version=N finds 0 rows updated, throws OptimisticLockException. Service catches it and returns 409 Conflict (preferred) or 200 with current status. Must clarify: optimistic locking does NOT pre-lock rows — it detects conflicts only at commit time, making it non-blocking for read-heavy scenarios.
- Question 5: Must map correctly: 201 Created = payment fully processed synchronously, resource created and complete; 202 Accepted = payment accepted for async processing, fraud check running in background, client should poll or await callback; 409 Conflict = concurrent modification, optimistic lock failure, another request already transitioned this payment; 503 Service Unavailable = fraud service is down or circuit breaker open, temporary unavailability; 504 Gateway Timeout = fraud service timed out, upstream did not respond in time. Must NOT use 408 Request Timeout for upstream failures — 408 is for client request timeout, not upstream.
- Question 6: Must describe the state machine explicitly: INITIATED → PENDING_FRAUD (after persisting) → PROCESSING (fraud approved) → APPROVED / REJECTED / FAILED. Must address invalid transitions: cannot go from APPROVED back to PROCESSING, cannot re-execute an APPROVED payment. Implementation: DB CHECK constraint or application-level guard that validates current state before transition. Bonus: mention the EXPIRED terminal state for payments that were never executed within the TTL window.
- Question 7: Must propose layered resilience in order: (1) timeout — set a short deadline (e.g. 3s) so threads don't hang indefinitely; (2) retry with exponential backoff + jitter — idempotency keys make retries safe on the fraud side too; (3) circuit breaker (Resilience4j) — after N failures, open the circuit and fail fast with 503 to protect the DB; (4) fallback — for low-risk payments, approve optimistically and flag for async re-evaluation. Must warn: retrying without idempotency on the fraud call risks double-fraud-checking or double-charging. Bonus: bulkhead to isolate fraud-call thread pool from core API threads.
- Question 8: Must explain the transactional outbox: instead of calling the broker/webhook directly after a DB commit (which can fail between the two), write an event record to an `outbox` table in the same DB transaction as the payment update. A separate poller reads unpublished outbox records and delivers them, marking them as delivered after acknowledgement. Guarantees at-least-once delivery without distributed transactions. Use it when: payment status changes must reliably trigger downstream events (ledger update, webhook, email) and the two-phase commit is not available or too costly.
- Question 9: Must describe: a scheduled job (e.g. every 5 min) queries for payments in PENDING_FRAUD or PROCESSING that are older than the fraud service SLA timeout (e.g. 2 min). For each: re-query the fraud service with the original idempotency key to get the latest result, or mark as FAILED if the fraud service has no record. Must address: idempotency on the fraud re-query prevents double processing; only process payments that are truly stuck, not ones that arrived recently. Bonus: alerting when orphan count exceeds threshold, dead-letter queue for payments the reconciler cannot resolve.
- Question 10: Must describe rate limiting strategies: token bucket (allows bursts, refills at fixed rate), fixed window (simple but allows double-rate at window boundary), sliding window (more accurate, higher memory cost). Implementation: Redis with atomic INCR + TTL for distributed rate limiting; Bucket4j for in-process. Rate limit by: API key for merchant-level limits, IP for anonymous endpoints. Response: 429 Too Many Requests with Retry-After header. Must distinguish per-second burst limits from per-day volume limits — both apply to payment APIs.
- Question 11: Must mention: every payment event (create, transition, reject, approve, refund) gets an immutable audit record with: paymentId, actorId (who or what system triggered it), action, old state, new state, timestamp, requestId for tracing. Must NOT update audit records — insert only (append-only log). Storage: separate audit table or event store, never update-in-place. Must address masking: card numbers, CVVs, and PII must be masked or tokenized before writing to logs. Bonus: separate audit log from operational DB (write to a WORM store or event stream like Kafka) to prevent tampering.
- Question 12: Must describe URI versioning (/api/v1/payments vs /api/v2/payments) as the most explicit and cache-friendly approach. Must address backward compatibility: additive changes (new optional fields) are safe in the same version; breaking changes (removing fields, changing status codes) require a new version. Sunset headers (Deprecation: date, Sunset: date) to warn clients before decommissioning v1. Bonus: OpenAPI spec versioning, consumer-driven contract testing (Pact) to catch breaking changes before deploy.
- Question 13: Must describe: refund creates a new Payment entity with type=REFUND linked to the original paymentId; the refund has its own idempotency key (original idempotency key + ":refund" suffix or a new client-provided key); the refund state machine mirrors the payment: INITIATED → PENDING_FRAUD (optional for large refunds) → PROCESSING → REFUNDED / FAILED. Must address: cannot refund more than the original payment amount; cannot refund a payment that is not APPROVED; partial refunds require tracking total refunded amount. Bonus: asynchronous refund flow — 202 Accepted, webhook on completion.
- Question 14: Must identify the saga pattern as the solution for multi-step distributed transactions. Choreography saga: each service publishes an event when its step succeeds; next service listens and executes; on failure, compensating transactions unwind completed steps (e.g. reverse the charge). Orchestration saga: a central orchestrator calls each step and drives compensating transactions on failure. Must distinguish: a local DB transaction can roll back atomically, but a cross-service call cannot — compensating transactions are the only option. Bonus: the outbox pattern ensures compensation events are reliably published even on crash.
- Question 15: Must describe: webhook records stored in DB (merchantId, eventType, url, status=PENDING, retryCount, nextRetryAt); a poller reads PENDING records and POSTs to the merchant URL; on 2xx → mark DELIVERED; on failure → exponential backoff with max retries (e.g. 10), then mark DEAD. Must address: idempotency on delivery (include event ID in payload so merchants can deduplicate); signing (HMAC-SHA256 of the payload with a shared secret so merchants can verify authenticity). Bonus: separate delivery workers per merchant to prevent one slow merchant from blocking others; webhook dashboard showing delivery status.
- Question 16: Must address: horizontal scaling behind a load balancer is straightforward; idempotency is safe because the unique constraint is in the DB (single source of truth); DB becomes the bottleneck — solutions: read replicas for polling endpoints, sharding payments by merchantId or paymentId range, connection pooling (HikariCP) sized to match DB capacity. Must address fraud service as a potential bottleneck: async queue (Kafka) between payment API and fraud service decouples throughput. Bonus: CQRS — write to a normalized payments DB, project events to a read-optimized store for analytics and reconciliation; circuit breaker + bulkhead per external dependency to prevent cascade failures under load.

## Concepts
- core concepts: idempotency, idempotency-key, persist-before-call, two-transactions, optimistic-locking, payment-status, async-api, concurrent-modification, audit-trail, state-machine
- practical usage: idempotency-key-header, client-payment-ref, version-field, optimistic-lock-exception, 202-accepted, 409-conflict, 504-gateway-timeout, jpa-version, completablefuture, transactional-outbox, saga, circuit-breaker, rate-limiting, webhook, reconciliation
- tradeoffs: optimistic-vs-pessimistic-locking, sync-vs-async-response, single-endpoint-vs-two-step, idempotency-key-vs-client-ref, hold-tx-vs-release-tx, choreography-vs-orchestration-saga, at-least-once-vs-exactly-once
- best practices: persist-before-external-call, never-hold-tx-during-network-call, return-same-resource-on-retry, use-409-for-conflicts, use-504-not-408-for-upstream-timeout, two-transaction-pattern, mask-sensitive-data-in-logs, append-only-audit-log, retry-vs-fail-fast
