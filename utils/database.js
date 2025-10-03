const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database', 'formulario-stats.json');

let isWriting = false;
let writingStartTime = null;
const writeQueue = [];

function forceResetWriteState() {
    console.log('FORZANDO RESET DEL ESTADO DE ESCRITURA - isWriting:', isWriting, 'writeQueue length:', writeQueue.length);
    isWriting = false;
    writingStartTime = null;
    if (writeQueue.length > 0) {
        console.log('Reintentando procesar cola después del reset forzado');
        setImmediate(() => processWriteQueue());
    }
}

function ensureDatabase() {
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
    
    if (!fs.existsSync(dbPath)) {
        const initialData = {
            formularios: {
                total: 0,
                accepted: 0,
                denied: 0,
                applications: []
            },
            fichaPJ: {
                total: 0,
                accepted: 0,
                denied: 0,
                applications: []
            },
            interviewers: {}
        };
        fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2));
    }
}

function readDatabase() {
    ensureDatabase();
    let retries = 5;
    
    while (retries > 0) {
        try {
            if (!fs.existsSync(dbPath)) {
                throw new Error('Archivo de base de datos no existe');
            }
            

            
            const stats = fs.statSync(dbPath);
            if (stats.size === 0) {
                throw new Error('Archivo de base de datos vacío (tamaño 0)');
            }
            
            const data = fs.readFileSync(dbPath, 'utf8');
            
            if (!data || data.trim() === '') {
                throw new Error('Archivo de base de datos vacío (contenido vacío)');
            }
            
            let parsed;
            try {
                parsed = JSON.parse(data);
            } catch (parseError) {
                throw new Error(`Error parseando JSON: ${parseError.message}`);
            }
            
            if (!parsed || typeof parsed !== 'object') {
                throw new Error('Datos parseados inválidos');
            }
            
            if (!parsed.fichaPJ) {
                parsed.fichaPJ = {
                    total: 0,
                    accepted: 0,
                    denied: 0,
                    applications: []
                };
            }
            
            if (!parsed.interviewers) {
                parsed.interviewers = {};
            }
            
            return parsed;
        } catch (error) {
            retries--;
            console.warn(`Error leyendo base de datos, reintentando... (${5 - retries}/5):`, error.message);
            
            if (retries === 0) {
                console.error('Error leyendo base de datos después de 5 intentos. Intentando lectura directa del archivo existente.');
                
                try {
                    const rawData = fs.readFileSync(dbPath, 'utf8');
                    if (rawData && rawData.trim() !== '') {
                        const parsed = JSON.parse(rawData);
                        console.log('Lectura directa exitosa, devolviendo datos existentes');
                        return parsed;
                    }
                } catch (directError) {
                    console.error('Error en lectura directa:', directError.message);
                }
                
                throw new Error('No se pudo leer la base de datos después de múltiples intentos');
            }
            
            const waitTime = Math.min(100 * (5 - retries), 1000);
            const start = Date.now();
            while (Date.now() - start < waitTime) {}
        }
    }
}

function writeDatabase(data) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            console.error('TIMEOUT EN ESCRITURA DE BD - Forzando reset de estado');
            forceResetWriteState();
            reject(new Error('Timeout al escribir en la base de datos'));
        }, 10000);

        const wrappedResolve = (result) => {
            clearTimeout(timeoutId);
            resolve(result);
        };

        const wrappedReject = (error) => {
            clearTimeout(timeoutId);
            console.error('ERROR EN ESCRITURA DE BD:', error.message);
            reject(error);
        };

        console.log('AÑADIENDO A COLA DE ESCRITURA - Cola actual:', writeQueue.length);
        writeQueue.push({ data, resolve: wrappedResolve, reject: wrappedReject });
        processWriteQueue();
    });
}

