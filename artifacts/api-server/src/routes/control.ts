import { Router } from "express";
import { getBotManager } from "../services";

const router = Router();

router.get("/status", (_req, res) => {
  try {
    res.json(getBotManager().status());
  } catch (error) {
    res.json({
      api: "ONLINE",
      bot: "OFFLINE",
      pid: null,
      discordConnected: false,
      pendingChanges: false,
      lastError: error instanceof Error ? error.message : "Runtime not configured",
      updatedAt: new Date().toISOString(),
    });
  }
});

router.post("/bot/start", async (_req, res) => {
  try {
    const manager = getBotManager();
    await manager.start();
    res.status(202).json({ accepted: true, message: "Bot start accepted" });
  } catch (error) {
    res.status(409).json({ error: error instanceof Error ? error.message : "Could not start bot" });
  }
});

router.post("/bot/stop", async (_req, res) => {
  try {
    await getBotManager().stop();
    res.status(202).json({ accepted: true, message: "Bot stop accepted" });
  } catch (error) {
    res.status(409).json({ error: error instanceof Error ? error.message : "Could not stop bot" });
  }
});

router.post("/bot/restart", async (_req, res) => {
  try {
    await getBotManager().restart();
    res.status(202).json({ accepted: true, message: "Bot restart accepted" });
  } catch (error) {
    res.status(409).json({ error: error instanceof Error ? error.message : "Could not restart bot" });
  }
});

export default router;