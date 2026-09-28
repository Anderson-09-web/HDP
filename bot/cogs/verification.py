from discord import app_commands
from discord.ext import commands


class Verification(commands.Cog):
    @app_commands.command(name="setup_verification", description="Configura verificación")
    async def setup_verification(self, interaction) -> None:
        await self.bot.database.save_config(interaction.guild_id or 0, "verification", {"enabled": True})
        await interaction.response.send_message("Verification guardado en Neon.", ephemeral=True)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(Verification(bot))