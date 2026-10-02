import path from "node:path";
import { R2Store, type StoredObject } from "./r2-store";

const MAX_FILE_BYTES = 1_000_000;
const SAFE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/;

export function safeBotPath(value: string) {
  const normalized = value.replaceAll("\\", "/").replace(/^\/+/, "");
  if (
    !normalized ||
    normalized.length > 240 ||
    !SAFE_PATH.test(normalized) ||
    path.posix.normalize(normalized) !== normalized
  ) {
    throw new Error("Invalid bot file path");
  }
  return normalized;
}

export class FileService {
  private pending = false;

  constructor(private readonly r2: R2Store) {}

  async list(prefix = "") {
    return {
      files: await this.r2.list(prefix, true),
      pendingChanges: this.pending,
    };
  }

  async create(input: { path: string; kind: "file" | "directory"; content?: string }) {
    const filePath = safeBotPath(input.path);
    if (input.kind === "directory") {
      const entry = await this.r2.putDirectory(filePath);
      this.pending = true;
      return entry;
    }
    const content = input.content ?? "";
    this.assertSize(content);
    const entry = await this.r2.putText(filePath, content);
    this.pending = true;
    return entry;
  }

  async createMissing(files: Array<{ path: string; content: string }>) {
    const existing = new Set((await this.r2.listAll()).map((file) => file.path));
    const created: string[] = [];
    const skipped: string[] = [];

    for (const file of files) {
      const filePath = safeBotPath(file.path);
      if (existing.has(filePath)) {
        skipped.push(filePath);
        continue;
      }
      this.assertSize(file.content);
      await this.r2.putText(filePath, file.content);
      created.push(filePath);
    }

    if (created.length) this.pending = true;
    return { created, skipped };
  }

  async update(filePath: string, content: string) {
    const safePath = safeBotPath(filePath);
    this.assertSize(content);
    const entry = await this.r2.putText(safePath, content);
    this.pending = true;
    return entry;
  }

  async remove(filePath: string) {
    const safePath = safeBotPath(filePath);
    await this.r2.delete(safePath);
    this.pending = true;
  }

  async download(filePath: string) {
    return this.r2.read(safeBotPath(filePath));
  }

  markApplied() {
    this.pending = false;
  }

  isPending() {
    return this.pending;
  }

  private assertSize(content: string) {
    if (Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES) {
      throw new Error("File exceeds the 1 MB limit");
    }
  }
}

export function dependencyLines(content: string) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

export function parseDependency(line: string) {
  const match = /^([A-Za-z0-9_.-]+)(?:\s*(===|==|!=|~=|>=|<=|>|<)\s*([A-Za-z0-9.*+!_-]+))?$/.exec(line);
  if (!match) return undefined;
  return { name: match[1], version: match[2] ? `${match[2]}${match[3]}` : "" };
}