import asyncio
import importlib
import json
import logging
import os
import pkgutil
import signal
from pathlib import Path

import discord
from discord.ext import commands

from utils.persistence import Database


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        level = "WARNING" if record.levelno >= logging.WARNING else "INFO"
        if record.levelno >= logging.ERROR:
            level = "ERROR"
        payload = {"level": level, "message": super().format(record)}
        if getattr(record, "discord_connected", False):
            payload["discord_connected"] = True
        return json.dumps(payload)


logging.basicConfig(level=logging.INFO, handlers=[logging.StreamHandler()])
for handler in logging.getLogger().handlers:
    handler.setFormatter(JsonFormatter("%(name)s: %(message)s"))
logger = logging.getLogger("discord-bot")


class HostedBot(commands.Bot):
    def __init__(self) -> None:
        intents = discord.Intents.default()
        intents.members = True
        intents.message_content = True
        super().__init__(command_prefix=os.getenv("BOT_PREFIX", "!"), intents=intents)
        self.database = Database()

    async def setup_hook(self) -> None:
        await self.database.connect()
        cogs_path = Path(__file__).parent / "cogs"
        for module in sorted(pkgutil.iter_modules([str(cogs_path)]), key=lambda item: item.name):
            if module.name.startswith("_"):
                continue
            extension = f"cogs.{module.name}"
            try:
                await self.load_extension(extension)
                logger.info("Cog %s cargado", module.name)
            except Exception:
                logger.exception("Error en %s", module.name)
        synced = await self.tree.sync()
        logger.info("%d comandos slash sincronizados", len(synced))

    async def on_ready(self) -> None:
        logger.info("Discord conectado como %s", self.user, extra={"discord_connected": True})

    async def close(self) -> None:
        await self.database.close()
        await super().close()


async def run() -> None:
    token = os.getenv("DISCORD_TOKEN")
    if not token:
        raise RuntimeError("DISCORD_TOKEN is required")
    bot = HostedBot()
    loop = asyncio.get_running_loop()
    stop_event = asyncio.Event()

    for signal_name in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(signal_name, stop_event.set)

    task = asyncio.create_task(bot.start(token))
    await stop_event.wait()
    await bot.close()
    await task


if __name__ == "__main__":
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        pass