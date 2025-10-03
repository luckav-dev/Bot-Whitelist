const { getIncompleteApplications, markReminderSent } = require('./database');
const { tieneRolInvitado } = require('./roleChecker');
const { Client, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

class SistemaRecordatorios {
    constructor(cliente) {
        this.cliente = cliente;
        this.intervaloRecordatorios = null;
        this.intervaloVerificacion = 60 * 1000;
        this.retrasoRecordatorio = 60 * 60 * 1000;
    }

    iniciar() {
        if (this.intervaloRecordatorios) {
            clearInterval(this.intervaloRecordatorios);
        }

        this.intervaloRecordatorios = setInterval(() => {
            this.verificarRecordatorios();
        }, this.intervaloVerificacion);

        console.log('Sistema de recordatorios iniciado');
    }

    detener() {
        if (this.intervaloRecordatorios) {
            clearInterval(this.intervaloRecordatorios);
            this.intervaloRecordatorios = null;
        }
        console.log('Sistema de recordatorios detenido');
    }

    async verificarRecordatorios() {
        try {
            const aplicacionesIncompletas = getIncompleteApplications();
            const ahora = Date.now();

            for (const aplicacion of aplicacionesIncompletas) {
                if (aplicacion.reminderSent) continue;

                const tiempoDesdeEnvio = ahora - aplicacion.timestamp;
                if (tiempoDesdeEnvio >= this.retrasoRecordatorio) {
                    await this.enviarRecordatorio(aplicacion);
                    markReminderSent(aplicacion.userId, aplicacion.type);
                }
            }
        } catch (error) {
            console.error('Error en sistema de recordatorios:', error);
        }
    }

    async enviarRecordatorio(aplicacion) {
        try {
            const servidor = this.cliente.guilds.cache.get(process.env.GUILD_ID);
            if (!servidor) return;

            const miembro = await servidor.members.fetch(aplicacion.userId).catch(() => null);
            if (!miembro) return;

            if (tieneRolInvitado(miembro)) return;

            const tipoFaltante = aplicacion.type === 'formulario' ? 'Ficha PJ' : 'Formulario';
            const tipoCompletado = aplicacion.type === 'formulario' ? 'Formulario' : 'Ficha PJ';

            const contenedorRecordatorio = new ContainerBuilder();

            contenedorRecordatorio.addTextDisplayComponents([
                new TextDisplayBuilder().setContent(
                    `# ${this.cliente.emojiManager.getEmoji('notificacion')} Recordatorio de Proceso Incompleto\n\n` +
                    `Hola ${miembro.user.displayName},\n\n` +
                    `Has enviado tu **${tipoCompletado}** hace más de 1 hora, pero aún falta tu **${tipoFaltante}** para completar el proceso de ingreso.`
                )
            ]);

            contenedorRecordatorio.addSeparatorComponents([
                new SeparatorBuilder().setSpacing('Small')
            ]);

            contenedorRecordatorio.addTextDisplayComponents([
                new TextDisplayBuilder().setContent(
                    `> ${this.cliente.emojiManager.getEmoji('warning')} **Estado Actual**\n\n` +
                    `${this.cliente.emojiManager.getEmoji('success')} ${tipoCompletado}: Enviado\n` +
                    `${this.cliente.emojiManager.getEmoji('error')} ${tipoFaltante}: Pendiente\n\n` +
                    `Para poder acceder completamente al servidor, necesitas enviar ambos formularios.`
                )
            ]);

            const botonCanal = new ButtonBuilder()
                .setLabel(`Ir al Canal de ${tipoFaltante}`)
                .setEmoji(this.cliente.emojiManager.getEmoji('createchannels'))
                .setStyle(ButtonStyle.Link);

            if (tipoFaltante === 'Ficha PJ') {
                botonCanal.setURL(`https://discord.com/channels/${servidor.id}/${process.env.FORM_PJ_CHANNEL_ID}`);
            } else {
                botonCanal.setURL(`https://discord.com/channels/${servidor.id}/${process.env.FORM_CHANNEL_ID}`);
            }

            const filaAccion = new ActionRowBuilder().addComponents(botonCanal);
            contenedorRecordatorio.addActionRowComponents([filaAccion]);

            contenedorRecordatorio.addSeparatorComponents([
                new SeparatorBuilder().setSpacing('Small')
            ]);

            contenedorRecordatorio.addTextDisplayComponents([
                new TextDisplayBuilder().setContent(
                    `*GTA Stories • Sistema de Recordatorios • <t:${Math.floor(Date.now() / 1000)}:F>*`
                )
            ]);

            await miembro.send({
                components: [contenedorRecordatorio],
                flags: MessageFlags.IsComponentsV2
            }).catch(error => {
                console.log(`No se pudo enviar recordatorio privado a ${miembro.user.tag}:`, error.message);
            });

            console.log(`Recordatorio enviado a ${miembro.user.tag} para completar ${tipoFaltante}`);

        } catch (error) {
            console.error('Error enviando recordatorio:', error);
        }
    }
}

module.exports = SistemaRecordatorios;