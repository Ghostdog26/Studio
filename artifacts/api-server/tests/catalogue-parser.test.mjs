import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAwesomeMcpDirectory } from "../src/lib/catalogue-parser.ts";

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
