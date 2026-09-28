import os

import httpx
from discord import app_commands
from discord.ext import commands


class AI(commands.Cog):
    @app_commands.command(name="setup_ai", description="Configura el proveedor de IA")
    async def setup_ai(self, interaction) -> None:
        provider = "openai" if os.getenv("OPENAI_API_KEY") else "groq" if os.getenv("GROQ_API_KEY") else "none"
        await self.bot.database.save_config(interaction.guild_id or 0, "ai", {"provider": provider, "enabled": provider != "none"})
        await interaction.response.send_message(f"IA configurada con proveedor: {provider}.", ephemeral=True)

    async def request(self, url: str, payload: dict[str, object]) -> dict[str, object]:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            return response.json()


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(AI(bot))