from discord import app_commands
from discord.ext import commands


class Tickets(commands.Cog):
    @app_commands.command(name="setup_tickets", description="Configura el sistema de tickets")
    async def setup_tickets(self, interaction) -> None:
        await self.bot.database.save_config(interaction.guild_id or 0, "tickets", {"enabled": True})
        await interaction.response.send_message("Tickets guardado en Neon.", ephemeral=True)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(Tickets(bot))