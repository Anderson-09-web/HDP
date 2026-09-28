import crypto from "node:crypto";
import pg from "pg";

export type EnvironmentVariable = {
  name: string;
  configured: boolean;
  masked: boolean;
  updatedAt: string;
};

const protectedNames = new Set([
  "DATABASE_URL",
  "SESSION_SECRET",
  "R2_SECRET_KEY",
  "R2_ACCESS_KEY",
  "R2_ENDPOINT",
  "R2_BUCKET",
]);

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required to persist variables");
  return crypto.createHash("sha256").update(secret).digest();
}

export class EnvStore {
  private readonly pool?: pg.Pool;

  constructor(pool?: pg.Pool, private readonly ready?: Promise<void>) {
    this.pool = pool;
  }

  async list(): Promise<EnvironmentVariable[]> {
    if (!this.pool) return [];
    await this.ready;
    const result = await this.pool.query(
      "SELECT name, updated_at FROM bot_env ORDER BY name",
    );
    return result.rows.map((row) => ({
      name: row.name,
      configured: true,
      masked: true,
      updatedAt: new Date(row.updated_at).toISOString(),
    }));
  }

  async upsert(name: string, value: string) {
    if (protectedNames.has(name)) {
      throw new Error(`${name} is managed by Render/Replit secrets and cannot be edited here`);
    }
    if (!this.pool) throw new Error("DATABASE_URL is required for persistent variables");
    await this.ready;
    const encrypted = this.encrypt(value);
    const result = await this.pool.query(
      `INSERT INTO bot_env (name, encrypted_value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (name) DO UPDATE SET encrypted_value = EXCLUDED.encrypted_value, updated_at = NOW()
       RETURNING name, updated_at`,
      [name, encrypted],
    );
    return {
      name: result.rows[0].name,
      configured: true,
      masked: true,
      updatedAt: new Date(result.rows[0].updated_at).toISOString(),
    };
  }

  async delete(name: string) {
    if (!this.pool) throw new Error("DATABASE_URL is required for persistent variables");
    await this.ready;
    await this.pool.query("DELETE FROM bot_env WHERE name = $1", [name]);
  }

  async getDecrypted(): Promise<Record<string, string>> {
    if (!this.pool) return {};
    await this.ready;
    const result = await this.pool.query(
      "SELECT name, encrypted_value FROM bot_env ORDER BY name",
    );
    return Object.fromEntries(
      result.rows.map((row) => [row.name, this.decrypt(row.encrypted_value)]),
    );
  }

  private encrypt(value: string) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", secretKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return `${iv.toString("base64")}.${cipher.getAuthTag().toString("base64")}.${encrypted.toString("base64")}`;
  }

  private decrypt(value: string) {
    const [ivValue, tagValue, encryptedValue] = value.split(".");
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      secretKey(),
      Buffer.from(ivValue, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tagValue, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64")),
      decipher.final(),
    ]).toString("utf8");
  }
}