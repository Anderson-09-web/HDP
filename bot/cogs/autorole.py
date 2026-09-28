import discord
from discord import app_commands
from discord.ext import commands


class Autorole(commands.Cog):
    @app_commands.command(name="setup_autorole", description="Configura el rol automático")
    async def setup_autorole(self, interaction: discord.Interaction, role: discord.Role) -> None:
        await self.bot.database.save_config(interaction.guild_id or 0, "autorole", {"role_id": role.id, "enabled": True})
        await interaction.response.send_message("Autorole guardado en Neon.", ephemeral=True)

    @commands.Cog.listener()
    async def on_member_join(self, member: discord.Member) -> None:
        config = await self.bot.database.get_config(member.guild.id, "autorole")
        if config:
            role = member.guild.get_role(int(config["role_id"]))
            if role:
                await member.add_roles(role, reason="Autorole configurado")


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(Autorole(bot))