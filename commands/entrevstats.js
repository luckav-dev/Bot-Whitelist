const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { getAllInterviewersStats, getInterviewerStats } = require('../utils/database');
const emojis = require('../emojis.json');

async function mostrarEstadisticasEntrevistadorEspecifico(interaction, usuarioObjetivo) {
    const estadisticas = getInterviewerStats(usuarioObjetivo.id);
    
    if (!estadisticas) {
        await interaction.reply({
            content: `${emojis.warning} El usuario <@${usuarioObjetivo.id}> no tiene estadísticas de entrevistador registradas.`,
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const formularios = estadisticas.formularios || { total: 0, accepted: 0, denied: 0 };
    const fichaPJ = estadisticas.fichaPJ || { total: 0, accepted: 0, denied: 0 };
    const totalFormularios = formularios.total;
    const totalFichasPJ = fichaPJ.total;
    const porcentajeFormularios = totalFormularios > 0 ? ((formularios.accepted / totalFormularios) * 100).toFixed(1) : '0.0';
    const porcentajeFichasPJ = totalFichasPJ > 0 ? ((fichaPJ.accepted / totalFichasPJ) * 100).toFixed(1) : '0.0';

    const contenedor = new ContainerBuilder()
        .setId(1)
        .addTextDisplayComponents(
            new TextDisplayBuilder()
                .setId(2)
                .setContent(`# ${emojis.user} **Estadísticas de Entrevistador**\n\n### ${emojis.persona} **Usuario:** <@${usuarioObjetivo.id}>\n\`\`\`yaml\nID del Usuario: ${usuarioObjetivo.id}\nNombre: ${usuarioObjetivo.username}\n\`\`\``)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder()
                .setId(3)
                .setContent(`## ${emojis.files} **Formularios Procesados**\n\n${emojis.settings} **Total procesados:** \`${totalFormularios}\`\n${emojis.success} **Aceptados:** \`${formularios.accepted}\`\n${emojis.error} **Denegados:** \`${formularios.denied}\`\n${emojis.awardcup} **Tasa de aceptación:** \`${porcentajeFormularios}%\`\n\n> *Rendimiento en formularios de ingreso*`)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder()
                .setId(4)
                .setContent(`## ${emojis.ticket} **Fichas PJ Procesadas**\n\n${emojis.settings} **Total procesadas:** \`${totalFichasPJ}\`\n${emojis.success} **Aceptadas:** \`${fichaPJ.accepted}\`\n${emojis.error} **Denegadas:** \`${fichaPJ.denied}\`\n${emojis.awardcup} **Tasa de aceptación:** \`${porcentajeFichasPJ}%\`\n\n> *Rendimiento en fichas de personaje*`)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder()
                .setId(5)
                .setContent(`---\n\n${emojis.fivem} **GTA Stories** ${emojis.estrellita} *Sistema de Estadísticas de Entrevistadores*`)
        );

    await interaction.reply({
        components: [contenedor],
        flags: MessageFlags.IsComponentsV2
    });
}

async function mostrarTodasLasEstadisticasEntrevistadores(interaction, pagina = 0) {
    const todasLasEstadisticas = getAllInterviewersStats();
    
    if (!todasLasEstadisticas || Object.keys(todasLasEstadisticas).length === 0) {
        await interaction.reply({
            content: `${emojis.warning} No hay estadísticas de entrevistadores registradas.`,
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const arrayEstadisticas = Object.entries(todasLasEstadisticas).map(([idUsuario, estadisticas]) => {
        const formularios = estadisticas.formularios || { total: 0, accepted: 0, denied: 0 };
        const fichaPJ = estadisticas.fichaPJ || { total: 0, accepted: 0, denied: 0 };
        const totalProcesados = formularios.total + fichaPJ.total;
        const totalAceptados = formularios.accepted + fichaPJ.accepted;
        const totalDenegados = formularios.denied + fichaPJ.denied;
        
        return {
            idUsuario,
            estadisticas: { formularios, fichaPJ },
            totalProcesados,
            totalAceptados,
            totalDenegados
        };
    }).sort((a, b) => b.totalProcesados - a.totalProcesados);

    const elementosPorPagina = 3;
    const totalPaginas = Math.ceil(arrayEstadisticas.length / elementosPorPagina);
    const indiceInicio = pagina * elementosPorPagina;
    const indiceFin = Math.min(indiceInicio + elementosPorPagina, arrayEstadisticas.length);
    const estadisticsPaginaActual = arrayEstadisticas.slice(indiceInicio, indiceFin);

    const contenedor = new ContainerBuilder()
        .setId(1)
        .addTextDisplayComponents(
            new TextDisplayBuilder()
                .setId(2)
                .setContent(`# ${emojis.awardcup} **Ranking de Entrevistadores**\n\n${emojis.usuarios} **Página:** \`${pagina + 1}\` de \`${totalPaginas}\`\n${emojis.persona} **Total de entrevistadores:** \`${arrayEstadisticas.length}\`\n\n**Leyenda:** ${emojis.buscar} Procesados ${emojis.success} Aceptados ${emojis.error} Denegados ${emojis.awardcup} Eficiencia\n\n> *Ordenados por total de solicitudes procesadas*`)
        );

    let idComponente = 3;
    
    for (let i = 0; i < estadisticsPaginaActual.length; i++) {
        const estadisticas = estadisticsPaginaActual[i];
        const posicionRanking = indiceInicio + i + 1;
        const mencionUsuario = `<@${estadisticas.idUsuario}>`;
        
        const eficienciaTotal = estadisticas.totalProcesados > 0 ? 
            ((estadisticas.totalAceptados / estadisticas.totalProcesados) * 100).toFixed(1) : '0.0';

        let emojiPosicion = emojis.persona;
        if (posicionRanking === 1) emojiPosicion = emojis.corona;
        else if (posicionRanking === 2) emojiPosicion = emojis.awardcup;
        else if (posicionRanking === 3) emojiPosicion = emojis.estrellita;

        contenedor.addTextDisplayComponents(
            new TextDisplayBuilder()
                .setId(idComponente++)
                .setContent(`${emojiPosicion} **#${posicionRanking}** ${mencionUsuario} ${emojis.buscar} **\`${estadisticas.totalProcesados}\`** ${emojis.success} **\`${estadisticas.totalAceptados}\`** ${emojis.error} **\`${estadisticas.totalDenegados}\`** ${emojis.awardcup} **\`${eficienciaTotal}%\`**`)
        );
    }

    contenedor.addTextDisplayComponents(
        new TextDisplayBuilder()
            .setId(idComponente++)
            .setContent(`\n${emojis.fivem} **GTA Stories** ${emojis.estrellita} *Sistema de Estadísticas de Entrevistadores*`)
    );

    const botonAnterior = new ButtonBuilder()
        .setCustomId(`entrevistadores_stats_prev_${pagina - 1}`)
        .setLabel('Anterior')
        .setEmoji(emojis.reply)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pagina <= 0);

    const botonSiguiente = new ButtonBuilder()
        .setCustomId(`entrevistadores_stats_next_${pagina + 1}`)
        .setLabel('Siguiente')
        .setEmoji(emojis.new)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pagina >= totalPaginas - 1);

    const botonActualizar = new ButtonBuilder()
        .setCustomId(`entrevistadores_stats_refresh_${pagina}`)
        .setLabel('Actualizar')
        .setEmoji(emojis.update)
        .setStyle(ButtonStyle.Primary);

    const filaAcciones = new ActionRowBuilder().addComponents(botonAnterior, botonSiguiente, botonActualizar);
    contenedor.addActionRowComponents([filaAcciones]);

    const componentes = [contenedor];

    if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ 
            components: componentes,
            flags: MessageFlags.IsComponentsV2
        });
    } else {
        await interaction.reply({ 
            components: componentes,
            flags: MessageFlags.IsComponentsV2
        });
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('entrevstats')
        .setDescription('Ver estadísticas de entrevistadores del servidor')
        .addUserOption(opcion =>
            opcion.setName('entrevistador')
                .setDescription('Ver estadísticas de un entrevistador específico')
                .setRequired(false)
        ),

    async execute(interaction) {
        try {
            const usuarioObjetivo = interaction.options.getUser('entrevistador');
            
            if (usuarioObjetivo) {
                await mostrarEstadisticasEntrevistadorEspecifico(interaction, usuarioObjetivo);
            } else {
                await mostrarTodasLasEstadisticasEntrevistadores(interaction);
            }
        } catch (error) {
            console.error('Error en comando entrevstats:', error);
            await interaction.reply({
                content: `${emojis.error} Error al obtener las estadísticas de entrevistadores.`,
                flags: MessageFlags.Ephemeral
            });
        }
    },

    mostrarTodasLasEstadisticasEntrevistadores,
    mostrarEstadisticasEntrevistadorEspecifico
};
