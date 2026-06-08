# Exercise: OrdersTableDesign

## Topic / Language / Difficulty
**Topic:** database-basics
**Language:** any
**Difficulty:** 2/5 — Easy
**Tags:** ddl, constraints, data-modeling, sql, orders, financial

## Real-World Context
**Scenario:** A small e-commerce backend team is bootstrapping their order lifecycle service. You are writing the initial migration for the `orders` table. The ORM is not generating this — you are authoring the DDL directly so the constraints live at the database layer where they cannot be bypassed by application bugs.

### Why this matters in production
- A missing NOT NULL on `status` lets a row exist with no known state — impossible to route through the order lifecycle.
- A plain VARCHAR for `total_amount` allows strings like 'free' or '-9.99' to enter the database and corrupt financial aggregates.
- Without a CHECK constraint on `status`, any string can be inserted — the application enum becomes the only guard, and it can be bypassed by a direct SQL client or a future migration.
- Omitting the foreign-key on `customer_id` means orders can reference deleted or non-existent customers with no database-level complaint.

## Learning Goal
Understand which SQL types and constraints are needed to make a financial domain table self-defending — so that no application bug, direct SQL query, or future migration can insert a structurally invalid order row.

## Prerequisites
_None — this is a self-contained exercise._

## Problem Statement
Write a CREATE TABLE statement for an `orders` table used by an e-commerce order lifecycle service.

The table must represent an `Order` with these fields:
- `id` — surrogate primary key
- `customer_id` — reference to a customers table (assume it already exists)
- `status` — the order lifecycle state; only the values `pending`, `confirmed`, `shipped`, `cancelled` are valid
- `total_amount` — monetary amount; must be non-negative and support two decimal places
- `currency` — ISO 4217 currency code (e.g. `USD`, `EUR`); always exactly 3 characters
- `created_at` — when the row was inserted; should be set automatically

Decide: correct column type for each field, which columns are nullable and which are not, and which additional constraints are needed beyond the type to enforce the invariants above.

## Implementation Steps
1. Start with just `id` and `customer_id`. Choose a surrogate key type (BIGSERIAL, UUID, or BIGINT with AUTO_INCREMENT — pick one and justify it). Add the foreign key reference to `customers(id)` and decide whether `ON DELETE` should be RESTRICT, SET NULL, or CASCADE for orders.
2. Add `status`. Choose a type — ENUM, VARCHAR with a CHECK, or a separate lookup table. Write the constraint that rejects any value outside the four valid states. Mark it NOT NULL.
3. Add `total_amount` and `currency`. Use NUMERIC(12, 2) for amount and justify why FLOAT is wrong for money. Add a CHECK that rejects negative amounts. Fix the width of `currency` to exactly 3 characters.
4. Add `created_at`. Use a timestamp type with a database-side default so the application cannot accidentally omit it or supply a wrong value.
5. Review the full DDL. For each column ask: could a valid-looking but wrong value slip through the type alone? Add any missing CHECK constraints. Verify every column has an explicit NOT NULL or a documented reason it is nullable.

## What a Good Solution Looks Like
- PRIMARY KEY is declared explicitly — not left implicit.
- customer_id references customers(id) with a foreign key; ON DELETE behaviour is chosen and justified (RESTRICT is acceptable; SET NULL requires customer_id to be nullable).
- status is constrained to exactly the four valid lifecycle values — the type alone (VARCHAR) is not sufficient; a CHECK or ENUM must be present.
- total_amount uses NUMERIC or DECIMAL, not FLOAT or REAL; a CHECK (total_amount >= 0) is present.
- currency is fixed-width (CHAR(3)) or has a CHECK enforcing exactly 3 characters; NOT NULL.
- created_at has a database-side default (DEFAULT NOW() or equivalent); NOT NULL.
- Every column is explicitly NOT NULL unless nullability is documented with a reason.

## Hints
- FLOAT stores binary fractions — 0.1 + 0.2 ≠ 0.30 in IEEE 754. NUMERIC(12, 2) stores exact decimals.
- A CHECK on a VARCHAR status column looks like: CHECK (status IN ('pending', 'confirmed', 'shipped', 'cancelled')).
- CHAR(3) enforces fixed width at the storage layer; VARCHAR(3) with a CHECK (LENGTH(currency) = 3) also works but is more verbose.
- ON DELETE RESTRICT prevents removing a customer who still has orders — usually the safest default for financial records.

## Related Concepts
- database-basics.md: column types, CHECK constraints, NOT NULL, foreign keys, NUMERIC vs FLOAT
