const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('verinvitaciones')
        .setDescription('Ver información de invitaciones VIP (Solo Administradores)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('tipo')
                .setDescription('Tipo de consulta')
                .setRequired(true)
                .addChoices(
                    { name: 'Ver usuarios invitados por un VIP', value: 'vip_invitados' },
                    { name: 'Ver qué VIP invitó a un usuario', value: 'quien_invito' }
                )
        ),
    
    async execute(interaction) {
        const tipo = interaction.options.getString('tipo');
        const emojiSettings = interaction.client.emojiManager.getEmoji('settings') || '⚙️';
        const emojiUser = interaction.client.emojiManager.getEmoji('user') || '👤';
        const emojiSearch = interaction.client.emojiManager.getEmoji('new') || '🔍';

        if (tipo === 'vip_invitados') {
            const container = new ContainerBuilder();
            container.addTextDisplayComponents([
                new TextDisplayBuilder().setContent(`# ${emojiSettings} Consultar Invitaciones VIP\n\n-# Ver usuarios invitados por un miembro VIP\n\n**Instrucciones:**\nIngresa la ID del usuario VIP para ver todos los usuarios que ha invitado\n\n*Sistema de Invitaciones • <t:${Math.floor(Date.now() / 1000)}:F>*`)
            ]);

            const botonConsultar = new ButtonBuilder()
                .setCustomId('consultar_vip_invitados')
                .setLabel('Ingresar ID del VIP')
                .setStyle(ButtonStyle.Primary)
                .setEmoji(emojiUser);

            const actionRow = new ActionRowBuilder().addComponents(botonConsultar);
            container.addActionRowComponents([actionRow]);

            await interaction.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });

        } else if (tipo === 'quien_invito') {
            const container = new ContainerBuilder();
            container.addTextDisplayComponents([
                new TextDisplayBuilder().setContent(`# ${emojiSettings} Consultar Origen de Invitación\n\n-# Ver qué VIP invitó a un usuario específico\n\n**Instrucciones:**\nIngresa la ID del usuario invitado para ver quién lo invitó\n\n*Sistema de Invitaciones • <t:${Math.floor(Date.now() / 1000)}:F>*`)
            ]);

            const botonConsultar = new ButtonBuilder()
                .setCustomId('consultar_quien_invito')
                .setLabel('Ingresar ID del Invitado')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(emojiSearch);

            const actionRow = new ActionRowBuilder().addComponents(botonConsultar);
            container.addActionRowComponents([actionRow]);

            await interaction.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }
    }
};