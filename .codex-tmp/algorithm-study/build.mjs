import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = new URL("../../outputs/algorithm-study/", import.meta.url);
const previewDir = new URL("./previews/", import.meta.url);
await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });

const workbook = Workbook.create();
const dashboard = workbook.worksheets.add("Dashboard");
const tracker = workbook.worksheets.add("Problem Tracker");
const patterns = workbook.worksheets.add("Pattern Library");

const colors = {
  navy: "#172554",
  blue: "#2563EB",
  cyan: "#0891B2",
  paleBlue: "#EFF6FF",
  paleCyan: "#ECFEFF",
  paleGreen: "#ECFDF5",
  paleAmber: "#FFFBEB",
  paleRed: "#FEF2F2",
  gray50: "#F8FAFC",
  gray100: "#F1F5F9",
  gray200: "#E2E8F0",
  gray500: "#64748B",
  gray800: "#1E293B",
  white: "#FFFFFF",
  green: "#059669",
  amber: "#D97706",
  red: "#DC2626",
};

const applyTitle = (sheet, range, title) => {
  sheet.mergeCells(range);
  const cell = sheet.getRange(range);
  cell.values = [[title]];
  cell.format.fill = colors.navy;
  cell.format.font = { bold: true, color: colors.white, size: 18 };
  cell.format.horizontalAlignment = "left";
  cell.format.verticalAlignment = "center";
  cell.format.rowHeightPx = 44;
};

const applySectionHeader = (range) => {
  range.format.fill = colors.blue;
  range.format.font = { bold: true, color: colors.white, size: 10 };
  range.format.verticalAlignment = "center";
  range.format.wrapText = true;
  range.format.borders = { preset: "all", style: "thin", color: "#BFDBFE" };
};

// Problem Tracker
tracker.showGridLines = false;
applyTitle(tracker, "A1:J1", "Coding / Algorithms Pattern Recognition Tracker");
tracker.mergeCells("A2:J2");
tracker.getRange("A2").values = [[
  "After each problem, capture the recognition pattern, the exact point of friction, the mistake to avoid, and when to test recall again."
]];
tracker.getRange("A2:J2").format = {
  fill: colors.paleBlue,
  font: { color: colors.gray800, italic: true, size: 10 },
  wrapText: true,
  verticalAlignment: "center",
  rowHeightPx: 34,
};

const trackerHeaders = [[
  "Problem",
  "Pattern",
  "Difficulty",
  "Tricky Part",
  "Mental Model",
  "Common Mistake",
  "Complexity",
  "Re-solved Without Help?",
  "Date Last Reviewed",
  "Next Review",
]];
tracker.getRange("A4:J4").values = trackerHeaders;
applySectionHeader(tracker.getRange("A4:J4"));
tracker.getRange("A4:J4").format.rowHeightPx = 42;

