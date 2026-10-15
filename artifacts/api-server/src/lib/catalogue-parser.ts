export interface CatalogueReference {
  name: string;
  url: string;
  description: string;
  categories: string[];
  languages: string[];
  scopes: string[];
  platforms: string[];
  officialListed: boolean;
}

const languageMarks = [
  ["🐍", "Python"], ["📇", "TypeScript / JavaScript"], ["🏎", "Go"],
  ["🦀", "Rust"], ["#️⃣", "C#"], ["☕", "Java"], ["🌊", "C / C++"], ["💎", "Ruby"],
] as const;
const scopeMarks = [["☁", "Cloud service"], ["🏠", "Local service"], ["📟", "Embedded systems"]] as const;
const platformMarks = [["🍎", "macOS"], ["🪟", "Windows"], ["🐧", "Linux"]] as const;

function cleanText(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "")
    .replace(/[*`]/g, "")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function markedValues(text: string, map: readonly (readonly [string, string])[]) {
  return map.filter(([mark]) => text.includes(mark)).map(([, label]) => label);
}

// Directory metadata only. Nothing in this parser fetches or executes listed repositories.
export function parseAwesomeMcpDirectory(markdown: string): CatalogueReference[] {
  const entries = new Map<string, CatalogueReference>();
  let inServers = false;
  let category = "";
  for (const line of markdown.split(/\r?\n/)) {
    if (/^## Server Implementations\s*$/.test(line)) { inServers = true; continue; }
    if (inServers && /^## /.test(line)) break;
    if (!inServers) continue;
    if (/^### /.test(line)) { category = cleanText(line.slice(4)); continue; }
    const match = /^[-*]\s+\[([^\]]+)\]\((https:\/\/[^)\s]+)\)\s*(.*)$/.exec(line);
    if (!category || !match) continue;
    const [, label, rawUrl, tail] = match;
    if (!label || !rawUrl || !tail) continue;
    const parsedUrl = new URL(rawUrl);
    if (parsedUrl.username || parsedUrl.password) continue;
    const url = parsedUrl.href.replace(/\/$/, "");
    // Ignore score badges before the legend. Parse marks only before the description.
    const withoutBadges = tail.replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, "").trim();
    const split = /\s[-–—]\s/.exec(withoutBadges);
    const marks = split ? withoutBadges.slice(0, split.index) : "";
    const description = cleanText(split ? withoutBadges.slice(split.index + split[0].length) : withoutBadges);
    if (!description) continue;
    const entry: CatalogueReference = {
      name: cleanText(label), url, description, categories: [category],
      languages: markedValues(marks, languageMarks), scopes: markedValues(marks, scopeMarks),
      platforms: markedValues(marks, platformMarks), officialListed: marks.includes("🎖"),
    };
    const existing = entries.get(url);
    if (existing) {
      for (const key of ["categories", "languages", "scopes", "platforms"] as const) {
        existing[key] = [...new Set([...existing[key], ...entry[key]])];
      }
      existing.officialListed ||= entry.officialListed;
      if (entry.description.length > existing.description.length) existing.description = entry.description;
    } else entries.set(url, entry);
  }
  if (!entries.size) throw new Error("The upstream directory has no recognized server listings. Import aborted.");
  return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name));
}
