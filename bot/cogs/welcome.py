import discord
from discord import app_commands
from discord.ext import commands


class Welcome(commands.Cog):
    @app_commands.command(name="setup_welcome", description="Configura el sistema de bienvenida")
    @app_commands.describe(channel="Canal donde enviar bienvenidas", message="Mensaje con {member}")
    async def setup_welcome(self, interaction: discord.Interaction, channel: discord.TextChannel, message: str) -> None:
        await self.bot.database.save_config(
            interaction.guild_id or 0,
            "welcome",
            {"channel_id": channel.id, "message": message, "enabled": True},
        )
        await interaction.response.send_message("Welcome guardado en Neon.", ephemeral=True)

    @commands.Cog.listener()
    async def on_member_join(self, member: discord.Member) -> None:
        config = await self.bot.database.get_config(member.guild.id, "welcome")
        if config:
            channel = member.guild.get_channel(int(config["channel_id"]))
            if isinstance(channel, discord.TextChannel):
                await channel.send(str(config["message"]).replace("{member}", member.mention))


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(Welcome(bot))