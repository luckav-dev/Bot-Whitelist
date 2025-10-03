const config = require('../config.json');

function tieneRolStaff(member) {
    return member.roles.cache.has(config.rolesStaff.staffRoleId);
}

function tieneRolEntrevistador(member) {
    return member.roles.cache.has(config.rolesStaff.entrevistadorRoleId);
}

function puedeGestionarFormularios(member) {
    return tieneRolStaff(member) || tieneRolEntrevistador(member);
}

function puedeAceptarDenegarFormularios(member) {
    return tieneRolEntrevistador(member);
}

function tieneRolInvitado(member) {
    return member.roles.cache.has(config.rolesEspeciales.invitadoRoleId);
}

function crearMensajeErrorPermisos(emojiManager, tipoAccion = 'ejecutar esta acción') {
    return `# ${emojiManager.getEmoji('error')} Permisos Insuficientes\n\n> ${emojiManager.getEmoji('warning')} **No tienes permisos para ${tipoAccion}**\n\n> ${emojiManager.getEmoji('settings')} **Roles Requeridos**\n• <@&${config.rolesStaff.staffRoleId}> Staff del servidor\n• <@&${config.rolesStaff.entrevistadorRoleId}> Entrevistador (solo para formularios)\n\n> ${emojiManager.getEmoji('announcements')} **Contacta con un administrador si crees que esto es un error**`;
}

function crearMensajeErrorEntrevistador(emojiManager, tipoAccion = 'ejecutar esta acción') {
    return `# ${emojiManager.getEmoji('error')} Permisos Insuficientes\n\n> ${emojiManager.getEmoji('warning')} Solo los entrevistadores pueden ${tipoAccion}\n\n> ${emojiManager.getEmoji('settings')} Rol Requerido\n• <@&${config.rolesStaff.entrevistadorRoleId}> Entrevistador\n\n> ${emojiManager.getEmoji('announcements')} Contacta con un administrador si crees que esto es un error`;
}

function crearMensajeErrorStaff(emojiManager) {
    return `# ${emojiManager.getEmoji('error')} Acceso Restringido\n\n> ${emojiManager.getEmoji('warning')} **Solo el staff puede ejecutar comandos**\n\n> ${emojiManager.getEmoji('settings')} **Rol Requerido**\n• <@&${config.rolesStaff.staffRoleId}> Staff del servidor\n\n> ${emojiManager.getEmoji('announcements')} **Contacta con un administrador para obtener permisos**`;
}

module.exports = {
    tieneRolStaff,
    tieneRolEntrevistador,
    puedeGestionarFormularios,
    puedeAceptarDenegarFormularios,
    tieneRolInvitado,
    crearMensajeErrorPermisos,
    crearMensajeErrorEntrevistador,
    crearMensajeErrorStaff
};