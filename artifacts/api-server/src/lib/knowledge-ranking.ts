interface RankableDocument { title: string; content: string; tags: string[] }
const stopWords = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
  "how", "in", "is", "it", "of", "on", "or", "that", "the", "this",
  "to", "what", "when", "where", "which", "who", "why", "with",
]);
function tokenize(value: string): string[] {
  return value.toLowerCase().match(/[a-z0-9][a-z0-9_-]{1,}/g)
    ?.filter(word => !stopWords.has(word)) ?? [];
}
export function rankDocuments<T extends RankableDocument>(query: string, documents: T[]) {
  const terms = [...new Set(tokenize(query))];
  const initial = documents.map(document => {
    const title = tokenize(document.title);
    const body = tokenize(document.content);
    const tags = tokenize(document.tags.join(" "));
    const score = terms.reduce((sum, term) => sum +
      title.filter(word => word === term).length * 4 +
      tags.filter(word => word === term).length * 3 +
      Math.min(body.filter(word => word === term).length, 5), 0);
    return { document, score };
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 12);
  const queryPhrase = query.toLowerCase().trim();
  return initial.map(({ document, score }) => {
    const title = document.title.toLowerCase();
    const content = document.content.toLowerCase();
    const phraseBoost = title.includes(queryPhrase) ? 8 : content.includes(queryPhrase) ? 4 : 0;
    const coverage = terms.length === 0 ? 0 :
      terms.filter(term => `${title} ${content}`.includes(term)).length / terms.length;
    const rerankScore = score + phraseBoost + coverage * 5;
    return { document, score: Math.min(0.99, rerankScore / (rerankScore + 12)) };
  }).sort((a, b) => b.score - a.score).slice(0, 5);
}
