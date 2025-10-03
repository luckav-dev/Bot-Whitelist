const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { getApplicationData, getFichaPJData, getFormularioStats, getApplicationProcessedBy, getFichaPJProcessedBy } = require('../utils/database');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('verformularios')
        .setDescription('Ver detalles de formularios y fichas PJ de un usuario')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuario del cual ver los formularios')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('tipo')
                .setDescription('Tipo de formulario a ver')
                .setRequired(true)
                .addChoices(
                    { name: 'Formulario', value: 'formulario' },
                    { name: 'Ficha PJ', value: 'ficha_pj' }
                )),
    
    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('usuario');
            const tipo = interaction.options.getString('tipo');
            
            let userData;
            let title;
            let noDataMessage;
            
            if (tipo === 'formulario') {
                userData = getApplicationData(targetUser.id);
                title = 'Formulario de Solicitud';
                noDataMessage = 'Este usuario no ha enviado ningún formulario o es un usuario invitado';
            } else {
                userData = getFichaPJData(targetUser.id);
                title = 'Ficha de Personaje';
                noDataMessage = 'Este usuario no ha enviado ninguna ficha PJ o es un usuario invitado';
            }
            
            const container = new ContainerBuilder();
            
            const hasData = tipo === 'formulario' ? 
                (userData && userData.formData) : 
                (userData && (userData.formData || userData.respuestas));
            
            if (!hasData) {
                container.addTextDisplayComponents([
                    new TextDisplayBuilder().setContent(
                        `# ${interaction.client.emojiManager.getEmoji('warning')} ${title} - No Encontrado\n\n` +
                        `> ${interaction.client.emojiManager.getEmoji('user')} **Usuario Consultado**\n` +
                        `<@${targetUser.id}> (${targetUser.tag})\n\n` +
                        `> ${interaction.client.emojiManager.getEmoji('aviso')} **Estado**\n` +
                        `${noDataMessage}\n\n` +
                        `*Esto puede indicar que el usuario fue invitado directamente al servidor*`
                    )
                ]);
            } else {
                let detailsContent = '';
                
                if (tipo === 'formulario') {
                    detailsContent = 
                        `-# ${interaction.client.emojiManager.getEmoji('reply')} **URL Steam**\n` +
                        `\`\`\`\n${userData.formData.url_steam}\`\`\`\n\n` +
                        `-# ${interaction.client.emojiManager.getEmoji('reply')} **Servidores Roleados**\n` +
                        `\`\`\`\n${userData.formData.servidores_roleados}\`\`\`\n\n` +
                        `-# ${interaction.client.emojiManager.getEmoji('reply')} **Rol en GTA Stories**\n` +
                        `\`\`\`\n${userData.formData.rol_gta_stories}\`\`\`\n\n` +
                        `-# ${interaction.client.emojiManager.getEmoji('reply')} **Sanciones Activas**\n` +
                        `\`\`\`\n${userData.formData.sanciones_activas}\`\`\`\n\n` +
                        `-# ${interaction.client.emojiManager.getEmoji('reply')} **Horas en FiveM**\n` +
                        `\`\`\`\n${userData.formData.horas_fivem}\`\`\``;
                } else {
                    const respuestas = userData.respuestas || {};
                    const formData = userData.formData || {};
                    
                    detailsContent = 
                        `-# ${interaction.client.emojiManager.getEmoji('reply')} **Nombre del Personaje**\n` +
                        `\`\`\`\n${respuestas['Nombre completo del personaje:'] || formData.nombre_completo || 'No disponible'}\`\`\`\n\n` +
                        `-# ${interaction.client.emojiManager.getEmoji('reply')} **Edad**\n` +
                        `\`\`\`\n${respuestas['Edad:'] || formData.edad || 'No disponible'}\`\`\`\n\n` +
                        `-# ${interaction.client.emojiManager.getEmoji('reply')} **Nacionalidad + Ciudad**\n` +
                        `\`\`\`\n${respuestas['Nacionalidad + Ciudad:'] || formData.nacionalidad || 'No disponible'}\`\`\`\n\n` +
                        `-# ${interaction.client.emojiManager.getEmoji('reply')} **Clase Social**\n` +
                        `\`\`\`\n${respuestas['Clase social:'] || formData.clase_social || 'No disponible'}\`\`\`\n\n` +
                        `-# ${interaction.client.emojiManager.getEmoji('reply')} **Profesión y Estudios**\n` +
                        `\`\`\`\n${respuestas['Profesión y estudios:'] || formData.profesion_estudios || 'No disponible'}\`\`\`\n\n` +
                        `-# ${interaction.client.emojiManager.getEmoji('reply')} **Antecedentes**\n` +
                        `\`\`\`\n${respuestas['Antecedentes:'] || formData.antecedentes || 'No disponible'}\`\`\`\n\n` +
                        `-# ${interaction.client.emojiManager.getEmoji('reply')} **Descripción Física y Psicológica**\n` +
                        `\`\`\`\n${respuestas['Descripción física y psicológica:'] || formData.descripcion_fisica || 'No disponible'}\`\`\`\n\n` +
                        `-# ${interaction.client.emojiManager.getEmoji('reply')} **Miedos y Fobias**\n` +
                        `\`\`\`\n${respuestas['Miedos y fobias:'] || formData.miedos_fobias || 'No disponible'}\`\`\`\n\n` +
                        `-# ${interaction.client.emojiManager.getEmoji('reply')} **Defectos**\n` +
                        `\`\`\`\n${respuestas['Defectos:'] || formData.defectos || 'No disponible'}\`\`\`\n\n` +
                        `-# ${interaction.client.emojiManager.getEmoji('reply')} **Virtudes**\n` +
                        `\`\`\`\n${respuestas['Virtudes:'] || formData.virtudes || 'No disponible'}\`\`\`\n\n` +
                        `-# ${interaction.client.emojiManager.getEmoji('reply')} **Motivaciones y Metas**\n` +
                        `\`\`\`\n${respuestas['Motivaciones y metas:'] || formData.motivaciones_metas || 'No disponible'}\`\`\`\n\n` +
                        `-# ${interaction.client.emojiManager.getEmoji('reply')} **Relaciones**\n` +
                        `\`\`\`\n${respuestas['Relaciones:'] || formData.relaciones || 'No disponible'}\`\`\``;
                }
                
                const statusEmoji = userData.status === 'accepted' ? 'success' : 
                                  userData.status === 'denied' ? 'error' : 'loading';
                const statusText = userData.status === 'accepted' ? 'ACEPTADO' : 
                                 userData.status === 'denied' ? 'DENEGADO' : 'PENDIENTE';

                let staffInfo = '';
                if (userData.status !== 'pending') {
                    try {
                        const processedBy = tipo === 'formulario' ? 
                            getApplicationProcessedBy(targetUser.id) : 
                            getFichaPJProcessedBy(targetUser.id);
                        
                        if (processedBy) {
                            staffInfo = `> ${interaction.client.emojiManager.getEmoji('user')} **Staff Responsable**\n` +
                                       `<@${processedBy}>\n\n`;
                        }
                    } catch (error) {
                        console.error('Error al obtener staff responsable:', error);
                    }
                }

                // Obtener información de transcripts para fichas PJ
                let transcriptInfo = '';
                if (tipo === 'ficha_pj') {
                    try {
                        const formularioStats = getFormularioStats(targetUser.id);
                        if (formularioStats && formularioStats.transcriptPath) {
                            const transcriptExists = fs.existsSync(formularioStats.transcriptPath);
                            if (transcriptExists) {
                                const transcriptContent = fs.readFileSync(formularioStats.transcriptPath, 'utf8');
                                const lines = transcriptContent.split('\n');
                                const staffLine = lines.find(line => line.startsWith('Staff:'));
                                const fechaLine = lines.find(line => line.startsWith('Fecha:'));
                                const razonLine = lines.find(line => line.startsWith('Razón:'));
                                
                                transcriptInfo = `\n\n> ${interaction.client.emojiManager.getEmoji('file')} **Información del Ticket**\n` +
                                    `${staffLine ? staffLine.replace('Staff:', 'Staff responsable:') : 'Staff: No disponible'}\n` +
                                    `${fechaLine ? fechaLine : 'Fecha: No disponible'}\n` +
                                    `${razonLine ? razonLine : 'Razón: No disponible'}\n` +
                                    `Transcript disponible: ${transcriptExists ? 'Sí' : 'No'}`;
                            }
                        }
                    } catch (error) {
                        console.error('Error al leer transcript:', error);
                        transcriptInfo = `\n\n> ${interaction.client.emojiManager.getEmoji('error')} **Información del Ticket**\n` +
                            `Error al cargar información del transcript`;
                    }
                }
                
                container.addTextDisplayComponents([
                    new TextDisplayBuilder().setContent(
                        `# ${interaction.client.emojiManager.getEmoji('user')} ${title} - ${statusText}\n\n` +
                        `> ${interaction.client.emojiManager.getEmoji('user')} **Usuario**\n` +
                        `<@${targetUser.id}> (${targetUser.tag})\n\n` +
                        `> ${interaction.client.emojiManager.getEmoji(statusEmoji)} **Estado**\n` +
                        `${statusText}\n\n` +
                        `> ${interaction.client.emojiManager.getEmoji('settings')} **Fecha de Envío**\n` +
                        `<t:${Math.floor(new Date(userData.fechaCreacion || userData.timestamp).getTime() / 1000)}:F>\n\n` +
                        (userData.processedAt ? 
                            `> ${interaction.client.emojiManager.getEmoji('settings')} **Fecha de Procesamiento**\n` +
                            `<t:${Math.floor(new Date(userData.processedAt).getTime() / 1000)}:F>\n\n` : '') +
                        staffInfo +
                        `> ${interaction.client.emojiManager.getEmoji('motivo')} **Detalles del ${title}**\n\n` +
                        detailsContent +
                        transcriptInfo
                    )
                ]);
            }
            
            await interaction.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
            
        } catch (error) {
            console.error('Error al obtener datos del formulario:', error);
            const errorContainer = new ContainerBuilder();
            errorContainer.addTextDisplayComponents([
                new TextDisplayBuilder().setContent(
                    `# ${interaction.client.emojiManager.getEmoji('error')} Error\n\n` +
                    `-# Hubo un error al obtener los datos del formulario\n\n` +
                    `*GTA Stories • Sistema de Formularios • <t:${Math.floor(Date.now() / 1000)}:F>*`
                )
            ]);
            
            await interaction.reply({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }
    }
};