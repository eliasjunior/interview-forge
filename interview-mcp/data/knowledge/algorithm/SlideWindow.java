package algorithm;

import java.util.ArrayList;
import java.util.List;

public class SlideWindow {

    public static void main(String[] args) {
        System.out.println("start tests");
        testCases1();
        testCases2();
        testCases3();
        testCases4();
        System.out.println("end tests");
    }

    private static int[] findPermutation(String b, String s) {
        // edge cases, make sure s < b
        if (s.length() > b.length()) {
            return new int[] { 0 };
        }

        char[] bArray = b.toCharArray();
        char[] shortArray = s.toCharArray();
        int n = bArray.length;
        int m = shortArray.length;

        int[] toMachFreq = new int[26];
        for (int i = 0; i < m; i++) {
            char c = shortArray[i];
            toMachFreq[c - 'a']++;
        }

        int[] freq = new int[26];
        List<Integer> result = new ArrayList<>();

        for (int i = 0; i <= n - m; i++) {
            for (int j = i; j < i + m; j++) {
                char c = bArray[j];
                freq[c - 'a'] = freq[c - 'a'] + 1;
            }
            boolean isMatched = compareFreq(freq, toMachFreq, s);
            freq = new int[26];
            if (isMatched) {
                result.add(i);
            }
        }
        return result
                .stream()
                .mapToInt(Integer::intValue)
                .toArray();
    }

    private static boolean compareFreq(int[] freq, int[] toMachFreq, String s) {
        int i = 0;
        while (i < toMachFreq.length && toMachFreq[i] == freq[i]) {
            i++;
        }
        return i == toMachFreq.length;
    }


    private static void testCases1() {
        String s = "abbc";
        String b = "aacbbaaabcb";
        int[] expected = { 1, 2, 7 };
        int[] actual = findPermutation(b, s);
        assert java.util.Arrays.equals(actual, expected) : "Expected: " + java.util.Arrays.toString(expected) +
                " but got: " + java.util.Arrays.toString(actual);
    }

    private static void testCases2() {
        String s = "abbc";
        String b = "abcbbbcaefsdcccccbbab";
        int[] expected = { 0, 4, 16 };
        int[] actual = findPermutation(b, s);
        assert java.util.Arrays.equals(actual, expected) : "Expected: " + java.util.Arrays.toString(expected) +
                " but got: " + java.util.Arrays.toString(actual);
    }

    private static void testCases3() {
        String s = "abbc";
        String b = "abb";
        int[] expected = { 0 };
        int[] actual = findPermutation(b, s);
        assert java.util.Arrays.equals(actual, expected) : "Expected: " + java.util.Arrays.toString(expected) +
                " but got: " + java.util.Arrays.toString(actual);
    }

    private static void testCases4() {
        String s = "ab";
        String b = "abxaba";
        int[] expected = { 0, 3, 4};
        int[] actual = findPermutation(b, s);
        assert java.util.Arrays.equals(actual, expected) : "Expected: " + java.util.Arrays.toString(expected) +
                " but got: " + java.util.Arrays.toString(actual);
    }
}

// m is the size of shot string, 2, valid is 1
// n is the large string, 6
// what is the largest index i 'abxaba' valid= 5
// i . . . i + m - 1
// it must satisfy
// i + m - 1 < n
// then solve it
// i <= n - m -> [5 <= 6 - 2]

// end = start(i) + m - 1
//
// for (int j = i; j < i + m)
// where start is i, but m itself cannot be last, it need size m and current
// array i(outer loop)