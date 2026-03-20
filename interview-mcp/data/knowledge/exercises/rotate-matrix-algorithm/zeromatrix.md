# Exercise: ZeroMatrix

## Topic / Language / Difficulty
**Topic:** rotate-matrix-algorithm
**Language:** java
**Difficulty:** 2/5 — Easy
**Tags:** matrix, 2d-indexing, array-traversal

## Real-World Context
**Scenario:** Spreadsheet-style analytics grid where one invalid source value contaminates every derived metric in its row and column, so the entire cross-section must be invalidated consistently.

### Why this matters in production
- A local bad value can invalidate dependent computations across two dimensions, not just one cell
- The main difficulty is separating detection of original zeros from mutation, otherwise newly written zeros corrupt the result
- This problem builds the same row-column reasoning used in matrix traversal, marking strategies, and in-place state encoding

## Learning Goal
Implement a correct two-pass solution for the zero-matrix transformation, explain why one-pass mutation fails, and describe how the first row and first column can be reused as in-place markers.

## Prerequisites
_None — this is a self-contained exercise._

## Problem Statement
Implement `setZeroes(int[][] matrix)` for an MxN matrix. If any element is 0, set its entire row and column to 0. Your solution must only react to cells that were originally 0, not zeros written during the transformation. First build the clear version using extra storage for marked rows and columns. Then explain how to optimize space by using the first row and first column as markers. Verify the behavior on rectangular matrices and edge cases involving zeros in the first row or first column.

## Implementation Steps
1. Write the straightforward version: scan the matrix and record which rows contain an original zero
2. Record which columns contain an original zero in the same discovery pass or in a separate pass
3. Run a second pass that sets matrix[r][c] to 0 if either its row or column was marked
4. Test rectangular cases such as 2x4 and 4x2, not just square matrices
5. Test edge cases: no zeros, all zeros, a single zero, and a zero in the first row or first column
6. Explain how the first row and first column can act as markers, and why they require separate bookkeeping

## What a Good Solution Looks Like
- Correctly zeros every affected row and column based only on original zeros
- Does not cascade from zeros introduced during mutation
- Handles MxN matrices, not only NxN inputs
- Identifies the first-row and first-column edge case in the in-place optimization
- States the trade-off between the simple extra-space solution and the marker-based optimized solution

## Hints
- If you zero cells while still discovering original zeros, you will over-zero the matrix
- A clean solution usually separates discovery from mutation
- For the optimized version, track whether the first row and first column originally contained a zero before using them as markers

## Related Concepts
- rotate-matrix-algorithm.md: matrix traversal, boundary reasoning, edge-case handling
- rotate-matrix-algorithm.md: in-place mutation, marker strategy, row-column dependency tracking
