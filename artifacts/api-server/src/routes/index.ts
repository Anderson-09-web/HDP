import { Router, type IRouter } from "express";
import controlRouter from "./control";
import dependenciesRouter from "./dependencies";
import envRouter from "./env";
import filesRouter from "./files";
import healthRouter from "./health";
import logsRouter from "./logs";
import setupRouter from "./setup";

const router: IRouter = Router();

router.use(healthRouter);
router.use(controlRouter);
router.use(filesRouter);
router.use(logsRouter);
router.use(dependenciesRouter);
router.use(envRouter);
router.use(setupRouter);

export default router;
