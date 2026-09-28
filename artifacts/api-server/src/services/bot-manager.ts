import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { FileService } from "./file-service";
import { LogStore } from "./log-store";
import { R2Store } from "./r2-store";
import { EnvStore } from "./env-store";

export type BotState = "ONLINE" | "STARTING" | "OFFLINE" | "ERROR" | "RESTARTING";

export class BotManager {
  private child?: ChildProcessWithoutNullStreams;
  private state: BotState = "OFFLINE";
  private discordConnected = false;
  private lastError: string | null = null;
  private updatedAt = new Date();
  private action?: Promise<void>;
  private readonly workspace = process.env.BOT_WORKSPACE_DIR ?? "/tmp/discord-bot";

  constructor(
    private readonly r2: R2Store,
    private readonly files: FileService,
    private readonly logs: LogStore,
    private readonly envStore?: EnvStore,
  ) {}

  status() {
    return {
      api: "ONLINE" as const,
      bot: this.state,
      pid: this.child?.pid ?? null,
      discordConnected: this.discordConnected,
      pendingChanges: this.files.isPending(),
      lastError: this.lastError,
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  async start() {
    if (this.action) return;
    if (this.child && !this.child.killed) {
      throw new Error("Bot process is already running");
    }
    this.action = this.doStart()
      .catch((error: unknown) => {
        this.fail(error instanceof Error ? error.message : "Bot start failed");
        throw error;
      })
      .finally(() => {
        this.action = undefined;
      });
    return this.action;
  }

  async stop() {
    if (this.action) return;
    this.action = this.doStop().finally(() => {
      this.action = undefined;
    });
    return this.action;
  }

  async restart() {
    if (this.action) return;
    this.action = (async () => {
      this.state = "RESTARTING";
      this.touch();
      await this.doStop();
      await this.doStart();
    })().catch((error: unknown) => {
      this.fail(error instanceof Error ? error.message : "Bot restart failed");
      throw error;
    }).finally(() => {
      this.action = undefined;
    });
    return this.action;
  }

  async installDependencies(requirements: string) {
    await mkdir(this.workspace, { recursive: true });
    await writeFile(path.join(this.workspace, "requirements.txt"), requirements, "utf8");
    await this.logs.write("INFO", "dependencies", "Instalando dependencias desde requirements.txt");
    return new Promise<void>((resolve, reject) => {
      const pipProcess = spawn(
        process.env.PYTHON_BIN ?? "python3",
        ["-m", "pip", "install", "--disable-pip-version-check", "-r", "requirements.txt"],
        { cwd: this.workspace, env: process.env, stdio: ["ignore", "pipe", "pipe"] },
      );
      const timer = setTimeout(() => {
        pipProcess.kill("SIGTERM");
        reject(new Error("Dependency installation timed out"));
      }, 300_000);
      pipProcess.stdout.on("data", (chunk: Buffer) => void this.logs.write("INFO", "pip", String(chunk)));
      pipProcess.stderr.on("data", (chunk: Buffer) => void this.logs.write("ERROR", "pip", String(chunk)));
      pipProcess.once("error", (error: Error) => {
        clearTimeout(timer);
        reject(error);
      });
      pipProcess.once("exit", (code: number | null) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(new Error(`pip exited with code ${code ?? "unknown"}`));
      });
    });
  }

  private async doStart() {
    this.state = "STARTING";
    this.discordConnected = false;
    this.lastError = null;
    this.touch();
    await this.logs.write("INFO", "bot-manager", "Restaurando archivos desde R2");
    await this.restoreFromR2();
    const requirements = await this.r2.readText("requirements.txt");
    if (!requirements.trim()) {
      throw new Error("R2 requirements.txt is empty");
    }
    await this.installDependencies(requirements);
    await this.logs.write("INFO", "bot-manager", "Iniciando bot Python");
    const runtimeEnv = {
      ...process.env,
      ...(this.envStore ? await this.envStore.getDecrypted() : {}),
      BOT_LOG_FORMAT: "json",
    };
    const child = spawn(
      process.env.PYTHON_BIN ?? "python3",
      ["main.py"],
      {
        cwd: this.workspace,
        env: runtimeEnv,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    this.child = child;
    child.stdout.on("data", (chunk) => this.consumeOutput(String(chunk)));
    child.stderr.on("data", (chunk) => this.consumeOutput(String(chunk), true));
    child.once("error", (error) => this.fail(error.message));
    child.once("exit", (code, signal) => {
      this.child = undefined;
      this.discordConnected = false;
      if (this.state !== "OFFLINE" && this.state !== "RESTARTING") {
        this.fail(`Bot process exited with code ${code ?? "null"} (${signal ?? "no signal"})`);
      }
    });
    this.files.markApplied();
    this.touch();
  }

  private async doStop() {
    const child = this.child;
    if (!child) {
      this.state = "OFFLINE";
      this.discordConnected = false;
      this.touch();
      return;
    }
    await this.logs.write("INFO", "bot-manager", "Solicitando cierre correcto del bot");
    child.stdin.write("shutdown\n");
    child.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        if (!child.killed) child.kill("SIGKILL");
        resolve();
      }, 10_000);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    this.child = undefined;
    this.state = "OFFLINE";
    this.discordConnected = false;
    this.touch();
  }

  private async restoreFromR2() {
    await rm(this.workspace, { recursive: true, force: true });
    await mkdir(this.workspace, { recursive: true });
    const objects = await this.r2.listAll();
    if (objects.length === 0) {
      throw new Error("R2 bucket is empty; upload bot/main.py and requirements.txt before starting");
    }
    for (const object of objects) {
      if (object.path.includes("..") || object.path.startsWith("/")) {
        throw new Error("Unsafe object path in R2");
      }
      const target = path.join(this.workspace, object.path);
      await mkdir(path.dirname(target), { recursive: true });
      const body = await this.r2.read(object.path);
      const bytes = await body.Body?.transformToByteArray();
      if (!bytes) throw new Error(`Could not download ${object.path} from R2`);
      await writeFile(target, bytes);
    }
    if (!objects.some((item) => item.path === "main.py")) {
      throw new Error("R2 is missing main.py");
    }
  }

  private consumeOutput(chunk: string, isError = false) {
    for (const line of chunk.split(/\r?\n/).filter(Boolean)) {
      let message = line;
      let level: "INFO" | "WARNING" | "ERROR" = isError ? "ERROR" : "INFO";
      try {
        const parsed = JSON.parse(line) as { level?: string; message?: string; discord_connected?: boolean };
        message = parsed.message ?? line;
        if (parsed.level === "WARNING" || parsed.level === "ERROR") level = parsed.level;
        if (parsed.discord_connected === true) {
          this.discordConnected = true;
          this.state = "ONLINE";
        }
      } catch {
        // Plain Python logs are still captured verbatim.
      }
      void this.logs.write(level, "bot", message);
    }
  }

  private fail(message: string) {
    this.state = "ERROR";
    this.discordConnected = false;
    this.lastError = message;
    this.touch();
    void this.logs.write("ERROR", "bot-manager", message);
  }

  private touch() {
    this.updatedAt = new Date();
  }
}