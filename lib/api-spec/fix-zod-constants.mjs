// Orval 8.30 can emit numeric validation constants after a union that reads them.
// Hoist only independent numeric literal declarations, never schema declarations.
import { readFile, writeFile } from "node:fs/promises";
const path = new URL("../api-zod/src/generated/api.ts", import.meta.url);
const source = await readFile(path, "utf8");
const constants = [];
const body = source.replace(/^export const \w+ = -?\d+(?:\.\d+)?;\s*$/gm, declaration => {
  constants.push(declaration.trim());
  return "";
});
const importMatch = /^import \* as zod from ['"]zod['"];.*$/m.exec(body);
if (!importMatch) throw new Error("Generated Zod import not found; inspect generator output.");
const importEnd = body.indexOf("\n", importMatch.index);
await writeFile(path, `${body.slice(0, importEnd + 1)}\n${constants.join("\n")}\n${body.slice(importEnd + 1).trimEnd()}\n`);
for (const relative of ["../api-client-react/src/generated/api.ts", "../api-client-react/src/generated/api.schemas.ts"]) {
  const generatedPath = new URL(relative, import.meta.url);
  await writeFile(generatedPath, `${(await readFile(generatedPath, "utf8")).trimEnd()}\n`);
}
