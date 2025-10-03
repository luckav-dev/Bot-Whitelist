const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('invitacion')
        .setDescription('Invitar a un usuario al sistema de formulario (Solo VIP)')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuario a invitar')
                .setRequired(true)
        ),
    
    async execute(interaction) {
        const targetUser = interaction.options.getUser('usuario');
        const member = interaction.member;
        const guild = interaction.guild;
        
        if (!member.roles.cache.has(config.rolesEspeciales.vipRoleId)) {
            const container = new ContainerBuilder();
            container.addTextDisplayComponents([
                new TextDisplayBuilder().setContent(`# ${interaction.client.emojiManager.getEmoji('error')} Acceso Denegado\n\n-# No tienes permisos para usar este comando\n\n**Rol Requerido:** <@&${config.rolesEspeciales.vipRoleId}> (VIP)\n**Tu Estado Actual:** No posees el rol VIP necesario\n\n*Solo los miembros VIP pueden enviar invitaciones • <t:${Math.floor(Date.now() / 1000)}:F>*`)
            ]);
            
            return await interaction.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }
        
        const databasePath = path.join(__dirname, '..', 'database');
        const invitationsPath = path.join(databasePath, 'invitations.json');
        let invitationsData;
        
        if (!fs.existsSync(databasePath)) {
            fs.mkdirSync(databasePath, { recursive: true });
        }
        
        try {
            invitationsData = JSON.parse(fs.readFileSync(invitationsPath, 'utf8'));
        } catch (error) {
            invitationsData = {
                stats: {
                    totalVipMembers: 0,
                    totalInvitationsSent: 0,
                    totalInvitationsUsed: 0,
                    lastUpdated: null
                },
                users: {}
            };
            fs.writeFileSync(invitationsPath, JSON.stringify(invitationsData, null, 2));
        }
        
        const userId = interaction.user.id;
        
        if (!invitationsData.users[userId]) {
            invitationsData.users[userId] = {
                invitationsLeft: 3,
                totalSent: 0,
                joinedVipAt: new Date().toISOString(),
                invitedUsers: []
            };
            invitationsData.stats.totalVipMembers++;
        }
        
        const userInvitations = invitationsData.users[userId];
        
        if (userInvitations.invitationsLeft <= 0) {
            const container = new ContainerBuilder();
            container.addTextDisplayComponents([
                new TextDisplayBuilder().setContent(`# ${interaction.client.emojiManager.getEmoji('error')} Sin Invitaciones Disponibles\n\n-# No tienes invitaciones restantes\n\n**Tu Estado VIP:**\nInvitaciones usadas: **${userInvitations.totalSent}/3**\nInvitaciones restantes: **0**\n\n**Información:** Cada miembro VIP recibe 3 invitaciones\n\n*Contacta con el staff para más invitaciones • <t:${Math.floor(Date.now() / 1000)}:F>*`)
            ]);
            
            return await interaction.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }
        
        try {
            const targetMember = await guild.members.fetch(targetUser.id);
            
            if (targetMember.roles.cache.has(config.rolesAprobacion.formularioRoleId)) {
                const container = new ContainerBuilder();
                container.addTextDisplayComponents([
                    new TextDisplayBuilder().setContent(`# ${interaction.client.emojiManager.getEmoji('warning')} Usuario Ya Invitado\n\n-# Este usuario ya tiene acceso\n\n**Usuario Objetivo:** <@${targetUser.id}>\n**Estado Actual:** Ya posee el rol de Formulario\n\n*No se ha consumido ninguna invitación • <t:${Math.floor(Date.now() / 1000)}:F>*`)
                ]);
                
                return await interaction.reply({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                });
            }

            if (targetMember.roles.cache.has(config.rolesSuspenso.formRechazadoRoleId)) {
                const container = new ContainerBuilder();
                container.addTextDisplayComponents([
                    new TextDisplayBuilder().setContent(`# ${interaction.client.emojiManager.getEmoji('error')} Usuario con Formulario Rechazado\n\n-# No se puede invitar a este usuario\n\n**Usuario Objetivo:** <@${targetUser.id}>\n**Estado Actual:** Tiene formulario rechazado\n**Motivo:** Los usuarios con formularios rechazados no pueden ser invitados\n\n*No se ha consumido ninguna invitación • <t:${Math.floor(Date.now() / 1000)}:F>*`)
                ]);
                
                return await interaction.reply({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                });
            }

            if (targetMember.roles.cache.has(config.rolesSuspenso.suspenso3ficharoleid)) {
                const container = new ContainerBuilder();
                container.addTextDisplayComponents([
                    new TextDisplayBuilder().setContent(`# ${interaction.client.emojiManager.getEmoji('error')} Usuario Suspendido Permanentemente\n\n-# No se puede invitar a este usuario\n\n**Usuario Objetivo:** <@${targetUser.id}>\n**Estado Actual:** Tiene suspensión permanente (3er suspenso)\n**Motivo:** Los usuarios con suspensión permanente no pueden ser invitados\n\n*No se ha consumido ninguna invitación • <t:${Math.floor(Date.now() / 1000)}:F>*`)
                ]);
                
                return await interaction.reply({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                });
            }
            
            await targetMember.roles.add([config.rolesAprobacion.formularioRoleId, config.rolesEspeciales.invitadoRoleId]);
            
            userInvitations.invitationsLeft--;
            userInvitations.totalSent++;
            userInvitations.invitedUsers.push({
                userId: targetUser.id,
                username: targetUser.tag,
                invitedAt: new Date().toISOString()
            });
            invitationsData.stats.totalInvitationsSent++;
            invitationsData.stats.totalInvitationsUsed++;
            invitationsData.stats.lastUpdated = new Date().toISOString();
            
            fs.writeFileSync(invitationsPath, JSON.stringify(invitationsData, null, 2));
            
            const container = new ContainerBuilder();
            container.addTextDisplayComponents([
                new TextDisplayBuilder().setContent(`# ${interaction.client.emojiManager.getEmoji('success')} Invitación Enviada Exitosamente\n\n-# Usuario invitado con éxito\n\n**Usuario Invitado:** <@${targetUser.id}>\n**Roles asignados:** <@&${config.rolesAprobacion.formularioRoleId}> • <@&${config.rolesEspeciales.invitadoRoleId}>\n**Procesado por:** <@${interaction.user.id}>\n\n**Tus Invitaciones VIP:**\nUsadas: **${userInvitations.totalSent}/3**\nRestantes: **${userInvitations.invitationsLeft}**\n\n*El usuario ha sido notificado por mensaje directo • <t:${Math.floor(Date.now() / 1000)}:F>*`)
            ]);
            
            await interaction.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
            
            const resultsChannel = guild.channels.cache.get(config.canales.resultsChannelId);
            if (resultsChannel) {
                const container = new ContainerBuilder();
                container.addTextDisplayComponents([
                    new TextDisplayBuilder().setContent(`# ${interaction.client.emojiManager.getEmoji('success')} Nueva Invitación VIP Procesada\n\n-# Invitación procesada exitosamente\n\n${interaction.client.emojiManager.getEmoji('user')} **Usuario Invitado:** <@${targetUser.id}>\n${interaction.client.emojiManager.getEmoji('whitelist')} **Miembro VIP Responsable:** <@${interaction.user.id}> utilizó una invitación\n${interaction.client.emojiManager.getEmoji('new')} **Roles otorgados:** <@&${config.rolesAprobacion.formularioRoleId}> • <@&${config.rolesEspeciales.invitadoRoleId}>\n\n*ROLES ASIGNADOS • <t:${Math.floor(Date.now() / 1000)}:F>*`)
                ]);
                
                await resultsChannel.send({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2
                });
            }
            
            try {
                const formularioRole = guild.roles.cache.get(config.rolesAprobacion.formularioRoleId);
                const invitadoRole = guild.roles.cache.get(config.rolesEspeciales.invitadoRoleId);
                const formularioRoleName = formularioRole ? formularioRole.name : 'rol desconocido';
                const invitadoRoleName = invitadoRole ? invitadoRole.name : 'rol desconocido';
                
                const container = new ContainerBuilder();
                container.addTextDisplayComponents([
                    new TextDisplayBuilder().setContent(`# ${interaction.client.emojiManager.getEmoji('success')} ¡Has sido invitado a GTA Stories!\n\n-# Invitación recibida\n\n**Invitado por:** ${interaction.user.tag} (Miembro VIP)\n**Acceso Otorgado:** Ahora tienes los roles **${formularioRoleName}** • **${invitadoRoleName}**\n\n**Próximos Pasos:**\n${interaction.client.emojiManager.getEmoji('uno')} Dirigete al servidor Principal de GTA Stories.\n${interaction.client.emojiManager.getEmoji('dos')} Dale al boton de Ficha de PJ.\n${interaction.client.emojiManager.getEmoji('tres')} Rellenar la ficha correctamente.\n${interaction.client.emojiManager.getEmoji('cuatro')} Mantente atento a que un staff te responda del resultado.\n\n*¡Bienvenido a la comunidad de GTA Stories! • <t:${Math.floor(Date.now() / 1000)}:F>*`)
                ]);
                
                await targetUser.send({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2
                });
            } catch (dmError) {
            }
            
        } catch (error) {
            const container = new ContainerBuilder();
            container.addTextDisplayComponents([
                new TextDisplayBuilder().setContent(`# ${interaction.client.emojiManager.getEmoji('error')} Error al Procesar Invitación\n\n-# No se pudo completar la invitación\n\n**Usuario Objetivo:** <@${targetUser.id}>\n\n**Posibles Causas:**\n• El usuario no está en el servidor\n• Error de permisos del bot\n• Usuario bloqueado\n\n*Contacta con el staff si el problema persiste • <t:${Math.floor(Date.now() / 1000)}:F>*`)
            ]);
            
            await interaction.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }
    }
};