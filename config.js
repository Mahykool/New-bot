import { watchFile, unwatchFile } from 'fs'
import chalk from 'chalk'
import { fileURLToPath, pathToFileURL } from 'url'
import fs from 'fs'
import * as cheerio from 'cheerio'
import fetch from 'node-fetch'
import axios from 'axios'
import moment from 'moment-timezone'
import { dirname } from 'path'

global.__dirname = (url) => dirname(fileURLToPath(url))

// ======================================================
// ✦ SW SYSTEM — GTA SAN ANDREAS EDITION
// ✦ CONFIGURACIÓN PRINCIPAL DEL BOT (ACTUALIZADO)
// ======================================================

// Utilidad local para normalizar JIDs en este archivo
function _ensureJid(raw) {
  if (!raw) return null
  raw = String(raw).trim()
  if (raw.includes('@')) return raw.split(':')[0]
  let cleaned = raw.replace(/[^\d+]/g, '')
  if (cleaned.startsWith('+')) cleaned = cleaned.slice(1)
  if (!cleaned) return null
  return `${cleaned}@s.whatsapp.net`
}

// ======================================================
// ✦ ROLES Y CONTACTOS GLOBALES (placeholders vacíos donde aplica)
// ======================================================

// Dueño raíz (máxima autoridad)
global.roowner = [
  _ensureJid('56969066865@s.whatsapp.net')
]

// Dueños y co-dueños
// Nota: la segunda entrada es un placeholder vacío (sin uso)
global.owner = [
  [_ensureJid('56969066865@s.whatsapp.net'), 'Mahykol 👑 Creador', true],
  [null, '', false]
]

// Moderadores
// Mantener vacío si no hay moderadores definidos
global.mods = []

// Suittag y prems
// Mantener vacíos si no hay valores reales
global.suittag = []
global.prems = []

// ======================================================
// ✦ INFORMACIÓN DEL BOT
// ======================================================
global.libreria = 'Baileys'
global.baileys = 'V 6.7.9'
global.languaje = 'Español'
global.vs = '4.3.1'
global.vsJB = '5.0'
global.nameqr = 'SwillQR'
global.namebot = 'Swill-IA'
global.sessions = 'Sessions/Principal'
global.jadi = 'Sessions/SubBot'
global.ItsukiJadibts = true
global.Choso = true
global.prefix = ['.', '!', '/', '#', '%']
global.apikey = 'SwillIA-Key'
global.botNumber = _ensureJid('56900000000')

// ======================================================
// ✦ BRANDING — SW SYSTEM
// ======================================================
global.packname = 'SWILL Stickers — GTA SA'
global.botname = '🤖 SW SYSTEM BOT'
global.wm = '© Mahykol — SW SYSTEM'
global.wm3 = '⫹⫺ Multi-Device'
global.author = '👑 Creado por Mahykol'
global.dev = '© Configurado por Mahykol'
global.textbot = 'SW SYSTEM v1'
global.etiqueta = '@Mahykol'
global.gt = '© SW SYSTEM — The Best WhatsApp IA'
global.me = 'SW SYSTEM — Update'
global.listo = '*Aquí tienes*'
global.moneda = 'SwillCoins'
global.multiplier = 69
global.maxwarn = 3
global.cheerio = cheerio
global.fs = fs
global.fetch = fetch
global.axios = axios
global.moment = moment

// ======================================================
// ✦ ENLACES OFICIALES — SW SYSTEM
// ======================================================
global.comunidad1 = 'https://chat.whatsapp.com/K02sv6Fm87fBQvlNKIGOQB'
global.gp1 = 'https://chat.whatsapp.com/C01CZDKL88uEFRZqlLxOdg?mode=wwt'

// Apis para las descargas y más
global.APIs = {
  ryzen: 'https://api.ryzendesu.vip',
  xteam: 'https://api.xteam.xyz',
  lol: 'https://api.lolhuman.xyz',
  delirius: 'https://delirius-apiofc.vercel.app',
  siputzx: 'https://api.siputzx.my.id',
  mayapi: 'https://mayapi.ooguy.com'
}

global.APIKeys = {
  'https://api.xteam.xyz': 'YOUR_XTEAM_KEY',
  'https://api.lolhuman.xyz': 'API_KEY',
  'https://api.betabotz.eu.org': 'API_KEY',
  'https://api.mayapi.ooguy.com': 'may-f53d1d49'
}

// Endpoints de IA
global.SIPUTZX_AI = {
  base: global.APIs?.siputzx || 'https://api.siputzx.my.id',
  bardPath: '/api/ai/bard',
  queryParam: 'query',
  headers: { accept: '*/*' }
}

// ======================================================
// ✦ CHAT DEFAULTS Y WHITELIST
// ======================================================
global.chatDefaults = {
  isBanned: false,
  sAutoresponder: '',
  welcome: false,
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
  per: [], // whitelist por chat; mantener como array de JIDs normalizados
  antitoxic: false
}

// Espacio opcional para overrides por chat en memoria
// Estructura esperada: global.chatDefaultsById = { '<chatId>': { ...chatDefaults } }
global.chatDefaultsById = global.chatDefaultsById || {}

// ======================================================
// ✦ UTILIDADES DE EMERGENCIA
// ======================================================
// Función auxiliar para obtener owners normalizados (útil para middleware)
global.getNormalizedOwners = function () {
  try {
    const raw = []
      .concat(global.roowner || [])
      .concat(global.owner || [])
      .flat()
      .map(o => {
        if (!o) return null
        if (Array.isArray(o)) return _ensureJid(o[0])
        if (typeof o === 'object' && o.jid) return _ensureJid(o.jid)
        return _ensureJid(o)
      })
      .filter(Boolean)
    return Array.from(new Set(raw))
  } catch {
    return []
  }
}

// Snippet de sincronización (pegar en el arranque si quieres sincronizar config -> user-roles.json)
global.syncOwnersToUserRolesSnippet = function (rolesLib) {
  try {
    const users = rolesLib.getUserRolesMap()
    const ownersFromConfig = []
      .concat(global.roowner || [])
      .concat(global.owner || [])
      .flat()
      .map(o => Array.isArray(o) ? o[0] : (o.jid || o))
      .filter(Boolean)
      .map(rolesLib.normalizeJid)

    for (const jid of ownersFromConfig) {
      users[jid] = users[jid] || []
      if (!users[jid].includes('creador')) users[jid].push('creador')
    }
    rolesLib.saveUserRolesMap(users)
  } catch (e) {
    console.warn('syncOwnersToUserRolesSnippet error', e?.message || e)
  }
}

// ======================================================
// ✦ WATCH CONFIG
// ======================================================
let file = fileURLToPath(import.meta.url)
watchFile(file, () => {
  unwatchFile(file)
  console.log(chalk.redBright("Update 'config.js'"))
  try { import(pathToFileURL(file).href + `?update=${Date.now()}`) } catch {}
})

// Configuraciones finales exportadas
export default {
  prefix: global.prefix,
  owner: global.owner,
  roowner: global.roowner,
  mods: global.mods,
  suittag: global.suittag,
  prems: global.prems,
  sessionDirName: global.sessions,
  sessionName: global.sessions,
  botNumber: global.botNumber,
  chatDefaults: global.chatDefaults
}
