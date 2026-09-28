import discord
from discord import app_commands
from discord.ext import commands


class Moderation(commands.Cog):
    @app_commands.command(name="setup_moderation", description="Activa la configuración de moderación")
    async def setup_moderation(self, interaction: discord.Interaction) -> None:
        await self.bot.database.save_config(interaction.guild_id or 0, "moderation", {"enabled": True})
        await interaction.response.send_message("Moderation guardado en Neon.", ephemeral=True)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(Moderation(bot))