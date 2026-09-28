import { Router } from "express";
import { getEnvStore } from "../services";

const router = Router();

router.get("/env", async (_req, res) => {
  try {
    res.json({ items: await getEnvStore().list() });
  } catch (error) {
    res.status(503).json({ error: error instanceof Error ? error.message : "Neon unavailable" });
  }
});

router.post("/env", async (req, res) => {
  try {
    const name = String(req.body?.name ?? "");
    const value = String(req.body?.value ?? "");
    if (!/^[A-Z][A-Z0-9_]*$/.test(name) || !value) {
      res.status(400).json({ error: "Invalid environment variable" });
      return;
    }
    res.status(201).json(await getEnvStore().upsert(name, value));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not save variable" });
  }
});

router.put("/env/:name", async (req, res) => {
  try {
    res.json(await getEnvStore().upsert(req.params.name, String(req.body?.value ?? "")));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not update variable" });
  }
});

router.delete("/env/:name", async (req, res) => {
  try {
    await getEnvStore().delete(req.params.name);
    res.status(204).end();
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not delete variable" });
  }
});

export default router;