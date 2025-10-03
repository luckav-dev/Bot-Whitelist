const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, SectionBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('encuesta')
        .setDescription('Crear una nueva encuesta para el servidor'),

    async execute(interaccion) {
        const containerPrincipal = new ContainerBuilder();
        
        containerPrincipal.addTextDisplayComponents([
            new TextDisplayBuilder().setContent(`# ${interaccion.client.emojiManager.getEmoji('estrellita')} Sistema de Encuestas\n\n-# ${interaccion.client.emojiManager.getEmoji('notificacion')} Selecciona el tipo de encuesta que deseas crear`)
        ]);

        const botonSiNo = new ButtonBuilder()
            .setCustomId('encuesta_tipo_si_no')
            .setLabel('Encuesta Sí/No')
            .setStyle(ButtonStyle.Primary);

        const botonMultiple = new ButtonBuilder()
            .setCustomId('encuesta_tipo_multiple')
            .setLabel('Encuesta Múltiple')
            .setStyle(ButtonStyle.Secondary);

        const seccionSiNo = new SectionBuilder()
            .addTextDisplayComponents([
                new TextDisplayBuilder()
                    .setContent(`${interaccion.client.emojiManager.getEmoji('uno')} **Encuesta Sí/No**\n-# Crear una encuesta con opciones de Sí y No`)
            ])
            .setButtonAccessory(botonSiNo);

        const seccionMultiple = new SectionBuilder()
            .addTextDisplayComponents([
                new TextDisplayBuilder()
                    .setContent(`${interaccion.client.emojiManager.getEmoji('dos')} **Encuesta de Opción Múltiple**\n-# Crear una encuesta con múltiples opciones personalizadas`)
            ])
            .setButtonAccessory(botonMultiple);

        containerPrincipal.addSectionComponents([seccionSiNo]);
        containerPrincipal.addSectionComponents([seccionMultiple]);
        
        containerPrincipal.addTextDisplayComponents([
            new TextDisplayBuilder().setContent(`\n*GTA Stories • Sistema de Encuestas • *`)
        ]);

        await interaccion.reply({
            components: [containerPrincipal],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });
    }
};
