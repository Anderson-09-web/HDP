from discord import app_commands
from discord.ext import commands


class Economy(commands.Cog):
    @app_commands.command(name="setup_economy", description="Configura economía")
    async def setup_economy(self, interaction) -> None:
        await self.bot.database.save_config(interaction.guild_id or 0, "economy", {"enabled": True})
        await interaction.response.send_message("Economy guardado en Neon.", ephemeral=True)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(Economy(bot))