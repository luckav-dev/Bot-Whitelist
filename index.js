const { Client, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config.json');
const EmojiManager = require('./utils/emojiManager');
const SystemConsoleDisplay = require('./utils/consoleDisplay');
const SistemaRecordatorios = require('./utils/reminderSystem');
const PresenceManager = require('./utils/presenceManager');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages
    ]
});

client.emojiManager = new EmojiManager(client);

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.log(`[ADVERTENCIA] El comando en ${filePath} no tiene las propiedades "data" o "execute" requeridas.`);
        }
    }
}

const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
    
    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);
        
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args));
        } else {
            client.on(event.name, (...args) => event.execute(...args));
        }
    }
}

process.on('unhandledRejection', (reason, promise) => {
    console.error('Promesa rechazada no manejada en:', promise, 'razón:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Excepción no capturada:', error);
});

client.once('ready', async () => {
    console.log(`Bot conectado como ${client.user.tag}`);
    
    await client.emojiManager.initializeEmojis();
    
    client.sistemaRecordatorios = new SistemaRecordatorios(client);
        client.sistemaRecordatorios.iniciar();
    
    client.presenceManager = new PresenceManager(client);
    client.presenceManager.start();
    
    const consoleDisplay = new SystemConsoleDisplay(client);
    consoleDisplay.init();
});

client.login(config.bot.token);