const starterProblems = [
  [
    "Two Sum",
    "Hash Map - Complement Lookup",
    "Easy",
    "We do NOT store the current value. We store what value would complete the target.\n\nTarget = 9\nCurrent = 2\nNeed = 7\n\nMap:\n7 -> index 0\n\nLater:\nCurrent = 7\n\nCheck:\nDoes map contain 7?\nYES -> answer found",
    "Store the value needed to complete the target, mapped to the current index. For each new number, first check whether that number is already a needed complement.",
    "Trying to search for the complement after inserting the current number, causing confusion with duplicates.",
    "Time O(n), Space O(n)",
    "Yes",
    new Date("2026-06-09T00:00:00Z"),
    "7 days",
  ],
  ["Valid Anagram", "Frequency Counting", "Easy", "Choosing counts instead of sorting", "Equal multisets have equal frequency maps", "", "Time O(n), Space O(k)", "", null, "14 days"],
  ["Longest Substring Without Repeating Characters", "Sliding Window", "Medium", "Moving the left pointer far enough after a duplicate", "Maintain the longest valid window; repair only when invalid", "", "Time O(n), Space O(k)", "", null, "3 days"],
  ["3Sum", "Two Pointers", "Medium", "Skipping duplicates without missing combinations", "Sort, fix one value, then squeeze the remaining search space", "", "Time O(n^2), Space O(1)*", "", null, "3 days"],
  ["Merge Intervals", "Intervals", "Medium", "Separating overlap detection from merge action", "Sort by start; the latest merged interval summarizes the past", "", "Time O(n log n), Space O(n)", "", null, "7 days"],
  ["Binary Tree Level Order Traversal", "Breadth-First Search", "Medium", "Preserving level boundaries in the queue", "Queue size at loop start is the current level width", "", "Time O(n), Space O(w)", "", null, "7 days"],
  ["Validate Binary Search Tree", "Depth-First Search", "Medium", "Checking global bounds rather than only parent-child values", "Every node inherits an allowed value interval", "", "Time O(n), Space O(h)", "", null, "3 days"],
  ["Number of Islands", "Graph Traversal", "Medium", "Marking visited at the correct moment", "Each unvisited land cell starts one component flood-fill", "", "Time O(mn), Space O(mn)", "", null, "7 days"],
  ["Course Schedule", "Topological Sort", "Medium", "Connecting cycle detection to feasibility", "A valid dependency order exists only if all nodes can be removed", "", "Time O(V+E), Space O(V+E)", "", null, "3 days"],
  ["Kth Largest Element in an Array", "Heap", "Medium", "Selecting heap size and direction", "Keep only the best k candidates seen so far", "", "Time O(n log k), Space O(k)", "", null, "7 days"],
  ["Coin Change", "Dynamic Programming", "Medium", "Defining the state and impossible sentinel", "dp[x] is the fewest coins needed to build amount x", "", "Time O(amount*c), Space O(amount)", "", null, "1 day"],
  ["Search in Rotated Sorted Array", "Binary Search", "Medium", "Determining which half is sorted", "One side is always ordered; test whether the target belongs there", "", "Time O(log n), Space O(1)", "", null, "3 days"],
];

const blankRows = Array.from({ length: 38 }, () => ["", "", "", "", "", "", "", "", null, ""]);
tracker.getRange("A5:J54").values = [...starterProblems, ...blankRows];
tracker.getRange("A5:J54").format = {
  fill: colors.white,
  font: { color: colors.gray800, size: 10 },
  verticalAlignment: "top",
  wrapText: true,
  borders: { preset: "all", style: "thin", color: colors.gray200 },
};
tracker.getRange("A5:A54").format.font = { bold: true, color: colors.gray800, size: 10 };
tracker.getRange("A5:J54").format.rowHeightPx = 50;
tracker.getRange("A5:J5").format.rowHeightPx = 300;
tracker.getRange("A5:A54").format.columnWidthPx = 215;
tracker.getRange("B5:B54").format.columnWidthPx = 175;
tracker.getRange("C5:C54").format.columnWidthPx = 90;
tracker.getRange("D5:D54").format.columnWidthPx = 285;
tracker.getRange("E5:E54").format.columnWidthPx = 285;
tracker.getRange("F5:F54").format.columnWidthPx = 265;
tracker.getRange("G5:G54").format.columnWidthPx = 165;
tracker.getRange("H5:H54").format.columnWidthPx = 145;
tracker.getRange("I5:I54").format.columnWidthPx = 130;
tracker.getRange("J5:J54").format.columnWidthPx = 100;
tracker.getRange("C5:C54").dataValidation = {
  rule: { type: "list", values: ["Easy", "Medium", "Hard"] },
};
tracker.getRange("H5:H54").dataValidation = {
  rule: { type: "list", values: ["Yes", "No"] },
};
tracker.getRange("I5:I54").setNumberFormat("yyyy-mm-dd");
tracker.getRange("J5:J54").dataValidation = {
  rule: { type: "list", values: ["New", "1 day", "3 days", "7 days", "14 days", "30 days", "Mastered"] },
};
tracker.getRange("C5:C54").conditionalFormats.add("containsText", {
  text: "Easy",
  format: { fill: colors.paleGreen, font: { color: colors.green, bold: true } },
});
tracker.getRange("C5:C54").conditionalFormats.add("containsText", {
  text: "Medium",
  format: { fill: colors.paleAmber, font: { color: colors.amber, bold: true } },
});
tracker.getRange("C5:C54").conditionalFormats.add("containsText", {
  text: "Hard",
  format: { fill: colors.paleRed, font: { color: colors.red, bold: true } },
});
tracker.getRange("H5:H54").conditionalFormats.add("containsText", {
  text: "Yes",
  format: { fill: colors.paleGreen, font: { color: colors.green, bold: true } },
});
tracker.getRange("H5:H54").conditionalFormats.add("containsText", {
  text: "No",
  format: { fill: colors.paleRed, font: { color: colors.red, bold: true } },
});
tracker.getRange("J5:J54").conditionalFormats.add("containsText", {
  text: "Mastered",
  format: { fill: colors.paleGreen, font: { color: colors.green, bold: true } },
});
tracker.getRange("J5:J54").conditionalFormats.add("containsText", {
  text: "1 day",
  format: { fill: colors.paleRed, font: { color: colors.red, bold: true } },
});
const trackerTable = tracker.tables.add("A4:J54", true, "AlgorithmProblemTracker");
trackerTable.style = "TableStyleMedium2";
trackerTable.showBandedRows = true;
trackerTable.showFilterButton = true;
tracker.freezePanes.freezeRows(4);

