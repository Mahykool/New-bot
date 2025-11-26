import { watchFile, unwatchFile } from 'fs'
import chalk from 'chalk'
import { fileURLToPath, pathToFileURL } from 'url'
import fs from 'fs'
import * as cheerio from 'cheerio'
import fetch from 'node-fetch'
import axios from 'axios'
import moment from 'moment-timezone'
import { dirname } from 'path'

global.__dirname = (url) => dirname(fileURLToPath(url));

// =======================
// Configuraciones principales
// =======================

// Dueño raíz (máxima autoridad) — usar solo números sin @s.whatsapp.net
global.roowner = ['56969066865'] // agrega aquí los números que pueden dar/quitar mods

// Lista de co-dueños (formato: [ ['56912345678', 'Nombre', true], ... ])
global.owner = [
  ['56969066865', 'Mahykol 👑 Creador', true],
  ['569XXXXXXXX', 'Co-Dueño', true]
]

// NOTA: La gestión de roles (roowner, owners, mods, suittag, prems) se centraliza
// en src/database/roles.json y src/database/mods.json mediante lib-roles.js y lib/mods-utils.js.
// Para compatibilidad con plugins antiguos, al arrancar sincronizamos global.* desde lib-roles.

// Bot number y demás
global.botNumber = '56900000000' // ← Cambiar este número según el que conecte el bot

// Información del bot 
global.libreria = 'Baileys'
global.baileys = 'V 6.7.9'
global.languaje = 'Español'
global.vs = '1.0.0'
global.vsJB = '1.0'
global.nameqr = 'SwillQR'
global.namebot = 'Swill-IA'
global.sessions = 'Swill-sessions'
global.jadi = 'jadibts'
global.SwillJadibts = true
global.Choso = true
global.prefix = ['.', '!', '/', '#', '%']
global.apikey = 'SwillIA-Key'

// Branding y créditos
global.packname = 'Swill Stickers 🌙'
global.botname = '🤖 Swill IA Bot'
global.wm = '© Mahykol'
global.wm3 = '⫹⫺ 𝙈𝙪𝙡𝙩𝙞-𝘿𝙚𝙫𝙞𝙘𝙚 💻'
global.author = '👑 Creado por Mahykol'
global.dev = '© Configurado por Mahykol'
global.textbot = 'Swill v1'
global.etiqueta = '@Mahykol'
global.gt = '© Swill Bot | The Best WhatsApp IA 🤖'
global.me = '🌙 Swill IA Update'
global.listo = '*Aquí tienes*'

// Economía y límites
global.moneda = 'SwillCoins'
global.multiplier = 69
global.maxwarn = 3

global.cheerio = cheerio
global.fs = fs
global.fetch = fetch
global.axios = axios
global.moment = moment

// Enlaces oficiales de Swill
global.comunidad1 = 'https://chat.whatsapp.com/K02sv6Fm87fBQvlNKIGOQB'
global.gp1 = 'https://chat.whatsapp.com/C01CZDKL88uEFRZqlLxOdg?mode=wwt'

// Espacios reservados
global.comunidad2 = ''
global.comunidad3 = ''
global.gp2 = ''
global.gp3 = ''
global.channel = ''
global.channel2 = ''
global.md = ''
global.correo = ''

// APIs oficiales de Swill
global.APIs = {
  ryzen: 'https://api.ryzendesu.vip',
  xteam: 'https://api.xteam.xyz',
  lol: 'https://api.lolhuman.xyz',
  delirius: 'https://delirius-apiofc.vercel.app',
  siputzx: 'https://api.siputzx.my.id',
  mayapi: 'https://mayapi.ooguy.com',
  swillapi: ''
}

global.APIKeys = {
  'https://api.xteam.xyz': 'YOUR_XTEAM_KEY',
  'https://api.lolhuman.xyz': 'API_KEY',
  'https://api.betabotz.eu.org': 'API_KEY',
  'https://mayapi.ooguy.com': 'may-f53d1d49',
  'https://api.swill.com': ''
}

// Endpoints de IA
global.SIPUTZX_AI = {
  base: global.APIs?.siputzx || 'https://api.siputzx.my.id',
  bardPath: '/api/ai/bard',
  queryParam: 'query',
  headers: { accept: '*/*' }
}

global.chatDefaults = {
  isBanned: false,
  sAutoresponder: '',
  welcome: true,
  autolevelup: false,
  autoAceptar: false,
  autosticker: false,
  autoRechazar: false,
  autoresponder: false,
  detect: true,
  antiBot: false,
  antiBot2: false,
  modoadmin: false,
  antiLink: true,
  antiImg: false,
  reaction: false,
  nsfw: false,
  antifake: false,
  delete: false,
  expired: 0,
  antiLag: false,
  per: [],
  antitoxic: false
}

// -----------------------------
// Shim de compatibilidad (sincroniza global.* desde lib-roles)
// -----------------------------
;(async () => {
  try {
    // intenta importar la librería central de roles (lib-roles.js)
    // ajusta la ruta si tu estructura es distinta (ej: './lib/lib-roles.js')
    const rolesLib = await import('./lib/lib-roles.js')
    // listRole devuelve arrays; hasRole/addRole/removeRole también disponibles
    const { listRole } = rolesLib

    // sincroniza globals para compatibilidad con plugins antiguos
    // convierto a formato esperado por plugins (JID completos para suittag/prems/mods)
    const mods = listRole('mods') || []
    const suittag = listRole('suittag') || []
    const prems = listRole('prems') || []
    const roowners = listRole('roowner') || []
    const owners = listRole('owners') || []

    // asignaciones seguras
    global.mods = Array.isArray(mods) ? mods : []
    global.suittag = Array.isArray(suittag) ? suittag : []
    global.prems = Array.isArray(prems) ? prems : []
    // roowner/owner en config.js siguen siendo seeds; aquí los sincronizamos si roles.json tiene valores
    if (Array.isArray(roowners) && roowners.length) global.roowner = roowners.map(r => String(r).replace(/@s\.whatsapp\.net/g, ''))
    if (Array.isArray(owners) && owners.length) global.owner = owners.map(o => Array.isArray(o) ? [String(o[0]).replace(/@s\.whatsapp\.net/g, ''), o[1] || '', !!o[2]] : [String(o).replace(/@s\.whatsapp\.net/g, ''), '', false])
  } catch (e) {
    // si falla la sincronización no interrumpe el arranque; los plugins nuevos usan lib-roles directamente
    console.error('Roles shim sync failed:', e)
  }
})()

let file = fileURLToPath(import.meta.url)
watchFile(file, () => {
  unwatchFile(file)
  console.log(chalk.redBright("Update 'config.js'"))
  try { import(pathToFileURL(file).href + `?update=${Date.now()}`) } catch {}
})

// Configuraciones finales
export default {
  prefix: global.prefix,
  owner: global.owner,
  sessionDirName: global.sessions,
  sessionName: global.sessions,
  botNumber: global.botNumber,
  chatDefaults: global.chatDefaults
}
