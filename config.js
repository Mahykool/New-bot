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
// ✦ CONFIGURACIÓN PRINCIPAL DEL BOT
// ======================================================

// Dueño raíz (máxima autoridad)
global.roowner = ['56969066865@s.whatsapp.net']

// Dueños y co-dueños
global.owner = [
  ['56969066865@s.whatsapp.net', 'Mahykol 👑 Creador', true],
  ['569XXXXXXXX@s.whatsapp.net', 'Co-Dueño', true]
]

// Moderadores
global.mods = [
  '569XXXXXXXX@s.whatsapp.net'
]

// Suittag y prems
global.suittag = [
  '569XXXXXXXX@s.whatsapp.net'
]
global.prems = [
  '569XXXXXXXX@s.whatsapp.net'
]

// Número del bot
global.botNumber = '56900000000'

// ======================================================
// ✦ INFORMACIÓN DEL BOT
// ======================================================
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

// ======================================================
// ✦ ECONOMÍA Y LÍMITES
// ======================================================
global.moneda = 'SwillCoins'
global.multiplier = 69
global.maxwarn = 3

// ======================================================
// ✦ LIBRERÍAS GLOBALES
// ======================================================
global.cheerio = cheerio
global.fs = fs
global.fetch = fetch
global.axios = axios
global.moment = moment

// ======================================================
// ✦ ENLACES OFICIALES
// ======================================================
global.comunidad1 = 'https://chat.whatsapp.com/K02sv6Fm87fBQvlNKIGOQB'
global.gp1 = 'https://chat.whatsapp.com/C01CZDKL88uEFRZqlLxOdg?mode=wwt'
global.comunidad2 = ''
global.comunidad3 = ''
global.gp2 = ''
global.gp3 = ''
global.channel = ''
global.channel2 = ''
global.md = ''
global.correo = ''

// ======================================================
// ✦ APIs
// ======================================================
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

// ======================================================
// ✦ ENDPOINTS IA
// ======================================================
global.SIPUTZX_AI = {
  base: global.APIs?.siputzx || 'https://api.siputzx.my.id',
  bardPath: '/api/ai/bard',
  queryParam: 'query',
  headers: { accept: '*/*' }
}

// ======================================================
// ✦ CONFIGURACIÓN POR DEFECTO DE CHATS
// ======================================================
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

// ======================================================
// ✦ WATCHER (AUTO-RELOAD)
// ======================================================
let file = fileURLToPath(import.meta.url)
watchFile(file, () => {
  unwatchFile(file)
  console.log(chalk.redBright("Update 'config.js'"))
  try { import(pathToFileURL(file).href + `?update=${Date.now()}`) } catch {}
})

// ======================================================
// ✦ EXPORT FINAL
// ======================================================
export default {
  prefix: global.prefix,
  owner: global.owner,
  sessionDirName: global.sessions,
  sessionName: global.sessions,
  botNumber: global.botNumber,
  chatDefaults: global.chatDefaults
}
