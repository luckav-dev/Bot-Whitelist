const { SlashCommandBuilder, PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Eliminar una cantidad específica de mensajes del canal')
        .addIntegerOption(option =>
            option.setName('cantidad')
                .setDescription('Número de mensajes a eliminar (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    
    async execute(interaction) {
        try {
            const cantidad = interaction.options.getInteger('cantidad');
            const channel = interaction.channel;

            if (!channel.isTextBased()) {
                const errorContainer = new ContainerBuilder();
                errorContainer.addTextDisplayComponents([
                    new TextDisplayBuilder().setContent(
                        `# ${interaction.client.emojiManager.getEmoji('error')} Error\n\n` +
                        `> ${interaction.client.emojiManager.getEmoji('warning')} **No se puede usar aquí**\n\n` +
                        `Este comando solo funciona en canales de texto\n\n` +
                        `*Sistema de Moderación* • `
                    )
                ]);
                return await interaction.reply({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                });
            }

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const messages = await channel.messages.fetch({ limit: cantidad });
            const deletedMessages = await channel.bulkDelete(messages, true);

            const successContainer = new ContainerBuilder();
            successContainer.addTextDisplayComponents([
                new TextDisplayBuilder().setContent(
                    `# ${interaction.client.emojiManager.getEmoji('success')} Mensajes Eliminados\n\n` +
                    `> ${interaction.client.emojiManager.getEmoji('delete')} **Cantidad eliminada:** ${deletedMessages.size}\n\n` +
                    `> ${interaction.client.emojiManager.getEmoji('announcements')} **Canal:** ${channel}\n\n` +
                    `> ${interaction.client.emojiManager.getEmoji('user')} **Moderador:** ${interaction.user}\n\n` +
                    `*Sistema de Moderación* • <t:${Math.floor(Date.now() / 1000)}:F>`
                )
            ]);

            await interaction.editReply({
                components: [successContainer],
                flags: MessageFlags.IsComponentsV2
            });

        } catch (error) {
            console.error('Error en comando clear:', error);
            
            const errorContainer = new ContainerBuilder();
            errorContainer.addTextDisplayComponents([
                new TextDisplayBuilder().setContent(
                    `# ${interaction.client.emojiManager.getEmoji('error')} Error al eliminar mensajes\n\n` +
                    `> ${interaction.client.emojiManager.getEmoji('warning')} **No se pudieron eliminar los mensajes**\n\n` +
                    `Posibles causas:\n` +
                    `• Los mensajes son muy antiguos (más de 14 días)\n` +
                    `• No tengo permisos suficientes\n` +
                    `• Error de conexión\n\n` +
                    `*Sistema de Moderación* • `
                )
            ]);

            if (interaction.deferred) {
                await interaction.editReply({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2
                });
            } else {
                await interaction.reply({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                });
            }
        }
    }
};