const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database', 'encuestas.json');

function ensureDatabase() {
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
    
    if (!fs.existsSync(dbPath)) {
        const initialData = {
            encuestas: []
        };
        fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2));
    }
}

function readDatabase() {
    ensureDatabase();
    try {
        const data = fs.readFileSync(dbPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error leyendo base de datos de encuestas:', error);
        return {
            encuestas: []
        };
    }
}

function writeDatabase(data) {
    try {
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error escribiendo base de datos de encuestas:', error);
    }
}

function crearEncuesta(encuestaData) {
    const db = readDatabase();
    const encuestaId = Date.now().toString();
    
    const nuevaEncuesta = {
        id: encuestaId,
        titulo: encuestaData.titulo,
        tipo: encuestaData.tipo,
        opciones: encuestaData.opciones || [],
        votos: {},
        estado: 'activa',
        creadaPor: encuestaData.creadaPor,
        fechaCreacion: new Date().toISOString(),
        canalId: encuestaData.canalId,
        mensajeId: null
    };
    
    db.encuestas.push(nuevaEncuesta);
    writeDatabase(db);
    return encuestaId;
}

function obtenerEncuesta(encuestaId) {
    const db = readDatabase();
    return db.encuestas.find(encuesta => encuesta.id === encuestaId);
}

function actualizarMensajeId(encuestaId, mensajeId) {
    const db = readDatabase();
    const encuestaIndex = db.encuestas.findIndex(encuesta => encuesta.id === encuestaId);
    
    if (encuestaIndex !== -1) {
        db.encuestas[encuestaIndex].mensajeId = mensajeId;
        writeDatabase(db);
        return true;
    }
    return false;
}

function registrarVoto(encuestaId, userId, opcion) {
    const db = readDatabase();
    const encuestaIndex = db.encuestas.findIndex(encuesta => encuesta.id === encuestaId && encuesta.estado === 'activa');
    
    if (encuestaIndex !== -1) {
        if (!db.encuestas[encuestaIndex].votos[userId]) {
            db.encuestas[encuestaIndex].votos[userId] = opcion;
            writeDatabase(db);
            return true;
        }
    }
    return false;
}

function cerrarEncuesta(encuestaId) {
    const db = readDatabase();
    const encuestaIndex = db.encuestas.findIndex(encuesta => encuesta.id === encuestaId);
    
    if (encuestaIndex !== -1) {
        db.encuestas[encuestaIndex].estado = 'cerrada';
        db.encuestas[encuestaIndex].fechaCierre = new Date().toISOString();
        writeDatabase(db);
        return db.encuestas[encuestaIndex];
    }
    return null;
}

function obtenerResultados(encuestaId) {
    const encuesta = obtenerEncuesta(encuestaId);
    if (!encuesta) return null;
    
    const resultados = {};
    const totalVotos = Object.keys(encuesta.votos).length;
    
    if (encuesta.tipo === 'si_no') {
        resultados.si = Object.values(encuesta.votos).filter(voto => voto === 'si').length;
        resultados.no = Object.values(encuesta.votos).filter(voto => voto === 'no').length;
    } else if (encuesta.tipo === 'multiple') {
        encuesta.opciones.forEach((opcion, index) => {
            const opcionIndex = (index + 1).toString();
            resultados[opcionIndex] = Object.values(encuesta.votos).filter(voto => voto === opcionIndex).length;
        });
    }
    
    return {
        resultados,
        totalVotos,
        encuesta
    };
}

function obtenerEncuestasActivas() {
    const db = readDatabase();
    return db.encuestas.filter(encuesta => encuesta.estado === 'activa');
}

module.exports = {
    crearEncuesta,
    obtenerEncuesta,
    actualizarMensajeId,
    registrarVoto,
    cerrarEncuesta,
    obtenerResultados,
    obtenerEncuestasActivas
};