import java.util.ArrayList;
import java.util.List;

public class RotateMatrix {
    private static final long DEFAULT_PAUSE_MS = 1500;
    private static final int CELL_WIDTH = 4;
    private static final int MIN_LEFT_PANEL_WIDTH = 58;
    private static final int CODE_PANEL_WIDTH = 54;
    private static final String ANSI_RESET = "\u001B[0m";
    private static final String ANSI_BOLD_YELLOW = "\u001B[1;33m";
    private static final String ANSI_BOLD_RED = "\u001B[1;31m";
    private static final String ANSI_CLEAR_SCREEN = "\u001B[2J";
    private static final String ANSI_CURSOR_HOME = "\u001B[H";
    private static final String MANUAL_MODE = "manual";
    private static final String CLEAR_MODE = "clear";
    private static final String[] CODE_VIEW = {
        "for (int layer = 0; layer < n / 2; layer++) {",
        "    int first = layer;",
        "    int last = n - 1 - layer;",
        "",
        "    for (int i = first; i < last; i++) {",
        "        int offset = i - first;",
        "",
        "        int top = matrix[first][i];",
        "",
        "        matrix[first][i] = matrix[last - offset][first];",
        "        matrix[last - offset][first] = matrix[last][last - offset];",
        "        matrix[last][last - offset] = matrix[i][last];",
        "        matrix[i][last] = top;",
        "    }",
        "}"
    };
    private static final int CODE_LINE_LAYER_LOOP = 0;
    private static final int CODE_LINE_FIRST = 1;
    private static final int CODE_LINE_LAST = 2;
    private static final int CODE_LINE_INNER_LOOP = 4;
    private static final int CODE_LINE_OFFSET = 5;
    private static final int CODE_LINE_SAVE_TOP = 7;
    private static final int CODE_LINE_STEP_1 = 9;
    private static final int CODE_LINE_STEP_2 = 10;
    private static final int CODE_LINE_STEP_3 = 11;
    private static final int CODE_LINE_STEP_4 = 12;

    public static void rotate(int[][] matrix, long pauseMs, boolean manualMode, boolean clearMode) throws InterruptedException {
        int n = matrix.length;
        boolean[][] touched = new boolean[n][n];

        renderState(
            "Initial matrix",
            matrix,
            touched,
            new int[0],
            -1,
            clearMode,
            "Starting state before any layer is processed."
        );
        pause(pauseMs, manualMode);

        for (int layer = 0; layer < n / 2; layer++) {
            int first = layer;
            int last = n - 1 - layer;

            renderState(
                "Layer " + layer + " setup",
                matrix,
                touched,
                new int[0],
                CODE_LINE_LAYER_LOOP,
                clearMode,
                "first = " + first + ", last = " + last,
                "Preparing the current ring."
            );
            pause(pauseMs, manualMode);

            for (int i = first; i < last; i++) {
                int offset = i - first;

                int topRow = first;
                int topCol = i;

                int rightRow = i;
                int rightCol = last;

                int bottomRow = last;
                int bottomCol = last - offset;

                int leftRow = last - offset;
                int leftCol = first;

                int top = matrix[topRow][topCol];

                renderState(
                    "Cycle " + (i - first + 1) + " in layer " + layer,
                    matrix,
                    touched,
                    new int[] {topRow, topCol, rightRow, rightCol, bottomRow, bottomCol, leftRow, leftCol},
                    CODE_LINE_OFFSET,
                    clearMode,
                    "i = " + i + ", offset = " + offset,
                    "top    = (" + topRow + "," + topCol + ") -> " + matrix[topRow][topCol],
                    "right  = (" + rightRow + "," + rightCol + ") -> " + matrix[rightRow][rightCol],
                    "bottom = (" + bottomRow + "," + bottomCol + ") -> " + matrix[bottomRow][bottomCol],
                    "left   = (" + leftRow + "," + leftCol + ") -> " + matrix[leftRow][leftCol]
                );
                pause(pauseMs, manualMode);

                matrix[topRow][topCol] = matrix[leftRow][leftCol];
                touched[topRow][topCol] = true;
                renderState(
                    "Step 1: left -> top",
                    matrix,
                    touched,
                    new int[] {topRow, topCol},
                    CODE_LINE_STEP_1,
                    clearMode,
                    "matrix[" + topRow + "][" + topCol + "] now takes value from (" + leftRow + "," + leftCol + ")."
                );
                pause(pauseMs, manualMode);

                matrix[leftRow][leftCol] = matrix[bottomRow][bottomCol];
                touched[leftRow][leftCol] = true;
                renderState(
                    "Step 2: bottom -> left",
                    matrix,
                    touched,
                    new int[] {leftRow, leftCol},
                    CODE_LINE_STEP_2,
                    clearMode,
                    "matrix[" + leftRow + "][" + leftCol + "] now takes value from (" + bottomRow + "," + bottomCol + ")."
                );
                pause(pauseMs, manualMode);

                matrix[bottomRow][bottomCol] = matrix[rightRow][rightCol];
                touched[bottomRow][bottomCol] = true;
                renderState(
                    "Step 3: right -> bottom",
                    matrix,
                    touched,
                    new int[] {bottomRow, bottomCol},
                    CODE_LINE_STEP_3,
                    clearMode,
                    "matrix[" + bottomRow + "][" + bottomCol + "] now takes value from (" + rightRow + "," + rightCol + ")."
                );
                pause(pauseMs, manualMode);

                matrix[rightRow][rightCol] = top;
                touched[rightRow][rightCol] = true;
                renderState(
                    "Step 4: saved top -> right",
                    matrix,
                    touched,
                    new int[] {rightRow, rightCol},
                    CODE_LINE_STEP_4,
                    clearMode,
                    "matrix[" + rightRow + "][" + rightCol + "] now receives the saved top value " + top + "."
                );
                pause(pauseMs, manualMode);
            }
        }

        renderState(
            "Final rotated matrix",
            matrix,
            touched,
            new int[0],
            -1,
            clearMode,
            "Rotation complete."
        );
    }

