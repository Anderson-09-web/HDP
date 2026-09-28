from discord import app_commands
from discord.ext import commands


class Levels(commands.Cog):
    @app_commands.command(name="setup_levels", description="Configura niveles")
    async def setup_levels(self, interaction) -> None:
        await self.bot.database.save_config(interaction.guild_id or 0, "levels", {"enabled": True})
        await interaction.response.send_message("Levels guardado en Neon.", ephemeral=True)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(Levels(bot))