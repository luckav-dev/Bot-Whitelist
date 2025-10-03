const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SectionBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

const { obtenerEncuesta, obtenerEncuestasActivas, cerrarEncuesta } = require('../utils/encuestas');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cerrarencuesta')
        .setDescription('Cierra una encuesta activa')
        .addStringOption(option =>
            option.setName('id')
                .setDescription('ID de la encuesta a cerrar')
                .setRequired(true)
                .setAutocomplete(true)),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const encuestasActivas = obtenerEncuestasActivas();
        
        const choices = encuestasActivas
            .filter(encuesta =>
                encuesta.titulo.toLowerCase().includes(focusedValue.toLowerCase()) ||
                encuesta.id.includes(focusedValue)
            )
            .slice(0, 25)
            .map(encuesta => ({
                name: `${encuesta.titulo} (ID: ${encuesta.id})`,
                value: encuesta.id
            }));

        await interaction.respond(choices);
    },

    async execute(interaction) {
        try {
            const encuestaId = interaction.options.getString('id');
            const datosEncuesta = await obtenerEncuesta(encuestaId);

            if (!datosEncuesta) {
                const containerError = new ContainerBuilder();
                containerError.addTextDisplayComponents([
                    new TextDisplayBuilder().setContent(`# ${interaction.client.emojiManager.getEmoji('error')} Error\n\n-# No se encontró una encuesta con el ID: \`${encuestaId}\`\n\n*GTA Stories • Sistema de Encuestas • *`)
                ]);

                return await interaction.reply({
                    components: [containerError],
                    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                });
            }

            if (datosEncuesta.estado === 'cerrada') {
                const containerYaCerrada = new ContainerBuilder();
                containerYaCerrada.addTextDisplayComponents([
                    new TextDisplayBuilder().setContent(`# ${interaction.client.emojiManager.getEmoji('warning')} Advertencia\n\n-# La encuesta **${datosEncuesta.titulo}** ya está cerrada\n\n*GTA Stories • Sistema de Encuestas • *`)
                ]);

                return await interaction.reply({
                    components: [containerYaCerrada],
                    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                });
            }

            let canal, mensajeOriginal;

            try {
                if (!datosEncuesta.canalId) {
                    throw new Error('ID de canal no válido');
                }

                canal = await interaction.client.channels.fetch(datosEncuesta.canalId);
                if (!canal) {
                    throw new Error('Canal no encontrado');
                }

                if (!datosEncuesta.mensajeId) {
                    throw new Error('ID de mensaje no válido');
                }

                mensajeOriginal = await canal.messages.fetch(datosEncuesta.mensajeId);
                if (!mensajeOriginal) {
                    throw new Error('Mensaje no encontrado');
                }

            } catch (fetchError) {
                console.error('Error obteniendo mensaje de encuesta:', fetchError);
                
                if (fetchError.code === 10008) {
                    cerrarEncuesta(encuestaId);
                    const containerLimpieza = new ContainerBuilder();
                    containerLimpieza.addTextDisplayComponents([
                        new TextDisplayBuilder().setContent(`# ${interaction.client.emojiManager.getEmoji('success')} Encuesta Limpiada\n\n-# El mensaje de la encuesta ya no existe en Discord\n\nLa encuesta ha sido cerrada automáticamente y eliminada de la base de datos.\n\n**Encuesta:** ${datosEncuesta.titulo}\n\n*GTA Stories • Sistema de Encuestas • *`)
                    ]);

                    return await interaction.reply({
                        components: [containerLimpieza],
                        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                    });
                }

                const containerError = new ContainerBuilder();
                containerError.addTextDisplayComponents([
                    new TextDisplayBuilder().setContent(`# ${interaction.client.emojiManager.getEmoji('error')} Error\n\n-# No se pudo encontrar la encuesta original\n\nVerifica que la encuesta exista y que tengas permisos para acceder al canal.\n\n**Detalles:** ${fetchError.message}\n**Canal ID:** ${datosEncuesta.canalId}\n**Mensaje ID:** ${datosEncuesta.mensajeId}\n\n*GTA Stories • Sistema de Encuestas • *`)
                ]);

                return await interaction.reply({
                    components: [containerError],
                    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                });
            }

            await cerrarEncuesta(encuestaId);

            const containerResultados = new ContainerBuilder();

            const emojiEstrellita = interaction.client.emojiManager.getEmoji('estrellita') || '⭐';
            const emojiAnnouncementsHeader = interaction.client.emojiManager.getEmoji('announcements') || '📢';
            
            containerResultados.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`# ${emojiEstrellita} Encuesta Finalizada\n\n**${datosEncuesta.titulo}**\n\n${emojiAnnouncementsHeader} **Resultados de la votación @everyone:**`)
            );

            let resultadosTexto = '';
            const totalVotos = Object.keys(datosEncuesta.votos).length;

            if (datosEncuesta.tipo === 'si_no') {
                const votosSi = Object.values(datosEncuesta.votos).filter(voto => voto === 'si').length;
                const votosNo = Object.values(datosEncuesta.votos).filter(voto => voto === 'no').length;
                
                const emojiSi = interaction.client.emojiManager.getEmoji('success') || '✅';
                const emojiNo = interaction.client.emojiManager.getEmoji('error') || '❌';
                resultadosTexto = `${emojiSi} **Sí:** ${votosSi} votos\n${emojiNo} **No:** ${votosNo} votos`;
            } else {
                datosEncuesta.opciones.forEach((opcion, indice) => {
                    const numeroOpcion = (indice + 1).toString();
                    const votosOpcion = Object.values(datosEncuesta.votos).filter(voto => voto === numeroOpcion).length;
                    const emojiNumero = interaction.client.emojiManager.getEmoji(['uno', 'dos', 'tres', 'cuatro', 'cinco'][indice] || 'estrellita') || ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'][indice] || '⭐';
                    resultadosTexto += `${emojiNumero} **${opcion}:** ${votosOpcion} votos\n`;
                });
            }

            if (!resultadosTexto || resultadosTexto.trim() === '') {
                resultadosTexto = 'No hay resultados disponibles';
            }

            const emojiUser = interaction.client.emojiManager.getEmoji('user') || '👤';
            const emojiSettings = interaction.client.emojiManager.getEmoji('settings') || '⚙️';
            const emojiAnnouncements = interaction.client.emojiManager.getEmoji('announcements') || '📢';

            containerResultados.addSeparatorComponents(
                new SeparatorBuilder().setSpacing('Small')
            );
            
            containerResultados.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(resultadosTexto.trim())
            );

            containerResultados.addSeparatorComponents(
                new SeparatorBuilder().setSpacing('Large')
            );
            
            containerResultados.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`\n${emojiUser} **Total de votos:** ${totalVotos}\n\n${emojiSettings} **Cerrada por:** <@${interaction.user.id}>\n\n${emojiAnnouncements} **Fecha:** <t:${Math.floor(Date.now() / 1000)}:F>`)
            );

            containerResultados.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`\n*GTA Stories • Sistema de Encuestas • Finalizada*`)
            );

            await mensajeOriginal.edit({
                components: [containerResultados],
                flags: MessageFlags.IsComponentsV2
            });

            const containerExito = new ContainerBuilder();
            containerExito.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`# ${interaction.client.emojiManager.getEmoji('success')} Éxito\n\n-# ¡Encuesta cerrada exitosamente!\n\n*GTA Stories • Sistema de Encuestas • *`)
            );

            await interaction.reply({
                components: [containerExito],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });

        } catch (error) {
            console.error('Error actualizando mensaje original de encuesta:', error);

            const containerError = new ContainerBuilder();
            containerError.addTextDisplayComponents([
                new TextDisplayBuilder().setContent(`# ${interaction.client.emojiManager.getEmoji('error')} Error\n\n-# Ocurrió un error al cerrar la encuesta\n\n**Detalles:** ${error.message}\n\n*GTA Stories • Sistema de Encuestas • *`)
            ]);

            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        components: [containerError],
                        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                    });
                }
            } catch (replyError) {
                console.error('Error enviando respuesta de error:', replyError);
            }
        }
    }
};
