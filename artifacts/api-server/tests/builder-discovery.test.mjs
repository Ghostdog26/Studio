import assert from "node:assert/strict";
import test from "node:test";
import { rankBuilderCandidates } from "../src/lib/builder-discovery.ts";

const entries = [
  { id: 1, name: "GitHub", description: "Repository tooling", categories: ["Developer Tools"] },
  { id: 2, name: "PostgreSQL", description: "Query a PostgreSQL database", categories: ["Databases"] },
  { id: 3, name: "Shell", description: "Command line execution", categories: ["Command Line"] },
  { id: 4, name: "Coding Agent", description: "Coding assistant", categories: ["Coding Agents"] },
];
test("broad developer request offers catalogue-backed varied categories", () => {
  for (const goal of ["let's build a developer MCP server tool today", "let’s build a developer MCP server tool today"]) {
    const result = rankBuilderCandidates(goal, entries);
    assert.equal(result.length, 3);
    assert.ok(result.every((item) => entries.includes(item.reference)));
    assert.ok(!result.some((item) => item.reference.id === 2));
  }
});
test("specific database goal ranks matching actual references", () => {
  const result = rankBuilderCandidates("Build a postgres database query tool", entries);
  assert.equal(result[0].reference.id, 2);
  assert.match(result[0].rationale, /postgres/);
});
test("unknown terms do not invent matches and results are bounded", () => {
  assert.deepEqual(rankBuilderCandidates("quuxflorp zzzxy", entries), []);
  const many = Array.from({ length: 30 }, (_, id) => ({ id, name: `GitHub ${id}`, description: "Github repository", categories: ["Developer Tools"] }));
  assert.equal(rankBuilderCandidates("Github repository explorer", many).length, 6);
});
