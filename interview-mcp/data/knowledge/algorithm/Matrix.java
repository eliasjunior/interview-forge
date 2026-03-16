public class Matrix {
    public static void main(String[] args) {
        int[][] matrix = {
                { 1, 2, 3, 4 },
                { 5, 6, 7, 8 },
                { 9, 10, 11, 12 },
                { 13, 14, 15, 16 }
        };

        // reverse each row
        // reverse each col

        // r = 0,
        // n-1 -> 0
        // n-2 -> 1
        int n = matrix[0].length;
        for (int r = 0; r < matrix.length; r++) {
            int start = 0;
            int end = n - 1;
            while (start < end) {
                int aux = matrix[r][end];
                matrix[r][end] = matrix[r][start];
                matrix[r][start] = aux;
                end--;
                start++;
            }

        }

        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < matrix.length; i++) {

            for (int j = 0; j < matrix.length; j++) {
                builder.append(matrix[i][j]).append(" ");
            }
            builder.append("\n");
        }
        System.out.println(builder.toString());
    }
}
