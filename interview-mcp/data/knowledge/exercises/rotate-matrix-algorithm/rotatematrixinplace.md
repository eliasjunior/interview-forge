# Exercise: RotateMatrixInPlace

## Topic / Language / Difficulty
**Topic:** rotate-matrix-algorithm
**Language:** java
**Difficulty:** 3/5 — Medium
**Tags:** matrix, 2d-indexing, array-traversal

## Real-World Context
**Scenario:** Image processing pipeline — rotate thumbnails in-place before writing to disk, where allocating a second matrix per frame would blow the memory budget at scale

### Why this matters in production
- Allocating a second NxN matrix per operation is unacceptable at scale — you must mutate in place
- Forces you to derive the clockwise coordinate mapping (r,c) → (c, N-1-r) from first principles
- Layer-boundary bugs cause silent corruption — off-by-one in the inner loop rotates a corner twice
- The same index math appears in spiral traversal, transpose, and pathfinding — mastering it transfers broadly

## Learning Goal
Derive the 4-way swap coordinates from the clockwise mapping, correctly bound the layer and offset loops, and explain why the center cell of an odd-sized matrix needs no move

## Prerequisites
_None — this is a self-contained exercise._

## Problem Statement
Implement rotate(int[][] matrix) that rotates an NxN matrix 90 degrees clockwise in place. You may not allocate a second NxN matrix. Process the matrix layer by layer from the outermost ring inward. For each layer, iterate over each offset position and perform a 4-way swap of the four corresponding cells. Verify with: a 4x4 matrix, a 3x3 matrix (check the center), and a 1x1 matrix (no-op).

## Implementation Steps
1. Write the naive version: copy to a second matrix using (r,c) → (c, N-1-r), confirm it works
2. Identify the 4 cells involved in one clockwise move for layer=0, offset=0 on a 4x4 matrix
3. Generalise: express all 4 coordinates in terms of first, last, and offset
4. Add the outer loop (layers: 0 to n/2) and inner loop (offset: first to last-1)
5. Remove the auxiliary matrix — perform the 4-way swap using a single temp variable
6. Test edge cases: 1x1, 2x2, 3x3 (verify center is untouched), 4x4

## What a Good Solution Looks Like
- Clockwise mapping (r,c) → (c, N-1-r) stated and validated with an example
- Outer loop runs from 0 to n/2 (exclusive), not n/2+1
- Inner loop runs from first to last-1 (exclusive) — not last
- 4-way swap uses a single temp variable, not a second matrix
- Correctly explains why the center cell of an odd matrix is skipped
- O(N^2) time, O(1) space stated with justification

## Hints
- Start with a 4x4 example and trace the 4 cells for layer=0, offset=0 before writing any code
- If your result looks almost right but corners are wrong, check your inner loop bound (last vs last-1)
- The center of a 3x3 is at (1,1) — its clockwise mapping is also (1,1), so no move is needed

## Related Concepts
- rotate-matrix-algorithm.md: coordinate mapping, layer traversal, 4-way swap, O(N^2) time O(1) space
- rotate-matrix-algorithm.md: square matrix constraint, center cell, offset reasoning
