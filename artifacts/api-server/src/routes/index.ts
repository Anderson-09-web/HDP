import { Router, type IRouter } from "express";
import controlRouter from "./control";
import dependenciesRouter from "./dependencies";
import envRouter from "./env";
import filesRouter from "./files";
import healthRouter from "./health";
import logsRouter from "./logs";

const router: IRouter = Router();

router.use(healthRouter);
router.use(controlRouter);
router.use(filesRouter);
router.use(logsRouter);
router.use(dependenciesRouter);
router.use(envRouter);

export default router;
