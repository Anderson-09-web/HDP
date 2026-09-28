import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type LogLevel = "INFO" | "WARNING" | "ERROR";

export type LogEntry = {
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
};

const MAX_BYTES = 2_000_000;
const MAX_ITEMS = 5_000;

export class LogStore {
  private readonly filePath: string;

  constructor(root = process.env.LOG_DIR ?? "/tmp/discord-bot-hosting") {
    this.filePath = path.join(root, "platform.log");
  }

  async write(level: LogLevel, source: string, message: string) {
    const line = JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      source,
      message: message.slice(0, 4_000),
    });
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await appendFile(this.filePath, `${line}\n`, "utf8");
    await this.trim();
  }

  async list(options: {
    level?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }) {
    const entries = await this.readAll();
    const level = options.level?.toUpperCase();
    const search = options.search?.trim().toLowerCase();
    const filtered = entries.filter((entry) => {
      const levelMatch = !level || level === "ALL" || entry.level === level;
      const searchMatch =
        !search ||
        `${entry.source} ${entry.message}`.toLowerCase().includes(search);
      return levelMatch && searchMatch;
    });
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 30));
    const start = (page - 1) * pageSize;
    return {
      items: filtered.slice(start, start + pageSize),
      page,
      pageSize,
      total: filtered.length,
    };
  }

  async text() {
    const entries = await this.readAll();
    return entries
      .map(
        (entry) =>
          `[${entry.timestamp}] [${entry.level}] [${entry.source}] ${entry.message}`,
      )
      .join("\n");
  }

  private async readAll(): Promise<LogEntry[]> {
    try {
      const content = await readFile(this.filePath, "utf8");
      return content
        .split("\n")
        .filter(Boolean)
        .slice(-MAX_ITEMS)
        .flatMap((line) => {
          try {
            const parsed = JSON.parse(line) as LogEntry;
            return parsed.timestamp && parsed.level ? [parsed] : [];
          } catch {
            return [];
          }
        });
    } catch {
      return [];
    }
  }

  private async trim() {
    try {
      const content = await readFile(this.filePath, "utf8");
      if (Buffer.byteLength(content) <= MAX_BYTES) return;
      const kept = content.split("\n").slice(-MAX_ITEMS).join("\n");
      await writeFile(this.filePath, kept, "utf8");
    } catch {
      // Logging must never crash the API.
    }
  }
}