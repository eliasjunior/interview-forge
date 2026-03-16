# Palindrome Permutation (Brute Force) - Memory Note

- Idea: try every rearrangement (permutation) of the string, then check if any is a palindrome.
- Factorial: `n! = n * (n-1) * (n-2) * ... * 2 * 1` (all ways to order `n` items).
- Number of permutations: `n!`.
- Palindrome check per permutation: `O(n)` (compare mirrored characters).
- Total time: `O(n * n!)`.
- Space: `O(n)` recursion stack (or `O(n * n!)` if storing all permutations).
- Key takeaway: factorial growth explodes quickly, so brute force is useful for intuition/small inputs only.
