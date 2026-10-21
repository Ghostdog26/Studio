import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import express from "express";
import studioRouter from "../routes/studio";
import { getStudioWorkflow } from "./studio-policy";
import type { StudioBlockedResponse, StudioWorkflow } from "@workspace/api-zod";

test("Studio has no implicit enterprise policy or connected release path", () => {
  const workflow = getStudioWorkflow();
  assert.equal(workflow.name, "MOSSI Studio");
  assert.equal(workflow.status, "blocked");
  assert.equal(workflow.integrations.length, 6);
  assert.ok(workflow.integrations.every((item) => item.status !== ("connected" as string)));
  assert.deepEqual(workflow.languagePolicy.allowedLanguages, []);
  assert.deepEqual(workflow.languagePolicy.suggestedLanguages, ["TypeScript", "Python"]);
  assert.ok(Object.values(workflow.actions).every((enabled) => enabled === false));
  assert.equal(workflow.delivery.status, "unverified");
  assert.equal(workflow.delivery.repositoryUrl, "https://gitlab.example.com/mossi/monorepo");
  assert.equal(workflow.delivery.repositoryPlaceholder, true);
  assert.equal(workflow.actions.canOpenMergeRequest, false);
  // A caller cannot turn a fresh server-owned response into persistent policy.
  workflow.actions.canOpenMergeRequest = true;
  assert.equal(getStudioWorkflow().actions.canOpenMergeRequest, false);
});

test("Studio routes block unavailable discovery and legacy generation before downstream handlers", async (t) => {
  const app = express();
  let downstreamCalls = 0;
  app.use(express.json());
  app.use("/api", studioRouter);
  app.use((_req, res) => { downstreamCalls++; res.json({ generated: true }); });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => { server.closeAllConnections(); server.close(); });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/api`;

  await t.test("readiness is no-store metadata, not successful discovery", async () => {
    const response = await fetch(`${base}/studio/workflow`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(((await response.json()) as StudioWorkflow).status, "blocked");
  });
  await t.test("valid goal yields unavailable, not empty/no-match results", async () => {
    const response = await fetch(`${base}/studio/reuse`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: "Find an existing developer capability", approved: true, scope: "all" }),
    });
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = (await response.json()) as StudioBlockedResponse;
    assert.equal(body.code, "MOSSI_INTEGRATION_REQUIRED");
    assert.equal(body.workflow.actions.canSearchInternal, false);
    assert.equal(body.workflow.delivery.repositoryPlaceholder, true);
    assert.equal(body.workflow.actions.canOpenMergeRequest, false);
    assert.ok(!Object.hasOwn(body, "matches"));
    assert.ok(!Object.hasOwn(body, "approved"));
    assert.ok(!JSON.stringify(body).includes("Find an existing developer capability"));
  });
  for (const goal of ["", "        ", "short", "x".repeat(2001)]) {
    await t.test(`reject invalid goal length ${goal.length}`, async () => {
      const response = await fetch(`${base}/studio/reuse`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goal }),
      });
      assert.equal(response.status, 400);
    });
  }
  for (const [method, path] of [
    ["GET", "/component-packages?id=1&target=cloudflare"],
    ["HEAD", "/component-packages?id=1&target=openshell"],
    ["GET", "/COMPONENT-PACKAGES/"],
    ["POST", "/builder/discover"],
    ["POST", "/builder/plan"],
    ["POST", "/component-packages/generate"],
  ]) {
    await t.test(`${method} ${path} cannot invoke a legacy generator`, async () => {
      const response = await fetch(`${base}${path}`, {
        method, ...(method === "POST" ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ goal: "Generate a new server", target: "cloudflare", approved: true }),
        } : {}),
      });
      assert.equal(response.status, 409);
      assert.equal(response.headers.get("cache-control"), "no-store");
      if (method !== "HEAD") assert.equal(((await response.json()) as StudioBlockedResponse).code, "MOSSI_CONTRIBUTION_REQUIRED");
    });
  }
  assert.equal(downstreamCalls, 0);
});
