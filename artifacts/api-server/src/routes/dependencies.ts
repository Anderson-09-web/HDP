import { Router } from "express";
import { getBotManager, getFiles, getR2 } from "../services";
import { dependencyLines, parseDependency } from "../services/file-service";

const router = Router();

async function readRequirements() {
  try {
    return await getR2().readText("requirements.txt");
  } catch (error) {
    if (error && typeof error === "object" && "name" in error && error.name === "NoSuchKey") {
      return "";
    }
    throw error;
  }
}

async function list() {
  const content = await readRequirements();
  return { items: dependencyLines(content).flatMap((line) => {
    const item = parseDependency(line);
    return item ? [item] : [];
  }) };
}

router.get("/dependencies", async (_req, res) => {
  try {
    res.json(await list());
  } catch (error) {
    res.status(503).json({ error: error instanceof Error ? error.message : "R2 unavailable" });
  }
});

router.post("/dependencies", async (req, res) => {
  try {
    const name = String(req.body?.name ?? "").trim();
    const version = String(req.body?.version ?? "").trim();
    if (
      !/^[A-Za-z0-9_.-]+$/.test(name) ||
      version.length > 64 ||
      /[\r\n]/.test(version) ||
      (version && !parseDependency(`${name}${/^(===|==|!=|~=|>=|<=|>|<)/.test(version) ? version : `==${version}`}`))
    ) {
      res.status(400).json({ error: "Invalid dependency" });
      return;
    }
    const current = await readRequirements();
    const next = dependencyLines(current).filter((line) => parseDependency(line)?.name !== name);
    next.push(`${name}${version ? /^(===|==|!=|~=|>=|<=|>|<)/.test(version) ? version : `==${version}` : ""}`);
    await getFiles().update("requirements.txt", `${next.join("\n")}\n`);
    await getBotManager().installDependencies(`${next.join("\n")}\n`);
    res.json(await list());
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not install dependency" });
  }
});

router.delete("/dependencies/:name", async (req, res) => {
  try {
    const current = await readRequirements();
    const next = dependencyLines(current).filter((line) => parseDependency(line)?.name !== req.params.name);
    await getFiles().update("requirements.txt", `${next.join("\n")}\n`);
    res.json(await list());
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not remove dependency" });
  }
});

export default router;