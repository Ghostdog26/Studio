import { Router, type IRouter } from "express";
import healthRouter from "./health";
import foundryRouter from "./foundry";
import mcpCatalogueRouter from "./mcp-catalogue";
import officialMcpRouter from "./official-mcp";
import enterpriseRouter from "./enterprise";

const router: IRouter = Router();

router.use(healthRouter);
router.use(foundryRouter);
router.use(mcpCatalogueRouter);
router.use(officialMcpRouter);
router.use(enterpriseRouter);

export default router;