// Pattern Library
patterns.showGridLines = false;
applyTitle(patterns, "A1:E1", "Pattern Library");
patterns.mergeCells("A2:E2");
patterns.getRange("A2").values = [[
  "Use this sheet as a recognition checklist. Ask the signal questions before choosing a data structure or algorithm."
]];
patterns.getRange("A2:E2").format = {
  fill: colors.paleCyan,
  font: { color: colors.gray800, italic: true, size: 10 },
  wrapText: true,
  rowHeightPx: 32,
};
patterns.getRange("A4:E4").values = [[
  "Pattern", "Recognition Signals", "Core Invariant", "Common Trap", "Typical Complexity"
]];
applySectionHeader(patterns.getRange("A4:E4"));
const patternRows = [
  ["Hash Map", "Need fast lookup, complement, grouping, or counting", "Stored keys summarize prior observations", "Forgetting duplicates or index order", "Usually O(n) time / O(n) space"],
  ["Two Pointers", "Sorted input, pair/triplet search, inward comparison", "Pointer movement discards impossible candidates", "Moving both pointers without proof", "Usually O(n) after optional sort"],
  ["Sliding Window", "Contiguous subarray/substring with a validity rule", "Window always represents the current candidate", "Recomputing the full window state", "Usually O(n)"],
  ["Binary Search", "Monotonic answer space or ordered search region", "Discarded half cannot contain the answer", "Incorrect loop boundary or midpoint update", "O(log n)"],
  ["Intervals", "Ranges overlap, merge, schedule, or sweep", "Sorted boundaries expose local decisions", "Comparing unsorted intervals", "Usually O(n log n)"],
  ["Stack", "Nested structure, nearest greater/smaller, undo", "Stack holds unresolved items in useful order", "Popping without processing the relationship", "Usually O(n)"],
  ["Breadth-First Search", "Shortest unweighted path or level-by-level traversal", "Queue frontier has equal distance from source", "Marking visited too late", "O(V+E)"],
  ["Depth-First Search", "Explore complete branches, components, recursion", "Call stack stores the current path/context", "No base case or leaked mutable state", "O(V+E)"],
  ["Topological Sort", "Prerequisites, dependencies, ordering constraints", "Zero-indegree nodes are currently safe to schedule", "Ignoring cycles or disconnected nodes", "O(V+E)"],
  ["Heap", "Repeated min/max, top k, streaming candidates", "Root is the weakest/strongest retained candidate", "Choosing min-heap versus max-heap incorrectly", "O(n log k) for top k"],
  ["Dynamic Programming", "Overlapping subproblems and reusable optimal choices", "Each state has a precise meaning and recurrence", "Coding before defining state and transition", "Varies by state space"],
  ["Backtracking", "Generate combinations, permutations, constrained choices", "Current path is a valid partial solution", "Forgetting to undo a choice", "Often exponential"],
  ["Union-Find", "Repeated connectivity queries or merging components", "Each set has one representative root", "No path compression or rank/size union", "Near O(1) amortized"],
  ["Greedy", "A locally optimal choice can be proven globally safe", "Past choices never need reconsideration", "Using intuition without an exchange proof", "Often O(n) or O(n log n)"],
];
patterns.getRange("A5:E18").values = patternRows;
patterns.getRange("A5:E18").format = {
  fill: colors.white,
  font: { color: colors.gray800, size: 10 },
  wrapText: true,
  verticalAlignment: "top",
  rowHeightPx: 50,
  borders: { preset: "all", style: "thin", color: colors.gray200 },
};
patterns.getRange("A5:A18").format.font = { bold: true, color: colors.navy, size: 10 };
patterns.getRange("A5:A18").format.columnWidthPx = 145;
patterns.getRange("B5:B18").format.columnWidthPx = 265;
patterns.getRange("C5:C18").format.columnWidthPx = 280;
patterns.getRange("D5:D18").format.columnWidthPx = 245;
patterns.getRange("E5:E18").format.columnWidthPx = 180;
const patternTable = patterns.tables.add("A4:E18", true, "AlgorithmPatternLibrary");
patternTable.style = "TableStyleMedium2";
patternTable.showBandedRows = true;
patterns.freezePanes.freezeRows(4);

