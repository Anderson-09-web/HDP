import os
from typing import Any

import asyncpg


class Database:
    def __init__(self) -> None:
        self.pool: asyncpg.Pool | None = None

    async def connect(self) -> None:
        url = os.getenv("DATABASE_URL")
        if not url:
            raise RuntimeError("DATABASE_URL is required for Neon persistence")
        self.pool = await asyncpg.create_pool(url, min_size=1, max_size=2, timeout=5)
        await self.pool.execute(
            """
            CREATE TABLE IF NOT EXISTS bot_config (
                id BIGSERIAL PRIMARY KEY,
                guild_id TEXT NOT NULL,
                system TEXT NOT NULL,
                config JSONB NOT NULL DEFAULT '{}'::jsonb,
                enabled BOOLEAN NOT NULL DEFAULT TRUE,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE (guild_id, system)
            )
            """
        )

    async def close(self) -> None:
        if self.pool:
            await self.pool.close()

    async def save_config(self, guild_id: int, system: str, config: dict[str, Any]) -> None:
        if not self.pool:
            raise RuntimeError("Database is not connected")
        await self.pool.execute(
            """
            INSERT INTO bot_config (guild_id, system, config, enabled, updated_at)
            VALUES ($1, $2, $3::jsonb, TRUE, NOW())
            ON CONFLICT (guild_id, system)
            DO UPDATE SET config = EXCLUDED.config, updated_at = NOW(), enabled = TRUE
            """,
            str(guild_id),
            system,
            __import__("json").dumps(config),
        )

    async def get_config(self, guild_id: int, system: str) -> dict[str, Any] | None:
        if not self.pool:
            raise RuntimeError("Database is not connected")
        row = await self.pool.fetchrow(
            "SELECT config FROM bot_config WHERE guild_id = $1 AND system = $2 AND enabled = TRUE",
            str(guild_id),
            system,
        )
        return dict(row["config"]) if row else None