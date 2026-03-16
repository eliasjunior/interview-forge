# a must do before more complex matrix problems

## Core idea
Before solving harder matrix problems like rotate matrix, spiral traversal, or set matrix zeroes, get comfortable with matrix coordinates and movement. Most confusion comes from not yet seeing a matrix as a grid of addresses.

## Think in coordinates first
A matrix is not just a picture or a table. Each value lives at:

- row index
- column index

Example:

```text
a b c
d e f
g h i
```

is really:

```text
(0,0) (0,1) (0,2)
(1,0) (1,1) (1,2)
(2,0) (2,1) (2,2)
```

Everything in matrix problems is based on moving across these coordinates.

## Fundamentals to master first

### 1. Name positions quickly
Practice until these feel automatic:

- what is at `(2,1)`?
- where is top-left?
- where is bottom-right?
- where is the center?
- what does `matrix[r][c]` mean?

### 2. Learn the four basic moves

- right: `(r, c + 1)`
- left: `(r, c - 1)`
- down: `(r + 1, c)`
- up: `(r - 1, c)`

### 3. Learn matrix boundaries
In an `n x n` matrix:

- first row = `0`
- first column = `0`
- last row = `n - 1`
- last column = `n - 1`

If `n = 4`, valid indices are:

- `0, 1, 2, 3`

That `n - 1` pattern appears constantly in matrix problems.

### 4. Practice common coordinate patterns
Before rotation, get used to identifying:

- first row
- last row
- first column
- last column
- main diagonal
- anti-diagonal

Examples:

- main diagonal: `(0,0), (1,1), (2,2)`
- anti-diagonal: `(0,n-1), (1,n-2), (2,n-3)`

## Why offset feels confusing
`offset` is not a magic formula. It just means:

- how far you moved from the start of the current layer

In rotate matrix:

- `first` = start of the current layer
- `i` = current position along the top edge
- `offset = i - first`

So offset is simply:

- `0` steps from start
- `1` step from start
- `2` steps from start

It is just distance within the current ring.

## Best learning path

### Step 1. Do coordinate drills on paper
Practice:

- given `(r,c)`, point to the cell
- given a cell, write its coordinates
- given `n = 5`, identify the last index
- find the cell below `(2,3)`
- find the cell left of `(1,1)`

### Step 2. Practice simple traversals

- row by row
- column by column
- reverse row
- reverse column
- diagonals
- border only

### Step 3. Practice mapping problems

- transpose
- reverse each row
- reverse each column
- rotate using an extra matrix first

Do not start with in-place rotation first.

### Step 4. Then move to layer-based problems

- spiral traversal
- rotate matrix
- set matrix zeroes
- search in sorted matrix

## A useful mental model
Most matrix problems fall into one of these patterns:

- traverse
- map one coordinate to another
- swap symmetric positions
- process a boundary or layer

## What to write when stuck
When a matrix problem feels confusing, write these four things first:

- matrix size `n`
- current position `(r,c)`
- last index `n - 1`
- where the current position should move

This forces the problem into coordinates instead of pure visual guessing.

## Practical advice
Use paper and label each cell with coordinates before using letters or values.

Example:

```text
(0,0) (0,1) (0,2) (0,3)
(1,0) (1,1) (1,2) (1,3)
(2,0) (2,1) (2,2) (2,3)
(3,0) (3,1) (3,2) (3,3)
```

Then ask:

- where does `(0,1)` move?
- where does `(3,2)` move?
- which four cells form one cycle?

This is usually much clearer than starting with letters like `a, b, c, d`.

## Final advice
Do not memorize rotate matrix directly. Build these fundamentals first:

- coordinates
- boundaries
- movement
- symmetry
- mapping

Once those become natural, more complex matrix problems become much easier to reason about.
