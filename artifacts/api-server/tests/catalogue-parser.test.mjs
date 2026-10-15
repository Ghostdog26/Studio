import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAwesomeMcpDirectory } from "../src/lib/catalogue-parser.ts";
import { BASELINE_CHECKS, PRIORITY_CATEGORY_STANDARDS, standardsForCategories, categoryStandardContent } from "../src/lib/catalogue-category-standards.ts";

test("extracts metadata, removes badges, merges cross-category references, and skips nonservers", () => {
  const source = `## Clients
- [client](https://example.com/client) - Not a server
## Server Implementations
### <a name="db"></a>Databases
- [org/postgres](https://github.com/org/postgres) [![score](https://example.com/score.svg)](https://example.com/score) 🐍 ☁️ 🐧 🎖️ - Search **Postgres** with [SQL](https://example.com/sql).
### Developer Tools
- [org/postgres](https://github.com/org/postgres/) 📇 🏠 - Postgres tools.
- [org/new](https://github.com/org/new) - Unknown metadata, not inferred.
- [bad](javascript:alert) - Not a secure external link.
## Frameworks
- [framework](https://example.com/framework) - Not a server`;
  const entries = parseAwesomeMcpDirectory(source);
  assert.equal(entries.length, 2);
  const postgres = entries.find((item) => item.name === "org/postgres");
  assert.deepEqual(postgres.categories, ["Databases", "Developer Tools"]);
  assert.deepEqual(postgres.languages, ["Python", "TypeScript / JavaScript"]);
  assert.equal(postgres.description, "Search Postgres with SQL.");
  assert.equal(postgres.officialListed, true);
  assert.deepEqual(entries.find((item) => item.name === "org/new").languages, []);
});

test("rejects a changed or empty source rather than replacing a catalogue with nothing", () => {
  assert.throws(() => parseAwesomeMcpDirectory("## A different format\nNo listings."), /Import aborted/);
});

test("all twelve requested categories carry evidence and negative acceptance tests, without claiming approval", () => {
  assert.equal(PRIORITY_CATEGORY_STANDARDS.length, 12);
  assert.equal(new Set(PRIORITY_CATEGORY_STANDARDS.map((item) => item.category)).size, 12);
  for (const standard of PRIORITY_CATEGORY_STANDARDS) {
    assert.ok(standard.checks.length >= 4);
    const checks = [...BASELINE_CHECKS, ...standard.checks];
    assert.equal(new Set(checks.map((item) => item.id)).size, checks.length);
    assert.ok(checks.every((item) => item.requirement && item.evidence && item.acceptanceTest));
    assert.match(categoryStandardContent(standard), /NOT completed audits/);
  }
  assert.equal(standardsForCategories(["Databases", "Code Execution"]).length, 2);
  assert.equal(standardsForCategories(["Travel & Transportation"]).length, 0);
});