    private static void pause(long pauseMs, boolean manualMode) throws InterruptedException {
        if (manualMode) {
            System.out.print("Press Enter to continue...");
            try {
                while (System.in.read() != '\n') {
                    // consume input until Enter
                }
            } catch (java.io.IOException e) {
                throw new RuntimeException("Failed to read manual step input", e);
            }
            return;
        }

        Thread.sleep(pauseMs);
    }

    private static void renderState(
        String title,
        int[][] matrix,
        boolean[][] touched,
        int[] activePositions,
        int activeCodeLine,
        boolean clearMode,
        String... details
    ) {
        List<String> leftLines = buildLeftPanel(title, matrix, touched, activePositions, details);
        List<String> rightLines = buildCodePanel(activeCodeLine);
        int leftPanelWidth = computeLeftPanelWidth(matrix, details);
        if (clearMode) {
            clearScreen();
        }
        printSideBySide(leftLines, rightLines, leftPanelWidth);
    }

    private static void clearScreen() {
        System.out.print(ANSI_CLEAR_SCREEN);
        System.out.print(ANSI_CURSOR_HOME);
        System.out.flush();
    }

    private static boolean containsPosition(int[] highlightedPositions, int row, int col) {
        for (int i = 0; i < highlightedPositions.length - 1; i += 2) {
            if (highlightedPositions[i] == row && highlightedPositions[i + 1] == col) {
                return true;
            }
        }
        return false;
    }

    private static String repeat(char ch, int count) {
        StringBuilder sb = new StringBuilder(count);
        for (int i = 0; i < count; i++) {
            sb.append(ch);
        }
        return sb.toString();
    }

    private static boolean hasTouchedCells(boolean[][] touched) {
        for (boolean[] row : touched) {
            for (boolean cell : row) {
                if (cell) {
                    return true;
                }
            }
        }
        return false;
    }

