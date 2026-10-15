import { Router, type IRouter } from "express";
import healthRouter from "./health";
import foundryRouter from "./foundry";
import mcpCatalogueRouter from "./mcp-catalogue";

const router: IRouter = Router();

router.use(healthRouter);
router.use(foundryRouter);
router.use(mcpCatalogueRouter);

export default router;