// Dashboard
dashboard.showGridLines = false;
applyTitle(dashboard, "A1:J1", "Algorithm Study Dashboard");
dashboard.mergeCells("A2:J2");
dashboard.getRange("A2").values = [[
  "The goal is not to memorize solutions. Track the signal that reveals the pattern and the invariant that keeps the solution correct."
]];
dashboard.getRange("A2:J2").format = {
  fill: colors.paleBlue,
  font: { color: colors.gray800, italic: true, size: 10 },
  wrapText: true,
  rowHeightPx: 34,
};

const kpiLabels = [["Problems Logged", "", "Review Soon", "", "Re-solved Solo", "", "Patterns Practiced", ""]];
dashboard.getRange("A4:H4").values = kpiLabels;
for (const range of ["A4:B4", "C4:D4", "E4:F4", "G4:H4"]) {
  dashboard.getRange(range).merge();
  dashboard.getRange(range).format = {
    fill: colors.gray100,
    font: { bold: true, color: colors.gray500, size: 9 },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    borders: { preset: "outside", style: "thin", color: colors.gray200 },
    rowHeightPx: 24,
  };
}
for (const range of ["A5:B6", "C5:D6", "E5:F6", "G5:H6"]) {
  dashboard.getRange(range).merge();
  dashboard.getRange(range).format = {
    fill: colors.white,
    font: { bold: true, color: colors.navy, size: 22 },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    borders: { preset: "outside", style: "thin", color: colors.gray200 },
    rowHeightPx: 31,
  };
}
dashboard.getRange("A5").formulas = [["=SUMPRODUCT(--('Problem Tracker'!$A$5:$A$54<>\"\"))"]];
dashboard.getRange("C5").formulas = [["=COUNTIF('Problem Tracker'!$J$5:$J$54,\"1 day\")+COUNTIF('Problem Tracker'!$J$5:$J$54,\"3 days\")"]];
dashboard.getRange("E5").formulas = [["=COUNTIF('Problem Tracker'!$H$5:$H$54,\"Yes\")"]];
dashboard.getRange("G5").formulas = [["=SUMPRODUCT(--('Problem Tracker'!$B$5:$B$54<>\"\"))"]];

dashboard.getRange("A8:B8").values = [["Difficulty", "Problems"]];
applySectionHeader(dashboard.getRange("A8:B8"));
dashboard.getRange("A9:A11").values = [["Easy"], ["Medium"], ["Hard"]];
dashboard.getRange("B9:B11").formulas = [
  ["=COUNTIF('Problem Tracker'!$C$5:$C$54,A9)"],
  ["=COUNTIF('Problem Tracker'!$C$5:$C$54,A10)"],
  ["=COUNTIF('Problem Tracker'!$C$5:$C$54,A11)"],
];
dashboard.getRange("A9:B11").format = {
  fill: colors.white,
  font: { color: colors.gray800, size: 10 },
  borders: { preset: "all", style: "thin", color: colors.gray200 },
};
dashboard.getRange("A9:A11").format.font = { bold: true, color: colors.gray800, size: 10 };

dashboard.getRange("D8:E8").values = [["Review Stage", "Problems"]];
applySectionHeader(dashboard.getRange("D8:E8"));
dashboard.getRange("D9:D15").values = [["1 day"], ["3 days"], ["7 days"], ["14 days"], ["30 days"], ["Mastered"], ["New"]];
dashboard.getRange("E9:E15").formulas = dashboard.getRange("D9:D15").values.map((_, i) => [
  `=COUNTIF('Problem Tracker'!$J$5:$J$54,D${9 + i})`,
]);
dashboard.getRange("D9:E15").format = {
  fill: colors.white,
  font: { color: colors.gray800, size: 10 },
  borders: { preset: "all", style: "thin", color: colors.gray200 },
};

