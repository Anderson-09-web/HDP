import { Router } from "express";
import { getLogs } from "../services";

const router = Router();

router.get("/logs", async (req, res) => {
  const page = Number(req.query.page);
  const pageSize = Number(req.query.pageSize);
  res.json(
    await getLogs().list({
      level: typeof req.query.level === "string" ? req.query.level : undefined,
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      page: Number.isFinite(page) ? page : undefined,
      pageSize: Number.isFinite(pageSize) ? pageSize : undefined,
    }),
  );
});

router.get("/logs/download", async (_req, res) => {
  res.type("text/plain").send(await getLogs().text());
});

export default router;