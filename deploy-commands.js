const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const config = require('./config.json');

const commands = [];
const foldersPath = path.join(__dirname, 'commands');

if (fs.existsSync(foldersPath)) {
    const items = fs.readdirSync(foldersPath);
    
    for (const item of items) {
        const itemPath = path.join(foldersPath, item);
        const stat = fs.statSync(itemPath);
        
        if (stat.isDirectory()) {
            const commandFiles = fs.readdirSync(itemPath).filter(file => file.endsWith('.js'));
            for (const file of commandFiles) {
                const filePath = path.join(itemPath, file);
                const command = require(filePath);
                if ('data' in command && 'execute' in command) {
                    commands.push(command.data.toJSON());
                } else {
                    console.log(`[ADVERTENCIA] El comando en ${filePath} no tiene las propiedades "data" o "execute" requeridas.`);
                }
            }
        } else if (item.endsWith('.js')) {
            const filePath = path.join(foldersPath, item);
            const commandExport = require(filePath);
            
            if (Array.isArray(commandExport)) {
                for (const command of commandExport) {
                    if ('data' in command && 'execute' in command) {
                        commands.push(command.data.toJSON());
                    } else {
                        console.log(`[ADVERTENCIA] Un comando en ${filePath} no tiene las propiedades "data" o "execute" requeridas.`);
                    }
                }
            } else if ('data' in commandExport && 'execute' in commandExport) {
                commands.push(commandExport.data.toJSON());
            } else {
                console.log(`[ADVERTENCIA] El comando en ${filePath} no tiene las propiedades "data" o "execute" requeridas.`);
            }
        }
     }
}

const rest = new REST().setToken(config.bot.token);

(async () => {
    try {
        console.log(`Iniciando actualización de ${commands.length} comandos de aplicación (/).`);

        const data = await rest.put(
            Routes.applicationGuildCommands(config.bot.clientId, config.bot.guildId),
            { body: commands },
        );

        console.log(`✅ Se recargaron exitosamente ${data.length} comandos de aplicación (/).`);
        console.log('Comandos registrados:');
        data.forEach(command => {
            console.log(`  - /${command.name}: ${command.description}`);
        });
    } catch (error) {
        console.error('❌ Error al registrar comandos:', error);
    }
})();