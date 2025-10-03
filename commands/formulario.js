const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, SectionBuilder, SeparatorBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('formulario')
        .setDescription('Solicitar formulario para el servidor de FiveM'),

    async execute(interaction) {
        const container = new ContainerBuilder();
        

        const formularioButton = new ButtonBuilder()
            .setCustomId('formulario_apply')
            .setLabel(`Aplicar para Formulario`)
            .setEmoji(interaction.client.emojiManager.getEmoji('motivo'))
            .setStyle(ButtonStyle.Primary);

        const fichaPJButton = new ButtonBuilder()
            .setCustomId('ficha_pj_apply')
            .setLabel(`Ficha PJ`)
            .setEmoji(interaction.client.emojiManager.getEmoji('fivem'))
            .setStyle(ButtonStyle.Secondary);

        container.addTextDisplayComponents([
            new TextDisplayBuilder().setContent(
                
                `# ${interaction.client.emojiManager.getEmoji('whitelist')} Sistema de Whitelist - GTA Stories\n\n` +
                `> **¡Bienvenido al sistema de GTA Stories!**\n\n` +
                `*Para acceder al servidor, necesitas completar el proceso de Formulario y crear tu Ficha de Personaje.*\n\n` +
                `${interaction.client.emojiManager.getEmoji('settings')} **Requisitos Mínimos:**\n` +
                `> • Tener **experiencia previa** en roleplay\n` +
                `> • Conocer las **reglas básicas** del servidor\n` +
                `> • Tener al menos **100 horas** en FiveM\n\n` +
                `${interaction.client.emojiManager.getEmoji('user')} **Proceso de Solicitud:**\n` +
                `\`\`\`\n` +
                `1. Completa el formulario → Primer botón\n` +
                `2. Crea tu ficha de personaje → Segundo botón\`\`\`\n` +
                `${interaction.client.emojiManager.getEmoji('announcements')} **Iniciar Proceso**\n`
            )
        ]);

        const seccionFormulario = new SectionBuilder()
            .addTextDisplayComponents([
                new TextDisplayBuilder()
                    .setContent(`${interaction.client.emojiManager.getEmoji('reply')} **Formulario de Aplicación:** Para solicitar acceso al servidor`)
            ])
            .setButtonAccessory(formularioButton);

        const seccionFichaPJ = new SectionBuilder()
            .addTextDisplayComponents([
                new TextDisplayBuilder()
                    .setContent(`${interaction.client.emojiManager.getEmoji('reply')} **Ficha PJ:** Para crear tu personaje`)
            ])
            .setButtonAccessory(fichaPJButton);

        container.addSectionComponents([seccionFormulario]);
        container.addSectionComponents([seccionFichaPJ]);

        container.addSeparatorComponents([
            new SeparatorBuilder()
        ]);

        const mediaGallery = new MediaGalleryBuilder()
            .addItems([
                new MediaGalleryItemBuilder()
                    .setURL('https://media.discordapp.net/attachments/1415856744613019659/1417946042976047284/GTA_STORIES_BANNER_CON_LOGOTIPO_MAY.png?ex=68cc54a8&is=68cb0328&hm=83984fca247517bce885e92498ae232f83cbfcc694719224c05095b5dd882029&=&format=webp&quality=lossless&width=1569&height=856')
                    .setDescription('GTA Stories Banner')
            ]);

        container.addMediaGalleryComponents([mediaGallery]);

        container.addSeparatorComponents([
            new SeparatorBuilder()
        ]);

        container.addTextDisplayComponents([
            new TextDisplayBuilder().setContent(
                `*Sistema de Formularios* • ${interaction.client.emojiManager.getEmoji('warning')} Este sistema tiene **Derechos de Autor** ${interaction.client.user.username}© 2025`
            )
        ]);

        await interaction.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });
    }
};