async function processWriteQueue() {
    if (writeQueue.length === 0) return;
    
    if (isWriting) {
        if (writingStartTime && (Date.now() - writingStartTime) > 30000) {
            console.warn('DETECTADO BLOQUEO DE ESCRITURA - Forzando reset después de 30 segundos');
            forceResetWriteState();
            return;
        }
        return;
    }
    
    isWriting = true;
    writingStartTime = Date.now();
    console.log('INICIANDO ESCRITURA A BD - Cola length:', writeQueue.length);
    const { data, resolve, reject } = writeQueue.shift();
    
    try {
        let retries = 3;
        while (retries > 0) {
            try {
                const jsonString = JSON.stringify(data, null, 2);
                const tempPath = dbPath + '.tmp';
                
                await fs.promises.writeFile(tempPath, jsonString);
                
                const verification = await fs.promises.readFile(tempPath, 'utf8');
                JSON.parse(verification);
                
                await fs.promises.rename(tempPath, dbPath);
                
                resolve();
                break;
            } catch (error) {
                retries--;
                if (retries === 0) {
                    console.error('Error escribiendo base de datos después de 3 intentos:', error);
                    reject(error);
                } else {
                    console.warn(`Error escribiendo base de datos, reintentando... (${3 - retries}/3):`, error);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }
    } finally {
            console.log('FINALIZANDO ESCRITURA A BD - Éxito, limpiando estado');
            isWriting = false;
            writingStartTime = null;
            if (writeQueue.length > 0) {
                console.log('Procesando siguiente elemento en cola - Restantes:', writeQueue.length);
                setImmediate(() => processWriteQueue());
            }
        }
}

async function addApplication(userId, formData) {
    const db = readDatabase();
    
    if (!db.formularios) {
        db.formularios = {
            total: 0,
            accepted: 0,
            denied: 0,
            applications: []
        };
    }
    
    const existingIndex = db.formularios.applications.findIndex(app => app.userId === userId && app.status === 'pending');
    
    if (existingIndex !== -1) {
        db.formularios.applications[existingIndex] = {
            userId: userId,
            status: 'pending',
            timestamp: new Date().toISOString(),
            formData: formData
        };
    } else {
        db.formularios.applications.push({
            userId: userId,
            status: 'pending',
            timestamp: new Date().toISOString(),
            formData: formData
        });
        db.formularios.total += 1;
    }
    
    await writeDatabase(db);
}

async function addFichaPJApplication(userId, formData) {
    const db = readDatabase();
    
    if (!db.fichaPJ) {
        db.fichaPJ = {
            total: 0,
            accepted: 0,
            denied: 0,
            applications: []
        };
    }
    
    const existingIndex = db.fichaPJ.applications.findIndex(app => app.userId === userId && app.status === 'pending');
    
    if (existingIndex !== -1) {
        db.fichaPJ.applications[existingIndex] = {
            userId: userId,
            status: 'pending',
            timestamp: new Date().toISOString(),
            formData: formData
        };
    } else {
        db.fichaPJ.applications.push({
            userId: userId,
            status: 'pending',
            timestamp: new Date().toISOString(),
            formData: formData
        });
        db.fichaPJ.total += 1;
    }
    
    await writeDatabase(db);
}

async function updateApplicationStatus(userId, status, messageUrl = null, processedBy = null) {
    const db = readDatabase();
    
    if (!db.formularios) {
        db.formularios = {
            total: 0,
            accepted: 0,
            denied: 0,
            applications: []
        };
    }
    
    let applicationIndex = db.formularios.applications.findIndex(app => app.userId === userId && app.status === 'pending');
    
    if (applicationIndex !== -1) {
        db.formularios.applications[applicationIndex].status = status;
        db.formularios.applications[applicationIndex].processedAt = new Date().toISOString();
        if (messageUrl) {
            db.formularios.applications[applicationIndex].messageUrl = messageUrl;
        }
        if (processedBy) {
            db.formularios.applications[applicationIndex].processedBy = processedBy;
        }
        
        if (status === 'accepted') {
            db.formularios.accepted += 1;
        } else if (status === 'denied') {
            db.formularios.denied += 1;
        }
        
        await writeDatabase(db);
        return true;
    }
    
    if (applicationIndex === -1 && status === 'suspended') {
        db.formularios.applications.push({
            userId: userId,
            status: status,
            timestamp: new Date().toISOString(),
            formData: {},
            processedAt: new Date().toISOString(),
            messageUrl: messageUrl
        });
        
        db.formularios.total += 1;
        
        if (status === 'accepted') {
            db.formularios.accepted += 1;
        } else if (status === 'denied') {
            db.formularios.denied += 1;
        }
        
        await writeDatabase(db);
        return true;
    }
    
    return false;
}

async function updateFichaPJStatus(userId, status, messageUrl = null, processedBy = null) {
    const db = readDatabase();
    
    if (!db.fichaPJ) {
        db.fichaPJ = {
            total: 0,
            accepted: 0,
            denied: 0,
            applications: []
        };
    }
    
    let applicationIndex = db.fichaPJ.applications.findIndex(app => app.userId === userId && app.status === 'pending');
    
    if (applicationIndex !== -1) {
        db.fichaPJ.applications[applicationIndex].status = status;
        db.fichaPJ.applications[applicationIndex].processedAt = new Date().toISOString();
        if (messageUrl) {
            db.fichaPJ.applications[applicationIndex].messageUrl = messageUrl;
        }
        if (processedBy) {
            db.fichaPJ.applications[applicationIndex].processedBy = processedBy;
        }
        
        if (status === 'accepted') {
            db.fichaPJ.accepted += 1;
        } else if (status === 'denied') {
            db.fichaPJ.denied += 1;
        }
        
        await writeDatabase(db);
        return true;
    }
    
    if (applicationIndex === -1 && status === 'suspended') {
        db.fichaPJ.applications.push({
            userId: userId,
            status: 'pending',
            timestamp: new Date().toISOString(),
            suspensions: 0,
            messageUrl: messageUrl
        });
        db.fichaPJ.total += 1;
        applicationIndex = db.fichaPJ.applications.length - 1;
    }
    
    if (applicationIndex !== -1) {
        const previousStatus = db.fichaPJ.applications[applicationIndex].status;
        db.fichaPJ.applications[applicationIndex].status = status;
        db.fichaPJ.applications[applicationIndex].processedAt = new Date().toISOString();
        if (messageUrl) {
            db.fichaPJ.applications[applicationIndex].messageUrl = messageUrl;
        }
        if (processedBy) {
            db.fichaPJ.applications[applicationIndex].processedBy = processedBy;
        }
        
        if (status === 'suspended') {
            db.fichaPJ.applications[applicationIndex].suspensions = (db.fichaPJ.applications[applicationIndex].suspensions || 0) + 1;
            db.fichaPJ.suspended += 1;
        } else if (status === 'accepted' && previousStatus !== 'accepted') {
            db.fichaPJ.accepted += 1;
        } else if (status === 'denied' && previousStatus !== 'denied') {
            db.fichaPJ.denied += 1;
        }
        
        await writeDatabase(db);
        return true;
    }
    
    return false;
}

function getApplicationData(userId) {
    const db = readDatabase();
    
    if (!db.formularios || !db.formularios.applications) {
        return null;
    }
    
    const application = db.formularios.applications.find(app => app.userId === userId);
    return application || null;
}

function getFichaPJData(userId) {
    const db = readDatabase();
    
    if (!db.fichaPJ || !db.fichaPJ.applications) {
        return null;
    }
    
    const application = db.fichaPJ.applications.find(app => app.userId === userId);
    return application || null;
}

function getStats() {
    const db = readDatabase();
    const formularios = db.formularios || { total: 0, accepted: 0, denied: 0, applications: [] };
    const pending = formularios.applications.filter(app => app.status === 'pending').length;
    
    return {
        total: formularios.total,
        accepted: formularios.accepted,
        denied: formularios.denied,
        pending: pending,
        acceptanceRate: formularios.total > 0 ? ((formularios.accepted / formularios.total) * 100).toFixed(1) : '0.0',
        denialRate: formularios.total > 0 ? ((formularios.denied / formularios.total) * 100).toFixed(1) : '0.0'
    };
}

function getAllApplications() {
    const db = readDatabase();
    const formularios = db.formularios || { applications: [] };
    return formularios.applications;
}

function getApplicationsByStatus(status) {
    const db = readDatabase();
    const formularios = db.formularios || { applications: [] };
    return formularios.applications.filter(app => app.status === status);
}

function deleteApplication(userId) {
    const db = readDatabase();
    if (!db.formularios) db.formularios = { applications: [] };
    
    const initialLength = db.formularios.applications.length;
    
    db.formularios.applications = db.formularios.applications.filter(app => app.userId !== userId);
    
    if (db.formularios.applications.length < initialLength) {
        writeDatabase(db);
        return true;
    }
    
    return false;
}

function resetStats() {
    const initialData = {
        formularios: {
            total: 0,
            accepted: 0,
            denied: 0,
            applications: []
        },
        fichaPJ: {
            total: 0,
            accepted: 0,
            denied: 0,
            applications: []
        },
        interviewers: {}
    };
    writeDatabase(initialData);
}

function isFormularioSuspended(userId) {
    const db = readDatabase();
    
    if (!db.formularios || !db.formularios.applications) {
        return false;
    }
    
    const deniedApplications = db.formularios.applications.filter(app => app.userId === userId && app.status === 'denied');
    return deniedApplications.length >= 1;
}

function isFichaPJSuspended(userId) {
    const db = readDatabase();
    
    if (!db.fichaPJ || !db.fichaPJ.applications) {
        return false;
    }
    
    const deniedApplications = db.fichaPJ.applications.filter(app => app.userId === userId && app.status === 'denied');
    return deniedApplications.length >= 3;
}

function getFormularioStatus(userId) {
    const db = readDatabase();
    
    if (!db.formularios || !db.formularios.applications) {
        return 'none';
    }
    
    const acceptedApp = db.formularios.applications.find(app => app.userId === userId && app.status === 'accepted');
    const pendingApp = db.formularios.applications.find(app => app.userId === userId && app.status === 'pending');
    const deniedApp = db.formularios.applications.find(app => app.userId === userId && app.status === 'denied');
    
    if (acceptedApp) return 'accepted';
    if (pendingApp) return 'pending';
    if (deniedApp) return 'denied';
    if (isFormularioSuspended(userId)) return 'suspended';
    return 'none';
}

function getFichaPJStatus(userId) {
    const db = readDatabase();
    
    if (!db.fichaPJ || !db.fichaPJ.applications) {
        return 'none';
    }
    
    const acceptedApp = db.fichaPJ.applications.find(app => app.userId === userId && app.status === 'accepted');
    const pendingApp = db.fichaPJ.applications.find(app => app.userId === userId && app.status === 'pending');
    const deniedApp = db.fichaPJ.applications.find(app => app.userId === userId && app.status === 'denied');
    
    if (acceptedApp) return 'accepted';
    if (pendingApp) return 'pending';
    if (deniedApp) return 'denied';
    if (isFichaPJSuspended(userId)) return 'suspended';
    return 'none';
}

function getFichaPJSuspensions(userId) {
    const data = readDatabase();
    
    if (!data.fichaPJ || !data.fichaPJ.applications) {
        return 0;
    }
    
    const application = data.fichaPJ.applications.find(app => app.userId === userId);
    return application ? (application.suspensions || 0) : 0;
}

function getFormularioMessageUrl(userId) {
    const db = readDatabase();
    
    if (!db.formularios || !db.formularios.applications) {
        return null;
    }
    
    const application = db.formularios.applications.find(app => app.userId === userId);
    return application ? application.messageUrl : null;
}

function getFichaPJMessageUrl(userId) {
    const db = readDatabase();
    if (!db.fichaPJ || !db.fichaPJ.applications) return null;
    const application = db.fichaPJ.applications.find(app => app.userId === userId);
    return application ? application.messageUrl : null;
}

function getIncompleteApplications() {
    const db = readDatabase();
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const incompleteApps = [];
    
    if (db.formularios && db.formularios.applications) {
        db.formularios.applications.forEach(app => {
            if (app.status === 'accepted' && app.timestamp) {
                const appTime = new Date(app.timestamp).getTime();
                if (appTime < oneHourAgo) {
                    const fichaPJStatus = getFichaPJStatus(app.userId);
                    if (fichaPJStatus === 'none' || fichaPJStatus === 'pending') {
                        incompleteApps.push({
                            userId: app.userId,
                            type: 'formulario',
                            needsType: 'fichaPJ',
                            timestamp: app.timestamp
                        });
                    }
                }
            }
        });
    }
    
    if (db.fichaPJ && db.fichaPJ.applications) {
        db.fichaPJ.applications.forEach(app => {
            if (app.status === 'accepted' && app.timestamp) {
                const appTime = new Date(app.timestamp).getTime();
                if (appTime < oneHourAgo) {
                    const formularioStatus = getFormularioStatus(app.userId);
                    if (formularioStatus === 'none' || formularioStatus === 'pending') {
                        incompleteApps.push({
                            userId: app.userId,
                            type: 'fichaPJ',
                            needsType: 'formulario',
                            timestamp: app.timestamp
                        });
                    }
                }
            }
        });
    }
    
    return incompleteApps;
}

function markReminderSent(userId, type) {
    const db = readDatabase();
    
    if (type === 'formulario' && db.formularios && db.formularios.applications) {
        const app = db.formularios.applications.find(app => app.userId === userId);
        if (app) {
            app.reminderSent = true;
        }
    } else if (type === 'fichaPJ' && db.fichaPJ && db.fichaPJ.applications) {
        const app = db.fichaPJ.applications.find(app => app.userId === userId);
        if (app) {
            app.reminderSent = true;
        }
    }
    
    writeDatabase(db);
}

function tieneFormularioEnviado(userId) {
    const db = readDatabase();
    if (!db.formularios || !db.formularios.applications) {
        return false;
    }
    return db.formularios.applications.some(app => app.userId === userId);
}

function tieneFichaPJEnviada(userId) {
    const db = readDatabase();
    if (!db.fichaPJ || !db.fichaPJ.applications) {
        return false;
    }
    return db.fichaPJ.applications.some(app => app.userId === userId);
}

async function verificarYEnviarNotificacionUnificada(userId, interaction, razonFormulario = null, razonFichaPJ = null, esFormularioDenegado = false) {
    try {
        const data = readDatabase();
        
        const formularioData = data.formularios?.applications?.find(app => app.userId === userId);
        const fichaPJData = data.fichaPJ?.applications?.find(app => app.userId === userId);
        
        const formularioStatus = formularioData ? formularioData.status : null;
        const fichaPJStatus = fichaPJData ? fichaPJData.status : null;
        
        const formularioDenegado = formularioStatus === 'denied';
        const fichaPJDenegado = fichaPJStatus === 'denied';
        
        if (formularioDenegado && fichaPJDenegado) {
            const user = await interaction.client.users.fetch(userId);
            
            const container = new ContainerBuilder()
                .setStyle('SECONDARY')
                .setTitle('Notificación de Denegación')
                .setDescription(
                    `${interaction.client.emojiManager.getEmoji('error')} **Ambas solicitudes denegadas**\n\n` +
                    `Hola ${user.username}, lamentamos informarte que tanto tu formulario como tu ficha PJ han sido denegados.\n\n` +
                    `**Razones:**\n` +
                    `• **Formulario:** ${razonFormulario || 'No especificada'}\n` +
                    `• **Ficha PJ:** ${razonFichaPJ || 'No especificada'}\n\n` +
                    `Puedes volver a enviar ambas solicitudes después de revisar los requisitos.`
                );
            
            try {
                await user.send({ embeds: [container.toEmbed()] });
                console.log(`Notificación unificada enviada a ${user.tag}`);
            } catch (error) {
                console.error(`Error enviando notificación unificada a ${user.tag}:`, error);
            }
            
            return true;
        }
        
        return false;
        
    } catch (error) {
        console.error('Error en verificarYEnviarNotificacionUnificada:', error);
        return false;
    }
}

function getFormularioStats(userId) {
    try {
        const data = readDatabase();
        const fichaPJData = data.fichaPJ.applications.find(app => app.userId === userId);
        
        if (fichaPJData && fichaPJData.transcriptPath) {
            return {
                transcriptPath: fichaPJData.transcriptPath,
                status: fichaPJData.status,
                processedAt: fichaPJData.processedAt,
                staffId: fichaPJData.staffId
            };
        }
        
        return null;
    } catch (error) {
        console.error('Error en getFormularioStats:', error);
        return null;
    }
}

function updateInterviewerStats(interviewerId, type, action) {
    try {
        const data = readDatabase();
        
        if (!data || typeof data !== 'object') {
            console.error('Error: datos de base de datos inválidos');
            return false;
        }
        
        if (!data.interviewers) {
            data.interviewers = {};
        }
        
        if (!data.interviewers[interviewerId]) {
            data.interviewers[interviewerId] = {
                formularios: { total: 0, accepted: 0, denied: 0 },
                fichaPJ: { total: 0, accepted: 0, denied: 0 },
                totalGeneral: 0
            };
        }
        
        const interviewer = data.interviewers[interviewerId];
        
        if (!interviewer[type]) {
            interviewer[type] = { total: 0, accepted: 0, denied: 0 };
        }
        
        if (!interviewer[type].hasOwnProperty('total')) {
            interviewer[type].total = 0;
        }
        if (!interviewer[type].hasOwnProperty('accepted')) {
            interviewer[type].accepted = 0;
        }
        if (!interviewer[type].hasOwnProperty('denied')) {
            interviewer[type].denied = 0;
        }
        
        if (type === 'formulario' || type === 'fichaPJ') {
            interviewer[type].total++;
            if (action === 'accepted') {
                interviewer[type].accepted++;
            } else if (action === 'denied') {
                interviewer[type].denied++;
            }
            
            if (!interviewer.hasOwnProperty('totalGeneral')) {
                interviewer.totalGeneral = 0;
            }
            interviewer.totalGeneral++;
        }
        
        writeDatabase(data);
        return true;
    } catch (error) {
        console.error('Error actualizando stats de entrevistador:', error);
        return false;
    }
}

function getAllInterviewersStats() {
    try {
        const data = readDatabase();
        return data.interviewers || {};
    } catch (error) {
        console.error('Error obteniendo stats de entrevistadores:', error);
        return {};
    }
}

function getInterviewerStats(interviewerId) {
    try {
        const data = readDatabase();
        return data.interviewers?.[interviewerId] || null;
    } catch (error) {
        console.error('Error obteniendo stats de entrevistador específico:', error);
        return null;
    }
}

function getApplicationProcessedBy(userId) {
    const data = readDatabase();
    if (!data.formularios || !data.formularios.applications) {
        return null;
    }
    const application = data.formularios.applications.find(app => app.userId === userId);
    return application ? application.processedBy : null;
}

function getFichaPJProcessedBy(userId) {
    const data = readDatabase();
    if (!data.fichaPJ || !data.fichaPJ.applications) {
        return null;
    }
    const fichaPJ = data.fichaPJ.applications.find(app => app.userId === userId);
    return fichaPJ ? fichaPJ.processedBy : null;
}

async function addFichaPJTicket(userId, channelId) {
    try {
        const db = readDatabase();
        
        if (!db.fichaPJ) {
            db.fichaPJ = {
                total: 0,
                accepted: 0,
                denied: 0,
                applications: []
            };
        }
        
        const existingIndex = db.fichaPJ.applications.findIndex(app => app.userId === userId && app.status === 'pending');
        
        if (existingIndex !== -1) {
            db.fichaPJ.applications[existingIndex].channelId = channelId;
            db.fichaPJ.applications[existingIndex].timestamp = new Date().toISOString();
        } else {
            db.fichaPJ.applications.push({
                userId: userId,
                channelId: channelId,
                status: 'pending',
                timestamp: new Date().toISOString()
            });
            db.fichaPJ.total += 1;
        }
        
        await writeDatabase(db);
        
    } catch (error) {
        console.error('Error en addFichaPJTicket:', error);
        throw error;
    }
}

function getFichaPJChannelId(userId) {
    const db = readDatabase();
    
    if (!db.fichaPJ || !db.fichaPJ.applications) {
        return null;
    }
    
    const application = db.fichaPJ.applications.find(app => app.userId === userId && app.status === 'pending');
    return application ? application.channelId : null;
}

module.exports = {
    addApplication,
    addFichaPJApplication,
    addFichaPJTicket,
    updateApplicationStatus,
    updateFichaPJStatus,
    getApplicationData,
    getFichaPJData,
    getFichaPJChannelId,
    getStats,
    getAllApplications,
    getApplicationsByStatus,
    deleteApplication,
    resetStats,
    isFormularioSuspended,
    isFichaPJSuspended,
    getFormularioStatus,
    getFichaPJStatus,
    getFichaPJSuspensions,
    getFormularioMessageUrl,
    getFichaPJMessageUrl,
    getIncompleteApplications,
    markReminderSent,
    tieneFormularioEnviado,
    tieneFichaPJEnviada,
    verificarYEnviarNotificacionUnificada,
    getFormularioStats,
    updateInterviewerStats,
    getAllInterviewersStats,
    getInterviewerStats,
    getApplicationProcessedBy,
    getFichaPJProcessedBy,
    forceResetWriteState
};