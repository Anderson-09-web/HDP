import { Router } from "express";
import { getEnvStore } from "../services";

const router = Router();
const protectedNames = new Set([
  "DATABASE_URL",
  "SESSION_SECRET",
  "CLERK_SECRET_KEY",
  "R2_SECRET_KEY",
  "R2_ACCESS_KEY",
  "R2_ENDPOINT",
  "R2_BUCKET",
]);

function validateVariable(name: string, value: string) {
  return /^[A-Z][A-Z0-9_]*$/.test(name) &&
    !protectedNames.has(name) &&
    value.length > 0;
}

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
    if (!validateVariable(name, value)) {
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
    const name = String(req.params.name);
    const value = String(req.body?.value ?? "");
    if (!validateVariable(name, value)) {
      res.status(400).json({ error: "Invalid environment variable" });
      return;
    }
    res.json(await getEnvStore().upsert(name, value));
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