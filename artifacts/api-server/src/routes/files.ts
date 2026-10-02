import { Router } from "express";
import { getFiles, getR2 } from "../services";
import { safeBotPath } from "../services/file-service";
import { botTemplateFiles } from "../services/bot-template";

const router = Router();

router.get("/files", async (req, res) => {
  try {
    res.json(await getFiles().list(typeof req.query.path === "string" ? req.query.path : ""));
  } catch (error) {
    res.status(503).json({ error: error instanceof Error ? error.message : "File storage unavailable" });
  }
});

router.post("/files", async (req, res) => {
  try {
    const { path, kind, content } = req.body as { path?: string; kind?: "file" | "directory"; content?: string };
    if (!path || (kind !== "file" && kind !== "directory")) {
      res.status(400).json({ error: "path and kind are required" });
      return;
    }
    res.status(201).json(await getFiles().create({ path, kind, content }));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not create file" });
  }
});

router.post("/files/bootstrap", async (_req, res) => {
  try {
    res.status(200).json(await getFiles().createMissing(botTemplateFiles));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not load starter files" });
  }
});

router.get("/files/*path", async (req, res) => {
  try {
    const filePath = Array.isArray(req.params.path) ? req.params.path.join("/") : req.params.path;
    const result = await getFiles().download(filePath);
    res.setHeader("Content-Type", result.ContentType ?? "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${safeBotPath(filePath).split("/").pop()}"`);
    if (!result.Body) {
      res.status(404).end();
      return;
    }
    res.end(Buffer.from(await result.Body.transformToByteArray()));
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : "File not found" });
  }
});

router.put("/files/*path", async (req, res) => {
  try {
    const filePath = Array.isArray(req.params.path) ? req.params.path.join("/") : req.params.path;
    const content = req.body?.content;
    if (typeof content !== "string") {
      res.status(400).json({ error: "content is required" });
      return;
    }
    res.json(await getFiles().update(filePath, content));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not update file" });
  }
});

router.delete("/files/*path", async (req, res) => {
  try {
    const filePath = Array.isArray(req.params.path) ? req.params.path.join("/") : req.params.path;
    await getFiles().remove(filePath);
    res.status(204).end();
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not delete file" });
  }
});

export default router;