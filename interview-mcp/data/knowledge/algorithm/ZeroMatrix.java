import java.util.HashSet;
import java.util.Set;

public class ZeroMatrix {

    public static void main(String[] args) {
        // int[][] matrix = {
        //         { 1, 0, 1 },
        //         { 1, 1, 1 },
        //         { 1, 1, 1 }
        // };
        int[][] matrix = {
                { 1, 1, 1 },
                { 1, 1, 1 },
                { 0, 1, 1 } };

        new ZeroMatrix().setZeroes(matrix);
    }

    public void setZeroes(int[][] matrix) {
        int M = matrix.length;
        int N = matrix[0].length;

        boolean firstRowHasZero = false;
        for (int j = 0; j < N; j++) {
            if (matrix[0][j] == 0) {
                firstRowHasZero = true;
                break;
            }
        }

        for (int i = 0; i < M; i++) {
            for (int j = 0; j < N; j++) {
                if (matrix[i][j] == 0) {
                    matrix[i][0] = 0;
                    matrix[0][j] = 0;
                }
            }
        }

        for (int i = 1; i < M; i++) {
            for (int j = 1; j < N; j++) {
                if (matrix[i][0] == 0 || matrix[0][j] == 0) {
                    matrix[i][j] = 0;
                }
            }
        }
        // Step 4: handle first column using matrix[i][0]
        if (matrix[0][0] == 0) {
            for (int i = 0; i < M; i++) {
                matrix[i][0] = 0;
            }
        }

        // Step 5: handle first row using firstRowHasZero
        if (firstRowHasZero) {
            for (int j = 0; j < N; j++) {
                matrix[0][j] = 0;
            }
        }
    }

}