dashboard.getRange("A18:H18").merge();
dashboard.getRange("A18").values = [["Pattern Recognition Loop"]];
dashboard.getRange("A18:H18").format = {
  fill: colors.cyan,
  font: { bold: true, color: colors.white, size: 11 },
  horizontalAlignment: "left",
  verticalAlignment: "center",
  rowHeightPx: 28,
};
dashboard.getRange("A19:H22").values = [
  ["1. Notice the signal", "", "2. Name the pattern", "", "3. State the invariant", "", "4. Rebuild from memory", ""],
  ["What constraint or input shape is the clue?", "", "Which known technique reduces the search?", "", "What remains true after every step?", "", "Can you explain and code it without notes?", ""],
  ["Write it in Tricky Part", "", "Write it in Pattern", "", "Write it in Mental Model", "", "Set the next Review interval", ""],
  ["Avoid solution-specific details.", "", "Prefer one primary pattern.", "", "Use one sentence.", "", "Shorten the interval when recall is weak.", ""],
];
for (const row of [19, 20, 21, 22]) {
  for (const pair of ["A:B", "C:D", "E:F", "G:H"]) {
    const [start, end] = pair.split(":");
    dashboard.mergeCells(`${start}${row}:${end}${row}`);
  }
}
for (const range of ["A19:B22", "C19:D22", "E19:F22", "G19:H22"]) {
  dashboard.getRange(range).format = {
    fill: colors.white,
    font: { color: colors.gray800, size: 10 },
    wrapText: true,
    verticalAlignment: "top",
    borders: { preset: "outside", style: "thin", color: colors.gray200 },
  };
}
dashboard.getRange("A19:H19").format.font = { bold: true, color: colors.navy, size: 10 };
dashboard.getRange("A19:H19").format.rowHeightPx = 42;
dashboard.getRange("A20:H20").format.rowHeightPx = 68;
dashboard.getRange("A21:H21").format.rowHeightPx = 50;
dashboard.getRange("A22:H22").format.rowHeightPx = 58;

dashboard.getRange("A4:H22").format.columnWidthPx = 92;
dashboard.getRange("A:A").format.columnWidthPx = 100;
dashboard.getRange("B:B").format.columnWidthPx = 75;
dashboard.getRange("C:C").format.columnWidthPx = 100;
dashboard.getRange("D:D").format.columnWidthPx = 75;
dashboard.getRange("E:E").format.columnWidthPx = 100;
dashboard.getRange("F:F").format.columnWidthPx = 75;
dashboard.getRange("G:G").format.columnWidthPx = 100;
dashboard.getRange("H:H").format.columnWidthPx = 75;

const difficultyChart = dashboard.charts.add("doughnut", dashboard.getRange("A8:B11"));
difficultyChart.title = "Problems by Difficulty";
difficultyChart.hasLegend = true;
difficultyChart.setPosition("G8", "J16");

dashboard.freezePanes.freezeRows(2);

const outputPath = new URL("algorithm_pattern_study_system.xlsx", outputDir);
const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(outputPath);

for (const [sheetName, range, file] of [
  ["Dashboard", "A1:J22", "dashboard.png"],
  ["Problem Tracker", "A1:J12", "tracker.png"],
  ["Pattern Library", "A1:E18", "patterns.png"],
]) {
  const preview = await workbook.render({ sheetName, range, scale: 1.25, format: "png" });
  await fs.writeFile(new URL(file, previewDir), new Uint8Array(await preview.arrayBuffer()));
}

const keyInspect = await workbook.inspect({
  kind: "table",
  range: "Dashboard!A1:J22",
  include: "values,formulas",
  tableMaxRows: 22,
  tableMaxCols: 10,
});
console.log(keyInspect.ndjson);

const trackerInspect = await workbook.inspect({
  kind: "table",
  range: "Problem Tracker!A4:J6",
  include: "values,formulas",
  tableMaxRows: 3,
  tableMaxCols: 10,
});
console.log(trackerInspect.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "final formula error scan",
});
console.log(errors.ndjson);
