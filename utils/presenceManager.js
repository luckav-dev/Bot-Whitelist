const fs = require('fs');
const path = require('path');
const { ActivityType } = require('discord.js');

class PresenceManager {
    constructor(client) {
        this.client = client;
        this.currentIndex = 0;
        this.interval = null;
    }

    getFormularioStats() {
        try {
            const dbPath = path.join(__dirname, '..', 'database', 'formulario-stats.json');
            if (!fs.existsSync(dbPath)) {
                return {
                    totalFormularios: 0,
                    totalFichas: 0,
                    totalAprobadas: 0,
                    totalCombinadas: 0
                };
            }
            
            const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
            const formularios = data.formularios || { total: 0, accepted: 0 };
            const fichaPJ = data.fichaPJ || { total: 0, accepted: 0 };
            
            return {
                totalFormularios: formularios.total,
                totalFichas: fichaPJ.total,
                totalAprobadas: formularios.accepted + fichaPJ.accepted,
                totalCombinadas: formularios.total + fichaPJ.total
            };
        } catch (error) {
            console.error('Error obteniendo estadísticas de formularios:', error);
            return {
                totalFormularios: 0,
                totalFichas: 0,
                totalAprobadas: 0,
                totalCombinadas: 0
            };
        }
    }

    getInvitationStats() {
        try {
            const invitationsPath = path.join(__dirname, '..', 'database', 'invitations.json');
            if (!fs.existsSync(invitationsPath)) {
                return { totalInvitados: 0 };
            }
            
            const data = JSON.parse(fs.readFileSync(invitationsPath, 'utf8'));
            return {
                totalInvitados: data.stats?.totalInvitationsSent || 0
            };
        } catch (error) {
            console.error('Error obteniendo estadísticas de invitaciones:', error);
            return { totalInvitados: 0 };
        }
    }

    getPresenceActivities() {
        const formularioStats = this.getFormularioStats();
        const invitationStats = this.getInvitationStats();

        return [
            {
                name: `${formularioStats.totalFormularios} formularios enviados`,
                type: ActivityType.Watching
            },
            {
                name: `${formularioStats.totalFichas} fichas procesadas`,
                type: ActivityType.Watching
            },
            {
                name: `${formularioStats.totalCombinadas} solicitudes totales`,
                type: ActivityType.Watching
            },
            {
                name: `${formularioStats.totalAprobadas} aprobaciones exitosas`,
                type: ActivityType.Watching
            },
            {
                name: `${invitationStats.totalInvitados} usuarios invitados`,
                type: ActivityType.Watching
            }
        ];
    }

    updatePresence() {
        try {
            const activities = this.getPresenceActivities();
            if (activities.length === 0) return;

            const activity = activities[this.currentIndex];
            this.client.user.setActivity(activity.name, { type: activity.type });

            this.currentIndex = (this.currentIndex + 1) % activities.length;
        } catch (error) {
            console.error('Error actualizando presence:', error);
        }
    }

    start() {
        this.updatePresence();
        this.interval = setInterval(() => {
            this.updatePresence();
        }, 10000);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
}

module.exports = PresenceManager;