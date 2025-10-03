const { execSync } = require('child_process');
const { getStats, getAllInterviewersStats } = require('./database');

class SystemConsoleDisplay {
    constructor(client) {
        this.client = client;
        this.refreshInterval = null;
        this.isInitialized = false;
    }

    init() {
        if (this.isInitialized) return;
        this.clearConsole();
        this.displayBanner();
        this.startAutoRefresh();
        this.isInitialized = true;
    }

    clearConsole() {
        try {
            if (process.platform === 'win32') {
                execSync('cls', { stdio: 'inherit' });
            } else {
                execSync('clear', { stdio: 'inherit' });
            }
        } catch (error) {
            process.stdout.write('\x1b[2J\x1b[0f');
        }
    }

    displayBanner() {
        const stats = getStats();
        const serverCount = this.client.guilds.cache.size;
        const currentTime = new Date().toLocaleString('es-ES', {
            timeZone: 'Europe/Madrid',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        let topStaffInfo = '';
        try {
            const allStats = getAllInterviewersStats();
            if (allStats && Object.keys(allStats).length > 0) {
                const staffArray = Object.entries(allStats).map(([userId, stats]) => {
                    const formularios = stats.formularios || { total: 0 };
                    const fichaPJ = stats.fichaPJ || { total: 0 };
                    const total = formularios.total + fichaPJ.total;
                    return { userId, total };
                }).sort((a, b) => b.total - a.total);

                if (staffArray.length > 0 && staffArray[0].total > 0) {
                    const topStaff = staffArray[0];
                    const user = this.client.users.cache.get(topStaff.userId);
                    const username = user ? user.username : `ID: ${topStaff.userId}`;
                    topStaffInfo = `\x1b[96m║\x1b[0m  \x1b[1m\x1b[95m👑 Staff Activo:\x1b[0m  \x1b[97m${username} (${topStaff.total})\x1b[0m${' '.repeat(Math.max(0, 35 - username.length - topStaff.total.toString().length - -8))}\x1b[96m║\x1b[0m\n`;
                }
            }
        } catch (error) {
            console.error('Error al obtener estadísticas de staff:', error);
        }

        const banner = [
            '',
            '\x1b[97m\x1b[1m██████╗████████╗ █████╗\x1b[0m      \x1b[93m\x1b[1m███████╗████████╗ ██████╗ ██████╗ ██╗███████╗███████╗\x1b[0m',
            '\x1b[97m\x1b[1m██╔════╝╚══██╔══╝██╔══██╗\x1b[0m    \x1b[93m\x1b[1m██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗██║██╔════╝██╔════╝\x1b[0m',
            '\x1b[97m\x1b[1m██║  ███╗  ██║   ███████║\x1b[0m    \x1b[93m\x1b[1m███████╗   ██║   ██║   ██║██████╔╝██║█████╗  ███████╗\x1b[0m',
            '\x1b[97m\x1b[1m██║   ██║  ██║   ██╔══██║\x1b[0m    \x1b[93m\x1b[1m╚════██║   ██║   ██║   ██║██╔══██╗██║██╔══╝  ╚════██║\x1b[0m',
            '\x1b[97m\x1b[1m╚██████╔╝  ██║   ██║  ██║\x1b[0m    \x1b[93m\x1b[1m███████║   ██║   ╚██████╔╝██║  ██║██║███████╗███████║\x1b[0m',
            '\x1b[97m\x1b[1m ╚═════╝   ╚═╝   ╚═╝  ╚═╝\x1b[0m    \x1b[93m\x1b[1m╚══════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚═╝╚══════╝╚══════╝\x1b[0m',
            '',
            '\x1b[96m╔══════════════════════════════════════════════════════════════════╗\x1b[0m',
            '\x1b[96m║\x1b[0m                        \x1b[1m\x1b[92mSISTEMA DE FORMULARIO\x1b[0m                     \x1b[96m║\x1b[0m',
            '\x1b[96m╠══════════════════════════════════════════════════════════════════╣\x1b[0m',
            `\x1b[96m║\x1b[0m  \x1b[1m\x1b[93mBot:\x1b[0m            \x1b[97m${this.client.user?.tag || 'Desconectado'}\x1b[0m${' '.repeat(Math.max(0, 35 - (this.client.user?.tag?.length || 1)))}             \x1b[96m║\x1b[0m`,
            `\x1b[96m║\x1b[0m  \x1b[1m\x1b[93mServidores:\x1b[0m     \x1b[97m${serverCount} servidor${serverCount !== 1 ? 'es' : ''}\x1b[0m${' '.repeat(Math.max(0, 42 - serverCount.toString().length - (serverCount !== 1 ? 10 : 1)))}     \x1b[96m║\x1b[0m`,
            `\x1b[96m║\x1b[0m  \x1b[1m\x1b[93mÚltima Act.:\x1b[0m    \x1b[97m${currentTime}\x1b[0m${' '.repeat(Math.max(0, 35 - currentTime.length))}             \x1b[96m║\x1b[0m`,
            '\x1b[96m╠══════════════════════════════════════════════════════════════════╣\x1b[0m',
            '\x1b[96m║\x1b[0m                       \x1b[1m\x1b[94mESTADÍSTICAS FORMULARIO\x1b[0m                    \x1b[96m║\x1b[0m',
            '\x1b[96m╠══════════════════════════════════════════════════════════════════╣\x1b[0m',
            `\x1b[96m║\x1b[0m  \x1b[1m\x1b[92m✅ Aprobadas:\x1b[0m    \x1b[97m${stats.accepted} solicitudes\x1b[0m${' '.repeat(Math.max(0, 35 - stats.accepted.toString().length - 0))}\x1b[96m║\x1b[0m`,
            `\x1b[96m║\x1b[0m  \x1b[1m\x1b[91m❌ Rechazadas:\x1b[0m   \x1b[97m${stats.denied} solicitudes\x1b[0m${' '.repeat(Math.max(0, 35 - stats.denied.toString().length - 0))}\x1b[96m║\x1b[0m`,
            `\x1b[96m║\x1b[0m  \x1b[1m\x1b[93m📊 Total:\x1b[0m        \x1b[97m${stats.total} solicitudes\x1b[0m${' '.repeat(Math.max(0, 35 - stats.total.toString().length - 0))}\x1b[96m║\x1b[0m`,
            ...(topStaffInfo ? [
                '\x1b[96m╠══════════════════════════════════════════════════════════════════╣\x1b[0m',
                topStaffInfo.trim()
            ] : []),
            '\x1b[96m╚══════════════════════════════════════════════════════════════════╝\x1b[0m',
            '',
            '\x1b[1m\x1b[92m[SISTEMA ACTIVO]\x1b[0m \x1b[97mBot funcionando correctamente\x1b[0m',
            '\x1b[90m══════════════════════════════════════════════════════════════════\x1b[0m',
            '\x1b[92mSistema de FORMULARIO Automático \x1b[90m| \x1b[96mActualización cada 5 minutos\x1b[0m',
            ''
        ];

        banner.forEach(line => console.log(line));
    }

    startAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        this.refreshInterval = setInterval(() => {
            this.clearConsole();
            this.displayBanner();
        }, 300000);
    }

    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        this.isInitialized = false;
    }
}

module.exports = SystemConsoleDisplay;