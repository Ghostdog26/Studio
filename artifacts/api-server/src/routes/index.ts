import { Router, type IRouter } from "express";
import healthRouter from "./health";
import foundryRouter from "./foundry";
import mcpCatalogueRouter from "./mcp-catalogue";
import officialMcpRouter from "./official-mcp";
import enterpriseRouter from "./enterprise";
import mcpDiscoveryRouter from "./mcp-discovery";
import builderRouter from "./builder";

const router: IRouter = Router();

router.use(healthRouter);
router.use(foundryRouter);
router.use(mcpCatalogueRouter);
router.use(officialMcpRouter);
router.use(enterpriseRouter);
router.use(mcpDiscoveryRouter);
router.use(builderRouter);

export default router;
