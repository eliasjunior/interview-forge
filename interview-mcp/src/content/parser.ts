// ─────────────────────────────────────────────────────────────────────────────
// content/parser.ts
//
// Pure functions that extract structured signals from raw spec text.
// No I/O. No side effects.
// ─────────────────────────────────────────────────────────────────────────────

export interface Endpoint {
  method: string;
  path:   string;
  hint:   string;
}

export interface DataModel {
  name:   string;
  fields: Array<{ name: string; type: string }>;
}

export interface ExtractedSpec {
  endpoints: Endpoint[];
  models:    DataModel[];
  rules:     string[];
  notes:     string[];
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Extract HTTP endpoints with optional inline descriptions. */
export function extractEndpoints(content: string): Endpoint[] {
  const re   = /\b(GET|POST|PUT|PATCH|DELETE)\s+(\/[\w/{}:.-]+)(?:\s*\(([^)]*)\))?/gi;
  const seen = new Set<string>();
  const results: Endpoint[] = [];
  for (const m of content.matchAll(re)) {
    const key = `${m[1].toUpperCase()} ${m[2]}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({ method: m[1].toUpperCase(), path: m[2], hint: m[3]?.trim() ?? "" });
    }
  }
  return results;
}

/**
 * Extract named data models by scanning for "contains [at least] the fields" anchors,
 * then collecting every "fieldName (Type)" pattern in the following lines until we hit
 * another model anchor, a blank line followed by a capital letter, or a section header.
 * Falls back to a single flat model when no named groups are found.
 */
export function extractModels(content: string): DataModel[] {
  const lines     = content.replace(/\r\n/g, "\n").split("\n");
  const anchorRe  = /\bcontains\s+(?:at\s+least\s+)?the\s+fields\b/i;
  const stopRe    = /^(business rules|#|\* (get|post|put|patch|delete)\b)/i;
  const fieldRe   = /\b([a-z][a-zA-Z]+)\s*\(([^)]+)\)/g;

  function modelNameFrom(line: string): string {
    const before = line.split(/\bcontains\b/i)[0] ?? line;
    return before
      .replace(/^\s*(?:the|a|an)\s+/i, "")
      .trim()
      .replace(/\s+/g, " ") || "Data Model";
  }

  const models: DataModel[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (!anchorRe.test(lines[i])) continue;

    const name   = capitalise(modelNameFrom(lines[i]));
    const fields: Array<{ name: string; type: string }> = [];

    for (let j = i; j < Math.min(i + 10, lines.length); j++) {
      const line = lines[j];
      if (j > i && (stopRe.test(line.trim()) || anchorRe.test(line))) break;
      if (j > i && line.trim() === "" && fields.length > 0) break;
      for (const f of line.matchAll(fieldRe)) {
        if (!fields.find((x) => x.name === f[1])) {
          fields.push({ name: f[1], type: f[2].trim() });
        }
      }
    }

    if (fields.length > 0) models.push({ name: capitalise(name), fields });
  }

  // Fallback: collect all typed fields into one flat model
  if (models.length === 0) {
    const fields: Array<{ name: string; type: string }> = [];
    for (const m of content.matchAll(/\b([a-z][a-zA-Z]+)\s*\(([^)]+)\)/g)) {
      if (!fields.find((f) => f.name === m[1])) {
        fields.push({ name: m[1], type: m[2].trim() });
      }
    }
    if (fields.length > 0) models.push({ name: "Data Fields", fields });
  }

  return models;
}

/**
 * Pull explicit business-rule sentences: constraint language present AND
 * the line is not just a structural description.
 */
export function extractRules(content: string): string[] {
  const structuralRe = /\b(contains|created|contains the fields|contain at least|is calculated|is returned)\b/i;
  return content
    .split(/\n/)
    .map((l) => l.replace(/^[-*•\d.]\s*/, "").trim())
    .filter((l) =>
      l.length > 10 &&
      /\b(should not|must not|cannot|must be|should be|not exceed|no more than|limited to|only if|requires|is forbidden|is required|is mandatory)\b/i.test(l) &&
      !structuralRe.test(l)
    )
    .slice(0, 8);
}

/** Pull implementation notes — "in memory", "framework choice", etc. */
export function extractNotes(content: string): string[] {
  return content
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) =>
      l.length > 10 &&
      /\b(in memory|on startup|on application startup|framework|library|in-memory|cache|no database|no persistence)\b/i.test(l)
    )
    .slice(0, 5);
}

/** Combine all extractors into a single pass. */
export function extractSpec(raw: string): ExtractedSpec {
  return {
    endpoints: extractEndpoints(raw),
    models:    extractModels(raw),
    rules:     extractRules(raw),
    notes:     extractNotes(raw),
  };
}
