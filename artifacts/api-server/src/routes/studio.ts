import { Router, type IRouter, type Request, type Response } from "express";
import { CheckStudioReuseBody, GetStudioWorkflowResponse } from "@workspace/api-zod";
import { z } from "zod";
import { getStudioWorkflow, STUDIO_CONTRIBUTION_MESSAGE } from "../lib/studio-policy";

const router: IRouter = Router();
// Orval emits success validators only. Compose the error envelope with the
// generated workflow validator rather than accepting unchecked response data.
const blockedResponse = z.object({
  code: z.enum(["MOSSI_INTEGRATION_REQUIRED", "MOSSI_CONTRIBUTION_REQUIRED"]),
  error: z.string(),
  workflow: GetStudioWorkflowResponse,
});

router.get("/studio/workflow", (_req, res): void => {
  res.set("Cache-Control", "no-store");
  res.json(GetStudioWorkflowResponse.parse(getStudioWorkflow()));
});

router.post("/studio/reuse", (req, res): void => {
  res.set("Cache-Control", "no-store");
  const input = CheckStudioReuseBody.safeParse(req.body);
  if (!input.success || input.data.goal.trim().length < 8) {
    res.status(400).json({ error: "Describe your goal using 8–2000 characters. Do not include credentials or private records." });
    return;
  }
  // Do not log or retain the goal, query an ambient public wiki, or return
  // empty search results when authorized enterprise sources are unavailable.
  res.status(503).json(blockedResponse.parse({
    code: "MOSSI_INTEGRATION_REQUIRED",
    error: "Internal reuse discovery is blocked. No enterprise catalogue was searched; no no-match decision can be made.",
    workflow: getStudioWorkflow(),
  }));
});

function blockPrototypeGeneration(_req: Request, res: Response): void {
  res.set("Cache-Control", "no-store");
  res.status(409).json(blockedResponse.parse({
    code: "MOSSI_CONTRIBUTION_REQUIRED",
    error: STUDIO_CONTRIBUTION_MESSAGE,
    workflow: getStudioWorkflow(),
  }));
}

// Register before legacy routers. Keeping the generators on disk preserves
// compatibility records without exposing an alternate release path.
router.get("/component-packages", blockPrototypeGeneration);
router.post(
  ["/builder/discover", "/builder/plan", "/component-packages/generate"],
  blockPrototypeGeneration,
);

export default router;
