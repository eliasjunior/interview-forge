# Rotate Matrix

## Summary
Rotate an `N x N` matrix by 90 degrees clockwise, in place, without allocating a second matrix. The core idea is to process the matrix layer by layer (outer ring to inner ring) and rotate four cells at a time. For each position in a layer, perform a 4-way swap: left to top, bottom to left, right to bottom, top to right.

Key properties:
- In-place: uses constant extra space, not another `N x N` matrix
- Layer-based: processes the matrix as concentric square rings
- 4-way swap: each move rotates four corresponding cells
- Deterministic mapping: `(r, c) -> (c, N - 1 - r)` for clockwise rotation

A strong candidate can derive the coordinate mapping from first principles, implement the layer loop without off-by-one errors, explain the alternative transpose-then-reverse approach, and reason about edge cases (empty matrix, 1×1, odd-sized center cell).

---

## Questions

1. Why does this problem require an `N x N` matrix, and what breaks if the matrix is not square?
2. What is the coordinate mapping for a cell `(r, c)` after a 90-degree clockwise rotation?
3. How would you solve this with an extra matrix first, and why is that not in place?
4. How do layers work in the in-place solution, and why do you only iterate to `n / 2` layers?
5. Which four coordinates participate in one rotation step for a given layer and offset?
6. Why do you stop the inner loop at `last - 1` instead of `last`?
7. What are the time and space complexities of the in-place approach?
8. What happens for odd-sized matrices, especially the center cell?
9. Explain the transpose-then-reverse approach. Why does it produce a clockwise rotation?
10. How would you rotate the matrix 90 degrees counter-clockwise? What changes?
11. How would you rotate by 180 degrees? What is the most efficient approach?
12. What edge cases should your solution handle, and how does your code behave on a 1×1 or empty matrix?
13. How would you generalize this algorithm to rotate a rectangular (non-square) matrix by 90 degrees?
14. If the matrix values represent pixel RGB data and the matrix is 4000×4000, what performance considerations apply and how would you optimize the in-place rotation?

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

---

## Evaluation Criteria

