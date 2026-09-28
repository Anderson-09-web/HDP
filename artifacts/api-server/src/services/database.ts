import pg from "pg";

export function createDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  return new pg.Pool({
    connectionString: url,
    max: 3,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
  });
}

export async function ensureSchema(pool: pg.Pool | undefined) {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bot_env (
      name TEXT PRIMARY KEY,
      encrypted_value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS bot_config (
      id BIGSERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      system TEXT NOT NULL,
      config JSONB NOT NULL DEFAULT '{}'::jsonb,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (guild_id, system)
    );
    CREATE INDEX IF NOT EXISTS bot_config_guild_system_idx
      ON bot_config (guild_id, system);
  `);
}