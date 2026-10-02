import { Router } from "express";
import { getEnvStore, getR2 } from "../services";

const router = Router();

router.get("/setup", async (_req, res) => {
  let discordTokenConfigured = Boolean(process.env.DISCORD_TOKEN);
  let environmentStoreAvailable = false;
  let r2Configured = false;

  if (
    process.env.R2_ENDPOINT &&
    process.env.R2_ACCESS_KEY &&
    process.env.R2_SECRET_KEY &&
    process.env.R2_BUCKET
  ) {
    try {
      await getR2().check();
      r2Configured = true;
    } catch {
      r2Configured = false;
    }
  }

  if (process.env.DATABASE_URL) {
    try {
      const envStore = getEnvStore();
      environmentStoreAvailable = true;
      discordTokenConfigured ||= await envStore.hasConfigured("DISCORD_TOKEN");
    } catch {
      environmentStoreAvailable = false;
    }
  }

  res.json({
    r2Configured,
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    environmentStoreAvailable,
    encryptionConfigured: Boolean(process.env.SESSION_SECRET),
    authConfigured: Boolean(process.env.CLERK_SECRET_KEY),
    discordTokenConfigured,
  });
});

export default router;