# Rotate Matrix In Place

## Summary
Rotate an `N x N` matrix by 90 degrees clockwise, in place, without allocating a
second matrix. The core idea is to process the matrix layer by layer (outer ring
to inner ring) and rotate four cells at a time. For each position in a layer,
perform a 4-way swap: left to top, bottom to left, right to bottom, top to right.

Key properties:
- In-place: uses constant extra space, not another `N x N` matrix
- Layer-based: processes the matrix as concentric square rings
- 4-way swap: each move rotates four corresponding cells
- Deterministic mapping: `(r, c) -> (c, N - 1 - r)` for clockwise rotation

## Questions
1. Why does this problem require an `N x N` matrix, and what breaks if the matrix is not square?
2. What is the coordinate mapping for a cell `(r, c)` after a 90-degree clockwise rotation?
3. How would you solve this with an extra matrix first, and why is that not in place?
4. How do layers work in the in-place solution, and why do you only iterate to `n / 2` layers?
5. Which four coordinates participate in one rotation step for a given layer and offset?
6. Why do you stop the inner loop at `last - 1` instead of `last`?
7. What are the time and space complexities of the in-place approach?
8. What happens for odd-sized matrices, especially the center cell?

## Evaluation Criteria
- Question 1: Must state that 90-degree in-place rotation assumes a square matrix because dimensions must remain aligned after rotation. Weak answer: says "because the problem says so" without explaining shape constraints.
- Question 2: Must give the clockwise mapping `(r, c) -> (c, N - 1 - r)`. Bonus: validates it with a small `4 x 4` example.
- Question 3: Must describe the auxiliary-matrix approach and identify its `O(N^2)` extra space cost. Weak answer: only says "copy values" without mapping logic.
- Question 4: Must explain outer-to-inner layer processing and that the number of layers is `n / 2`. Bonus: calls them rings or shells.
- Question 5: Must identify the four-way swap positions using `first`, `last`, and `offset`. Weak answer: understands swapping in general but cannot map the coordinates.
- Question 6: Must explain that iterating to `last` would reprocess a corner and break the cycle logic.
- Question 7: Must state `O(N^2)` time and `O(1)` extra space for the in-place solution.
- Question 8: Must mention that the center cell in an odd-sized matrix remains unchanged and needs no special move.

## Concepts
- core concepts: matrix rotation, in-place mutation, coordinate mapping, clockwise rotation
- algorithm structure: layers, rings, outer-to-inner traversal, offset, 4-way swap
- complexity: `O(N^2)` time, `O(1)` space, square matrix constraint
- interview focus: edge cases, index math, swap ordering, correctness under mutation
