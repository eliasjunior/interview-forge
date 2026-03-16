# Interview Prep: Matrix Fundamentals With Exercises

## Goal
Build enough matrix intuition to solve interview problems like rotate matrix, spiral traversal, transpose, and set matrix zeroes without getting lost in indices.

## Core mindset
Treat a matrix as a grid of addresses, not a picture.

Each value is identified by:
- row index
- column index

Example:

```text
a b c
d e f
g h i
```

really means:

```text
(0,0) (0,1) (0,2)
(1,0) (1,1) (1,2)
(2,0) (2,1) (2,2)
```

If that feels natural, harder matrix problems get much easier.

## Interview rule
When you get stuck in a matrix problem, write these first:

- matrix size `n`
- current position `(r, c)`
- last valid index `n - 1`
- destination or matching position

This forces the problem into coordinate reasoning.

## Stage 1: Coordinate fluency

### What to learn
- top-left is `(0,0)`
- bottom-right is `(n-1, n-1)`
- `matrix[r][c]` means row `r`, column `c`
- valid indices go from `0` to `n-1`

### Drill 1
Given this matrix:

```text
(0,0) (0,1) (0,2) (0,3)
(1,0) (1,1) (1,2) (1,3)
(2,0) (2,1) (2,2) (2,3)
(3,0) (3,1) (3,2) (3,3)
```

Answer:
- What is the bottom-left coordinate?
- What is the coordinate to the right of `(2,1)`?
- What is the coordinate above `(3,2)`?
- What is the last valid column when `n = 4`?

### Drill 2
Use a `5 x 5` matrix. Answer:
- What is the center?
- What is the last valid row?
- Is `(5,1)` valid?
- Is `(4,4)` valid?

### Checkpoint
You should be able to point to any `(r, c)` quickly without hesitation.

## Stage 2: Basic movement

### Movement formulas
- right: `(r, c + 1)`
- left: `(r, c - 1)`
- down: `(r + 1, c)`
- up: `(r - 1, c)`

### Drill 3
Starting from `(2,2)`, write the coordinate after moving:
- right once
- left once
- down once
- up once
- right twice
- up then left

### Drill 4
Which of these moves are invalid in a `4 x 4` matrix?
- left from `(0,0)`
- up from `(1,3)`
- down from `(3,2)`
- right from `(2,3)`

### Checkpoint
You should be able to describe matrix movement like grid navigation.

## Stage 3: Boundaries and patterns

### Patterns to know
- first row: row `0`
- last row: row `n - 1`
- first column: column `0`
- last column: column `n - 1`
- main diagonal: `(0,0), (1,1), (2,2), ...`
- anti-diagonal: `(0,n-1), (1,n-2), (2,n-3), ...`

### Drill 5
For a `4 x 4` matrix, list:
- all coordinates in the first row
- all coordinates in the last column
- all coordinates in the main diagonal
- all coordinates in the anti-diagonal

### Drill 6
For a `5 x 5` matrix:
- what is the center?
- how many cells are on the main diagonal?
- what is the anti-diagonal coordinate when `r = 3`?

### Checkpoint
You should recognize these shapes without drawing them every time.

## Stage 4: Traversal practice

### What to practice
- row by row
- column by column
- reverse rows
- reverse columns
- border only

### Drill 7
On paper, write the coordinate order for:
- row-by-row traversal of a `3 x 3`
- column-by-column traversal of a `3 x 3`
- border-only traversal of a `4 x 4`

### Drill 8
Write pseudocode for:
- printing every row left to right
- printing every column top to bottom

### Checkpoint
You should understand when row changes and when column changes.

## Stage 5: Mapping one coordinate to another

### Why this matters
Rotate matrix is fundamentally a coordinate mapping problem.

Before learning in-place rotation, practice easier mappings:
- transpose
- reverse each row
- reverse each column
- rotate using an extra matrix

### Drill 9
For transpose, where does `(r, c)` move?

### Drill 10
For reversing each row in an `n x n` matrix, where does `(r, c)` move?

### Drill 11
For a 90-degree clockwise rotation, apply this mapping:

```text
(r, c) -> (c, n - 1 - r)
```

Compute the destination of:
- `(0,0)` in a `4 x 4`
- `(0,1)` in a `4 x 4`
- `(1,0)` in a `4 x 4`
- `(3,2)` in a `4 x 4`

### Checkpoint
You should be able to explain what happens to a single cell before thinking about the whole matrix.

## Stage 6: Layers and offset

### Core idea
For in-place rotation, the matrix is processed ring by ring.

For one layer:
- `first = layer`
- `last = n - 1 - layer`
- `offset = i - first`

`offset` means: how far you are from the start of the current ring.

### Drill 12
For a `4 x 4` matrix, outer layer:
- what are `first` and `last`?
- what values can `i` take?
- what are the offsets?

### Drill 13
For `n = 4`, `layer = 0`, compute the 4-way swap positions for:
- `i = 0`
- `i = 1`
- `i = 2`

Using:
- top = `(first, i)`
- right = `(i, last)`
- bottom = `(last, last - offset)`
- left = `(last - offset, first)`

### Checkpoint
You should see that `offset` is just distance along the current ring.

## Stage 7: Build toward rotate matrix

### Interview progression
When solving rotate matrix, reason in this order:

1. confirm the matrix is square
2. find the mapping for one cell
3. describe the extra-matrix solution first
4. move to in-place layer-by-layer swaps
5. rotate four cells at a time
6. state `O(N^2)` time and `O(1)` space

### Drill 14
Using this matrix:

```text
a b c d
e f g h
i j k l
m n o p
```

Answer:
- what does the first row become after clockwise rotation?
- what does the second row become?
- which 4 cells are involved in the first swap cycle?

### Drill 15
Explain in words:
- why the outer loop runs `n / 2` times
- why the inner loop stops at `i < last`
- why the center does not move when `n` is odd

## Common interview mistakes
- confusing rows with columns
- forgetting that last index is `n - 1`
- mixing clockwise and counterclockwise formulas
- not validating the mapping with examples
- using letters only instead of coordinates
- treating `offset` as something abstract instead of simple distance

## Best practice when studying
- draw the coordinates first
- solve small `3 x 3` and `4 x 4` examples by hand
- speak the movement out loud
- compute one cell at a time
- do not jump straight to in-place rotation

## A good study sequence
1. Coordinates
2. Movement
3. Boundaries
4. Traversal
5. Diagonals
6. Transpose
7. Reverse rows
8. Rotation with extra matrix
9. In-place rotation

## Final advice
Do not try to memorize rotate matrix as a trick.

Instead, build:
- coordinate fluency
- movement fluency
- boundary awareness
- mapping intuition
- layer intuition

If these are strong, rotate matrix becomes a normal indexing problem instead of a confusing one.