    private static List<String> buildLeftPanel(
        String title,
        int[][] matrix,
        boolean[][] touched,
        int[] activePositions,
        String... details
    ) {
        List<String> lines = new ArrayList<>();
        lines.add(title);
        lines.add(repeat('=', title.length()));
        for (String detail : details) {
            lines.add(detail);
        }
        if (details.length > 0) {
            lines.add("");
        }

        for (int row = 0; row < matrix.length; row++) {
            StringBuilder matrixRow = new StringBuilder();
            for (int col = 0; col < matrix[row].length; col++) {
                boolean isActive = containsPosition(activePositions, row, col);
                boolean isTouched = touched != null && touched[row][col];

                if (isActive) {
                    matrixRow.append(ANSI_BOLD_YELLOW);
                } else if (isTouched) {
                    matrixRow.append(ANSI_BOLD_RED);
                }
                matrixRow.append(String.format("%4d", matrix[row][col]));
                if (isActive || isTouched) {
                    matrixRow.append(ANSI_RESET);
                }
            }
            lines.add(matrixRow.toString());

            StringBuilder markers = new StringBuilder();
            boolean rowHasMarker = false;
            for (int col = 0; col < matrix[row].length; col++) {
                boolean isActive = containsPosition(activePositions, row, col);
                boolean isTouched = touched != null && touched[row][col];
                if (isActive || isTouched) {
                    rowHasMarker = true;
                }

                char markerChar = isActive ? '^' : (isTouched ? '-' : ' ');
                markers.append(repeat(markerChar, CELL_WIDTH));
            }
            if (rowHasMarker) {
                markers.append("  < row ").append(row);
            }
            lines.add(markers.toString());
        }

        if (activePositions.length > 0 || hasTouchedCells(touched)) {
            lines.add("");
            lines.add("^ active write   - already touched");
        }
        return lines;
    }

    private static List<String> buildCodePanel(int activeCodeLine) {
        List<String> lines = new ArrayList<>();
        lines.add("Java code");
        lines.add("=========");
        for (int i = 0; i < CODE_VIEW.length; i++) {
            String prefix = i == activeCodeLine ? ">> " : "   ";
            lines.add(prefix + CODE_VIEW[i]);
        }
        return lines;
    }

    private static int computeLeftPanelWidth(int[][] matrix, String... details) {
        int matrixWidth = matrix.length == 0 ? MIN_LEFT_PANEL_WIDTH : matrix[0].length * CELL_WIDTH;
        int markerWidth = matrixWidth + "  < row 99".length();
        int detailsWidth = 0;
        for (String detail : details) {
            detailsWidth = Math.max(detailsWidth, visibleLength(detail));
        }
        int legendWidth = visibleLength("^ active write   - already touched");
        int contentWidth = Math.max(Math.max(matrixWidth, markerWidth), Math.max(detailsWidth, legendWidth));
        return Math.max(MIN_LEFT_PANEL_WIDTH, contentWidth + 4);
    }

    private static void printSideBySide(List<String> leftLines, List<String> rightLines, int leftPanelWidth) {
        int totalLines = Math.max(leftLines.size(), rightLines.size());
        System.out.println();
        for (int i = 0; i < totalLines; i++) {
            String left = i < leftLines.size() ? leftLines.get(i) : "";
            String right = i < rightLines.size() ? rightLines.get(i) : "";
            System.out.printf("%-" + leftPanelWidth + "s | %-" + CODE_PANEL_WIDTH + "s%n", left, right);
        }
    }

    private static int visibleLength(String value) {
        return value.replaceAll("\u001B\\[[;\\d]*m", "").length();
    }

    public static void main(String[] args) throws InterruptedException {
        long pauseMs = DEFAULT_PAUSE_MS;
        boolean manualMode = false;
        boolean clearMode = false;

        if (args.length > 0) {
            if (MANUAL_MODE.equalsIgnoreCase(args[0])) {
                manualMode = true;
            } else if (CLEAR_MODE.equalsIgnoreCase(args[0])) {
                clearMode = true;
            } else {
                pauseMs = Long.parseLong(args[0]);
            }
        }

        if (args.length > 1) {
            if (MANUAL_MODE.equalsIgnoreCase(args[1])) {
                manualMode = true;
            } else if (CLEAR_MODE.equalsIgnoreCase(args[1])) {
                clearMode = true;
            }
        }

        if (args.length > 2) {
            if (MANUAL_MODE.equalsIgnoreCase(args[2])) {
                manualMode = true;
            } else if (CLEAR_MODE.equalsIgnoreCase(args[2])) {
                clearMode = true;
            }
        }

        int[][] matrix = {
            {1, 2, 3, 4},
            {5, 6, 7, 8},
            {9, 10, 11, 12},
            {13, 14, 15, 16}
        };

        if (manualMode) {
            System.out.println("Pause mode: manual (press Enter between states)");
        } else {
            System.out.println("Pause per step: " + pauseMs + " ms");
        }
        System.out.println("Screen redraw: " + (clearMode ? "enabled" : "disabled"));
        rotate(matrix, pauseMs, manualMode, clearMode);
    }
}
