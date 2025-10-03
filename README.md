# 🎮 GTA Stories Bot

<div align="center">

![Discord](https://img.shields.io/badge/Discord-7289DA?style=for-the-badge&logo=discord&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![FiveM](https://img.shields.io/badge/FiveM-F40552?style=for-the-badge&logo=fivem&logoColor=white)

**Bot de Discord avanzado para la gestión completa de servidores de GTA Stories**

[📋 Características](#-características) • [🚀 Instalación](#-instalación) • [⚙️ Configuración](#️-configuración) • [📖 Comandos](#-comandos)

</div>

---

## 📝 Descripción

**GTA Stories Bot** es un sistema completo de gestión para servidores de Discord especializados en roleplay de FiveM. Diseñado específicamente para **GTA Stories**, este bot automatiza procesos críticos como la whitelist, gestión de fichas de personajes, sistema de encuestas y estadísticas detalladas de staff.

## ✨ Características

### 🔐 Sistema de Whitelist
- **Formularios automatizados** para solicitudes de ingreso
- **Proceso de revisión** con staff especializado
- **Transcripts automáticos** de todas las entrevistas
- **Sistema de recordatorios** para solicitudes pendientes

### 👤 Gestión de Fichas PJ
- **Creación y revisión** de fichas de personajes
- **Sistema de aprobación** por niveles
- **Almacenamiento seguro** de datos de personajes
- **Historial completo** de modificaciones

### 📊 Sistema de Encuestas
- **Creación dinámica** de encuestas personalizadas
- **Gestión completa** del ciclo de vida de encuestas
- **Resultados en tiempo real** con estadísticas detalladas
- **Cierre automático** programable

### 🎫 Invitaciones VIP
- **Sistema de invitaciones** exclusivo para miembros VIP
- **Tracking completo** de invitados por VIP
- **Gestión de cupos** y límites personalizables
- **Historial de invitaciones** detallado

### 📈 Estadísticas Avanzadas
- **Métricas de entrevistadores** individuales y globales
- **Estadísticas de formularios** en tiempo real
- **Reportes detallados** de actividad del servidor
- **Dashboard interactivo** para administradores

## 🚀 Instalación

### Prerrequisitos
- **Node.js** v16.0.0 o superior
- **npm** o **yarn**
- **Servidor de Discord** con permisos de administrador

### Pasos de instalación

1. **Clona el repositorio**
```bash
git clone https://github.com/tu-usuario/gta-stories-bot.git
cd gta-stories-bot
```

2. **Instala las dependencias**
```bash
npm install
```

3. **Configura el bot**
```bash
cp config.json.example config.json
```

4. **Despliega los comandos**
```bash
npm run deploy
```

5. **Inicia el bot**
```bash
npm start
```

## ⚙️ Configuración

### Archivo config.json

```json
{
  "bot": {
    "token": "TU_BOT_TOKEN",
    "clientId": "TU_CLIENT_ID",
    "guildId": "TU_GUILD_ID"
  },
  "canales": {
    "FormChannelId": "ID_CANAL_FORMULARIOS",
    "resultsChannelId": "ID_CANAL_RESULTADOS",
    "fichasLogsChannelId": "ID_CANAL_LOGS_FICHAS",
    "ticketsCategoryId": "ID_CATEGORIA_TICKETS"
  },
  "rolesAprobacion": {
    "formularioRoleId": "ID_ROL_FORMULARIO_APROBADO",
    "FichaPjRoleid": "ID_ROL_FICHA_APROBADA"
  },
  "rolesStaff": {
    "entrevistadorRoleId": "ID_ROL_ENTREVISTADOR",
    "staffRoleId": "ID_ROL_STAFF"
  },
  "rolesEspeciales": {
    "vipRoleId": "ID_ROL_VIP",
    "invitadoRoleId": "ID_ROL_INVITADO"
  }
}
```

### Variables importantes

| Variable | Descripción | Requerido |
|----------|-------------|-----------|
| `bot.token` | Token del bot de Discord | ✅ |
| `bot.clientId` | ID de la aplicación del bot | ✅ |
| `bot.guildId` | ID del servidor de Discord | ✅ |
| `canales.*` | IDs de canales específicos | ✅ |
| `roles*.*` | IDs de roles del servidor | ✅ |

## 📖 Comandos

### 🔐 Gestión de Formularios

| Comando | Descripción | Permisos |
|---------|-------------|----------|
| `/formulario` | Inicia el proceso de solicitud de whitelist | Todos |
| `/verformularios <usuario> <tipo>` | Consulta formularios de un usuario específico | Staff |
| `/viewstats` | Muestra estadísticas generales del sistema | Staff |

### 👤 Fichas de Personajes

| Comando | Descripción | Permisos |
|---------|-------------|----------|
| `/verformularios <usuario> ficha` | Consulta ficha PJ de un usuario | Staff |
| `/entrevstats [entrevistador]` | Estadísticas de entrevistadores | Staff |

### 📊 Sistema de Encuestas

| Comando | Descripción | Permisos |
|---------|-------------|----------|
| `/encuesta` | Crea una nueva encuesta personalizada | Staff |
| `/cerrarencuesta <id>` | Cierra una encuesta activa | Staff |

### 🎫 Invitaciones VIP

| Comando | Descripción | Permisos |
|---------|-------------|----------|
| `/invitacion` | Gestiona invitaciones VIP | VIP |
| `/verinvitaciones <tipo>` | Consulta historial de invitaciones | Staff |

### 🛠️ Utilidades

| Comando | Descripción | Permisos |
|---------|-------------|----------|
| `/say <mensaje>` | Envía un mensaje como el bot | Staff |
| `/clear <cantidad>` | Elimina mensajes del canal | Staff |

## 🏗️ Estructura del Proyecto

```
GtaStories/
├── 📁 commands/           # Comandos slash del bot
│   ├── 📄 formulario.js   # Sistema de whitelist
│   ├── 📄 encuesta.js     # Gestión de encuestas
│   ├── 📄 invitacion.js   # Sistema VIP
│   └── 📄 ...
├── 📁 events/             # Eventos de Discord
│   └── 📄 interactionCreate.js
├── 📁 utils/              # Utilidades y helpers
│   ├── 📄 database.js     # Gestión de datos
│   ├── 📄 emojiManager.js # Gestión de emojis
│   ├── 📄 reminderSystem.js # Sistema de recordatorios
│   └── 📄 ...
├── 📁 database/           # Base de datos JSON
├── 📁 emojis/            # Emojis personalizados
├── 📁 transcripts/       # Transcripts de tickets
├── 📄 index.js           # Archivo principal
├── 📄 config.json        # Configuración
└── 📄 package.json       # Dependencias
```

## 🔧 Tecnologías Utilizadas

- **[Discord.js v14](https://discord.js.org/)** - Librería principal para Discord
- **[Node.js](https://nodejs.org/)** - Runtime de JavaScript
- **[discord-html-transcripts](https://www.npmjs.com/package/discord-html-transcripts)** - Generación de transcripts

## 🎯 Características Técnicas

### 🔄 Sistema de Recordatorios
- Verificación automática cada 60 segundos
- Recordatorios para formularios incompletos
- Gestión inteligente de usuarios invitados

### 💾 Base de Datos
- Sistema de archivos JSON para persistencia
- Backup automático de datos críticos
- Estructura optimizada para consultas rápidas

### 🎨 Interfaz de Usuario
- Componentes interactivos modernos
- Emojis personalizados para mejor UX
- Mensajes embebidos con formato profesional

### 📊 Sistema de Estadísticas
- Métricas en tiempo real
- Historial detallado de actividades
- Reportes exportables

## 🤝 Contribución

¡Las contribuciones son bienvenidas! Para contribuir:

1. **Fork** el proyecto
2. Crea una **rama** para tu feature (`git checkout -b feature/AmazingFeature`)
3. **Commit** tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. **Push** a la rama (`git push origin feature/AmazingFeature`)
5. Abre un **Pull Request**

## 📋 Roadmap

- [ ] 🔐 Sistema de autenticación OAuth2
- [ ] 📱 Dashboard web administrativo
- [ ] 🔔 Notificaciones push
- [ ] 📊 Métricas avanzadas con gráficos
- [ ] 🌐 Soporte multi-idioma
- [ ] 🔄 Integración con APIs externas

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

---

<div align="center">

**Desarrollado con ❤️ para la comunidad de GTA Stories**

[🔗 Discord](https://discord.gg/Mja2bY6n) •

</div>