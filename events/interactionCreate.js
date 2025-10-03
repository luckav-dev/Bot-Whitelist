const { Events, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, ContainerBuilder, TextDisplayBuilder, SectionBuilder, SeparatorBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, ChannelType, FileBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../config.json');
const { addApplication, updateApplicationStatus, addFichaPJApplication, updateFichaPJStatus, getFormularioMessageUrl, getFichaPJMessageUrl, getFormularioStatus, getFichaPJStatus, tieneFormularioEnviado, tieneFichaPJEnviada, getFichaPJSuspensions, updateInterviewerStats, addFichaPJTicket, getFichaPJChannelId } = require('../utils/database');
const { crearEncuesta, actualizarMensajeId, registrarVoto, obtenerEncuesta } = require('../utils/encuestas');
const { tieneRolStaff, puedeGestionarFormularios, puedeAceptarDenegarFormularios, crearMensajeErrorPermisos, crearMensajeErrorEntrevistador, crearMensajeErrorStaff } = require('../utils/roleChecker');
const discordTranscripts = require('discord-html-transcripts');
const fs = require('fs');
const path = require('path');

function numeroAPalabra(numero) {
    const numeros = {
        1: 'uno',
        2: 'dos',
        3: 'tres',
        4: 'cuatro',
        5: 'cinco',
        6: 'seis',
        7: 'siete',
        8: 'ocho',
        9: 'nueve',
        10: 'diez'
    };
    return numeros[numero] || numero.toString();
}

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        try {
            if (!interaction.client.isReady()) {
                console.log('Bot no está listo, ignorando interacción');
                return;
            }

            if (interaction.isChatInputCommand()) {
                if (!tieneRolStaff(interaction.member)) {
                    const errorContainer = new ContainerBuilder();
                    errorContainer.addTextDisplayComponents([
                        new TextDisplayBuilder().setContent(crearMensajeErrorStaff(interaction.client.emojiManager))
                    ]);
                    return await interaction.reply({
                        components: [errorContainer],
                        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                    });
                }

                const command = interaction.client.commands.get(interaction.commandName);
                if (!command) {
                    console.error(`No se encontró el comando ${interaction.commandName}.`);
                    return;
                }

                try {
                    await command.execute(interaction);
                } catch (error) {
                    console.error('Error ejecutando comando:', error);
                    try {
                        const errorMessage = {
                            content: `${interaction.client.emojiManager.getEmoji('error')} Hubo un error al ejecutar este comando.`,
                            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                        };
                        if (interaction.replied || interaction.deferred) {
                            await interaction.followUp(errorMessage);
                        } else {
                            await interaction.reply(errorMessage);
                        }
                    } catch (replyError) {
                        console.error('Error al responder con mensaje de error:', replyError);
                    }
                }
            }

            if (interaction.isAutocomplete()) {
                try {
                    if (!interaction.client.isReady()) {
                        return;
                    }

                    const command = interaction.client.commands.get(interaction.commandName);
                    if (!command || !command.autocomplete) {
                        return;
                    }

                    await command.autocomplete(interaction);
                } catch (error) {
                    console.error('Error en autocomplete:', error);
                }
            }

            if (interaction.isButton()) {
                try {
                    if (!interaction.client.isReady()) {
                        return;
                    }

                    if (interaction.customId === 'formulario_apply') {
                        const member = interaction.member;
                        const formularioRole = interaction.guild.roles.cache.get(config.rolesAprobacion.formularioRoleId);

                        if (member.roles.cache.has(config.rolesSuspenso.formRechazadoRoleId)) {
                            await interaction.deferReply({ ephemeral: true });
                            const blockedContainer = new ContainerBuilder();
                            blockedContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(
                                    `# ${interaction.client.emojiManager.getEmoji('error')} Acceso Denegado\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('warning')} **No puedes aplicar**\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('announcements')} **Motivo:** Tienes formulario suspendido\n` +
                                    `No puedes enviar formularios mientras tengas la suspensión activa\n\n` +
                                    `*Sistema de Formulario* • `
                                )
                            ]);
                            return await interaction.editReply({
                                components: [blockedContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        }

                        if (member.roles.cache.has(config.rolesAprobacion.formularioRoleId)) {
                            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                            const alreadyHasRoleContainer = new ContainerBuilder();
                            alreadyHasRoleContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(
                                    `# ${interaction.client.emojiManager.getEmoji('warning')} Ya tienes acceso\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('success')} **¡Ya tienes el rol de formulario!**\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('whitelist')} **Rol actual:** ${formularioRole ? `<@&${formularioRole.id}>` : 'Rol de Formulario'}\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('announcements')} **No puedes volver a aplicar**\n` +
                                    `Ya tienes acceso a hacer la ficha del pj de GTA Stories\n\n` +
                                    `*Sistema de Formulario* • `
                                )
                            ]);
                            return await interaction.editReply({
                                components: [alreadyHasRoleContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        }

                        if (tieneFormularioEnviado(member.user.id)) {
                            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                            const alreadySubmittedContainer = new ContainerBuilder();
                            alreadySubmittedContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(
                                    `# ${interaction.client.emojiManager.getEmoji('error')} Formulario ya enviado\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('warning')} **Ya has enviado un formulario**\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('announcements')} **No puedes enviar otro**\n` +
                                    `Solo se permite un formulario por usuario\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('settings')} **Estado actual**\n` +
                                    `Tu formulario está siendo procesado por el staff\n\n` +
                                    `*Sistema de Formulario* • `
                                )
                            ]);
                            return await interaction.editReply({
                                components: [alreadySubmittedContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        }

                        const modal = new ModalBuilder()
                            .setCustomId('formulario_modal')
                            .setTitle('Solicitud de Formulario - GTA Stories');

                        const steamInput = new TextInputBuilder()
                            .setCustomId('url_steam')
                            .setLabel('URL de Steam')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('https://steamcommunity.com/profiles/...')
                            .setRequired(true)
                            .setMaxLength(200);

                        const serversInput = new TextInputBuilder()
                            .setCustomId('servidores_roleados')
                            .setLabel('Servidores en los que hayas roleado')
                            .setStyle(TextInputStyle.Paragraph)
                            .setPlaceholder('Menciona los servidores donde has jugado roleplay...')
                            .setRequired(true)
                            .setMaxLength(500);

                        const rolInput = new TextInputBuilder()
                            .setCustomId('rol_gta_stories')
                            .setLabel('Que rol vas a llevar en GTA Stories')
                            .setStyle(TextInputStyle.Paragraph)
                            .setPlaceholder('Describe el personaje que planeas interpretar...')
                            .setRequired(true)
                            .setMaxLength(300);

                        const sancionesInput = new TextInputBuilder()
                            .setCustomId('sanciones_activas')
                            .setLabel('Tienes alguna sanción activa?')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('Sí/No - Si es sí, explica brevemente')
                            .setRequired(true)
                            .setMaxLength(200);

                        const horasInput = new TextInputBuilder()
                            .setCustomId('horas_fivem')
                            .setLabel('Horas en FiveM')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('Ejemplo: 500 horas')
                            .setRequired(true)
                            .setMaxLength(50);

                        const firstRow = new ActionRowBuilder().addComponents(steamInput);
                        const secondRow = new ActionRowBuilder().addComponents(serversInput);
                        const thirdRow = new ActionRowBuilder().addComponents(rolInput);
                        const fourthRow = new ActionRowBuilder().addComponents(sancionesInput);
                        const fifthRow = new ActionRowBuilder().addComponents(horasInput);

                        modal.addComponents(firstRow, secondRow, thirdRow, fourthRow, fifthRow);

                        await interaction.showModal(modal);
                    }

                    if (interaction.customId === 'ficha_pj_apply') {
                        const member = interaction.member;
                        const fichaPjRole = interaction.guild.roles.cache.get(config.rolesAprobacion.FichaPjRoleid);

                        if (member.roles.cache.has(config.rolesAprobacion.FichaPjRoleid)) {
                            const alreadyHasRoleContainer = new ContainerBuilder();
                            alreadyHasRoleContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(
                                    `# ${interaction.client.emojiManager.getEmoji('warning')} Ya tienes acceso\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('success')} **¡Ya tienes el rol de ficha PJ!**\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('whitelist')} **Rol actual:** ${fichaPjRole ? `<@&${fichaPjRole.id}>` : 'Rol de Ficha PJ'}\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('announcements')} **No puedes volver a aplicar**\n` +
                                    `Ya tienes acceso a hacer la ficha del pj de GTA Stories\n\n` +
                                    `*Sistema de Ficha PJ* • `
                                )
                            ]);
                            return await interaction.reply({
                                components: [alreadyHasRoleContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        }

                        if (!member.roles.cache.has(config.rolesAprobacion.formularioRoleId)) {
                            const noFormularioContainer = new ContainerBuilder();
                            noFormularioContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(
                                    `# ${interaction.client.emojiManager.getEmoji('warning')} Formulario Requerido\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('announcements')} **Debes completar el formulario primero**\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('user')} **Proceso requerido:**\n` +
                                    `1. Envía tu formulario de ingreso\n` +
                                    `2. Espera la aprobación del entrevistador\n` +
                                    `3. Una vez aprobado, podrás crear un ticket para enviar tu ficha PJ\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('settings')} **Estado actual:** Sin formulario aprobado\n\n` +
                                    `*Sistema de Ficha PJ* • `
                                )
                            ]);
                            return await interaction.reply({
                                components: [noFormularioContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        }

                        if (member.roles.cache.has(config.rolesAprobacion.formRechazadoRoleId)) {
                            const blockedContainer = new ContainerBuilder();
                            blockedContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(
                                    `# ${interaction.client.emojiManager.getEmoji('error')} Acceso Denegado\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('warning')} **No puedes aplicar**\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('announcements')} **Motivo:** Tienes formulario suspendido\n` +
                                    `No puedes hacer ficha PJ mientras tengas el formulario suspendido\n\n` +
                                    `*Sistema de Ficha PJ* • `
                                )
                            ]);
                            return await interaction.reply({
                                components: [blockedContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        }

                        if (member.roles.cache.has(config.rolesSuspenso.suspenso1ficharoleid)) {
                            const suspendedContainer = new ContainerBuilder();
                            suspendedContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(
                                    `# ${interaction.client.emojiManager.getEmoji('error')} Acceso Denegado\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('warning')} **No puedes aplicar**\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('announcements')} **Motivo:** Tienes ficha PJ suspendida - Intento 1 de 3\n` +
                                    `Tu ficha PJ anterior fue rechazada. Tienes 2 intentos restantes\n\n` +
                                    `*Sistema de Ficha PJ* • `
                                )
                            ]);
                            return await interaction.reply({
                                components: [suspendedContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        }

                        if (member.roles.cache.has(config.rolesSuspenso.suspenso2ficharoleid)) {
                            const suspendedContainer = new ContainerBuilder();
                            suspendedContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(
                                    `# ${interaction.client.emojiManager.getEmoji('error')} Acceso Denegado\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('warning')} **No puedes aplicar**\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('announcements')} **Motivo:** Tienes ficha PJ suspendida - Intento 2 de 3\n` +
                                    `Tu ficha PJ anterior fue rechazada. Tienes 1 intento restante\n\n` +
                                    `*Sistema de Ficha PJ* • `
                                )
                            ]);
                            return await interaction.reply({
                                components: [suspendedContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        }

                        if (member.roles.cache.has(config.rolesSuspenso.suspenso3ficharoleid)) {
                            const permanentlyBlockedContainer = new ContainerBuilder();
                            permanentlyBlockedContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(
                                    `# ${interaction.client.emojiManager.getEmoji('error')} Acceso Denegado Permanentemente\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('warning')} **No puedes aplicar**\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('announcements')} **Motivo:** Ficha PJ suspendida permanentemente\n` +
                                    `Has agotado tus 3 intentos. No puedes volver a aplicar para ficha PJ\n\n` +
                                    `*Sistema de Ficha PJ* • `
                                )
                            ]);
                            return await interaction.reply({
                                components: [permanentlyBlockedContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        }

                        if (tieneFichaPJEnviada(member.user.id)) {
                            const alreadySubmittedContainer = new ContainerBuilder();
                            alreadySubmittedContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(
                                    `# ${interaction.client.emojiManager.getEmoji('error')} Ficha PJ ya enviada\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('warning')} **Ya has enviado una ficha PJ**\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('announcements')} **No puedes enviar otra**\n` +
                                    `Solo se permite una ficha PJ por usuario\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('settings')} **Estado actual**\n` +
                                    `Tu ficha PJ está siendo procesada por el staff\n\n` +
                                    `*Sistema de Ficha PJ* • `
                                )
                            ]);
                            return await interaction.reply({
                                components: [alreadySubmittedContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        }

                        await interaction.deferReply({ ephemeral: true });

                        const ticketsCategory = interaction.guild.channels.cache.find(channel => 
                            channel.id === config.canales.ticketsCategoryId && channel.type === ChannelType.GuildCategory
                        );

                        if (!ticketsCategory) {
                            const errorContainer = new ContainerBuilder();
                            errorContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(`# ${interaction.client.emojiManager.getEmoji('error')} Error de Configuración\n\n> ${interaction.client.emojiManager.getEmoji('error')} **No se pudo crear el ticket**\nLa categoría de tickets no está configurada\n\n*Contacta con un administrador* ${interaction.client.emojiManager.getEmoji('settings')}`)
                            ]);
                            return await interaction.editReply({
                                components: [errorContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        }

                        const ticketChannel = await interaction.guild.channels.create({
                            name: `📕丨${interaction.user.username}`,
                            type: ChannelType.GuildText,
                            parent: ticketsCategory.id,
                            permissionOverwrites: [
                                {
                                    id: interaction.guild.id,
                                    deny: [PermissionFlagsBits.ViewChannel]
                                },
                                {
                                    id: interaction.user.id,
                                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                                },
                                {
                                    id: config.rolesAprobacion.formularioRoleId,
                                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages]
                                }
                            ]
                        });

                        const currentDate = new Date();
                        const fechaFormateada = currentDate.toLocaleDateString('es-ES', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        });
                        const horaFormateada = currentDate.toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit'
                        });

                        const ticketContainer = new ContainerBuilder();
                        ticketContainer.addTextDisplayComponents([
                            new TextDisplayBuilder().setContent(
                                `# ${interaction.client.emojiManager.getEmoji('ticket')} Bienvenido al ticket de ficha PJ\n\n` +
                                `-# ${interaction.client.emojiManager.getEmoji('loading')} Por favor, ten paciencia mientras asignamos a alguien para ayudarte.\n` +
                                `**Mientras tanto, puedes agregar cualquier información adicional que consideres relevante.**\n\n` +
                                `${interaction.client.emojiManager.getEmoji('ticket')} **Categoría del Ticket:** Ficha de Personaje\n` +
                                `${interaction.client.emojiManager.getEmoji('persona')} **Usuario:** <@${interaction.user.id}>\n` +
                                `${interaction.client.emojiManager.getEmoji('calendar')} **Fecha:** ${fechaFormateada}\n` +
                                `${interaction.client.emojiManager.getEmoji('clock')} **Hora:** ${horaFormateada}`
                            )
                        ]);

                        ticketContainer.addSeparatorComponents([
                            new SeparatorBuilder()
                        ]);

                        const claimButton = new ButtonBuilder()
                            .setCustomId(`ficha_pj_claim_${interaction.user.id}`)
                            .setLabel('Reclamar Ticket')
                            .setEmoji(interaction.client.emojiManager.getEmoji('ticket'))
                            .setStyle(ButtonStyle.Primary);

                        const claimSection = new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder()
                                    .setContent(`${interaction.client.emojiManager.getEmoji('ticket')} **Reclamar Ticket**\n-# Asignar este ticket a un entrevistador`)
                            )
                            .setButtonAccessory(claimButton);

                        ticketContainer.addSectionComponents(claimSection);

                        await ticketChannel.send({
                            components: [ticketContainer],
                            flags: MessageFlags.IsComponentsV2
                        });

                        const preguntasTexto = `Por favor, responde a las siguientes preguntas en un solo mensaje:\n\n` +
                            `**Nombre completo del personaje:**\n` +
                            `**Edad:**\n` +
                            `**Nacionalidad + Ciudad::**\n` +
                            `**Clase social:**\n` +
                            `**Profesión y estudios:**\n` +
                            `**Antecedentes (si los hay):**\n` +
                            `**Descripción física y psicológica:**\n` +
                            `**Miedos y fobias:**\n` +
                            `**Defectos y virtudes [ 3 de cada ]:**\n` +
                            `**Motivaciones y metas:**\n` +
                            `**Relaciones amistosas, familiares y amorosas:**`;

                        await ticketChannel.send(preguntasTexto);

                        try {
                            await addFichaPJTicket(interaction.user.id, ticketChannel.id);
                            await updateFichaPJStatus(interaction.user.id, 'pending');
                        } catch (error) {
                            console.error(`Error al registrar ticket de ficha PJ:`, error);
                        }

                        const successContainer = new ContainerBuilder();
                        successContainer.addTextDisplayComponents([
                            new TextDisplayBuilder().setContent(`# ${interaction.client.emojiManager.getEmoji('success')} Ticket de Ficha PJ Creado\n\n> ${interaction.client.emojiManager.getEmoji('success')} **Tu ticket ha sido creado**\nSe ha creado un ticket para enviar tu ficha PJ\n\n> ${interaction.client.emojiManager.getEmoji('createchannels')} **Canal del Ticket**\n<#${ticketChannel.id}>\n\n> ${interaction.client.emojiManager.getEmoji('notificacion')} **Instrucciones**\nResponde a las preguntas en el ticket en un solo mensaje\n\n> ${interaction.client.emojiManager.getEmoji('loading')} **Tiempo de Respuesta**\nAproximadamente 2-3 horas\n\n*Gracias por tu interés en GTA Stories* ${interaction.client.emojiManager.getEmoji('user')}`)
                        ]);

                        await interaction.editReply({
                            components: [successContainer],
                            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                        });
                    }

                    if (interaction.customId === 'consultar_vip_invitados') {
                        const modal = new ModalBuilder()
                            .setCustomId('modal_vip_invitados')
                            .setTitle('Consultar Invitaciones VIP');

                        const userIdInput = new TextInputBuilder()
                            .setCustomId('user_id_vip')
                            .setLabel('ID del Usuario VIP')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('Ejemplo: 123456789012345678')
                            .setRequired(true)
                            .setMaxLength(20);

                        const firstRow = new ActionRowBuilder().addComponents(userIdInput);
                        modal.addComponents(firstRow);

                        await interaction.showModal(modal);
                    }

                    if (interaction.customId === 'consultar_quien_invito') {
                        const modal = new ModalBuilder()
                            .setCustomId('modal_quien_invito')
                            .setTitle('Consultar Origen de Invitación');

                        const userIdInput = new TextInputBuilder()
                            .setCustomId('user_id_invitado')
                            .setLabel('ID del Usuario Invitado')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('Ejemplo: 123456789012345678')
                            .setRequired(true)
                            .setMaxLength(20);

                        const firstRow = new ActionRowBuilder().addComponents(userIdInput);
                        modal.addComponents(firstRow);

                        await interaction.showModal(modal);
                    }

                    if (interaction.customId.startsWith('formulario_accept_')) {
                        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                        if (!puedeAceptarDenegarFormularios(interaction.member)) {
                            const errorContainer = new ContainerBuilder();
                            errorContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(
                                    crearMensajeErrorEntrevistador(interaction.client.emojiManager, 'aceptar formularios')
                                )
                            ]);
                            return await interaction.editReply({
                                components: [errorContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        }

                        const userId = interaction.customId.split('_')[2];
                        const guild = interaction.guild;
                        const member = await guild.members.fetch(userId).catch(() => null);

                        if (!member) {
                            const errorContainer = new ContainerBuilder();
                            errorContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(
                                    `# ${interaction.client.emojiManager.getEmoji('error')} ${interaction.client.emojiManager.getEmoji('aviso')} Error de Usuario\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('user')} **No se pudo encontrar al usuario en el servidor**\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('settings')} **Posibles Causas**\n` +
                                    `• El usuario abandonó el servidor\n` +
                                    `• Permisos insuficientes\n` +
                                    `• Error temporal del sistema\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('reply')} **Acción Recomendada**\n` +
                                    `Verifica que el usuario esté en el servidor y vuelve a intentarlo\n\n` +
                                    `*Si el problema persiste, contacta con un administrador* ${interaction.client.emojiManager.getEmoji('settings')} • `
                                )
                            ]);
                            return await interaction.editReply({
                                components: [errorContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        }

                        const formularioRole = guild.roles.cache.get(config.rolesAprobacion.formularioRoleId);
                        if (!formularioRole) {
                            const roleErrorContainer = new ContainerBuilder();
                            roleErrorContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(
                                    `# ${interaction.client.emojiManager.getEmoji('error')} ${interaction.client.emojiManager.getEmoji('warning')} Error de Configuración\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('settings')} **No se encontró el rol de formulario**\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('aviso')} **ID del Rol Configurado**\n` +
                                    `\`${config.rolesAprobacion.formularioRoleId}\`\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('reply')} **Acción Requerida**\n` +
                                    `Contacta con un administrador para verificar la configuración\n\n` +
                                    `*La solicitud no pudo ser procesada completamente* ${interaction.client.emojiManager.getEmoji('discordmod')} • `
                                )
                            ]);
                            return await interaction.editReply({
                                components: [roleErrorContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        }

                        try {
                            await member.roles.add(formularioRole);
                        } catch (error) {
                            const permissionErrorContainer = new ContainerBuilder();
                            permissionErrorContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(
                                    `# ${interaction.client.emojiManager.getEmoji('error')} ${interaction.client.emojiManager.getEmoji('warning')} Error de Permisos\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('discordmod')} **No se pudo asignar el rol de formulario**\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('settings')} **Posibles Causas**\n` +
                                    `• El bot no tiene permisos suficientes\n` +
                                    `• El rol está por encima del bot en la jerarquía\n` +
                                    `• Error temporal de Discord\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('reply')} **Acción Requerida**\n` +
                                    `Verifica los permisos del bot y la jerarquía de roles\n\n` +
                                    `*La solicitud fue aceptada pero el rol no se asignó* ${interaction.client.emojiManager.getEmoji('aviso')} • `
                                )
                            ]);
                            return await interaction.editReply({
                                components: [permissionErrorContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        }

                        const { updateApplicationStatus, getFichaPJStatus, getFormularioStatus, getFichaPJMessageUrl } = require('../utils/database');
                        await updateApplicationStatus(userId, 'accepted', interaction.message.url, interaction.user.id);
                        updateInterviewerStats(interaction.user.id, 'formulario', 'accepted');

                        const fichaPJStatus = getFichaPJStatus(userId);
                        const formularioStatus = getFormularioStatus(userId);
                        const fichaPJMessageUrl = getFichaPJMessageUrl(userId);

                        const esInvitado = member.roles.cache.has(config.rolesEspeciales.invitadoRoleId);
                        
                        try {
                            const user = await interaction.client.users.fetch(userId);
                            let dmContainer = new ContainerBuilder();
                            
                            if (esInvitado) {
                                dmContainer.addTextDisplayComponents([
                                    new TextDisplayBuilder().setContent(
                                        `# ${interaction.client.emojiManager.getEmoji('success')} Usuario Invitado Aprobado\n\n` +
                                        `> ${interaction.client.emojiManager.getEmoji('user')} **Usuario**\n` +
                                        `<@${user.id}> (${user.username})\n\n` +
                                        `> ${interaction.client.emojiManager.getEmoji('settings')} **Estado**\n` +
                                        `**FORMULARIO ACEPTADO** ${interaction.client.emojiManager.getEmoji('success')}\n\n` +
                                        `> ${interaction.client.emojiManager.getEmoji('discordmod')} **Staff Responsable**\n` +
                                        `<@${interaction.user.id}>\n\n` +
                                        `> ${interaction.client.emojiManager.getEmoji('calendar')} **Fecha de Aprobación**\n` +
                                        `<t:${Math.floor(Date.now() / 1000)}:F>`
                                    )
                                ]);
                            } else {
                                if (fichaPJStatus === 'accepted') {
                                    dmContainer.addTextDisplayComponents([
                                        new TextDisplayBuilder().setContent(
                                            `# ${interaction.client.emojiManager.getEmoji('success')} Nuevo Usuario Aprobado\n\n` +
                                            `> ${interaction.client.emojiManager.getEmoji('user')} **Usuario**\n` +
                                            `<@${user.id}> (${user.username})\n\n` +
                                            `> ${interaction.client.emojiManager.getEmoji('settings')} **Estado**\n` +
                                            `**FORMULARIO ACEPTADO** ${interaction.client.emojiManager.getEmoji('success')} **FICHA PJ ACEPTADA** ${interaction.client.emojiManager.getEmoji('success')}\n\n` +
                                            `> ${interaction.client.emojiManager.getEmoji('discordmod')} **Staff Responsable**\n` +
                                            `<@${interaction.user.id}>\n\n` +
                                            `> ${interaction.client.emojiManager.getEmoji('calendar')} **Fecha de Aprobación**\n` +
                                            `<t:${Math.floor(Date.now() / 1000)}:F>`
                                        )
                                    ]);
                                } else {
                                    dmContainer.addTextDisplayComponents([
                                        new TextDisplayBuilder().setContent(
                                            `# ${interaction.client.emojiManager.getEmoji('success')} Formulario Aceptado\n\n` +
                                            `> ${interaction.client.emojiManager.getEmoji('success')} **Tu formulario ha sido aceptado**\n\n` +
                                            `> ${interaction.client.emojiManager.getEmoji('warning')} **Siguiente paso:**\n` +
                                            `Ahora debes enviar tu ficha de personaje para completar el proceso\n\n` +
                                            `> ${interaction.client.emojiManager.getEmoji('settings')} **¿Cómo crear ticket para ficha PJ?**\n` +
                                            `Usa el comando correspondiente en el servidor para enviar tu ficha\n\n` +
                                            `*Formulario aprobado por el staff* ${interaction.client.emojiManager.getEmoji('staff')}`
                                        )
                                    ]);
                                }
                            }
                            
                            await user.send({
                                components: [dmContainer],
                                flags: MessageFlags.IsComponentsV2
                            });
                        } catch (error) {
                            console.error('No se pudo enviar DM al usuario:', error);
                        }



                        const acceptedStatusContainer = new ContainerBuilder();
                        let statusTitle = '';
                        let statusDescription = '';
                        let nextSteps = '';

                        if (fichaPJStatus === 'accepted' && formularioStatus === 'accepted') {
                            statusTitle = `# ${interaction.client.emojiManager.getEmoji('success')} Proceso Completo`;
                            statusDescription = `> ${interaction.client.emojiManager.getEmoji('success')} **Formulario y Ficha PJ Aceptados**\n` +
                                `Ambos procesos han sido completados exitosamente`;
                            nextSteps = `*El usuario tiene acceso completo al servidor* ${interaction.client.emojiManager.getEmoji('whitelist')}`;

                            const resultsChannel = interaction.guild.channels.cache.get(config.canales.resultsChannelId);
                            if (resultsChannel) {
                                const resultContainer = new ContainerBuilder();
                                resultContainer.addTextDisplayComponents([
                                    new TextDisplayBuilder().setContent(
                                        `# ${interaction.client.emojiManager.getEmoji('success')} Nuevo Usuario Aprobado\n\n` +
                                        `> ${interaction.client.emojiManager.getEmoji('user')} **Usuario**\n` +
                                        `<@${member.user.id}> (${member.user.tag})\n\n` +
                                        `> ${interaction.client.emojiManager.getEmoji('success')} **Estado**\n` +
                                        `**FORMULARIO ACEPTADO** ${interaction.client.emojiManager.getEmoji('success')}\n` +
                                        `**FICHA PJ ACEPTADA** ${interaction.client.emojiManager.getEmoji('success')}\n\n` +
                                        `> ${interaction.client.emojiManager.getEmoji('discordmod')} **Staff Responsable**\n` +
                                        `<@${interaction.user.id}>\n\n` +
                                        `> ${interaction.client.emojiManager.getEmoji('settings')} **Fecha de Aprobación**\n` +
                                        `<t:${Math.floor(Date.now() / 1000)}:F>`
                                    )
                                ]);

                                try {
                                    await resultsChannel.send({
                                        components: [resultContainer],
                                        flags: MessageFlags.IsComponentsV2
                                    });
                                } catch (error) {
                                    console.log(`Error al enviar resultado al canal: ${error.message}`);
                                }
                            }
                        } else if (fichaPJStatus === 'accepted') {
                            statusTitle = `# ${interaction.client.emojiManager.getEmoji('success')} Formulario Aceptado`;
                            statusDescription = `> ${interaction.client.emojiManager.getEmoji('success')} **Ficha PJ ya Aceptada**\n` +
                                `El formulario ha sido aceptado y la ficha PJ ya fue aprobada previamente`;
                            nextSteps = `*¡Bienvenido oficialmente a GTA Stories!* ${interaction.client.emojiManager.getEmoji('whitelist')}`;
                        } else if (fichaPJStatus === 'pending') {
                            statusTitle = `# ${interaction.client.emojiManager.getEmoji('success')} Formulario Aceptado`;
                            statusDescription = `> ${interaction.client.emojiManager.getEmoji('warning')} **Falta aprobar Ficha PJ**\n` +
                                `El formulario ha sido aceptado, pero la ficha PJ está pendiente de revisión`;

                            if (fichaPJMessageUrl) {
                                nextSteps = `*[Ir al ticket de Ficha PJ pendiente](${fichaPJMessageUrl})*`;
                            } else {
                                nextSteps = `*Esperando que el usuario cree un ticket para la ficha PJ* ${interaction.client.emojiManager.getEmoji('clock')}`;
                            }
                        } else if (fichaPJStatus === 'none') {
                            statusTitle = `# ${interaction.client.emojiManager.getEmoji('success')} Formulario Aceptado`;
                            statusDescription = `> ${interaction.client.emojiManager.getEmoji('warning')} **Usuario debe crear ticket para Ficha PJ**\n` +
                                `El formulario ha sido aceptado, pero debe crear un ticket para enviar la ficha PJ`;
                            nextSteps = `*El usuario ha sido notificado para crear un ticket de ficha PJ* ${interaction.client.emojiManager.getEmoji('ticket')}`;
                        }

                        acceptedStatusContainer.addTextDisplayComponents([
                            new TextDisplayBuilder().setContent(
                                statusTitle + `\n\n` +
                                statusDescription + `\n\n` +
                                `> ${interaction.client.emojiManager.getEmoji('whitelist')} **Usuario Procesado**\n` +
                                `<@${member.user.id}>\n\n` +
                                `> ${interaction.client.emojiManager.getEmoji('discordmod')} **Staff Responsable**\n` +
                                `<@${interaction.user.id}> aprobó esta solicitud\n\n` +
                                `> ${interaction.client.emojiManager.getEmoji('settings')} **Estado del Proceso**\n` +
                                `**FORMULARIO ACEPTADO** ${interaction.client.emojiManager.getEmoji('success')} • \n\n` +
                                nextSteps
                            )
                        ]);

                        const originalMessageUrl = getFormularioMessageUrl(member.user.id);
                        if (originalMessageUrl) {
                            try {
                                const urlParts = originalMessageUrl.split('/');
                                const messageId = urlParts[urlParts.length - 1];
                                const channelId = urlParts[urlParts.length - 2];
                                const channel = interaction.guild.channels.cache.get(channelId);

                                if (channel) {
                                    const originalMessage = await channel.messages.fetch(messageId);
                                    if (originalMessage) {
                                        await originalMessage.edit({
                                            components: [acceptedStatusContainer],
                                            flags: MessageFlags.IsComponentsV2
                                        });

                                        if (fichaPJStatus === 'accepted') {
                                            const fichaPJMessageUrl = getFichaPJMessageUrl(member.user.id);
                                            if (fichaPJMessageUrl) {
                                                try {
                                                    const fichaPJUrlParts = fichaPJMessageUrl.split('/');
                                                    const fichaPJMessageId = fichaPJUrlParts[fichaPJUrlParts.length - 1];
                                                    const fichaPJChannelId = fichaPJUrlParts[fichaPJUrlParts.length - 2];
                                                    const fichaPJChannel = interaction.guild.channels.cache.get(fichaPJChannelId);

                                                    if (fichaPJChannel) {
                                                        const fichaPJMessage = await fichaPJChannel.messages.fetch(fichaPJMessageId);
                                                        if (fichaPJMessage) {
                                                            const updatedFichaPJContainer = new ContainerBuilder();
                                                            updatedFichaPJContainer.addTextDisplayComponents([
                                                                new TextDisplayBuilder().setContent(
                                                                    `# ${interaction.client.emojiManager.getEmoji('success')} Proceso Completo\n\n` +
                                                                    `> ${interaction.client.emojiManager.getEmoji('success')} **Formulario y Ficha PJ Aceptados**\n` +
                                                                    `Ambos procesos han sido completados exitosamente\n\n` +
                                                                    `> ${interaction.client.emojiManager.getEmoji('user')} **Usuario Procesado**\n` +
                                                                    `<@${member.user.id}>\n\n` +
                                                                    `> ${interaction.client.emojiManager.getEmoji('discordmod')} **Staff Responsable**\n` +
                                                                    `<@${interaction.user.id}> completó el proceso\n\n` +
                                                                    `> ${interaction.client.emojiManager.getEmoji('settings')} **Estado del Proceso**\n` +
                                                                    `**PROCESO COMPLETO** ${interaction.client.emojiManager.getEmoji('success')} • \n\n` +
                                                                    `*El usuario tiene acceso completo al servidor* ${interaction.client.emojiManager.getEmoji('whitelist')}`
                                                                )
                                                            ]);

                                                            await fichaPJMessage.edit({
                                                                components: [updatedFichaPJContainer],
                                                                flags: MessageFlags.IsComponentsV2
                                                            });
                                                        }
                                                    }
                                                } catch (error) {
                                                    console.log(`Error al actualizar mensaje de ficha PJ: ${error.message}`);
                                                }
                                            }
                                        }

                                        const confirmContainer = new ContainerBuilder();
                                        confirmContainer.addTextDisplayComponents([
                                            new TextDisplayBuilder().setContent(`${interaction.client.emojiManager.getEmoji('success')} Formulario aceptado correctamente`)
                                        ]);

                                        await interaction.editReply({
                                            components: [confirmContainer],
                                            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                                        });
                                    } else {
                                        console.log(`No se pudo encontrar el mensaje original: ${messageId}`);
                                        await interaction.editReply({
                                            components: [acceptedStatusContainer],
                                            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                                        });
                                    }
                                } else {
                                    console.log(`No se pudo encontrar el canal: ${channelId}`);
                                    await interaction.editReply({
                                        components: [acceptedStatusContainer],
                                        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                                    });
                                }
                            } catch (error) {
                                console.log(`Error al actualizar mensaje original: ${error.message}`);
                                await interaction.editReply({
                                    components: [acceptedStatusContainer],
                                    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                                });
                            }
                        } else {
                            console.log(`No se encontró URL del mensaje original para el usuario: ${member.user.id}`);
                            await interaction.editReply({
                                components: [acceptedStatusContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        }
                    }

                    if (interaction.customId.startsWith('formulario_deny_')) {
                        if (!puedeAceptarDenegarFormularios(interaction.member)) {
                            const errorContainer = new ContainerBuilder();
                            errorContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(crearMensajeErrorEntrevistador(interaction.client.emojiManager, 'denegar formularios'))
                            ]);
                            return await interaction.editReply({
                                components: [errorContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        }

                        const userId = interaction.customId.split('_')[2];
                        
                        const modal = new ModalBuilder()
                            .setCustomId(`formulario_deny_modal_${userId}`)
                            .setTitle('Denegar Formulario - Especificar Razón');

                        const razonInput = new TextInputBuilder()
                            .setCustomId('razon_rechazo')
                            .setLabel('Razón del rechazo')
                            .setStyle(TextInputStyle.Paragraph)
                            .setPlaceholder('Escribe aquí la razón específica del rechazo del formulario...')
                            .setRequired(true)
                            .setMaxLength(1000);

                        const firstActionRow = new ActionRowBuilder().addComponents(razonInput);
                        modal.addComponents(firstActionRow);

                        await interaction.showModal(modal);
                    }

                    if (interaction.customId.startsWith('formulario_view_')) {
                        const userId = interaction.customId.split('_')[2];
                        const { getApplicationData } = require('../utils/database');
                        const applicationData = getApplicationData(userId);

                        if (!applicationData) {
                            const errorContainer = new ContainerBuilder();
                            errorContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(`# ${interaction.client.emojiManager.getEmoji('error')} ${interaction.client.emojiManager.getEmoji('warning')} Error de Datos\n\n> ${interaction.client.emojiManager.getEmoji('aviso')} **No se encontraron datos de la solicitud**\n\n> ${interaction.client.emojiManager.getEmoji('settings')} **Posibles Causas**\n• La solicitud fue eliminada o expiró\n• Error en la base de datos\n• Solicitud inválida o corrupta\n\n> ${interaction.client.emojiManager.getEmoji('reply')} **Acción Recomendada**\nVerifica que la solicitud sea válida y vuelve a intentarlo\n\n*Si el problema persiste, contacta con un administrador* ${interaction.client.emojiManager.getEmoji('discordmod')}`)
                            ]);
                            return await interaction.editReply({
                                components: [errorContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        }

                        const viewContainer = new ContainerBuilder();
                        viewContainer.addTextDisplayComponents([
                            new TextDisplayBuilder().setContent(
                                `# ${interaction.client.emojiManager.getEmoji('settings')} Detalles de la Solicitud\n\n> **Información adicional del solicitante**\n\n` +
                                `-# ${interaction.client.emojiManager.getEmoji('reply')} **Rol Planeado**\n` +
                                `> ${applicationData.formData.rol_gta_stories}\n` +
                                `-# ${interaction.client.emojiManager.getEmoji('loading')} **Experiencia Previa**\n` +
                                `> ${applicationData.formData.servidores_roleados}\n` +
                                `-# ${interaction.client.emojiManager.getEmoji('aviso')} **Sanciones**\n` +
                                `\`\`\`\n${applicationData.formData.sanciones_activas}\`\`\`\n` +
                                `*GTA Stories • Revisión de Solicitud • *`
                            )
                        ]);

                        await interaction.reply({
                            components: [viewContainer],
                            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                        });
                    }

                    if (interaction.customId.startsWith('ficha_pj_claim_')) {
                        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                        if (!puedeAceptarDenegarFormularios(interaction.member)) {
                            const errorContainer = new ContainerBuilder();
                            errorContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(
                                    crearMensajeErrorEntrevistador(interaction.client.emojiManager, 'reclamar fichas PJ')
                                )
                            ]);
                            return await interaction.editReply({
                                components: [errorContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        }

                        const userId = interaction.customId.split('_')[3];
                        const guild = interaction.guild;
                        const member = await guild.members.fetch(userId).catch(() => null);

                        if (!member) {
                            const errorContainer = new ContainerBuilder();
                            errorContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(
                                    `# ${interaction.client.emojiManager.getEmoji('error')} ${interaction.client.emojiManager.getEmoji('aviso')} Error de Usuario\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('user')} **No se pudo encontrar al usuario en el servidor**\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('settings')} **Posibles Causas**\n` +
                                    `• El usuario abandonó el servidor\n` +
                                    `• Permisos insuficientes\n` +
                                    `• Error temporal del sistema\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('reply')} **Acción Recomendada**\n` +
                                    `Verifica que el usuario esté en el servidor y vuelve a intentarlo\n\n` +
                                    `*Si el problema persiste, contacta con un administrador* ${interaction.client.emojiManager.getEmoji('settings')} • `
                                )
                            ]);
                            return await interaction.editReply({
                                components: [errorContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        }

                        const currentDate = new Date();
                        const fechaFormateada = currentDate.toLocaleDateString('es-ES', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        });
                        const horaFormateada = currentDate.toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit'
                        });

                        const updatedContainer = new ContainerBuilder();

                        updatedContainer.addTextDisplayComponents([
                            new TextDisplayBuilder().setContent(
                                `# ${interaction.client.emojiManager.getEmoji('ticket')} Bienvenido al ticket de ficha PJ\n\n` +
                                `${interaction.client.emojiManager.getEmoji('success')} **Reclamado por** <@${interaction.user.id}>\n\n` +
                                `${interaction.client.emojiManager.getEmoji('ticket')} **Categoría del Ticket:** Ficha de Personaje\n` +
                                `${interaction.client.emojiManager.getEmoji('persona')} **Usuario:** <@${userId}>\n` +
                                `${interaction.client.emojiManager.getEmoji('calendar')} **Fecha:** ${fechaFormateada}\n` +
                                `${interaction.client.emojiManager.getEmoji('clock')} **Hora:** ${horaFormateada}`
                            )
                        ]);
                        updatedContainer.addSeparatorComponents([
                            new SeparatorBuilder()
                        ]);
                        const adminButton = new ButtonBuilder()
                            .setCustomId(`ficha_pj_admin_${userId}`)
                            .setLabel('Administración')
                            .setEmoji(interaction.client.emojiManager.getEmoji('administrator'))
                            .setStyle(ButtonStyle.Secondary);

                        const viewButton = new ButtonBuilder()
                            .setCustomId(`ficha_pj_details_${userId}`)
                            .setLabel('Ver Detalles')
                            .setEmoji(interaction.client.emojiManager.getEmoji('files'))
                            .setStyle(ButtonStyle.Secondary);

                        const adminSection = new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder()
                                    .setContent(`${interaction.client.emojiManager.getEmoji('administrator')} **Panel de Administración**\n-# Acciones de aceptar, denegar y notificar`)
                            )
                            .setButtonAccessory(adminButton);

                        const viewSection = new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder()
                                    .setContent(`${interaction.client.emojiManager.getEmoji('files')} **Ver Información Completa**\n-# Revisar todos los detalles de la ficha`)
                            )
                            .setButtonAccessory(viewButton);

                        updatedContainer.addSectionComponents(adminSection);
                        updatedContainer.addSectionComponents(viewSection);

                        await interaction.message.edit({
                            components: [updatedContainer],
                            flags: MessageFlags.IsComponentsV2
                        });

                        const confirmContainer = new ContainerBuilder();
                        confirmContainer.addTextDisplayComponents([
                            new TextDisplayBuilder().setContent(`${interaction.client.emojiManager.getEmoji('success')} Has reclamado la ficha PJ de <@${userId}>`)
                        ]);

                        await interaction.editReply({
                            components: [confirmContainer],
                            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                        });
                    }

                    if (interaction.customId.startsWith('ficha_pj_admin_')) {
                        if (!puedeAceptarDenegarFormularios(interaction.member)) {
                            const errorContainer = new ContainerBuilder();
                            errorContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(crearMensajeErrorEntrevistador(interaction.client.emojiManager, 'administrar fichas PJ'))
                            ]);
                            return await interaction.reply({
                                components: [errorContainer],
                                flags: MessageFlags.IsComponentsV2,
                                ephemeral: true
                            });
                        }

                        const userId = interaction.customId.split('_')[3];
                        
                        const adminContainer = new ContainerBuilder();
                        adminContainer.addTextDisplayComponents([
                            new TextDisplayBuilder().setContent(
                                `# ${interaction.client.emojiManager.getEmoji('settings')} Panel de Administración\n\n` +
                                `Selecciona una acción para la ficha PJ de <@${userId}>:`
                            )
                        ]);

                        const adminButtons = new ButtonBuilder()
                            .setCustomId(`ficha_pj_notify_${userId}`)
                            .setLabel('Notificar Usuario')
                            .setEmoji(interaction.client.emojiManager.getEmoji('notificacion'))
                            .setStyle(ButtonStyle.Secondary);

                        const acceptButton = new ButtonBuilder()
                            .setCustomId(`ficha_pj_accept_${userId}`)
                            .setLabel('Aceptar')
                            .setEmoji(interaction.client.emojiManager.getEmoji('success'))
                            .setStyle(ButtonStyle.Success);

                        const denyButton = new ButtonBuilder()
                            .setCustomId(`ficha_pj_deny_${userId}`)
                            .setLabel('Denegar')
                            .setEmoji(interaction.client.emojiManager.getEmoji('error'))
                            .setStyle(ButtonStyle.Danger);

                        const addFichaPJButton = new ButtonBuilder()
                            .setCustomId(`ficha_pj_add_${userId}`)
                            .setLabel('Añadir ficha PJ')
                            .setEmoji(interaction.client.emojiManager.getEmoji('files'))
                            .setStyle(ButtonStyle.Primary);

                        adminContainer.addActionRowComponents([
                            new ActionRowBuilder().addComponents(adminButtons, acceptButton, denyButton),
                            new ActionRowBuilder().addComponents(addFichaPJButton)
                        ]);

                        await interaction.reply({
                            components: [adminContainer],
                            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                        });
                    }

                    if (interaction.customId.startsWith('ficha_pj_details_')) {
                        const userId = interaction.customId.split('_')[3];
                        const { getFichaPJData } = require('../utils/database');
                        const fichaPJData = getFichaPJData(userId);

                        if (!fichaPJData || !fichaPJData.formData) {
                            const errorContainer = new ContainerBuilder();
                            errorContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(
                                    `# ${interaction.client.emojiManager.getEmoji('error')} Datos Incompletos\n\n` +
                                    `No se encontraron los datos completos de la ficha PJ para este usuario.\n\n` +
                                    `Esto puede ocurrir si:\n` +
                                    `• La ficha PJ no se completó correctamente\n` +
                                    `• Los datos se perdieron durante el procesamiento\n` +
                                    `• El usuario solo tiene información básica registrada\n\n` +
                                    `**Estado actual:** ${fichaPJData ? fichaPJData.status || 'Desconocido' : 'Sin datos'}`
                                )
                            ]);
                            return await interaction.reply({
                                components: [errorContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        }

                        const viewContainer = new ContainerBuilder();
                        viewContainer.addTextDisplayComponents([
                            new TextDisplayBuilder().setContent(`# ${interaction.client.emojiManager.getEmoji('persona')} Ficha de Personaje Completa\n\n> ${interaction.client.emojiManager.getEmoji('user')} **Usuario Solicitante**\n<@${userId}> • \`${userId}\``)
                        ]);

                        viewContainer.addSeparatorComponents([
                            new SeparatorBuilder().setSpacing('Small')
                        ]);

                        const respuestas = fichaPJData.respuestas || {};
                        const formData = fichaPJData.formData || {};

                        viewContainer.addTextDisplayComponents([
                            new TextDisplayBuilder().setContent(
                                `-# ${interaction.client.emojiManager.getEmoji('reply')} **Nombre del Personaje**\n` +
                                `\`\`\`\n${respuestas['Nombre completo del personaje:'] || formData.nombre_completo || 'No disponible'}\`\`\`\n` +
                                `-# ${interaction.client.emojiManager.getEmoji('reply')} **Edad**\n` +
                                `\`\`\`\n${respuestas['Edad:'] || formData.edad || 'No disponible'}\`\`\`\n` +
                                `-# ${interaction.client.emojiManager.getEmoji('reply')} **Nacionalidad + Ciudad**\n` +
                                `\`\`\`\n${respuestas['Nacionalidad + Ciudad:'] || formData.nacionalidad || 'No disponible'}\`\`\`\n` +
                                `-# ${interaction.client.emojiManager.getEmoji('reply')} **Clase Social**\n` +
                                `\`\`\`\n${respuestas['Clase social:'] || formData.clase_social || 'No disponible'}\`\`\`\n` +
                                `-# ${interaction.client.emojiManager.getEmoji('reply')} **Profesión y Estudios**\n` +
                                `\`\`\`\n${respuestas['Profesión y estudios:'] || formData.profesion_estudios || 'No disponible'}\`\`\`\n` +
                                `-# ${interaction.client.emojiManager.getEmoji('reply')} **Antecedentes**\n` +
                                `\`\`\`\n${respuestas['Antecedentes:'] || formData.antecedentes || 'No disponible'}\`\`\``
                            )
                        ]);

                        viewContainer.addSeparatorComponents([
                            new SeparatorBuilder().setSpacing('Small')
                        ]);

                        viewContainer.addTextDisplayComponents([
                            new TextDisplayBuilder().setContent(
                                `-# ${interaction.client.emojiManager.getEmoji('reply')} **Descripción Física y Psicológica**\n` +
                                `\`\`\`\n${respuestas['Descripción física y psicológica:'] || formData.descripcion_fisica || 'No disponible'}\`\`\`\n` +
                                `-# ${interaction.client.emojiManager.getEmoji('reply')} **Miedos y Fobias**\n` +
                                `\`\`\`\n${respuestas['Miedos y fobias:'] || formData.miedos_fobias || 'No disponible'}\`\`\`\n` +
                                `-# ${interaction.client.emojiManager.getEmoji('reply')} **Defectos**\n` +
                                `\`\`\`\n${respuestas['Defectos:'] || formData.defectos || 'No disponible'}\`\`\`\n` +
                                `-# ${interaction.client.emojiManager.getEmoji('reply')} **Virtudes**\n` +
                                `\`\`\`\n${respuestas['Virtudes:'] || formData.virtudes || 'No disponible'}\`\`\`\n` +
                                `-# ${interaction.client.emojiManager.getEmoji('reply')} **Motivaciones y Metas**\n` +
                                `\`\`\`\n${respuestas['Motivaciones y metas:'] || formData.motivaciones_metas || 'No disponible'}\`\`\`\n` +
                                `-# ${interaction.client.emojiManager.getEmoji('reply')} **Relaciones**\n` +
                                `\`\`\`\n${respuestas['Relaciones:'] || formData.relaciones || 'No disponible'}\`\`\``
                            )
                        ]);

                        await interaction.reply({
                            components: [viewContainer],
                            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                        });
                    }

                    if (interaction.customId.startsWith('ficha_pj_notify_')) {
                        const userId = interaction.customId.split('_')[3];
                        
                        const modal = new ModalBuilder()
                            .setCustomId(`ficha_pj_notify_modal_${userId}`)
                            .setTitle('Notificar Usuario - Ficha PJ');

                        const messageInput = new TextInputBuilder()
                            .setCustomId('notification_message')
                            .setLabel('Mensaje de notificación')
                            .setStyle(TextInputStyle.Paragraph)
                            .setPlaceholder('Escribe el mensaje que se enviará al usuario...')
                            .setRequired(true)
                            .setMaxLength(1000);

                        const firstActionRow = new ActionRowBuilder().addComponents(messageInput);
                        modal.addComponents(firstActionRow);

                        await interaction.showModal(modal);
                    }

                    if (interaction.customId.startsWith('ficha_pj_accept_')) {
                        if (!puedeAceptarDenegarFormularios(interaction.member)) {
                            const errorContainer = new ContainerBuilder();
                            errorContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(crearMensajeErrorEntrevistador(interaction.client.emojiManager, 'aceptar fichas PJ'))
                            ]);
                            return await interaction.reply({
                                components: [errorContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        }

                        const userId = interaction.customId.split('_')[3];
                        const { getFichaPJData } = require('../utils/database');
                        
                        try {
                            const fichaPJData = getFichaPJData(userId);
                            if (!fichaPJData) {
                                throw new Error('No se encontraron datos de la ficha PJ');
                            }

                            await updateFichaPJStatus(userId, 'accepted', null, interaction.user.id);
                            updateInterviewerStats(interaction.user.id, 'fichaPJ', 'accepted');

                            const targetUser = await interaction.guild.members.fetch(userId);
                            const fichaPjRole = interaction.guild.roles.cache.get(config.rolesAprobacion.FichaPjRoleid);
                            
                            
                            if (fichaPjRole && !targetUser.roles.cache.has(fichaPjRole.id)) {
                                await targetUser.roles.add(fichaPjRole);
                            }

                            try {
                                const dmContainer = new ContainerBuilder();
                                dmContainer.addTextDisplayComponents([
                                    new TextDisplayBuilder().setContent(
                                        `# ${interaction.client.emojiManager.getEmoji('success')} ¡Ficha PJ Aceptada!\n\n` +
                                        `Tu ficha de personaje ha sido **aceptada** por el equipo de staff.\n\n` +
                                        `Ya puedes acceder al servidor y comenzar tu experiencia de roleplay.\n\n` +
                                        `*GTA Stories • Sistema de Fichas PJ*`
                                    )
                                ]);
                                await targetUser.send({ components: [dmContainer], flags: MessageFlags.IsComponentsV2 });
                            } catch (dmError) {
                                console.log(`No se pudo enviar DM a ${targetUser.user.tag}: ${dmError.message}`);
                            }

                            const transcriptFilename = `ficha-pj-${targetUser.user.username}-${Date.now()}.html`;
                            const transcript = await discordTranscripts.createTranscript(interaction.channel, {
                                limit: -1,
                                returnType: 'attachment',
                                filename: transcriptFilename,
                                saveImages: true,
                                poweredBy: false
                            });

                            const logChannel = interaction.guild.channels.cache.get(config.canales.fichasLogsChannelId);

                            const logContainer = new ContainerBuilder()
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(`${interaction.client.emojiManager.getEmoji('success')} **Ficha PJ Aceptada - Transcript**

-# ${interaction.client.emojiManager.getEmoji('user')} **Usuario Aprobado**
<@${userId}> (${targetUser.user.tag})

-# ${interaction.client.emojiManager.getEmoji('discordmod')} **Staff Responsable**
<@${interaction.user.id}> aprobó esta ficha PJ

-# ${interaction.client.emojiManager.getEmoji('success')} **Estado del Proceso**
FICHA PJ ACEPTADA ${interaction.client.emojiManager.getEmoji('success')}

-# ${interaction.client.emojiManager.getEmoji('calendar')} **Fecha de Aprobación**
<t:${Math.floor(Date.now() / 1000)}:F>

-# ${interaction.client.emojiManager.getEmoji('files')} **Transcript Adjunto**`)
                                )
                                .addSeparatorComponents([new SeparatorBuilder().setSpacing('Small')])
                                .addFileComponents(
                                    new FileBuilder()
                                        .setURL(`attachment://${transcriptFilename}`)
                                        .setSpoiler(false)
                                )
                                .addSeparatorComponents([new SeparatorBuilder().setSpacing('Small')])
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(`GTA Stories • Sistema de Fichas PJ • Logs`)
                                );

                            try {
                                await logChannel.send({
                                    content: null,
                                    components: [logContainer],
                                    files: [transcript],
                                    flags: MessageFlags.IsComponentsV2
                                });
                            } catch (error) {
                                console.error('Error enviando transcript al canal de logs:', error);
                                await logChannel.send({
                                    components: [logContainer],
                                    flags: MessageFlags.IsComponentsV2
                                });
                            }


                            const formularioStatus = getFormularioStatus(userId);
                            const tieneRolFormulario = targetUser.roles.cache.has(config.rolesAprobacion.formularioRoleId);
                            const tieneFormularioEnBD = tieneFormularioEnviado(userId);
                            const resultsChannel = interaction.guild.channels.cache.get(config.canales.resultsChannelId);
                            
                            if (resultsChannel) {
                                if (formularioStatus === 'accepted') {
                                    const combinedContainer = new ContainerBuilder();
                                    combinedContainer.addTextDisplayComponents([
                                        new TextDisplayBuilder().setContent(
                                            `# ${interaction.client.emojiManager.getEmoji('success')} Formulario y Ficha PJ Aceptados\n\n` +
                                            `> ${interaction.client.emojiManager.getEmoji('user')} **Usuario Completamente Aprobado**\n` +
                                            `<@${userId}> (${targetUser.user.tag}) ha completado exitosamente todo el proceso\n\n` +
                                            `> ${interaction.client.emojiManager.getEmoji('discordmod')} **Staff Responsable**\n` +
                                            `<@${interaction.user.id}> procesó la ficha PJ\n\n` +
                                            `> ${interaction.client.emojiManager.getEmoji('calendar')} **Fecha de Aprobación**\n` +
                                            `<t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
                                            `> ${interaction.client.emojiManager.getEmoji('success')} **Estado del Proceso**\n` +
                                            `**PROCESO COMPLETO** ${interaction.client.emojiManager.getEmoji('success')}\n\n` +
                                            `> ${interaction.client.emojiManager.getEmoji('whitelist')} **Acceso Otorgado**\n` +
                                            `El usuario ahora tiene acceso completo al servidor\n\n` +
                                            `*¡Bienvenido oficialmente a GTA Stories!* ${interaction.client.emojiManager.getEmoji('whitelist')}`
                                        )
                                    ]);

                                    try {
                                        await resultsChannel.send({
                                            components: [combinedContainer],
                                            flags: MessageFlags.IsComponentsV2
                                        });
                                    } catch (error) {
                                        console.log(`Error al enviar resultado combinado al canal: ${error.message}`);
                                    }

                                    // Actualizar el mensaje original del formulario con el contenedor final
                                    const originalMessageUrl = getFormularioMessageUrl(userId);
                                    if (originalMessageUrl) {
                                        try {
                                            const urlParts = originalMessageUrl.split('/');
                                            const messageId = urlParts[urlParts.length - 1];
                                            const channelId = urlParts[urlParts.length - 2];
                                            const channel = interaction.guild.channels.cache.get(channelId);

                                            if (channel) {
                                                const originalMessage = await channel.messages.fetch(messageId);
                                                if (originalMessage) {
                                                    const finalContainer = new ContainerBuilder();
                                                    finalContainer.addTextDisplayComponents([
                                                        new TextDisplayBuilder().setContent(
                                                            `# ${interaction.client.emojiManager.getEmoji('success')} Proceso Completado\n\n` +
                                                            `> ${interaction.client.emojiManager.getEmoji('user')} **Usuario**\n` +
                                                            `<@${userId}>\n\n` +
                                                            `> ${interaction.client.emojiManager.getEmoji('success')} **Estado del Proceso**\n` +
                                                            `**FORMULARIO ACEPTADO** ${interaction.client.emojiManager.getEmoji('success')} • **FICHA PJ ACEPTADA** ${interaction.client.emojiManager.getEmoji('success')}\n\n` +
                                                            `> ${interaction.client.emojiManager.getEmoji('whitelist')} **Resultado**\n` +
                                                            `El usuario ha completado todo el proceso de verificación\n\n` +
                                                            `*¡Proceso completado exitosamente!* ${interaction.client.emojiManager.getEmoji('whitelist')}`
                                                        )
                                                    ]);

                                                    await originalMessage.edit({
                                                        components: [finalContainer],
                                                        flags: MessageFlags.IsComponentsV2
                                                    });
                                                }
                                            }
                                        } catch (error) {
                                            console.log(`Error al actualizar mensaje original del formulario: ${error.message}`);
                                        }
                                    }
                                } else if (tieneRolFormulario && !tieneFormularioEnBD) {
                                    // Usuario tiene rol de formulario pero no formulario en BD - enviar automáticamente
                                    const autoResultContainer = new ContainerBuilder();
                                    autoResultContainer.addTextDisplayComponents([
                                        new TextDisplayBuilder().setContent(
                                            `# ${interaction.client.emojiManager.getEmoji('success')} Ficha PJ Aprobada - Acceso Directo\n\n` +
                                            `> ${interaction.client.emojiManager.getEmoji('user')} **Usuario**\n` +
                                            `<@${userId}> (${targetUser.user.tag})\n\n` +
                                            `> ${interaction.client.emojiManager.getEmoji('success')} **Estado**\n` +
                                            `**FICHA PJ ACEPTADA** ${interaction.client.emojiManager.getEmoji('success')}\n\n` +
                                            `> ${interaction.client.emojiManager.getEmoji('discordmod')} **Staff Responsable**\n` +
                                            `<@${interaction.user.id}>\n\n` +
                                            `> ${interaction.client.emojiManager.getEmoji('calendar')} **Fecha de Aprobación**\n` +
                                            `<t:${Math.floor(Date.now() / 1000)}:F>\n\n` +  
                                            `> ${interaction.client.emojiManager.getEmoji('whitelist')} **Acceso Otorgado**\n` +
                                            `El usuario ahora tiene acceso completo al servidor`
                                        )
                                    ]);

                                    try {
                                        await resultsChannel.send({
                                            components: [autoResultContainer],
                                            flags: MessageFlags.IsComponentsV2
                                        });
                                    } catch (error) {
                                        console.log(`Error al enviar resultado automático al canal: ${error.message}`);
                                    }
                                } else {
                                    // Solo ficha PJ aceptada - enviar mensaje individual
                                    const resultContainer = new ContainerBuilder();
                                    resultContainer.addTextDisplayComponents([
                                        new TextDisplayBuilder().setContent(
                                            `# ${interaction.client.emojiManager.getEmoji('success')} Nueva Ficha PJ Aprobada\n\n` +
                                            `> ${interaction.client.emojiManager.getEmoji('user')} **Usuario**\n` +
                                            `<@${userId}> (${targetUser.user.tag})\n\n` +
                                            `> ${interaction.client.emojiManager.getEmoji('success')} **Estado**\n` +
                                            `**FICHA PJ ACEPTADA** ${interaction.client.emojiManager.getEmoji('success')}\n\n` +
                                            `> ${interaction.client.emojiManager.getEmoji('discordmod')} **Staff Responsable**\n` +
                                            `<@${interaction.user.id}>\n\n` +
                                            `> ${interaction.client.emojiManager.getEmoji('calendar')} **Fecha de Aprobación**\n` +
                                            `<t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
                                            `> ${interaction.client.emojiManager.getEmoji('whitelist')} **Acceso Otorgado**\n` +
                                            `El usuario ahora tiene acceso completo al servidor`
                                        )
                                    ]);

                                    try {
                                        await resultsChannel.send({
                                            components: [resultContainer],
                                            flags: MessageFlags.IsComponentsV2
                                        });
                                    } catch (error) {
                                        console.log(`Error al enviar resultado al canal: ${error.message}`);
                                    }
                                }
                            }

                            // Cerrar el ticket
                            await interaction.channel.delete();

                        } catch (error) {
                            console.error('Error al aceptar ficha PJ:', error);
                            const errorContainer = new ContainerBuilder();
                            errorContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(
                                    `# ${interaction.client.emojiManager.getEmoji('error')} Error\n\n` +
                                    `Hubo un error al procesar la aceptación de la ficha PJ.\n\n` +
                                    `**Error:** ${error.message}`
                                )
                            ]);
                            await interaction.reply({
                                components: [errorContainer],
                                flags: MessageFlags.IsComponentsV2,
                                ephemeral: true
                            });
                        }
                    }

                    // Botón de Denegar Ficha PJ
                    if (interaction.customId.startsWith('ficha_pj_deny_')) {
                        if (!puedeAceptarDenegarFormularios(interaction.member)) {
                            const errorContainer = new ContainerBuilder();
                            errorContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(crearMensajeErrorEntrevistador(interaction.client.emojiManager, 'denegar fichas PJ'))
                            ]);
                            return await interaction.reply({
                                components: [errorContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        }

                        const userId = interaction.customId.split('_')[3];
                        
                        const modal = new ModalBuilder()
                            .setCustomId(`ficha_pj_deny_modal_${userId}`)
                            .setTitle('Denegar Ficha PJ - Especificar Razón');

                        const razonInput = new TextInputBuilder()
                            .setCustomId('razon_rechazo')
                            .setLabel('Razón del rechazo')
                            .setStyle(TextInputStyle.Paragraph)
                            .setPlaceholder('Escribe aquí la razón específica del rechazo de la ficha PJ...')
                            .setRequired(true)
                            .setMaxLength(1000);

                        const firstActionRow = new ActionRowBuilder().addComponents(razonInput);
                        modal.addComponents(firstActionRow);

                        await interaction.showModal(modal);
                    }

                    // Botón de Añadir Ficha PJ
                    if (interaction.customId.startsWith('ficha_pj_add_')) {
                        if (!puedeAceptarDenegarFormularios(interaction.member)) {
                            const errorContainer = new ContainerBuilder();
                            errorContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(crearMensajeErrorEntrevistador(interaction.client.emojiManager, 'añadir fichas PJ'))
                            ]);
                            return await interaction.reply({
                                components: [errorContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        }

                        const userId = interaction.customId.split('_')[3];
                        
                        const modal = new ModalBuilder()
                            .setCustomId(`ficha_pj_add_modal_${userId}`)
                            .setTitle('Añadir Ficha PJ - ID del Mensaje');

                        const messageIdInput = new TextInputBuilder()
                            .setCustomId('message_id')
                            .setLabel('ID del mensaje con las respuestas')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('Ingresa el ID del mensaje del usuario con las respuestas...')
                            .setRequired(true)
                            .setMaxLength(20);

                        const firstActionRow = new ActionRowBuilder().addComponents(messageIdInput);
                        modal.addComponents(firstActionRow);

                        await interaction.showModal(modal);
                    }

                    if (interaction.customId.startsWith('encuesta_voto_')) {
                        const [, , encuestaId, opcion] = interaction.customId.split('_');
                        const votoRegistrado = registrarVoto(encuestaId, interaction.user.id, opcion);

                        if (votoRegistrado) {
                            const encuesta = obtenerEncuesta(encuestaId);
                            let mensajeRespuesta = '';

                            if (encuesta.tipo === 'si_no') {
                                const emojiRespuesta = opcion === 'si' ? interaction.client.emojiManager.getEmoji('success') : interaction.client.emojiManager.getEmoji('error');
                                const textoOpcion = opcion === 'si' ? 'Sí' : 'No';
                                mensajeRespuesta = `Has votado **${textoOpcion}** en la encuesta: **${encuesta.titulo}**`;
                            } else if (encuesta.tipo === 'multiple') {
                                const indiceOpcion = parseInt(opcion) - 1;
                                const nombreOpcion = encuesta.opciones[indiceOpcion];
                                const emojiNumero = interaction.client.emojiManager.getEmoji(numeroAPalabra(parseInt(opcion)));
                                mensajeRespuesta = `Has votado por **${nombreOpcion}** en la encuesta: **${encuesta.titulo}**`;
                            }

                            const successContainer = new ContainerBuilder();
                            successContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(`${interaction.client.emojiManager.getEmoji('success')} ${mensajeRespuesta}`)
                            ]);
                            await interaction.reply({
                                components: [successContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        } else {
                            const warningContainer = new ContainerBuilder();
                            warningContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(`${interaction.client.emojiManager.getEmoji('warning')} Ya has votado en esta encuesta o la encuesta ha sido cerrada.`)
                            ]);
                            await interaction.reply({
                                components: [warningContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        }
                    }

                    if (interaction.customId === 'encuesta_tipo_si_no') {
                        const modal = new ModalBuilder()
                            .setCustomId('encuesta_modal_si_no')
                            .setTitle('Crear Encuesta Sí/No');

                        const tituloInput = new TextInputBuilder()
                            .setCustomId('titulo')
                            .setLabel('Título de la encuesta')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('Escribe el título de tu encuesta...')
                            .setRequired(true)
                            .setMaxLength(200);

                        const firstRow = new ActionRowBuilder().addComponents(tituloInput);
                        modal.addComponents(firstRow);

                        await interaction.showModal(modal);
                    }

                    if (interaction.customId === 'encuesta_tipo_multiple') {
                        const modal = new ModalBuilder()
                            .setCustomId('encuesta_modal_multiple')
                            .setTitle('Crear Encuesta Múltiple');

                        const tituloInput = new TextInputBuilder()
                            .setCustomId('titulo')
                            .setLabel('Título de la encuesta')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('Escribe el título de tu encuesta...')
                            .setRequired(true)
                            .setMaxLength(200);

                        const opcionesInput = new TextInputBuilder()
                            .setCustomId('opciones')
                            .setLabel('Opciones (una por línea, máximo 9)')
                            .setStyle(TextInputStyle.Paragraph)
                            .setPlaceholder('Opción 1\nOpción 2\nOpción 3\n...')
                            .setRequired(true)
                            .setMaxLength(500);

                        const firstRow = new ActionRowBuilder().addComponents(tituloInput);
                        const secondRow = new ActionRowBuilder().addComponents(opcionesInput);

                        modal.addComponents(firstRow, secondRow);

                        await interaction.showModal(modal);
                    }

                    if (interaction.customId === 'say_texto') {
                        const modal = new ModalBuilder()
                            .setCustomId('say_texto_modal')
                            .setTitle('Agregar Texto al Mensaje');

                        const textoInput = new TextInputBuilder()
                            .setCustomId('contenido_texto')
                            .setLabel('Contenido del mensaje')
                            .setStyle(TextInputStyle.Paragraph)
                            .setPlaceholder('Escribe el contenido de tu mensaje aquí...')
                            .setRequired(true)
                            .setMaxLength(2000);

                        const canalInput = new TextInputBuilder()
                            .setCustomId('canal_destino')
                            .setLabel('ID del canal (opcional)')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('Deja vacío para enviar en el canal actual')
                            .setRequired(false)
                            .setMaxLength(20);

                        const firstRow = new ActionRowBuilder().addComponents(textoInput);
                        const secondRow = new ActionRowBuilder().addComponents(canalInput);

                        modal.addComponents(firstRow, secondRow);

                        await interaction.showModal(modal);
                    }

                    if (interaction.customId === 'say_boton') {
                        const modal = new ModalBuilder()
                            .setCustomId('say_boton_modal')
                            .setTitle('Agregar Botón al Mensaje');

                        const textoInput = new TextInputBuilder()
                            .setCustomId('texto_mensaje')
                            .setLabel('Texto del mensaje')
                            .setStyle(TextInputStyle.Paragraph)
                            .setPlaceholder('Contenido del mensaje...')
                            .setRequired(true)
                            .setMaxLength(2000);

                        const labelInput = new TextInputBuilder()
                            .setCustomId('label_boton')
                            .setLabel('Texto del botón')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('Ejemplo: Hacer clic aquí')
                            .setRequired(true)
                            .setMaxLength(80);

                        const urlInput = new TextInputBuilder()
                            .setCustomId('url_boton')
                            .setLabel('URL del botón')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('https://ejemplo.com')
                            .setRequired(true)
                            .setMaxLength(200);

                        const canalInput = new TextInputBuilder()
                            .setCustomId('canal_destino')
                            .setLabel('ID del canal (opcional)')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('Deja vacío para enviar en el canal actual')
                            .setRequired(false)
                            .setMaxLength(20);

                        const firstRow = new ActionRowBuilder().addComponents(textoInput);
                        const secondRow = new ActionRowBuilder().addComponents(labelInput);
                        const thirdRow = new ActionRowBuilder().addComponents(urlInput);
                        const fourthRow = new ActionRowBuilder().addComponents(canalInput);

                        modal.addComponents(firstRow, secondRow, thirdRow, fourthRow);

                        await interaction.showModal(modal);
                    }

                    if (interaction.customId === 'say_imagen') {
                        const modal = new ModalBuilder()
                            .setCustomId('say_imagen_modal')
                            .setTitle('Agregar Imagen/Video al Mensaje');

                        const textoInput = new TextInputBuilder()
                            .setCustomId('texto_mensaje')
                            .setLabel('Texto del mensaje')
                            .setStyle(TextInputStyle.Paragraph)
                            .setPlaceholder('Contenido del mensaje...')
                            .setRequired(true)
                            .setMaxLength(2000);

                        const imagenInput = new TextInputBuilder()
                            .setCustomId('url_imagen')
                            .setLabel('URL de la imagen')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('https://ejemplo.com/imagen.png')
                            .setRequired(true)
                            .setMaxLength(200);

                        const canalInput = new TextInputBuilder()
                            .setCustomId('canal_destino')
                            .setLabel('ID del canal (opcional)')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('Deja vacío para enviar en el canal actual')
                            .setRequired(false)
                            .setMaxLength(20);

                        const firstRow = new ActionRowBuilder().addComponents(textoInput);
                        const secondRow = new ActionRowBuilder().addComponents(imagenInput);
                        const thirdRow = new ActionRowBuilder().addComponents(canalInput);

                        modal.addComponents(firstRow, secondRow, thirdRow);

                        await interaction.showModal(modal);
                    }

                    if (interaction.customId.startsWith('entrevistadores_stats_')) {
                        const { mostrarTodasLasEstadisticasEntrevistadores } = require('../commands/entrevstats');
                        
                        if (interaction.customId.startsWith('entrevistadores_stats_prev_')) {
                            const pagina = parseInt(interaction.customId.split('_')[3]);
                            await interaction.deferUpdate();
                            await mostrarTodasLasEstadisticasEntrevistadores(interaction, pagina);
                        } else if (interaction.customId.startsWith('entrevistadores_stats_next_')) {
                            const pagina = parseInt(interaction.customId.split('_')[3]);
                            await interaction.deferUpdate();
                            await mostrarTodasLasEstadisticasEntrevistadores(interaction, pagina);
                        } else if (interaction.customId.startsWith('entrevistadores_stats_refresh_')) {
                            const pagina = parseInt(interaction.customId.split('_')[3]);
                            await interaction.deferUpdate();
                            await mostrarTodasLasEstadisticasEntrevistadores(interaction, pagina);
                        }
                    }


                } catch (error) {
                    console.error('Error en interacción de botón:', error);
                    const errorContainer = new ContainerBuilder();
                    errorContainer.addTextDisplayComponents([
                        new TextDisplayBuilder().setContent(`${interaction.client.emojiManager.getEmoji('error')} Hubo un error al procesar tu solicitud.`)
                    ]);
                    const errorMessage = {
                        components: [errorContainer],
                        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                    };
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp(errorMessage);
                    } else {
                        await interaction.reply(errorMessage);
                    }
                }
            }

            if (interaction.isModalSubmit()) {
                try {
                    if (interaction.customId.startsWith('ficha_pj_add_modal_')) {
                        await interaction.deferReply({ ephemeral: true });
                        
                        const userId = interaction.customId.split('_')[4];
                        const messageId = interaction.fields.getTextInputValue('message_id');

                        if (!puedeAceptarDenegarFormularios(interaction.member)) {
                            const errorContainer = new ContainerBuilder();
                            errorContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(crearMensajeErrorEntrevistador(interaction.client.emojiManager, 'añadir fichas PJ'))
                            ]);
                            return await interaction.editReply({
                                components: [errorContainer],
                                flags: MessageFlags.IsComponentsV2
                            });
                        }

                        try {
                            if (!messageId || messageId.length < 17 || messageId.length > 20 || !/^\d+$/.test(messageId)) {
                                throw new Error('ID de mensaje inválido. Debe ser un número de 17-20 dígitos.');
                            }

                            const userChannelId = getFichaPJChannelId(userId);
                            if (!userChannelId) {
                                throw new Error('No se encontró un canal de ticket para este usuario.');
                            }

                            const userChannel = interaction.guild.channels.cache.get(userChannelId);
                            if (!userChannel) {
                                throw new Error('El canal del ticket del usuario no existe o no es accesible.');
                            }

                            let message = await userChannel.messages.fetch(messageId);
                            
                            if (!message) {
                                throw new Error('No se pudo encontrar el mensaje con ese ID en este canal.');
                            }
                            
                            if (!message.content || message.content.trim().length === 0) {
                                try {
                                    message = await userChannel.messages.fetch(messageId, { force: true });
                                } catch (refreshError) {
                                    
                                }
                            }

                            let messageContent = '';
                            let contentSources = [];
                            
                            if (message.content && message.content.trim().length > 0) {
                                messageContent = message.content;
                                contentSources.push('contenido directo');
                            }
                            
                            if (!messageContent && message.embeds && message.embeds.length > 0) {
                                for (const embed of message.embeds) {
                                    if (embed.description && embed.description.trim().length > 0) {
                                        messageContent += embed.description + '\n';
                                        contentSources.push('embed description');
                                    }
                                    if (embed.fields && embed.fields.length > 0) {
                                        for (const field of embed.fields) {
                                            if (field.value && field.value.trim().length > 0) {
                                                messageContent += `${field.name}: ${field.value}\n`;
                                                contentSources.push('embed field');
                                            }
                                        }
                                    }
                                    if (!messageContent && embed.title && embed.title.trim().length > 0) {
                                        messageContent = embed.title;
                                        contentSources.push('embed title');
                                    }
                                    if (embed.author && embed.author.name && embed.author.name.trim().length > 0) {
                                        messageContent += embed.author.name + '\n';
                                        contentSources.push('embed author');
                                    }
                                    if (embed.footer && embed.footer.text && embed.footer.text.trim().length > 0) {
                                        messageContent += embed.footer.text + '\n';
                                        contentSources.push('embed footer');
                                    }
                                }
                            }
                            
                            if (!messageContent && message.attachments && message.attachments.size > 0) {
                                for (const attachment of message.attachments.values()) {
                                    if (attachment.description && attachment.description.trim().length > 0) {
                                        messageContent += attachment.description + '\n';
                                        contentSources.push('attachment description');
                                    }
                                    if (attachment.name && attachment.name.trim().length > 0) {
                                        messageContent += attachment.name + '\n';
                                        contentSources.push('attachment name');
                                    }
                                }
                            }
                            
                            if (!messageContent && message.components && message.components.length > 0) {
                                for (const component of message.components) {
                                    if (component.components) {
                                        for (const subComponent of component.components) {
                                            if (subComponent.value && subComponent.value.trim().length > 0) {
                                                messageContent += subComponent.value + '\n';
                                                contentSources.push('component value');
                                            }
                                            if (subComponent.label && subComponent.label.trim().length > 0) {
                                                messageContent += subComponent.label + '\n';
                                                contentSources.push('component label');
                                            }
                                            if (subComponent.placeholder && subComponent.placeholder.trim().length > 0) {
                                                messageContent += subComponent.placeholder + '\n';
                                                contentSources.push('component placeholder');
                                            }
                                        }
                                    }
                                }
                            }
                            
                            if (!messageContent && message.interaction) {
                                if (message.interaction.commandName) {
                                    messageContent += `Comando: ${message.interaction.commandName}\n`;
                                    contentSources.push('interaction command');
                                }
                                if (message.interaction.options) {
                                    for (const option of message.interaction.options) {
                                        if (option.value && option.value.toString().trim().length > 0) {
                                            messageContent += `${option.name}: ${option.value}\n`;
                                            contentSources.push('interaction option');
                                        }
                                    }
                                }
                                if (message.interaction.data) {
                                    const interactionData = message.interaction.data;
                                    if (interactionData.name) {
                                        messageContent += `Interacción: ${interactionData.name}\n`;
                                        contentSources.push('interaction data name');
                                    }
                                    if (interactionData.components) {
                                        for (const component of interactionData.components) {
                                            if (component.components) {
                                                for (const subComponent of component.components) {
                                                    if (subComponent.value && subComponent.value.trim().length > 0) {
                                                        messageContent += subComponent.value + '\n';
                                                        contentSources.push('interaction data component');
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            
                            if (!messageContent && message.interactionMetadata) {
                                if (message.interactionMetadata.name) {
                                    messageContent += `Metadata: ${message.interactionMetadata.name}\n`;
                                    contentSources.push('interaction metadata name');
                                }
                                if (message.interactionMetadata.originalResponseMessageId) {
                                    try {
                                        const originalMessage = await interaction.channel.messages.fetch(message.interactionMetadata.originalResponseMessageId);
                                        if (originalMessage && originalMessage.content && originalMessage.content.trim().length > 0) {
                                            messageContent = originalMessage.content;
                                            contentSources.push('metadata original message');
                                        }
                                    } catch (error) {
                                        console.log('No se pudo obtener el mensaje original de interactionMetadata:', error.message);
                                    }
                                }
                            }
                            
                            if (!messageContent && message.reference && message.reference.messageId) {
                                try {
                                    const referencedMessage = await interaction.channel.messages.fetch(message.reference.messageId);
                                    if (referencedMessage) {
                                        if (referencedMessage.content && referencedMessage.content.trim().length > 0) {
                                            messageContent = referencedMessage.content;
                                            contentSources.push('referenced message content');
                                        } else if (referencedMessage.embeds && referencedMessage.embeds.length > 0) {
                                            for (const embed of referencedMessage.embeds) {
                                                if (embed.description && embed.description.trim().length > 0) {
                                                    messageContent += embed.description + '\n';
                                                    contentSources.push('referenced embed description');
                                                }
                                                if (embed.fields && embed.fields.length > 0) {
                                                    for (const field of embed.fields) {
                                                        if (field.value && field.value.trim().length > 0) {
                                                            messageContent += field.name + ': ' + field.value + '\n';
                                                            contentSources.push('referenced embed field');
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                } catch (error) {
                                    console.log('No se pudo obtener el mensaje referenciado:', error.message);
                                }
                            }
                            
                            if (!messageContent && message.poll) {
                                if (message.poll.question && message.poll.question.text) {
                                    messageContent += `Encuesta: ${message.poll.question.text}\n`;
                                    contentSources.push('poll question');
                                }
                                if (message.poll.answers) {
                                    for (const answer of message.poll.answers) {
                                        if (answer.text && answer.text.trim().length > 0) {
                                            messageContent += `- ${answer.text}\n`;
                                            contentSources.push('poll answer');
                                        }
                                    }
                                }
                            }
                            
                            if (!messageContent && message.stickers && message.stickers.size > 0) {
                                for (const sticker of message.stickers.values()) {
                                    if (sticker.name && sticker.name.trim().length > 0) {
                                        messageContent += `Sticker: ${sticker.name}\n`;
                                        contentSources.push('sticker name');
                                    }
                                    if (sticker.description && sticker.description.trim().length > 0) {
                                        messageContent += sticker.description + '\n';
                                        contentSources.push('sticker description');
                                    }
                                }
                            }
                            
                            if (!messageContent || messageContent.trim().length === 0) {
                                try {
                                    const alternativeMessage = await userChannel.messages.fetch({
                                        around: messageId,
                                        limit: 1
                                    });
                                    const foundMessage = alternativeMessage.get(messageId);
                                    if (foundMessage && foundMessage.content && foundMessage.content.trim().length > 0) {
                                        messageContent = foundMessage.content;
                                        contentSources.push('fetch alternativo');
                                    }
                                } catch (altError) {
                                    
                                }
                                
                                if (!messageContent || messageContent.trim().length === 0) {
                                    await interaction.editReply({
                                        content: '❌ **Error al procesar ficha PJ**\n\n' +
                                                'El mensaje seleccionado no contiene texto procesable.\n' +
                                                'Por favor, verifica que el mensaje contenga el contenido de la ficha PJ.',
                                         ephemeral: true
                                     });
                                    return;
                                 }
                            }

                            messageContent = messageContent
                                .replace(/\*\*([^*]+)\*\*/g, '$1')
                                .replace(/\*([^*]+)\*/g, '$1')
                                .replace(/__([^_]+)__/g, '$1')
                                .replace(/~~([^~]+)~~/g, '$1')
                                .replace(/`([^`]+)`/g, '$1')
                                .replace(/\|\|([^|]+)\|\|/g, '$1')
                                .replace(/^>\s*/gm, '')
                                .trim();
                            
                            const preguntas = [
                                'Nombre completo del personaje:',
                                'Edad:',
                                'Nacionalidad + Ciudad:',
                                'Clase social:',
                                'Profesión y estudios:',
                                'Antecedentes:',
                                'Descripción física y psicológica:',
                                'Miedos y fobias:',
                                'Defectos:',
                                'Virtudes:',
                                'Motivaciones y metas:',
                                'Relaciones:'
                            ];

                            const respuestas = {};
                            const lineas = messageContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                            
                            let preguntaActual = '';
                            let respuestaActual = '';

                            function escaparRegex(texto) {
                                return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            }
                            
                            function detectarPregunta(linea, preguntas) {
                                const lineaLimpia = linea.toLowerCase().trim();
                                
                                for (const pregunta of preguntas) {
                                    const preguntaOriginal = pregunta.toLowerCase().trim();
                                    const preguntaSinDospuntos = preguntaOriginal.replace(/:$/, '');
                                    
                                    if (lineaLimpia.startsWith(preguntaSinDospuntos + ':') || 
                                        lineaLimpia.startsWith(preguntaSinDospuntos + ' ')) {
                                        return pregunta;
                                    }
                                    
                                    const patronExacto = escaparRegex(preguntaSinDospuntos);
                                    const regexExacta = new RegExp('^\\s*' + patronExacto + '\\s*:?\\s*', 'i');
                                    if (regexExacta.test(lineaLimpia)) {
                                        return pregunta;
                                    }
                                    
                                    const preguntaLimpia = preguntaOriginal.replace(/[:\[\]()]/g, '').trim();
                                    if (preguntaLimpia.length > 15 && lineaLimpia.includes(preguntaLimpia.substring(0, 15))) {
                                        const palabrasClave = preguntaLimpia.split(' ').filter(p => p.length > 3);
                                        const coincidencias = palabrasClave.filter(palabra => lineaLimpia.includes(palabra));
                                        if (coincidencias.length >= Math.min(2, palabrasClave.length)) {
                                            return pregunta;
                                        }
                                    }
                                }
                                return null;
                            }

                            for (let i = 0; i < lineas.length; i++) {
                                const linea = lineas[i];
                                
                                const preguntaEncontrada = detectarPregunta(linea, preguntas);
                                
                                if (preguntaEncontrada) {
                                    if (preguntaActual && respuestaActual.trim()) {
                                        respuestas[preguntaActual] = respuestaActual.trim();
                                    }
                                    preguntaActual = preguntaEncontrada;
                                    
                                    const preguntaPattern = preguntaEncontrada.toLowerCase()
                                        .replace(/[:\[\]()]/g, '')
                                        .replace(/\+/g, '')
                                        .replace(/\s+/g, '\\s*');
                                    const regex = new RegExp(preguntaPattern + '\\s*:?\\s*', 'i');
                                    respuestaActual = linea.replace(regex, '').trim();
                                } else if (preguntaActual) {
                                    if (respuestaActual) {
                                        respuestaActual += ' ' + linea;
                                    } else {
                                        respuestaActual = linea;
                                    }
                                }
                            }

                            if (preguntaActual && respuestaActual.trim()) {
                                respuestas[preguntaActual] = respuestaActual.trim();
                            }
                            
                            if (Object.keys(respuestas).length === 0) {
                                throw new Error('No se pudieron extraer respuestas del mensaje. Verifica que el formato sea correcto.');
                            }

                            const fs = require('fs');
                            const path = require('path');
                            const dbPath = path.join(__dirname, '../database/formulario-stats.json');
                            
                            let database = {};
                            if (fs.existsSync(dbPath)) {
                                database = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
                            }

                            if (!database.fichaPJ) {
                                database.fichaPJ = {
                                    total: 0,
                                    accepted: 0,
                                    denied: 0,
                                    applications: []
                                };
                            }

                            if (!database.fichaPJ.applications) {
                                database.fichaPJ.applications = [];
                            }

                            const formData = {
                                nombre_completo: respuestas['Nombre completo del personaje:'] || '',
                                edad: respuestas['Edad:'] || '',
                                nacionalidad: respuestas['Nacionalidad + Ciudad:'] || '',
                                clase_social: respuestas['Clase social:'] || '',
                                profesion_estudios: respuestas['Profesión y estudios:'] || '',
                                antecedentes: respuestas['Antecedentes:'] || '',
                                descripcion_fisica: respuestas['Descripción física y psicológica:'] || '',
                                miedos_fobias: respuestas['Miedos y fobias:'] || '',
                                defectos: respuestas['Defectos:'] || '',
                                virtudes: respuestas['Virtudes:'] || '',
                                motivaciones_metas: respuestas['Motivaciones y metas:'] || '',
                                relaciones: respuestas['Relaciones:'] || ''
                            };

                            const nuevaFicha = {
                                userId: userId,
                                formData: formData,
                                respuestas: respuestas,
                                fechaCreacion: new Date().toISOString(),
                                staffResponsable: interaction.user.id,
                                messageId: messageId,
                                status: 'pending'
                            };

                            const existingIndex = database.fichaPJ.applications.findIndex(app => app.userId === userId);
                            if (existingIndex !== -1) {
                                database.fichaPJ.applications[existingIndex] = nuevaFicha;
                            } else {
                                database.fichaPJ.applications.push(nuevaFicha);
                                database.fichaPJ.total++;
                            }

                            fs.writeFileSync(dbPath, JSON.stringify(database, null, 2));

                            const confirmContainer = new ContainerBuilder();
                            confirmContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(
                                    `${interaction.client.emojiManager.getEmoji('success')} **Ficha PJ añadida correctamente**\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('user')} **Usuario**\n` +
                                    `<@${userId}>\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('files')} **Respuestas procesadas**\n` +
                                    `${Object.keys(respuestas).length} de ${preguntas.length} preguntas\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('settings')} **Guardado en base de datos**\n` +
                                    `Los datos han sido almacenados correctamente`
                                )
                            ]);

                            await interaction.editReply({
                                components: [confirmContainer],
                                flags: MessageFlags.IsComponentsV2
                            });

                        } catch (error) {
                            console.error('Error al procesar ficha PJ:', error);
                            
                            const errorContainer = new ContainerBuilder();
                            errorContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(
                                    `# ${interaction.client.emojiManager.getEmoji('error')} Error al Procesar Ficha PJ\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('error')} **Error específico**\n` +
                                    `${error.message}\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('aviso')} **Instrucciones**\n` +
                                    `• Asegúrate de que el ID del mensaje sea correcto\n` +
                                    `• El mensaje debe estar en este mismo canal\n` +
                                    `• El mensaje debe contener las respuestas del formulario\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('settings')} **ID proporcionado**\n` +
                                    `\`${messageId}\``
                                )
                            ]);

                            await interaction.editReply({
                                components: [errorContainer],
                                flags: MessageFlags.IsComponentsV2
                            });
                        }
                    } else if (interaction.customId.startsWith('encuesta_modal_')) {
                        const tipoEncuesta = interaction.customId.includes('si_no') ? 'si_no' : 'multiple';
                        const titulo = interaction.fields.getTextInputValue('titulo');

                        let opciones = [];
                        if (tipoEncuesta === 'multiple') {
                            const opcionesTexto = interaction.fields.getTextInputValue('opciones');
                            opciones = opcionesTexto.split('\n').filter(opcion => opcion.trim().length > 0).slice(0, 9);

                            if (opciones.length < 2) {
                                return await interaction.reply({
                                    content: `${interaction.client.emojiManager.getEmoji('error')} Debes proporcionar al menos 2 opciones para una encuesta de opción múltiple.`,
                                    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                                });
                            }
                        } else if (tipoEncuesta === 'si_no') {
                            opciones = ['Sí', 'No'];
                        }

                        const encuestaId = crearEncuesta({
                            titulo,
                            tipo: tipoEncuesta,
                            opciones,
                            creadaPor: interaction.user.id,
                            canalId: interaction.channel.id
                        });

                        const containerEncuesta = new ContainerBuilder();
                        containerEncuesta.addTextDisplayComponents([
                            new TextDisplayBuilder().setContent(`# ${interaction.client.emojiManager.getEmoji('announcements')} Nueva Encuesta\n\n**${titulo}**\n\n> ${interaction.client.emojiManager.getEmoji('user')} **Creada por:** <@${interaction.user.id}>\n> ${interaction.client.emojiManager.getEmoji('loading')} **Estado:** Activa`)
                        ]);

                        containerEncuesta.addSeparatorComponents(
                            new SeparatorBuilder().setSpacing('Small')
                        );

                        if (tipoEncuesta === 'si_no') {
                            const botonSi = new ButtonBuilder()
                                .setCustomId(`encuesta_voto_${encuestaId}_si`)
                                .setLabel('Sí')
                                .setEmoji(interaction.client.emojiManager.getEmoji('success'))
                                .setStyle(ButtonStyle.Success);

                            const botonNo = new ButtonBuilder()
                                .setCustomId(`encuesta_voto_${encuestaId}_no`)
                                .setLabel('No')
                                .setEmoji(interaction.client.emojiManager.getEmoji('error'))
                                .setStyle(ButtonStyle.Danger);

                            const seccionSi = new SectionBuilder()
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder()
                                        .setContent(`${interaction.client.emojiManager.getEmoji('success')} **Sí** - Estoy de acuerdo`)
                                )
                                .setButtonAccessory(botonSi);

                            const seccionNo = new SectionBuilder()
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder()
                                        .setContent(`${interaction.client.emojiManager.getEmoji('error')} **No** - No estoy de acuerdo`)
                                )
                                .setButtonAccessory(botonNo);

                            containerEncuesta.addSectionComponents(seccionSi);
                            containerEncuesta.addSectionComponents(seccionNo);
                        } else if (tipoEncuesta === 'multiple') {
                            opciones.forEach((opcion, index) => {
                                const numeroOpcion = index + 1;
                                const emojiNumero = interaction.client.emojiManager.getEmoji(numeroAPalabra(numeroOpcion));

                                const botonOpcion = new ButtonBuilder()
                                    .setCustomId(`encuesta_voto_${encuestaId}_${numeroOpcion}`)
                                    .setEmoji(emojiNumero)
                                    .setStyle(ButtonStyle.Primary);

                                const seccionOpcion = new SectionBuilder()
                                    .addTextDisplayComponents(
                                        new TextDisplayBuilder()
                                            .setContent(`${emojiNumero} ${opcion}`)
                                    )
                                    .setButtonAccessory(botonOpcion);

                                containerEncuesta.addSectionComponents(seccionOpcion);
                            });
                        }

                        containerEncuesta.addSeparatorComponents(
                            new SeparatorBuilder().setSpacing('Small')
                        );

                        containerEncuesta.addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`${interaction.client.emojiManager.getEmoji('aviso')} **Importante:** Solo puedes votar una vez por encuesta.`)
                        );

                        containerEncuesta.addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `*Encuesta creada • • ID: ${encuestaId}*`
                            )
                        );

                        await interaction.reply({
                            components: [containerEncuesta],
                            flags: MessageFlags.IsComponentsV2
                        });

                        const mensajeReal = await interaction.fetchReply();
                        actualizarMensajeId(encuestaId, mensajeReal.id);
                    }

                    if (interaction.customId === 'say_texto') {
                        const modal = new ModalBuilder()
                            .setCustomId('say_texto_modal')
                            .setTitle('Agregar Texto al Mensaje');

                        const textoInput = new TextInputBuilder()
                            .setCustomId('contenido_texto')
                            .setLabel('Contenido del Texto')
                            .setStyle(TextInputStyle.Paragraph)
                            .setPlaceholder('Escribe tu mensaje aquí... Puedes usar emojis y markdown')
                            .setRequired(true)
                            .setMaxLength(2000);

                        const firstRow = new ActionRowBuilder().addComponents(textoInput);
                        modal.addComponents(firstRow);

                        await interaction.showModal(modal);
                    }

                    if (interaction.customId === 'say_boton') {
                        const modal = new ModalBuilder()
                            .setCustomId('say_boton_modal')
                            .setTitle('Agregar Botón al Mensaje');

                        const textoBotonInput = new TextInputBuilder()
                            .setCustomId('texto_boton')
                            .setLabel('Texto del Botón')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('Texto que aparecerá en el botón')
                            .setRequired(true)
                            .setMaxLength(80);

                        const idBotonInput = new TextInputBuilder()
                            .setCustomId('id_boton')
                            .setLabel('ID del Botón')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('ID único para el botón (sin espacios)')
                            .setRequired(true)
                            .setMaxLength(100);

                        const urlBotonInput = new TextInputBuilder()
                            .setCustomId('url_boton')
                            .setLabel('URL del Botón (Opcional)')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('https://ejemplo.com (deja vacío para botón normal)')
                            .setRequired(false)
                            .setMaxLength(500);

                        const firstRow = new ActionRowBuilder().addComponents(textoBotonInput);
                        const secondRow = new ActionRowBuilder().addComponents(idBotonInput);
                        const thirdRow = new ActionRowBuilder().addComponents(urlBotonInput);

                        modal.addComponents(firstRow, secondRow, thirdRow);

                        await interaction.showModal(modal);
                    }

                    if (interaction.customId === 'say_imagen') {
                        const modal = new ModalBuilder()
                            .setCustomId('say_imagen_modal')
                            .setTitle('Agregar Imagen/Video al Mensaje');

                        const urlImagenInput = new TextInputBuilder()
                            .setCustomId('url_imagen')
                            .setLabel('URL de Imagen/Video')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('https://ejemplo.com/archivo.png (webp, gif, png, jpg, mp4)')
                            .setRequired(true)
                            .setMaxLength(500);

                        const firstRow = new ActionRowBuilder().addComponents(urlImagenInput);
                        modal.addComponents(firstRow);

                        await interaction.showModal(modal);
                    }

                    if (interaction.customId === 'formulario_modal') {
                        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                        
                        const formData = {
                            url_steam: interaction.fields.getTextInputValue('url_steam'),
                            servidores_roleados: interaction.fields.getTextInputValue('servidores_roleados'),
                            rol_gta_stories: interaction.fields.getTextInputValue('rol_gta_stories'),
                            sanciones_activas: interaction.fields.getTextInputValue('sanciones_activas'),
                            horas_fivem: interaction.fields.getTextInputValue('horas_fivem')
                        };

                        await addApplication(interaction.user.id, formData);

                        const staffContainer = new ContainerBuilder();
                        staffContainer.addTextDisplayComponents([
                            new TextDisplayBuilder().setContent(`# ${interaction.client.emojiManager.getEmoji('new')} Nueva Solicitud de Formulario\n\n> ${interaction.client.emojiManager.getEmoji('loading')} **Solicitud pendiente de revisión**\n\n> ${interaction.client.emojiManager.getEmoji('user')} **Usuario Solicitante**\n<@${interaction.user.id}> • \`${interaction.user.id}\``)
                        ]);

                        staffContainer.addSeparatorComponents([
                            new SeparatorBuilder().setSpacing('Small')
                        ]);

                        staffContainer.addTextDisplayComponents([
                            new TextDisplayBuilder().setContent(
                                `-# ${interaction.client.emojiManager.getEmoji('whitelist')} **URL Steam**\n` +
                                `\`\`\`\n${formData.url_steam}\`\`\`\n` +
                                `-# ${interaction.client.emojiManager.getEmoji('fivem')} **Horas en FiveM**\n` +
                                `\`\`\`\n${formData.horas_fivem}\`\`\`\n`
                            )
                        ]);

                        const acceptButton = new ButtonBuilder()
                            .setCustomId(`formulario_accept_${interaction.user.id}`)
                            .setLabel(`Aceptar Solicitud`)
                            .setEmoji(interaction.client.emojiManager.getEmoji('success'))
                            .setStyle(ButtonStyle.Success);

                        const denyButton = new ButtonBuilder()
                            .setCustomId(`formulario_deny_${interaction.user.id}`)
                            .setLabel(`Denegar Solicitud`)
                            .setEmoji(interaction.client.emojiManager.getEmoji('delete'))
                            .setStyle(ButtonStyle.Danger);

                        const viewButton = new ButtonBuilder()
                            .setCustomId(`formulario_view_${interaction.user.id}`)
                            .setLabel(`Ver Detalles`)
                            .setEmoji(interaction.client.emojiManager.getEmoji('motivo'))
                            .setStyle(ButtonStyle.Secondary);

                        const actionsSection = new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder()
                                    .setContent(`${interaction.client.emojiManager.getEmoji('discordmod')} **Acciones de Moderación**\n-# Selecciona una acción para procesar esta solicitud.`)
                            )
                            .setButtonAccessory(acceptButton);

                        const denySection = new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder()
                                    .setContent(`${interaction.client.emojiManager.getEmoji('delete')} **Denegar Solicitud**\n-# Rechazar la solicitud de formulario.`)
                            )
                            .setButtonAccessory(denyButton);

                        const viewSection = new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder()
                                    .setContent(`${interaction.client.emojiManager.getEmoji('user')} **Ver Información Completa**\n-# Revisar todos los detalles de la solicitud.`)
                            )
                            .setButtonAccessory(viewButton);

                        staffContainer.addSectionComponents(actionsSection);
                        staffContainer.addSectionComponents(denySection);
                        staffContainer.addSectionComponents(viewSection);

                        staffContainer.addTextDisplayComponents([
                            new TextDisplayBuilder().setContent(
                                `\n\n*GTA Stories • Sistema de Formulario • *`
                            )
                        ]);

                        const staffChannel = interaction.guild.channels.cache.get(config.canales.FormChannelId);
                        if (staffChannel) {
                            const sentMessage = await staffChannel.send({
                                components: [staffContainer],
                                flags: MessageFlags.IsComponentsV2
                            });

                            await updateApplicationStatus(interaction.user.id, 'pending', sentMessage.url);
                        }

                        const fichaPJStatus = getFichaPJStatus(interaction.user.id);
                        if (fichaPJStatus === 'accepted') {
                            const fichaPJMessageUrl = getFichaPJMessageUrl(interaction.user.id);
                            if (fichaPJMessageUrl) {
                                try {
                                    const urlParts = fichaPJMessageUrl.split('/');
                                    const channelId = urlParts[urlParts.length - 2];
                                    const messageId = urlParts[urlParts.length - 1];
                                    
                                    const resultsChannel = interaction.guild.channels.cache.get(channelId);
                                    if (resultsChannel) {
                                        const message = await resultsChannel.messages.fetch(messageId);
                                        
                                        const updatedContainer = new ContainerBuilder();
                                        updatedContainer.addTextDisplayComponents([
                                            new TextDisplayBuilder().setContent(
                                                `# ${interaction.client.emojiManager.getEmoji('success')} Ficha PJ Aceptada\n\n` +
                                                `> ${interaction.client.emojiManager.getEmoji('warning')} **Falta aprobar Formulario**\n` +
                                                `La ficha PJ ha sido aceptada, pero el formulario está pendiente\n\n` +
                                                `> ${interaction.client.emojiManager.getEmoji('whitelist')} **Usuario Procesado**\n` +
                                                `<@${interaction.user.id}>\n\n` +
                                                `> ${interaction.client.emojiManager.getEmoji('discordmod')} **Staff Responsable**\n` +
                                                `<@${interaction.user.id}> aprobó esta solicitud\n\n` +
                                                `> ${interaction.client.emojiManager.getEmoji('settings')} **Estado del Proceso**\n` +
                                                `FICHA PJ ACEPTADA ${interaction.client.emojiManager.getEmoji('success')} • FORMULARIO PENDIENTE ${interaction.client.emojiManager.getEmoji('loading')}\n\n` +
                                                `*[Ir al Formulario pendiente](${getFormularioMessageUrl(interaction.user.id)})*`
                                            )
                                        ]);

                                        await message.edit({
                                            components: [updatedContainer],
                                            flags: MessageFlags.IsComponentsV2
                                        });
                                    }
                                } catch (error) {
                                    console.error('Error actualizando contenedor de ficha PJ:', error);
                                }
                            }
                        }

                        const successContainer = new ContainerBuilder();
                        successContainer.addTextDisplayComponents([
                            new TextDisplayBuilder().setContent(`# ${interaction.client.emojiManager.getEmoji('success')} Solicitud Enviada Correctamente\n\n-# ${interaction.client.emojiManager.getEmoji('success')} ¡Tu solicitud ha sido enviada exitosamente!\n\n> ${interaction.client.emojiManager.getEmoji('notificacion')} **Notificación**\nRecibirás una respuesta por mensaje privado\n> ${interaction.client.emojiManager.getEmoji('loading')} **Tiempo de Respuesta**\nAproximadamente 2-3 horas\n> ${interaction.client.emojiManager.getEmoji('aviso')} **Recordatorio Importante**\nAsegúrate de tener los mensajes privados activados\n\n*Gracias por tu interés en GTA Stories* ${interaction.client.emojiManager.getEmoji('whitelist')}`)
                        ]);

                        await interaction.editReply({
                            components: [successContainer],
                            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                        });
                    }

                    if (interaction.customId === 'ficha_pj_modal') {
                        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                        const fichaPJData = {
                            nombre_completo: interaction.fields.getTextInputValue('nombre_completo'),
                            edad: interaction.fields.getTextInputValue('edad'),
                            nacionalidad: interaction.fields.getTextInputValue('nacionalidad'),
                            antecedentes: interaction.fields.getTextInputValue('antecedentes'),
                            objetivo_servidor: interaction.fields.getTextInputValue('objetivo_servidor')
                        };

                        await addFichaPJApplication(interaction.user.id, fichaPJData);

                        const ticketsCategory = interaction.guild.channels.cache.get(config.canales.ticketsCategoryId);
                        if (!ticketsCategory) {
                            const errorContainer = new ContainerBuilder();
                            errorContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(`# ${interaction.client.emojiManager.getEmoji('error')} Error de Configuración\n\n> ${interaction.client.emojiManager.getEmoji('error')} **No se pudo crear el ticket**\nLa categoría de tickets no está configurada\n\n*Contacta con un administrador* ${interaction.client.emojiManager.getEmoji('settings')}`)
                            ]);
                            return await interaction.editReply({
                                components: [errorContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        }

                        const ticketChannel = await interaction.guild.channels.create({
                            name: `📕丨${interaction.user.username}`,
                            type: ChannelType.GuildText,
                            parent: ticketsCategory.id,
                            permissionOverwrites: [
                                {
                                    id: interaction.guild.id,
                                    deny: [PermissionFlagsBits.ViewChannel]
                                },
                                {
                                    id: interaction.user.id,
                                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                                },
                                {
                                    id: config.rolesAprobacion.formularioRoleId,
                                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages]
                                }
                            ]
                        });

                        const currentDate = new Date();
                        const fechaFormateada = currentDate.toLocaleDateString('es-ES', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        });
                        const horaFormateada = currentDate.toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit'
                        });

                        const ticketContainer = new ContainerBuilder();
                        
                
                        ticketContainer.addTextDisplayComponents([
                            new TextDisplayBuilder().setContent(
                                `# ${interaction.client.emojiManager.getEmoji('ticket')} Bienvenido al ticket de ficha PJ\n\n` +
                                `-# ${interaction.client.emojiManager.getEmoji('loading')} Por favor, ten paciencia mientras asignamos a alguien para ayudarte.\n` +
                                `**Mientras tanto, puedes agregar cualquier información adicional que consideres relevante.**\n\n` +
                                `${interaction.client.emojiManager.getEmoji('ticket')} **Categoría del Ticket:** Ficha de Personaje\n` +
                                `${interaction.client.emojiManager.getEmoji('persona')} **Usuario:** <@${interaction.user.id}>\n` +
                                `${interaction.client.emojiManager.getEmoji('calendar')} **Fecha:** ${fechaFormateada}\n` +
                                `${interaction.client.emojiManager.getEmoji('clock')} **Hora:** ${horaFormateada}`
                            )
                        ]);

                        ticketContainer.addSeparatorComponents([
                            new SeparatorBuilder()
                        ]);

                        const claimButton = new ButtonBuilder()
                            .setCustomId(`ficha_pj_claim_${interaction.user.id}`)
                            .setLabel('Reclamar Ficha PJ')
                            .setEmoji(interaction.client.emojiManager.getEmoji('user'))
                            .setStyle(ButtonStyle.Primary);

                        const adminButton = new ButtonBuilder()
                            .setCustomId(`ficha_pj_admin_${interaction.user.id}`)
                            .setLabel('Administración')
                            .setEmoji(interaction.client.emojiManager.getEmoji('administrator'))
                            .setStyle(ButtonStyle.Secondary);

                        const viewButton = new ButtonBuilder()
                            .setCustomId(`ficha_pj_details_${interaction.user.id}`)
                            .setLabel('Ver Detalles')
                            .setEmoji(interaction.client.emojiManager.getEmoji('files'))
                            .setStyle(ButtonStyle.Secondary);

                        const claimSection = new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder()
                                    .setContent(`${interaction.client.emojiManager.getEmoji('user')} **Reclamar Ficha**\n-# Hacerse cargo de esta ficha PJ`)
                            )
                            .setButtonAccessory(claimButton);

                        const adminSection = new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder()
                                    .setContent(`${interaction.client.emojiManager.getEmoji('administrator')} **Panel de Administración**\n-# Acciones de aceptar, denegar y notificar`)
                            )
                            .setButtonAccessory(adminButton);

                        const viewSection = new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder()
                                    .setContent(`${interaction.client.emojiManager.getEmoji('files')} **Ver Información Completa**\n-# Revisar todos los detalles de la ficha`)
                            )
                            .setButtonAccessory(viewButton);

                        ticketContainer.addSectionComponents(claimSection);
                        ticketContainer.addSectionComponents(adminSection);
                        ticketContainer.addSectionComponents(viewSection);

                        ticketContainer.addSeparatorComponents([
                            new SeparatorBuilder()
                        ]);

                        ticketContainer.addTextDisplayComponents([
                            new TextDisplayBuilder().setContent(`<@&${config.rolesAprobacion.formularioRoleId}>`)
                        ]);

                        await ticketChannel.send({
                            components: [ticketContainer],
                            flags: MessageFlags.IsComponentsV2
                        });

                        try {
                            await addFichaPJTicket(interaction.user.id, ticketChannel.id);
                            await updateFichaPJStatus(interaction.user.id, 'pending', ticketChannel.url);
                        } catch (error) {
                            console.error('Error al procesar ticket de ficha PJ:', error);
                        }

                        const successContainer = new ContainerBuilder();
                        successContainer.addTextDisplayComponents([
                            new TextDisplayBuilder().setContent(`# ${interaction.client.emojiManager.getEmoji('success')} Ticket de Ficha PJ Creado\n\n> ${interaction.client.emojiManager.getEmoji('success')} **Tu ficha de personaje ha sido enviada**\nSe ha creado un ticket para revisar tu ficha\n\n> ${interaction.client.emojiManager.getEmoji('createchannels')} **Canal del Ticket**\n<#${ticketChannel.id}>\n\n> ${interaction.client.emojiManager.getEmoji('notificacion')} **Notificación**\nRecibirás una respuesta por mensaje privado\n\n> ${interaction.client.emojiManager.getEmoji('loading')} **Tiempo de Respuesta**\nAproximadamente 2-3 horas\n\n*Gracias por tu interés en GTA Stories* ${interaction.client.emojiManager.getEmoji('user')}`)
                        ]);

                        await interaction.editReply({
                            components: [successContainer],
                            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                        });
                    }

                    if (interaction.customId === 'say_texto_modal') {
                        const contenidoTexto = interaction.fields.getTextInputValue('contenido_texto');
                        const canalDestino = interaction.fields.getTextInputValue('canal_destino');

                        const procesarTexto = (texto) => {
                            return texto
                                .replace(/\\n/g, '\n')
                                .replace(/\\t/g, '\t')
                                .split('\n')
                                .map(linea => linea.trim())
                                .filter(linea => linea.length > 0)
                                .join('\n\n');
                        };

                        const textoFinal = procesarTexto(contenidoTexto);
                        const container = new ContainerBuilder();
                        container.addTextDisplayComponents([
                            new TextDisplayBuilder().setContent(textoFinal)
                        ]);

                        const targetChannel = canalDestino ? interaction.guild.channels.cache.get(canalDestino) : interaction.channel;

                        if (!targetChannel) {
                            const emojiError = interaction.client.emojiManager.getEmoji('error') || '❌';
                            const errorContainer = new ContainerBuilder();
                            errorContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(`# ${emojiError} Canal No Encontrado\n\n-# El canal especificado no existe o no tienes permisos\n\n*GTA Stories • Sistema de Mensajes • *`)
                            ]);

                            return await interaction.reply({
                                components: [errorContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        }

                        await targetChannel.send({
                            components: [container],
                            flags: MessageFlags.IsComponentsV2
                        });

                        const emojiSuccess = interaction.client.emojiManager.getEmoji('success') || '✅';
                        const successContainer = new ContainerBuilder();
                        successContainer.addTextDisplayComponents([
                            new TextDisplayBuilder().setContent(`# ${emojiSuccess} Mensaje de Texto Enviado\n\n*GTA Stories • Sistema de Mensajes • *`)
                        ]);

                        await interaction.reply({
                            components: [successContainer],
                            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                        });
                    }

                    if (interaction.customId === 'say_boton_modal') {
                        const textoMensaje = interaction.fields.getTextInputValue('texto_mensaje');
                        const labelBoton = interaction.fields.getTextInputValue('label_boton');
                        const urlBoton = interaction.fields.getTextInputValue('url_boton');
                        const canalDestino = interaction.fields.getTextInputValue('canal_destino');

                        if (urlBoton && !urlBoton.startsWith('http')) {
                            const emojiError = interaction.client.emojiManager.getEmoji('error') || '❌';
                            const errorContainer = new ContainerBuilder();
                            errorContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(`# ${emojiError} Error de URL\n\n-# La URL debe comenzar con http:// o https://\n\n*GTA Stories • Sistema de Mensajes • *`)
                            ]);

                            return await interaction.reply({
                                components: [errorContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        }

                        const boton = new ButtonBuilder()
                            .setLabel(labelBoton)
                            .setStyle(ButtonStyle.Link)
                            .setURL(urlBoton);

                        const container = new ContainerBuilder();
                        container.addTextDisplayComponents([
                            new TextDisplayBuilder().setContent(textoMensaje)
                        ]);

                        const actionRow = new ActionRowBuilder().addComponents(boton);
                        container.addActionRowComponents([actionRow]);

                        const targetChannel = canalDestino ? interaction.guild.channels.cache.get(canalDestino) : interaction.channel;

                        if (!targetChannel) {
                            const emojiError = interaction.client.emojiManager.getEmoji('error') || '❌';
                            const errorContainer = new ContainerBuilder();
                            errorContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(`# ${emojiError} Canal No Encontrado\n\n-# El canal especificado no existe o no tienes permisos\n\n*GTA Stories • Sistema de Mensajes • *`)
                            ]);

                            return await interaction.reply({
                                components: [errorContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        }

                        await targetChannel.send({
                            components: [container],
                            flags: MessageFlags.IsComponentsV2
                        });

                        const emojiSuccess = interaction.client.emojiManager.getEmoji('success') || '✅';
                        const successContainer = new ContainerBuilder();
                        successContainer.addTextDisplayComponents([
                            new TextDisplayBuilder().setContent(`# ${emojiSuccess} Botón Enviado\n\n*GTA Stories • Sistema de Mensajes • *`)
                        ]);

                        await interaction.reply({
                            components: [successContainer],
                            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                        });
                    }

                    if (interaction.customId === 'say_imagen_modal') {
                        const textoMensaje = interaction.fields.getTextInputValue('texto_mensaje');
                        const urlImagen = interaction.fields.getTextInputValue('url_imagen');
                        const canalDestino = interaction.fields.getTextInputValue('canal_destino');

                        const formatosValidos = ['.webp', '.gif', '.png', '.jpg', '.jpeg', '.mp4'];
                        const esFormatoValido = formatosValidos.some(formato => urlImagen.toLowerCase().includes(formato));

                        if (!urlImagen.startsWith('http') || !esFormatoValido) {
                            const emojiError = interaction.client.emojiManager.getEmoji('error') || '❌';
                            const errorContainer = new ContainerBuilder();
                            errorContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(`# ${emojiError} Error de Archivo\n\n-# La URL debe comenzar con http:// o https://\n-# Formatos válidos: webp, gif, png, jpg, jpeg, mp4\n\n*GTA Stories • Sistema de Mensajes • *`)
                            ]);

                            return await interaction.reply({
                                components: [errorContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        }

                        const container = new ContainerBuilder();
                        container.addTextDisplayComponents([
                            new TextDisplayBuilder().setContent(textoMensaje)
                        ]);

                        container.addSeparatorComponents([
                            new SeparatorBuilder().setSpacing('Small')
                        ]);

                        const mediaGallery = new MediaGalleryBuilder()
                            .addItems([
                                new MediaGalleryItemBuilder()
                                    .setURL(urlImagen)
                                    .setDescription('Archivo multimedia')
                            ]);

                        container.addMediaGalleryComponents([mediaGallery]);

                        container.addSeparatorComponents([
                            new SeparatorBuilder().setSpacing('Small')
                        ]);

                        let canalObjetivo = interaction.channel;
                        if (canalDestino) {
                            const canal = interaction.guild.channels.cache.get(canalDestino.replace(/[<#>]/g, ''));
                            if (canal) {
                                canalObjetivo = canal;
                            } else {
                                const emojiError = interaction.client.emojiManager.getEmoji('error') || '❌';
                                const errorContainer = new ContainerBuilder();
                                errorContainer.addTextDisplayComponents([
                                    new TextDisplayBuilder().setContent(`# ${emojiError} Canal No Encontrado\n\n-# El canal especificado no existe o no es válido\n\n*GTA Stories • Sistema de Mensajes • *`)
                                ]);

                                return await interaction.reply({
                                    components: [errorContainer],
                                    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                                });
                            }
                        }

                        await canalObjetivo.send({
                            components: [container],
                            flags: MessageFlags.IsComponentsV2
                        });

                        const emojiSuccess = interaction.client.emojiManager.getEmoji('success') || '✅';
                        const successContainer = new ContainerBuilder();
                        successContainer.addTextDisplayComponents([
                            new TextDisplayBuilder().setContent(`# ${emojiSuccess} Archivo Enviado\n\n*GTA Stories • Sistema de Mensajes • *`)
                        ]);

                        await interaction.reply({
                            components: [successContainer],
                            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                        });
                    }

                    if (interaction.customId === 'modal_vip_invitados') {
                        const userId = interaction.fields.getTextInputValue('user_id_vip');
                        const invitationsPath = path.join(__dirname, '..', 'database', 'invitations.json');

                        let invitationsData;
                        try {
                            invitationsData = JSON.parse(fs.readFileSync(invitationsPath, 'utf8'));
                        } catch (error) {
                            const errorContainer = new ContainerBuilder();
                            errorContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(`# ${interaction.client.emojiManager.getEmoji('error')} Error de Base de Datos\n\n-# No se pudo acceder a la información de invitaciones\n\n**Error:** Base de datos no disponible\n**Acción:** Contacta con un administrador\n\n*Sistema de Invitaciones • *`)
                            ]);

                            return await interaction.reply({
                                components: [errorContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        }

                        const member = interaction.guild.members.cache.get(userId);
                        const hasVipRole = member && member.roles.cache.has(config.rolesEspeciales.vipRoleId);
                        const userInvitations = invitationsData.users && invitationsData.users[userId];

                        if (!member) {
                            const errorContainer = new ContainerBuilder();
                            errorContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(`# ${interaction.client.emojiManager.getEmoji('error')} Usuario No Encontrado\n\n-# La ID proporcionada no corresponde a ningún usuario\n\n**ID Consultada:** \`${userId}\`\n**Estado:** Usuario no existe en el servidor\n\n*Verifica que la ID sea correcta*\n\n*Sistema de Invitaciones • *`)
                            ]);

                            return await interaction.reply({
                                components: [errorContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        }

                        if (!hasVipRole) {
                            const errorContainer = new ContainerBuilder();
                            errorContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(`# ${interaction.client.emojiManager.getEmoji('warning')} Usuario Sin Rol VIP\n\n-# El usuario no tiene permisos de invitación\n\n**Usuario:** <@${userId}>\n**Estado:** No posee el rol VIP requerido\n**Rol Necesario:** <@&${config.rolesEspeciales.vipRoleId}>\n\n*Solo los miembros VIP pueden enviar invitaciones*\n\n*Sistema de Invitaciones • *`)
                            ]);

                            return await interaction.reply({
                                components: [errorContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        }

                        if (!userInvitations || userInvitations.invitedUsers.length === 0) {
                            const infoContainer = new ContainerBuilder();
                            infoContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(`# ${interaction.client.emojiManager.getEmoji('user')} Información de Invitaciones VIP\n\n-# Usuario VIP sin invitaciones enviadas\n\n**Usuario VIP:** <@${userId}>\n**Estado:** Miembro VIP activo\n**Invitaciones Enviadas:** 0\n**Invitaciones Disponibles:** ${userInvitations ? userInvitations.invitationsLeft : 3}\n\n*Este usuario aún no ha enviado ninguna invitación*\n\n*Sistema de Invitaciones • *`)
                            ]);

                            return await interaction.reply({
                                components: [infoContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        }

                        const invitedList = userInvitations.invitedUsers.map((invited, index) => {
                            const invitedDate = new Date(invited.invitedAt);
                            const timestamp = Math.floor(invitedDate.getTime() / 1000);
                            return `**${index + 1}.** <@${invited.userId}> • \`${invited.userId}\`\n-# Invitado el `;
                        }).join('\n\n');

                        const resultContainer = new ContainerBuilder();
                        resultContainer.addTextDisplayComponents([
                            new TextDisplayBuilder().setContent(`# ${interaction.client.emojiManager.getEmoji('user')} Invitaciones de Usuario VIP\n\n-# Lista de usuarios invitados\n\n**Usuario VIP:** <@${userId}>\n**Total Invitaciones Enviadas:** ${userInvitations.totalSent}\n**Invitaciones Restantes:** ${userInvitations.invitationsLeft}\n**Miembro VIP desde:** `)
                        ]);

                        resultContainer.addSeparatorComponents([
                            new SeparatorBuilder().setSpacing('Small')
                        ]);

                        resultContainer.addTextDisplayComponents([
                            new TextDisplayBuilder().setContent(`## ${interaction.client.emojiManager.getEmoji('announcements')} Usuarios Invitados\n\n${invitedList}`)
                        ]);

                        resultContainer.addTextDisplayComponents([
                            new TextDisplayBuilder().setContent(`\n*Sistema de Invitaciones • *`)
                        ]);

                        await interaction.reply({
                            components: [resultContainer],
                            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                        });
                    }

                    if (interaction.customId === 'modal_quien_invito') {
                        const userId = interaction.fields.getTextInputValue('user_id_invitado');
                        const invitationsPath = path.join(__dirname, '..', 'database', 'invitations.json');

                        let invitationsData;
                        try {
                            invitationsData = JSON.parse(fs.readFileSync(invitationsPath, 'utf8'));
                        } catch (error) {
                            const errorContainer = new ContainerBuilder();
                            errorContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(`# ${interaction.client.emojiManager.getEmoji('error')} Error de Base de Datos\n\n-# No se pudo acceder a la información de invitaciones\n\n**Error:** Base de datos no disponible\n**Acción:** Contacta con un administrador\n\n*Sistema de Invitaciones • *`)
                            ]);

                            return await interaction.reply({
                                components: [errorContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        }

                        const member = interaction.guild.members.cache.get(userId);
                        const hasInvitedRole = member && member.roles.cache.has(config.rolesEspeciales.invitadoRoleId);
                        const hasVipRole = member && member.roles.cache.has(config.rolesEspeciales.vipRoleId);

                        if (!member) {
                            const errorContainer = new ContainerBuilder();
                            errorContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(`# ${interaction.client.emojiManager.getEmoji('error')} Usuario No Encontrado\n\n-# La ID proporcionada no corresponde a ningún usuario\n\n**ID Consultada:** \`${userId}\`\n**Estado:** Usuario no existe en el servidor\n\n*Verifica que la ID sea correcta*\n\n*Sistema de Invitaciones • *`)
                            ]);

                            return await interaction.reply({
                                components: [errorContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        }

                        if (!hasInvitedRole && !hasVipRole) {
                            const errorContainer = new ContainerBuilder();
                            errorContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(`# ${interaction.client.emojiManager.getEmoji('warning')} Usuario Sin Invitación\n\n-# El usuario no fue invitado ni es VIP\n\n**Usuario:** <@${userId}>\n**Estado:** No posee rol de invitado ni VIP\n**Roles Necesarios:** <@&${config.rolesEspeciales.invitadoRoleId}> o <@&${config.rolesEspeciales.vipRoleId}>\n\n*Este usuario no forma parte del sistema de invitaciones*\n\n*Sistema de Invitaciones • *`)
                            ]);

                            return await interaction.reply({
                                components: [errorContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        }

                        if (hasVipRole && !hasInvitedRole) {
                            const infoContainer = new ContainerBuilder();
                            infoContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(`# ${interaction.client.emojiManager.getEmoji('user')} Usuario VIP Original\n\n-# Este usuario es VIP, no fue invitado\n\n**Usuario:** <@${userId}>\n**Estado:** Miembro VIP original\n**Rol:** <@&${config.rolesEspeciales.vipRoleId}>\n\n*Los usuarios VIP originales no fueron invitados por otros miembros*\n\n*Sistema de Invitaciones • *`)
                            ]);

                            return await interaction.reply({
                                components: [infoContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        }

                        let inviterFound = null;
                        let invitationDate = null;

                        if (invitationsData.users) {
                            for (const [vipId, vipData] of Object.entries(invitationsData.users)) {
                                if (vipData.invitedUsers) {
                                    const invitation = vipData.invitedUsers.find(invited => invited.userId === userId);
                                    if (invitation) {
                                        inviterFound = vipId;
                                        invitationDate = invitation.invitedAt;
                                        break;
                                    }
                                }
                            }
                        }

                        if (!inviterFound) {
                            const errorContainer = new ContainerBuilder();
                            errorContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(`# ${interaction.client.emojiManager.getEmoji('warning')} Información No Disponible\n\n-# No se encontró registro de invitación\n\n**Usuario:** <@${userId}>\n**Estado:** Tiene rol de invitado pero sin registro\n**Posible Causa:** Invitación anterior al sistema actual\n\n*El registro de esta invitación no está disponible*\n\n*Sistema de Invitaciones • *`)
                            ]);

                            return await interaction.reply({
                                components: [errorContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        }

                        const timestamp = Math.floor(new Date(invitationDate).getTime() / 1000);
                        const resultContainer = new ContainerBuilder();
                        resultContainer.addTextDisplayComponents([
                            new TextDisplayBuilder().setContent(`# ${interaction.client.emojiManager.getEmoji('success')} Información de Invitación\n\n-# Origen de invitación encontrado\n\n**Usuario Invitado:** <@${userId}>\n**Invitado por:** <@${inviterFound}>\n**Fecha de Invitación:** \n**Hace:** \n\n*Información del sistema de invitaciones VIP*\n\n*Sistema de Invitaciones • *`)
                        ]);

                        await interaction.reply({
                            components: [resultContainer],
                            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                        });
                    }

                    if (interaction.customId.startsWith('formulario_deny_modal_')) {
                        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                        
                        const userId = interaction.customId.split('_')[3];
                        const razon = interaction.fields.getTextInputValue('razon_rechazo');

                        if (!puedeAceptarDenegarFormularios(interaction.member)) {
                            const errorContainer = new ContainerBuilder();
                            errorContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(crearMensajeErrorEntrevistador(interaction.client.emojiManager, 'denegar formularios'))
                            ]);
                            return await interaction.reply({
                                components: [errorContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        }

                        const member = interaction.guild.members.cache.get(userId);
                        if (!member) {
                            const errorContainer = new ContainerBuilder();
                            errorContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(
                                    `# ${interaction.client.emojiManager.getEmoji('error')} Usuario No Encontrado\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('error')} **El usuario no se encuentra en el servidor**\n\n` +
                                    `*No se puede procesar la denegación*`
                                )
                            ]);
                            return await interaction.reply({
                                components: [errorContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        }

                        await updateApplicationStatus(userId, 'denied', null, interaction.user.id);
                        updateInterviewerStats(interaction.user.id, 'formulario', 'denied');

                        try {
                            await member.roles.add(config.rolesSuspenso.suspenso3ficharoleid);
                            await member.roles.add(config.rolesSuspenso.formRechazadoRoleId);
                        } catch (error) {
                            console.error('Error asignando roles de suspensión:', error);
                        }

                        const { getFichaPJStatus, getFichaPJMessageUrl } = require('../utils/database');
                        const fichaPJStatus = getFichaPJStatus(userId);
                        if (fichaPJStatus === 'pending') {
                            await updateFichaPJStatus(userId, 'denied', null, interaction.user.id);
                            updateInterviewerStats(interaction.user.id, 'fichaPJ', 'denied');
                            
                            const fichaPJMessageUrl = getFichaPJMessageUrl(userId);
                            if (fichaPJMessageUrl) {
                                try {
                                    const urlParts = fichaPJMessageUrl.split('/');
                                    const fichaPJMessageId = urlParts[urlParts.length - 1];
                                    const fichaPJChannelId = urlParts[urlParts.length - 2];
                                    const fichaPJChannel = interaction.guild.channels.cache.get(fichaPJChannelId);
                                    
                                    if (fichaPJChannel) {
                                        const fichaPJMessage = await fichaPJChannel.messages.fetch(fichaPJMessageId);
                                        if (fichaPJMessage) {
                                            const suspendedFichaPJContainer = new ContainerBuilder();
                                            suspendedFichaPJContainer.addTextDisplayComponents([
                                                new TextDisplayBuilder().setContent(
                                                    `# ${interaction.client.emojiManager.getEmoji('error')} Ficha PJ Suspendida\n\n` +
                                                    `> ${interaction.client.emojiManager.getEmoji('error')} **Estado:** Suspendido\n` +
                                                    `La ficha PJ ha sido suspendida debido a la denegación del formulario\n\n` +
                                                    `> ${interaction.client.emojiManager.getEmoji('user')} **Usuario**\n` +
                                                    `<@${member.user.id}>\n\n` +
                                                    `> ${interaction.client.emojiManager.getEmoji('calendar')} **Fecha de Suspensión**\n` +
                                                    `<t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
                                                    `*Sistema de Ficha PJ* • `
                                                )
                                            ]);
                                            
                                            await fichaPJMessage.edit({
                                                components: [suspendedFichaPJContainer],
                                                flags: MessageFlags.IsComponentsV2
                                            });
                                        }
                                    }
                                } catch (error) {
                                    console.error('Error actualizando mensaje de ficha PJ:', error);
                                }
                            }
                        }

                        const deniedContainer = new ContainerBuilder();
                        const statusTitle = `# ${interaction.client.emojiManager.getEmoji('error')} Formulario Denegado`;
                        const statusDescription = `> ${interaction.client.emojiManager.getEmoji('error')} **Formulario rechazado**\n` +
                            `El formulario ha sido denegado por el staff`;
                        const nextSteps = `*El usuario ha sido notificado del rechazo* ${interaction.client.emojiManager.getEmoji('error')}`;

                        deniedContainer.addTextDisplayComponents([
                            new TextDisplayBuilder().setContent(
                                statusTitle + `\n\n` +
                                statusDescription + `\n\n` +
                                `> ${interaction.client.emojiManager.getEmoji('user')} **Usuario Procesado**\n` +
                                `<@${member.user.id}>\n\n` +
                                `> ${interaction.client.emojiManager.getEmoji('discordmod')} **Staff Responsable**\n` +
                                `<@${interaction.user.id}> denegó este formulario\n\n` +
                                `> ${interaction.client.emojiManager.getEmoji('settings')} **Estado del Proceso**\n` +
                                `**FORMULARIO DENEGADO** ${interaction.client.emojiManager.getEmoji('error')} • \n\n` +
                                nextSteps
                            )
                        ]);

                        const containerDenegado = new ContainerBuilder();
                        containerDenegado.addTextDisplayComponents([
                            new TextDisplayBuilder().setContent(
                                `# ${interaction.client.emojiManager.getEmoji('error')} Solicitud Denegada\n\n` +
                                `> ${interaction.client.emojiManager.getEmoji('error')} **Tu solicitud de formulario ha sido denegada**\n\n` +
                                `> ${interaction.client.emojiManager.getEmoji('aviso')} **Razón del rechazo:**\n${razon}\n\n` +
                                `> ${interaction.client.emojiManager.getEmoji('loading')} **¿Qué puedes hacer ahora?**\n` +
                                `Puedes enviar un nuevo formulario corrigiendo los aspectos mencionados\n\n` +
                                `*Formulario denegado por el staff* ${interaction.client.emojiManager.getEmoji('staff')}`
                            )
                        ]);

                        try {
                            const user = await interaction.client.users.fetch(userId);
                            await user.send({
                                components: [containerDenegado],
                                flags: MessageFlags.IsComponentsV2
                            });
                        } catch (error) {
                            console.error('No se pudo enviar DM al usuario:', error);
                        }

                        const resultadosChannel = interaction.client.channels.cache.get(config.canales.resultsChannelId);
                        if (resultadosChannel) {
                            const resultContainer = new ContainerBuilder();
                            const esInvitado = member.roles.cache.has(config.rolesEspeciales.invitadoRoleId);
                            const tituloResultado = esInvitado ? 'Usuario Invitado Denegado' : 'Nuevo Usuario Denegado';
                            
                            resultContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(
                                    `# ${interaction.client.emojiManager.getEmoji('error')} ${tituloResultado}\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('user')} **Usuario**\n` +
                                    `<@${member.user.id}> (${member.user.username})\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('settings')} **Estado**\n` +
                                    `**FORMULARIO DENEGADO** ${interaction.client.emojiManager.getEmoji('error')}\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('discordmod')} **Staff Responsable**\n` +
                                    `<@${interaction.user.id}>\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('calendar')} **Fecha de Denegación**\n` +
                                    `<t:${Math.floor(Date.now() / 1000)}:F>`
                                )
                            ]);

                            await resultadosChannel.send({
                                components: [resultContainer],
                                flags: MessageFlags.IsComponentsV2
                            });
                        }

                        const originalMessageUrl = getFormularioMessageUrl(member.user.id);
                        if (originalMessageUrl) {
                            try {
                                const urlParts = originalMessageUrl.split('/');
                                const messageId = urlParts[urlParts.length - 1];
                                const channelId = urlParts[urlParts.length - 2];
                                const channel = interaction.guild.channels.cache.get(channelId);

                                if (channel) {
                                    const originalMessage = await channel.messages.fetch(messageId);
                                    if (originalMessage) {
                                        await originalMessage.edit({
                                            components: [deniedContainer],
                                            flags: MessageFlags.IsComponentsV2
                                        });

                                        const confirmContainer = new ContainerBuilder();
                                        confirmContainer.addTextDisplayComponents([
                                            new TextDisplayBuilder().setContent(`${interaction.client.emojiManager.getEmoji('error')} Formulario denegado correctamente`)
                                        ]);

                                        await interaction.editReply({
                                            components: [confirmContainer],
                                            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                                        });
                                    } else {
                                        console.log(`No se pudo encontrar el mensaje original: ${messageId}`);
                                        await interaction.editReply({
                                            components: [deniedContainer],
                                            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                                        });
                                    }
                                } else {
                                    console.log(`No se pudo encontrar el canal: ${channelId}`);
                                    await interaction.editReply({
                                        components: [deniedContainer],
                                        flags: MessageFlags.IsComponentsV2
                                    });
                                }
                            } catch (error) {
                                console.log(`Error al actualizar mensaje original: ${error.message}`);
                                await interaction.editReply({
                                    components: [deniedContainer],
                                    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                                });
                            }
                        } else {
                            console.log(`No se encontró URL del mensaje original para el usuario: ${member.user.id}`);
                            await interaction.editReply({
                                components: [deniedContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        }
                    }

                    // Modal de denegación de ficha PJ
                    if (interaction.customId.startsWith('ficha_pj_deny_modal_')) {
                        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                        
                        const userId = interaction.customId.split('_')[4];
                        const razon = interaction.fields.getTextInputValue('razon_rechazo');

                        if (!puedeAceptarDenegarFormularios(interaction.member)) {
                            const errorContainer = new ContainerBuilder();
                            errorContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(crearMensajeErrorEntrevistador(interaction.client.emojiManager, 'denegar fichas PJ'))
                            ]);
                            return await interaction.editReply({
                                components: [errorContainer],
                                flags: MessageFlags.IsComponentsV2
                            });
                        }

                        const member = interaction.guild.members.cache.get(userId);
                        if (!member) {
                            const errorContainer = new ContainerBuilder();
                            errorContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(
                                    `# ${interaction.client.emojiManager.getEmoji('error')} Usuario No Encontrado\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('error')} **El usuario no se encuentra en el servidor**\n\n` +
                                    `*No se puede procesar la denegación*`
                                )
                            ]);
                            return await interaction.editReply({
                                components: [errorContainer],
                                flags: MessageFlags.IsComponentsV2
                            });
                        }

                        const { getFichaPJSuspensions, tieneFormularioEnviado } = require('../utils/database');
                        const formularioStatus = getFormularioStatus(userId);
                        const esInvitado = member.roles.cache.has(config.rolesEspeciales.invitadoRoleId);
                        const tieneFormulario = tieneFormularioEnviado(userId);
                        
                        let estadoProceso, nextSteps, tituloResultado, debeAplicarSuspension = false;
                        let nuevasSuspensiones = 0;

                        if (esInvitado) {
                            debeAplicarSuspension = true;
                            await updateFichaPJStatus(userId, 'denied', null, interaction.user.id);
                            updateInterviewerStats(interaction.user.id, 'fichaPJ', 'denied');
                            const suspensiones = getFichaPJSuspensions(userId);
                            nuevasSuspensiones = suspensiones + 1;

                            if (nuevasSuspensiones === 1) {
                                await member.roles.add(config.rolesSuspenso.suspenso1ficharoleid);
                            } else if (nuevasSuspensiones === 2) {
                                await member.roles.remove(config.rolesSuspenso.suspenso1ficharoleid);
                                await member.roles.add(config.rolesSuspenso.suspenso2ficharoleid);
                            } else if (nuevasSuspensiones >= 3) {
                                await member.roles.remove(config.rolesSuspenso.suspenso2ficharoleid);
                                await member.roles.add(config.rolesSuspenso.suspenso3ficharoleid);
                            }

                            estadoProceso = `**FICHA PJ DENEGADA** ${interaction.client.emojiManager.getEmoji('error')} • Suspensiones: ${nuevasSuspensiones}/3`;
                            nextSteps = `*El usuario invitado ha sido notificado del rechazo* ${interaction.client.emojiManager.getEmoji('error')}`;
                            tituloResultado = 'Usuario Invitado - Ficha PJ Suspendida';
                        } else {
                            if (!tieneFormulario) {
                                if (member.roles.cache.has(config.rolesAprobacion.formularioRoleId)) {
                                    debeAplicarSuspension = true;
                                    await updateFichaPJStatus(userId, 'denied', null, interaction.user.id);
                                    updateInterviewerStats(interaction.user.id, 'fichaPJ', 'denied');
                                    const suspensiones = getFichaPJSuspensions(userId);
                                    nuevasSuspensiones = suspensiones + 1;

                                    if (nuevasSuspensiones === 1) {
                                        await member.roles.add(config.rolesSuspenso.suspenso1ficharoleid);
                                    } else if (nuevasSuspensiones === 2) {
                                        await member.roles.remove(config.rolesSuspenso.suspenso1ficharoleid);
                                        await member.roles.add(config.rolesSuspenso.suspenso2ficharoleid);
                                    } else if (nuevasSuspensiones >= 3) {
                                        await member.roles.remove(config.rolesSuspenso.suspenso2ficharoleid);
                                        await member.roles.add(config.rolesSuspenso.suspenso3ficharoleid);
                                    }

                                    estadoProceso = `**FICHA PJ DENEGADA** ${interaction.client.emojiManager.getEmoji('error')} • Suspensiones: ${nuevasSuspensiones}/3`;
                                    nextSteps = `*El usuario ha sido notificado del rechazo* ${interaction.client.emojiManager.getEmoji('error')}`;
                                    tituloResultado = 'Usuario con Rol - Ficha PJ Suspendida';
                                } else {
                                    estadoProceso = `**ESPERANDO FORMULARIO** - El usuario debe enviar su formulario primero`;
                                    nextSteps = `*El usuario debe completar el formulario antes de evaluar su ficha PJ* ${interaction.client.emojiManager.getEmoji('loading')}`;
                                    tituloResultado = 'Nuevo Usuario - Esperando Formulario';
                                }
                            } else if (formularioStatus === 'pending') {
                                estadoProceso = `**ESPERANDO RESPUESTA DEL ENTREVISTADOR** - Formulario en revisión`;
                                nextSteps = `*El entrevistador debe decidir sobre el formulario antes de procesar la ficha PJ* ${interaction.client.emojiManager.getEmoji('loading')}`;
                                tituloResultado = 'Nuevo Usuario - Formulario en Revisión';
                            } else if (formularioStatus === 'accepted') {
                                debeAplicarSuspension = true;
                                await updateFichaPJStatus(userId, 'denied', null, interaction.user.id);
                                updateInterviewerStats(interaction.user.id, 'fichaPJ', 'denied');
                                const suspensiones = getFichaPJSuspensions(userId);
                                nuevasSuspensiones = suspensiones + 1;

                                if (nuevasSuspensiones === 1) {
                                    await member.roles.add(config.rolesSuspenso.suspenso1ficharoleid);
                                } else if (nuevasSuspensiones === 2) {
                                    await member.roles.remove(config.rolesSuspenso.suspenso1ficharoleid);
                                    await member.roles.add(config.rolesSuspenso.suspenso2ficharoleid);
                                } else if (nuevasSuspensiones >= 3) {
                                    await member.roles.remove(config.rolesSuspenso.suspenso2ficharoleid);
                                    await member.roles.add(config.rolesSuspenso.suspenso3ficharoleid);
                                }

                                estadoProceso = `**FICHA PJ DENEGADA** ${interaction.client.emojiManager.getEmoji('error')} • Suspensiones: ${nuevasSuspensiones}/3`;
                                nextSteps = `*El usuario ha sido notificado del rechazo* ${interaction.client.emojiManager.getEmoji('error')}`;
                                tituloResultado = 'Nuevo Usuario - Ficha PJ Suspendida';
                            } else if (formularioStatus === 'suspended') {
                                estadoProceso = `**FORMULARIO SUSPENDIDO** - No se puede procesar ficha PJ`;
                                nextSteps = `*El usuario tiene el formulario suspendido* ${interaction.client.emojiManager.getEmoji('error')}`;
                                tituloResultado = 'Nuevo Usuario - Formulario Suspendido';
                            }
                        }

                        // Enviar DM al usuario si debe aplicar suspensión
                        if (debeAplicarSuspension) {
                            const containerDenegado = new ContainerBuilder();
                            const mensajeSuspensiones = `> ${interaction.client.emojiManager.getEmoji('loading')} **Suspensiones:** ${nuevasSuspensiones}/3\n\n`;
                            const mensajeAccion = `Puedes enviar una nueva ficha corrigiendo los aspectos mencionados`;
                            
                            containerDenegado.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(
                                    `# ${interaction.client.emojiManager.getEmoji('error')} Ficha PJ Denegada\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('error')} **Tu ficha de personaje ha sido denegada**\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('aviso')} **Razón del rechazo:**\n${razon}\n\n` +
                                    mensajeSuspensiones +
                                    `> ${interaction.client.emojiManager.getEmoji('loading')} **¿Qué puedes hacer ahora?**\n` +
                                    `${mensajeAccion}\n\n` +
                                    `*Ficha PJ denegada por el staff* ${interaction.client.emojiManager.getEmoji('staff')}`
                                )
                            ]);

                            try {
                                const user = await interaction.client.users.fetch(userId);
                                await user.send({
                                    components: [containerDenegado],
                                    flags: MessageFlags.IsComponentsV2
                                });
                            } catch (error) {
                                console.error('No se pudo enviar DM al usuario:', error);
                            }
                        }

                        // Enviar resultado al canal de resultados
                        const resultadosChannel = interaction.client.channels.cache.get(config.canales.resultsChannelId);
                        if (resultadosChannel) {
                            const resultContainer = new ContainerBuilder();
                            
                            resultContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(
                                    `# ${interaction.client.emojiManager.getEmoji('error')} ${tituloResultado}\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('user')} **Usuario**\n` +
                                    `<@${member.user.id}> (${member.user.username})\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('settings')} **Estado**\n` +
                                    `${estadoProceso}\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('discordmod')} **Staff Responsable**\n` +
                                    `<@${interaction.user.id}>\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('aviso')} **Fecha de Observación**\n` +
                                    `<t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
                                    nextSteps
                                )
                            ]);

                            await resultadosChannel.send({
                                components: [resultContainer],
                                flags: MessageFlags.IsComponentsV2
                            });
                        }

                        // Create transcript using discord-html-transcripts
                        const transcript = await discordTranscripts.createTranscript(interaction.channel, {
                            limit: -1,
                            fileName: `ficha-pj-${userId}-${Date.now()}.html`,
                            saveImages: true,
                            poweredBy: false
                        });

                        // Save transcript to transcripts channel if it exists
                        const transcriptsChannel = interaction.guild.channels.cache.find(
                            channel => channel.name === 'transcripts' && 
                            channel.type === ChannelType.GuildText
                        );

                        if (transcriptsChannel) {
                            await transcriptsChannel.send({
                                files: [transcript]
                            });
                        }
                        await updateFichaPJStatus(userId, 'denied', null, interaction.user.id);
                        updateInterviewerStats(interaction.user.id, 'fichaPJ', 'denied');

                        // Cerrar el canal del ticket
                        try {
                            await interaction.channel.delete();
                        } catch (error) {
                            console.error('Error al cerrar el canal del ticket:', error);
                            
                            const confirmContainer = new ContainerBuilder();
                            confirmContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(
                                    `${interaction.client.emojiManager.getEmoji('success')} **Ficha PJ denegada correctamente**\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('aviso')} **Transcript guardado**\n` +
                                    `El registro de esta decisión ha sido almacenado\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('error')} **Error al cerrar canal**\n` +
                                    `El canal no pudo cerrarse automáticamente`
                                )
                            ]);

                            await interaction.editReply({
                                components: [confirmContainer],
                                flags: MessageFlags.IsComponentsV2
                            });
                        }
                    }

                    // Modal de notificación de ficha PJ
                    if (interaction.customId.startsWith('ficha_pj_notify_modal_')) {
                        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                        
                        const userId = interaction.customId.split('_')[4];
                        const mensaje = interaction.fields.getTextInputValue('notification_message');

                        if (!puedeAceptarDenegarFormularios(interaction.member)) {
                            const errorContainer = new ContainerBuilder();
                            errorContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(crearMensajeErrorEntrevistador(interaction.client.emojiManager, 'notificar usuarios'))
                            ]);
                            return await interaction.editReply({
                                components: [errorContainer],
                                flags: MessageFlags.IsComponentsV2
                            });
                        }

                        const member = interaction.guild.members.cache.get(userId);
                        if (!member) {
                            const errorContainer = new ContainerBuilder();
                            errorContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(
                                    `# ${interaction.client.emojiManager.getEmoji('error')} Usuario No Encontrado\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('error')} **El usuario no se encuentra en el servidor**\n\n` +
                                    `*No se puede enviar la notificación*`
                                )
                            ]);
                            return await interaction.editReply({
                                components: [errorContainer],
                                flags: MessageFlags.IsComponentsV2
                            });
                        }

                        // Enviar DM al usuario
                        const containerNotificacion = new ContainerBuilder();
                        containerNotificacion.addTextDisplayComponents([
                            new TextDisplayBuilder().setContent(
                                `# ${interaction.client.emojiManager.getEmoji('notificacion')} Notificación sobre tu Ficha PJ\n\n` +
                                `> ${interaction.client.emojiManager.getEmoji('discordmod')} **Mensaje del Staff**\n` +
                                `${mensaje}\n\n` +
                                `> ${interaction.client.emojiManager.getEmoji('loading')} **Estado de tu Ficha**\n` +
                                `Tu ficha está siendo revisada por el equipo de staff\n\n` +
                                `*Notificación enviada por ${interaction.user.username}*`
                            )
                        ]);

                        const ticketUrl = getFichaPJMessageUrl(userId);
                        if (ticketUrl) {
                            const ticketButton = new ButtonBuilder()
                                .setLabel('Ir al Ticket')
                                .setStyle(ButtonStyle.Link)
                                .setURL(ticketUrl)
                                .setEmoji(interaction.client.emojiManager.getEmoji('ticket'));
                            
                            const actionRow = new ActionRowBuilder().addComponents(ticketButton);
                            containerNotificacion.addActionRowComponents([actionRow]);
                        }

                        try {
                            const user = await interaction.client.users.fetch(userId);
                            await user.send({
                                components: [containerNotificacion],
                                flags: MessageFlags.IsComponentsV2
                            });

                            const confirmContainer = new ContainerBuilder();
                            confirmContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(
                                    `${interaction.client.emojiManager.getEmoji('success')} **Notificación enviada correctamente**\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('user')} **Usuario notificado**\n` +
                                    `<@${member.user.id}> ha recibido tu mensaje\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('aviso')} **Mensaje enviado**\n` +
                                    `"${mensaje}"`
                                )
                            ]);

                            await interaction.editReply({
                                components: [confirmContainer],
                                flags: MessageFlags.IsComponentsV2
                            });
                        } catch (error) {
                            console.error('No se pudo enviar DM al usuario:', error);
                            
                            const errorContainer = new ContainerBuilder();
                            errorContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(
                                    `# ${interaction.client.emojiManager.getEmoji('error')} Error al Enviar Notificación\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('error')} **No se pudo enviar el mensaje**\n` +
                                    `El usuario tiene los DMs desactivados o bloqueados\n\n` +
                                    `> ${interaction.client.emojiManager.getEmoji('aviso')} **Acción Recomendada**\n` +
                                    `Contacta al usuario directamente en el servidor`
                                )
                            ]);

                            await interaction.editReply({
                                components: [errorContainer],
                                flags: MessageFlags.IsComponentsV2
                            });
                        }
                    }
                } catch (error) {
                    console.error('Error en modal submit:', error);
                    if (!interaction.replied && !interaction.deferred) {
                        try {
                            const errorContainer = new ContainerBuilder();
                            errorContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(`# ${interaction.client.emojiManager.getEmoji('error')} Error de Procesamiento\n\n> ${interaction.client.emojiManager.getEmoji('error')} **Hubo un error al procesar tu solicitud**\n\n> ${interaction.client.emojiManager.getEmoji('loading')} **Acción Recomendada**\nInténtalo de nuevo en unos momentos\n\n> ${interaction.client.emojiManager.getEmoji('settings')} **Si el problema persiste**\nContacta con un administrador del servidor\n\n> ${interaction.client.emojiManager.getEmoji('reply')} **Soporte Técnico**\nUsa el sistema de tickets para reportar el error\n\n*Lamentamos las molestias ocasionadas* ${interaction.client.emojiManager.getEmoji('aviso')}`)
                            ]);

                            await interaction.reply({
                                components: [errorContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                            });
                        } catch (replyError) {
                            console.error('No se pudo responder a la interacción:', replyError);
                        }
                    } else if (interaction.deferred && !interaction.replied) {
                        try {
                            const errorContainer = new ContainerBuilder();
                            errorContainer.addTextDisplayComponents([
                                new TextDisplayBuilder().setContent(`# ${interaction.client.emojiManager.getEmoji('error')} Error de Procesamiento\n\n> ${interaction.client.emojiManager.getEmoji('error')} **Hubo un error al procesar tu solicitud**\n\n> ${interaction.client.emojiManager.getEmoji('loading')} **Acción Recomendada**\nInténtalo de nuevo en unos momentos\n\n> ${interaction.client.emojiManager.getEmoji('settings')} **Si el problema persiste**\nContacta con un administrador del servidor\n\n> ${interaction.client.emojiManager.getEmoji('reply')} **Soporte Técnico**\nUsa el sistema de tickets para reportar el error\n\n*Lamentamos las molestias ocasionadas* ${interaction.client.emojiManager.getEmoji('aviso')}`)
                            ]);

                            await interaction.editReply({
                                components: [errorContainer],
                                flags: MessageFlags.IsComponentsV2,
                                ephemeral: true
                            });
                        } catch (editError) {
                            console.error('No se pudo editar la respuesta de la interacción:', editError);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error global en interactionCreate:', error);
        }
    }
};
