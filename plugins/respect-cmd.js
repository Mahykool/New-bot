// plugins/respect-cmd.js
import fs from 'fs'
import path from 'path'
import { normalizeJid } from '../lib/lib-roles.js' // si no existe, puedes comentar o implementar simple normalize

const DB_DIR = path.join(process.cwd(), 'database')
const pathRespect = path.join(DB_DIR, 'respect.json')

// Asegurar carpeta y archivo
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true })
if (!fs.existsSync(pathRespect)) fs.writeFileSync(pathRespect, JSON.stringify({}, null, 2), 'utf8')

// Cargar DB con manejo de errores
let respectDB = {}
try {
  const raw = fs.readFileSync(pathRespect, 'utf8')
  respectDB = raw.trim() ? JSON.parse(raw) : {}
} catch (e) {
  console.warn('respect-cmd: fallo leyendo respect.json, se crea DB vacía', e?.message || e)
  respectDB = {}
  try { fs.writeFileSync(pathRespect, JSON.stringify(respectDB, null, 2), 'utf8') } catch {}
}

function saveRespectDB() {
  try {
    fs.writeFileSync(pathRespect, JSON.stringify(respectDB, null, 2), 'utf8')
  } catch (e) {
    console.error('respect-cmd: fallo guardando respect.json', e)
  }
}

// Obtener rango según RESPECT
function getRespectRank(points = 0) {
  if (points >= 2000) return 'Big Smoke Tier'
  if (points >= 800) return 'Grove Street Legend'
  if (points >= 300) return 'OG'
  if (points >= 100) return 'Gangsta'
  return 'Busta'
}

// Verificar si es creador (usa global.owner si existe)
function isOwner(m) {
  if (!m || !m.sender) return false
  // normalizar sender
  const sender = typeof normalizeJid === 'function' ? normalizeJid(m.sender) : String(m.sender)
  if (global.owner) {
    const owners = Array.isArray(global.owner) ? global.owner.flat() : [global.owner]
    return owners.some(v => {
      if (!v) return false
      const id = typeof v === 'string' ? v : (Array.isArray(v) ? v[0] : String(v))
      const ownerJid = typeof normalizeJid === 'function' ? normalizeJid(id) : String(id)
      return ownerJid && sender && sender === ownerJid
    })
  }
  // fallback: número local (ejemplo Chile +56)
  return sender && sender.startsWith('56')
}

// Helper para asegurar estructura de usuario en DB
function ensureUserEntry(jid) {
  if (!jid) return
  if (!respectDB[jid]) {
    respectDB[jid] = {
      respect: 0,
      robCount: 0,
      windowStart: 0,
      totalRobs: 0,
      punishLevel: 0
    }
  }
}

