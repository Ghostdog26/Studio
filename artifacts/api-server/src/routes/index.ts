import { Router, type IRouter } from "express";
import healthRouter from "./health";
import foundryRouter from "./foundry";

const router: IRouter = Router();

router.use(healthRouter);
router.use(foundryRouter);

export default router;