- Question 1: Must state that 90-degree in-place rotation assumes a square matrix because dimensions must remain aligned after rotation. For an M×N matrix (M≠N), the result is an N×M matrix — different dimensions, so in-place is impossible without extra space. Weak answer: says "because the problem says so" without explaining shape constraints.
- Question 2: Must give the clockwise mapping `(r, c) -> (c, N - 1 - r)`. Derivation: a point at (r, c) in an N×N matrix moves to row=c, col=N-1-r after clockwise rotation. Bonus: validates it with a small 4×4 example (e.g. corner (0,0) → (0,N-1), top-right (0,N-1) → (N-1,N-1), etc.).
- Question 3: Must describe the auxiliary-matrix approach: allocate a new N×N matrix, apply the mapping `result[c][N-1-r] = matrix[r][c]` for all (r,c), then copy back. Must identify the O(N²) extra space cost. Weak answer: only says "copy values" without showing the mapping or explaining why extra space is needed.
- Question 4: Must explain outer-to-inner layer processing: layer 0 is the outermost ring, layer 1 is the next inner ring, and so on. The number of layers is `n / 2` — integer division handles both even (all layers have pairs) and odd (center layer is a single cell that doesn't move) correctly. Bonus: calls them rings or shells, notes that for a 4×4 matrix there are 2 layers.
- Question 5: Must identify the four-way swap positions for `first=layer`, `last=n-1-layer`, `offset=i-first`: (first, first+offset) → top, (first+offset, last) → right, (last, last-offset) → bottom, (last-offset, first) → left. Or equivalently in terms of the standard implementation: save top = matrix[first][i], then left→top, bottom→left, right→bottom, top→right. Weak answer: understands swapping in general but cannot map the coordinates.
- Question 6: Must explain that iterating to `last` (inclusive) would reprocess the corner cell that was already moved in the first iteration (offset=0). The corner belongs to the current layer's starting position; processing it again at offset=last-first would incorrectly move it a second time, breaking the cycle. The inner loop range is `[first, last)`, i.e. `i < last`.
- Question 7: Must state O(N²) time — every cell is visited exactly once. O(1) extra space — the in-place swap uses only a single temporary variable regardless of N. Weak: says O(N) time or O(N²) space.
- Question 8: Must mention that the center cell in an odd-sized matrix (e.g. 3×3, 5×5) sits at the intersection of all four symmetry axes. A 90-degree rotation maps the center cell to itself — it stays in place. The layer loop naturally handles this because `n / 2` for an odd N does not include the center layer. No special-case code needed. Bonus: demonstrates with a 3×3 matrix where `n/2=1`, so only layer 0 is processed and the center cell at (1,1) is untouched.
- Question 9: Must explain the two-step transpose-then-reverse approach: (1) transpose the matrix in place — swap matrix[i][j] with matrix[j][i] for i < j; (2) reverse each row — swap matrix[i][j] with matrix[i][n-1-j]. This produces a clockwise 90-degree rotation. Intuition: transpose flips along the main diagonal; reversing rows then "flips" the result horizontally, which combined equals a clockwise rotation. Must note: this is equivalent to the 4-way swap approach in time and space complexity but is often easier to implement without index arithmetic bugs.
- Question 10: Must explain: counter-clockwise rotation is the inverse of clockwise. Two equivalent approaches: (1) transpose then reverse each column (instead of each row); (2) reverse each row first, then transpose. Alternatively, apply the clockwise rotation three times. Coordinate mapping: (r, c) → (N-1-c, r). Weak: applies clockwise mapping without recognizing the change needed.
- Question 11: Must explain: 180-degree rotation = two consecutive 90-degree clockwise rotations, or equivalently, reverse all rows then reverse each row, or directly map (r, c) → (N-1-r, N-1-c). The most efficient approach: a single pass reversing each element against its 180-degree partner — swap matrix[r][c] with matrix[N-1-r][N-1-c] for r from 0 to N/2 (plus handle the middle row for odd N). O(N²) time, O(1) space.
- Question 12: Must address: empty matrix (n=0) — loop does not execute, safe; 1×1 matrix — n/2=0, no iterations, correct (no rotation needed); 2×2 — one layer, offset range [0,1), only offset=0 (one corner rotation cycle); odd-sized — center cell untouched as explained. Must state that the implementation should check for null or empty input before accessing matrix[0].length to avoid ArrayIndexOutOfBoundsException.
- Question 13: Must explain: for an M×N matrix (M≠N), a 90-degree clockwise rotation produces an N×M result — a different shape. In-place rotation is impossible without extra space because the result dimensions differ. Approach: allocate result[N][M], apply mapping: result[c][M-1-r] = matrix[r][c] for all (r,c) in M×N. This is O(M×N) time and O(M×N) space. Alternatively, can operate in-place using cycle-based permutation if the caller accepts the original memory being reinterpreted — requires careful bookkeeping. Bonus: mention that most "rotate matrix" problems restrict to square matrices precisely to enable in-place rotation.
- Question 14: Must identify: for a 4000×4000 matrix, the data is 4000×4000×3 bytes ≈ 48 MB (assuming 3 bytes per pixel). The naive in-place 4-way swap processes cells row-by-row but the access pattern jumps across rows (column accesses for a large matrix are cache-unfriendly). Optimization: process in cache-friendly blocks (block decomposition / tiling) — rotate each B×B tile independently to keep working set in L1/L2 cache. Block size should fit in cache (e.g. 64 bytes × 64 bytes fits in 4 KB cache lines). Must acknowledge: in-place rotation still has O(N²) time; the optimization is about constant-factor cache efficiency. Bonus: SIMD intrinsics for block transposition in performance-critical contexts.

## Concepts
- core concepts: matrix-rotation, in-place-mutation, coordinate-mapping, clockwise-rotation, layer-traversal, 4-way-swap, transpose
- algorithm-structure: layers, rings, outer-to-inner-traversal, offset, 4-way-swap, transpose-then-reverse
- complexity: O(N²)-time, O(1)-space, square-matrix-constraint, cache-efficiency, block-decomposition
- interview-focus: edge-cases, index-math, swap-ordering, correctness-under-mutation, off-by-one, derivation-from-first-principles
