import { BotManager } from "./bot-manager";
import { createDatabase, ensureSchema } from "./database";
import { EnvStore } from "./env-store";
import { FileService } from "./file-service";
import { LogStore } from "./log-store";
import { R2Store } from "./r2-store";

const logs = new LogStore();
const pool = createDatabase();
let schemaPromise: Promise<void> | undefined;
let manager: BotManager | undefined;
let files: FileService | undefined;
let env: EnvStore | undefined;
let r2: R2Store | undefined;

export function getLogs() {
  return logs;
}

export function getDatabase() {
  if (!pool) throw new Error("DATABASE_URL is required for Neon persistence");
  schemaPromise ??= ensureSchema(pool);
  return { pool, ready: schemaPromise };
}

export function getR2() {
  r2 ??= new R2Store();
  return r2;
}

export function getFiles() {
  files ??= new FileService(getR2());
  return files;
}

export function getEnvStore() {
  const database = getDatabase();
  env ??= new EnvStore(database.pool, database.ready);
  return env;
}

export function getBotManager() {
  let envStore: EnvStore | undefined;
  try {
    envStore = getEnvStore();
  } catch {
    envStore = undefined;
  }
  manager ??= new BotManager(getR2(), getFiles(), getLogs(), envStore);
  return manager;
}