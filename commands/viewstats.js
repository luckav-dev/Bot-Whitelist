const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { getStats } = require('../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('viewstats')
        .setDescription('Ver estadísticas del sistema de formulario'),
    
    async execute(interaction) {
        try {
            const stats = getStats();
            
            const statsDescription = `> **Datos actuales del sistema de formulario de GTA Stories**\n\n*Información actualizada en tiempo real*\n\n` +
                `-# ${interaction.client.emojiManager.getEmoji('success')} **Solicitudes Aceptadas**\n` +
                `\`\`\`\n${stats.accepted} usuarios aprobados\`\`\`\n\n` +
                `-# ${interaction.client.emojiManager.getEmoji('error')} **Solicitudes Denegadas**\n` +
                `\`\`\`\n${stats.denied} solicitudes rechazadas\`\`\`\n\n` +
                `-# ${interaction.client.emojiManager.getEmoji('loading')} **Solicitudes Pendientes**\n` +
                `\`\`\`\n${stats.total - stats.accepted - stats.denied} en revisión\`\`\`\n\n` +
                `> **Total de Solicitudes:** **${stats.total}**\n\n` +
                `*Última actualización: <t:${Math.floor(Date.now() / 1000)}:F>*`;
            
            const statsContainer = new ContainerBuilder();
            statsContainer.addTextDisplayComponents([
                new TextDisplayBuilder().setContent(`# ${interaction.client.emojiManager.getEmoji('settings')} Estadísticas del Sistema\n\n${statsDescription}`)
            ]);
            
            await interaction.reply({ 
                components: [statsContainer],
                flags: MessageFlags.IsComponentsV2
            });
        } catch (error) {
            console.error('Error al obtener estadísticas:', error);
            const errorContainer = new ContainerBuilder();
            errorContainer.addTextDisplayComponents([
                new TextDisplayBuilder().setContent(`# ${interaction.client.emojiManager.getEmoji('error')} Error\n\n-# Hubo un error al obtener las estadísticas\n\n*GTA Stories • Sistema de Estadísticas • <t:${Math.floor(Date.now() / 1000)}:F>*`)
            ]);
            
            await interaction.reply({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }
    }
};