// Handler principal
const handler = async (m, { conn, command = '', args = [], usedPrefix = '/' }) => {
  const cmd = (command || '').toLowerCase()
  const user = typeof normalizeJid === 'function' ? normalizeJid(m.sender) : String(m.sender)

  ensureUserEntry(user)
  const data = respectDB[user]

  // mirespect
  if (cmd === 'mirespect') {
    const robosDisponibles = Math.max(0, 3 - (data.robCount || 0))
    return (conn && typeof conn.reply === 'function')
      ? conn.reply(m.chat, `✦ *Tu RESPECT — SW SYSTEM*\n\n✦ RESPECT: *${data.respect}*\n✦ Robos disponibles: *${robosDisponibles}*\n✦ Robos realizados: *${data.totalRobs || 0}*`, m)
      : null
  }

  // respectrango
  if (cmd === 'respectrango') {
    const rango = getRespectRank(data.respect)
    return (conn && typeof conn.reply === 'function')
      ? conn.reply(m.chat,
        `✦ *Tu Rango — SW SYSTEM*\n\n✦ RESPECT: *${data.respect}*\n✦ Rango actual: *${rango}*\n\n▸ 0–99 → Busta\n▸ 100–299 → Gangsta\n▸ 300–799 → OG\n▸ 800–1999 → Grove Street Legend\n▸ 2000+ → Big Smoke Tier`, m)
      : null
  }

  // respectinfo
  if (cmd === 'respectinfo') {
    return (conn && typeof conn.reply === 'function')
      ? conn.reply(m.chat,
        `✦ *Sistema RESPECT — SW SYSTEM*\n\n✦ Cada robo de sticker dentro del límite suma *+5 RESPECT*.\n✦ Máximo *3 robos* por ventana de *5 minutos*.\n✦ Después del 3° robo, cada robo extra aplica un *castigo progresivo*:\n   • 1° exceso: -5 RESPECT\n   • 2° exceso: -10 RESPECT\n   • 3° exceso: -20 RESPECT\n   • 4° exceso: -40 RESPECT\n\n✦ Pasados 5 minutos desde el 3er robo, la ventana se reinicia.\n✦ Tus puntos se guardan y no se pierden al reiniciar el bot.\n\n✦ Rangos:\n   • 0–99 → Busta\n   • 100–299 → Gangsta\n   • 300–799 → OG\n   • 800–1999 → Grove Street Legend\n   • 2000+ → Big Smoke Tier`, m)
      : null
  }

  // comandos solo creador
  if (['respectreset', 'respectgive', 'respecttake', 'respectset', 'respecttop'].includes(cmd)) {
    if (!isOwner(m)) {
      return (conn && typeof conn.reply === 'function')
        ? conn.reply(m.chat, '> Este comando solo puede usarlo el *Creador del bot*.', m)
        : null
    }
  }

  // respectreset
  if (cmd === 'respectreset') {
    const target = (m.mentionedJid && m.mentionedJid[0]) || null
    const arg = (args[0] || '').toLowerCase()

    if (arg === 'all') {
      Object.keys(respectDB).forEach(jid => {
        respectDB[jid].respect = 0
        respectDB[jid].totalRobs = 0
        respectDB[jid].robCount = 0
        respectDB[jid].punishLevel = 0
      })
      saveRespectDB()
      return conn.reply(m.chat, '✦ Todos los registros de RESPECT han sido *reiniciados*.', m)
    }

    if (!target) {
      return conn.reply(m.chat,
        `✦ Usa:\n• *${usedPrefix}respectreset @usuario* → resetear 1 usuario\n• *${usedPrefix}respectreset all* → resetear todos`, m)
    }

    const t = typeof normalizeJid === 'function' ? normalizeJid(target) : target
    ensureUserEntry(t)
    respectDB[t].respect = 0
    respectDB[t].totalRobs = 0
    respectDB[t].robCount = 0
    respectDB[t].punishLevel = 0
    saveRespectDB()
    return conn.reply(m.chat, `✦ RESPECT de *@${t.split('@')[0]}* ha sido *reiniciado*.`, m, { mentions: [t] })
  }

  // respectgive / respecttake / respectset
  if (['respectgive', 'respecttake', 'respectset'].includes(cmd)) {
    const target = (m.mentionedJid && m.mentionedJid[0]) || null
    const amount = parseInt(args[1])
    if (!target || isNaN(amount)) {
      return conn.reply(m.chat,
        `✦ Uso correcto:\n• *${usedPrefix}respectgive @usuario 50*\n• *${usedPrefix}respecttake @usuario 20*\n• *${usedPrefix}respectset @usuario 150*`, m)
    }

    const t = typeof normalizeJid === 'function' ? normalizeJid(target) : target
    ensureUserEntry(t)

    if (cmd === 'respectgive') {
      respectDB[t].respect += amount
    } else if (cmd === 'respecttake') {
      respectDB[t].respect -= amount
      if (respectDB[t].respect < 0) respectDB[t].respect = 0
    } else if (cmd === 'respectset') {
      respectDB[t].respect = amount
    }

    saveRespectDB()
    const rango = getRespectRank(respectDB[t].respect)
    return conn.reply(m.chat,
      `✦ RESPECT actualizado para *@${t.split('@')[0]}*\n\n✦ RESPECT: *${respectDB[t].respect}*\n✦ Rango: *${rango}*`, m, { mentions: [t] })
  }

  // respecttop
  if (cmd === 'respecttop') {
    const entries = Object.entries(respectDB)
      .filter(([jid, info]) => typeof info.respect === 'number')
      .sort((a, b) => b[1].respect - a[1].respect)
      .slice(0, 10)

    if (!entries.length) return conn.reply(m.chat, '✦ No hay datos de RESPECT aún.', m)

    let texto = '✦ *TOP 10 RESPECT — SW SYSTEM*\n\n'
    let pos = 1
    for (const [jid, info] of entries) {
      const rango = getRespectRank(info.respect)
      const tag = '@' + jid.split('@')[0]
      texto += `${pos}) ${tag} — *${info.respect}* RESPECT (${rango})\n`
      pos++
    }

    return conn.reply(m.chat, texto, m, { mentions: entries.map(([jid]) => jid) })
  }
}

handler.help = [
  'mirespect',
  'respecttop',
  'respectreset',
  'respectinfo',
  'respectgive',
  'respecttake',
  'respectset',
  'respectrango'
]

handler.tags = ['respect', 'tools']

handler.command = [
  'mirespect',
  'respecttop',
  'respectreset',
  'respectinfo',
  'respectgive',
  'respecttake',
  'respectset',
  'respectrango'
]

export default handler
