export interface CodeProblemExample {
  input: string;
  output: string;
  explanation?: string;
}

export interface CodeProblemDefinition {
  problemStatement: string;
  examples: CodeProblemExample[];
  constraints: string[];
}

export function renderCodeProblemDefinition(definition: CodeProblemDefinition): string {
  const lines = [
    definition.problemStatement.trim(),
    "",
    "### Examples",
  ];

  definition.examples.forEach((example, index) => {
    lines.push(
      "",
      `#### Example ${index + 1}`,
      `**Input:** ${example.input.trim()}`,
      `**Output:** ${example.output.trim()}`,
    );
    if (example.explanation?.trim()) {
      lines.push(`**Explanation:** ${example.explanation.trim()}`);
    }
  });

  lines.push("", "### Constraints");
  for (const constraint of definition.constraints) {
    lines.push(`- ${constraint.trim()}`);
  }

  return lines.join("\n");
}

export function replaceProblemStatement(
  customContent: string | undefined,
  definition: CodeProblemDefinition,
): string {
  const rendered = renderCodeProblemDefinition(definition);
  const content = customContent?.trim() ?? "";
  const problemSection = /##\s+Problem Statement\s*\n[\s\S]*$/i;

  if (problemSection.test(content)) {
    return content.replace(problemSection, `## Problem Statement\n${rendered}`);
  }

  return [content, "## Problem Statement", rendered]
    .filter(Boolean)
    .join("\n\n");
}
