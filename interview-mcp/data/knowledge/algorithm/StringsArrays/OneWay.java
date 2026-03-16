package algorithm.StringsArrays;

public class OneWay {

    public static void main(String[] args) {
        System.out.println(oneWay("ab", "ba"));
        System.out.println(oneWay("pales", "pale"));
        System.out.println(oneWay("pale", "bale"));
        System.out.println(oneWay("pale", "bake"));
    }

    private static boolean oneWay(String s1, String s2) {
        if (s1 == null || s2 == null) {
            return false;
        }
        if (s1.length() > s2.length()) {
            return helper(s1, s2);
        } else {
            return helper(s2, s1);
        }
    }

    private static boolean helper(String larger, String shorter) {
        int count = 0;

        if (larger.length() - shorter.length() > 1) {
            return false;
        }
        int i = 0;
        int j = 0;

        while (j < larger.length() && i < shorter.length()) {
            char cL = larger.charAt(j);
            char cS = shorter.charAt(i);
            if (count > 1) {
                return false;
            }
            if (cL != cS) {
                count++;
                if (larger.length() == shorter.length()) {
                    i++;
                    j++;
                } else {
                    j++;
                }
            } else {
                i++;
                j++;
            }

        }

        return count <= 1;
    }
}