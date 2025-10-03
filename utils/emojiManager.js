const fs = require('fs');
const path = require('path');

class EmojiManager {
    constructor(client) {
        this.client = client;
        this.emojis = new Map();
        this.emojiData = {};
        this.loadEmojiData();
    }

    loadEmojiData() {
        try {
            const emojiPath = path.join(__dirname, '..', 'emojis.json');
            this.emojiData = JSON.parse(fs.readFileSync(emojiPath, 'utf8'));
        } catch (error) {
        }
    }

    saveEmojiData() {
        try {
            const emojiPath = path.join(__dirname, '..', 'emojis.json');
            const formattedData = {};
            
            for (const [key, value] of Object.entries(this.emojiData)) {
                if (typeof value === 'object' && value.id && value.name) {
                    formattedData[key] = `<:${value.name}:${value.id}>`;
                } else {
                    formattedData[key] = value;
                }
            }
            
            fs.writeFileSync(emojiPath, JSON.stringify(formattedData, null, 2), 'utf8');
        } catch (error) {
        }
    }

    async initializeEmojis() {
        try {
            if (!this.client.application) {
                return;
            }

            await this.syncEmojis();
        } catch (error) {
        }
    }

    async syncEmojis() {
        try {
            await this.client.application.emojis.fetch();
        } catch (error) {
        }
        
        const emojiFiles = fs.readdirSync(path.join(__dirname, '..', 'emojis'));
        
        for (const fileName of emojiFiles) {
            if (!fileName.endsWith('.png')) continue;
            
            const originalName = path.parse(fileName).name;
            let emojiName = originalName.replace(/[^a-zA-Z0-9_]/g, '_');
            if (emojiName.length < 2) emojiName = emojiName + '_emoji';
            if (emojiName.length > 32) emojiName = emojiName.substring(0, 32);
            
            try {
                const existingEmoji = this.client.application.emojis.cache.find(e => e.name === emojiName);
                
                if (existingEmoji) {
                    this.emojiData[originalName] = {
                        id: existingEmoji.id,
                        name: existingEmoji.name,
                        fileName: fileName
                    };
                    this.emojis.set(originalName, existingEmoji);
                } else {
                    const emojiPath = path.join(__dirname, '..', 'emojis', fileName);
                    
                    if (fs.existsSync(emojiPath)) {
                        const createdEmoji = await this.client.application.emojis.create({
                            attachment: emojiPath,
                            name: emojiName
                        });
                        
                        this.emojiData[originalName] = {
                            id: createdEmoji.id,
                            name: emojiName,
                            fileName: fileName
                        };
                        this.emojis.set(originalName, createdEmoji);
                    } else {
                        continue;
                    }
                }
            } catch (error) {
            }
        }
        
        this.saveEmojiData();
    }

    getEmoji(name) {
        const emoji = this.emojis.get(name);
        if (emoji) {
            return `<:${emoji.name}:${emoji.id}>`;
        }
        
        const emojiData = this.emojiData[name];
        if (emojiData) {
            if (typeof emojiData === 'string' && emojiData.startsWith('<:')) {
                return emojiData;
            }
            if (emojiData.id && emojiData.name) {
                return `<:${emojiData.name}:${emojiData.id}>`;
            }
        }
        
        return `❓`;
    }

    getAllEmojis() {
        const result = {};
        for (const [name, emoji] of this.emojis) {
            result[name] = `<:${emoji.name}:${emoji.id}>`;
        }
        return result;
    }

    isEmojiAvailable(name) {
        if (this.emojis.has(name)) {
            return true;
        }
        
        const emojiData = this.emojiData[name];
        if (emojiData) {
            if (typeof emojiData === 'string' && emojiData.startsWith('<:')) {
                return true;
            }
            if (emojiData.id) {
                return true;
            }
        }
        
        return false;
    }
}

module.exports = EmojiManager;