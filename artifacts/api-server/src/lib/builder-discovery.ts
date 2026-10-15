export interface CatalogueCandidate {
  id: number;
  name: string;
  description: string;
  categories: string[];
}

const STOP_WORDS = new Set("a an the and or to of for with my me we you i today let lets let's build create server mcp tool tools want can help developer development please some something new us get started start make looking what".split(" "));
const DEVELOPER_CATEGORIES = ["Developer Tools", "Coding Agents", "Command Line", "Code Execution", "Product Management"];

export function rankBuilderCandidates<T extends CatalogueCandidate>(goal: string, entries: T[]): { reference: T; rationale: string }[] {
  const tokens = [...new Set(goal.toLowerCase().match(/[a-z0-9+#]{2,}/g) ?? [])]
    .filter((token) => !STOP_WORDS.has(token)).slice(0, 30);
  const broad = tokens.length === 0;
  const expanded = [...tokens];
  if (/\b(repo|repository|repositories|coding|code|github|gitlab)\b/i.test(goal)) expanded.push("github", "repository");
  if (/\b(database|databases|sql|postgres)\b/i.test(goal)) expanded.push("database", "postgres");
  const scored = entries.map((reference) => {
    const text = `${reference.name} ${reference.description} ${reference.categories.join(" ")}`.toLowerCase();
    const matched = [...new Set(expanded)].filter((token) => text.includes(token));
    const developer = reference.categories.some((category) => DEVELOPER_CATEGORIES.includes(category));
    return { reference, matched, score: matched.length * 10 + (broad && developer ? 5 : 0) };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.reference.name.localeCompare(b.reference.name));
  // Broader requests get category diversity rather than six copies of the same service.
  const selected: typeof scored = [];
  const seen = new Set<string>();
  for (const item of scored) {
    const key = item.reference.categories.find((category) => DEVELOPER_CATEGORIES.includes(category)) ?? item.reference.categories[0] ?? "";
    if (broad && seen.has(key) && selected.length < 4) continue;
    selected.push(item);
    seen.add(key);
    if (selected.length === 6) break;
  }
  return selected.map(({ reference, matched }) => ({
    reference,
    rationale: matched.length
      ? `Catalogue match for ${matched.join(", ")}. Review the reference before choosing what to implement.`
      : `A developer-oriented starting point in ${reference.categories.join(", ")}.`,
  }));
}
