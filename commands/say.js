const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, TextDisplayBuilder, MessageFlags, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('Crear mensajes personalizados con texto, botones e imágenes')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    
    async execute(interaction) {
        try {
            const emojiSettings = interaction.client.emojiManager.getEmoji('settings') || '⚙️';
            const emojiAdd = interaction.client.emojiManager.getEmoji('motivo') || '➕';
            const emojiNew = interaction.client.emojiManager.getEmoji('new') || '🆕';

            const container = new ContainerBuilder();
            container.addTextDisplayComponents([
                new TextDisplayBuilder().setContent(`# ${emojiSettings} Constructor de Mensajes\n\nSelecciona qué tipo de contenido quieres agregar a tu mensaje:\n\n*GTA Stories • Sistema de Mensajes • <t:${Math.floor(Date.now() / 1000)}:F>*`)
            ]);

            const botonTexto = new ButtonBuilder()
                .setCustomId('say_texto')
                .setLabel('Agregar Texto')
                .setStyle(ButtonStyle.Primary)
                .setEmoji(emojiAdd);

            const botonBoton = new ButtonBuilder()
                .setCustomId('say_boton')
                .setLabel('Agregar Botón')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emojiSettings);

            const botonImagen = new ButtonBuilder()
                .setCustomId('say_imagen')
                .setLabel('Agregar Imagen/Video')
                .setStyle(ButtonStyle.Success)
                .setEmoji(emojiNew);

            const actionRow = new ActionRowBuilder().addComponents(botonTexto, botonBoton, botonImagen);
            container.addActionRowComponents([actionRow]);

            await interaction.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });

        } catch (error) {
            console.error('Error en comando say:', error);
            
            const emojiError = interaction.client.emojiManager.getEmoji('error') || '❌';
            const errorContainer = new ContainerBuilder();
            errorContainer.addTextDisplayComponents([
                new TextDisplayBuilder().setContent(`# ${emojiError} Error\n\n-# Error al mostrar el constructor\n\n**Detalles:** ${error.message}\n\n*GTA Stories • Sistema de Mensajes • <t:${Math.floor(Date.now() / 1000)}:F>*`)
            ]);
            
            await interaction.reply({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }
    }
};