// plugins/respect-cmd.js
// Comandos para consultar y administrar RESPECT
// Usa lib/db-respect.js para persistencia atómica

import path from 'path'
import fs from 'fs'
import { normalizeJid } from '../lib/lib-roles.js' // si no existe, el fallback usa el string crudo
import {
  loadRespectDB,
  saveRespectDB,
  ensureUserEntry
} from '../lib/db-respect.js'
import { parseTarget } from '../lib/utils.js' // <-- import del helper central

const DB_PATH = path.join(process.cwd(), 'database', 'respect.json')

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
  const sender = (typeof normalizeJid === 'function') ? normalizeJid(m.sender) : String(m.sender)
  if (global.owner) {
    const owners = Array.isArray(global.owner) ? global.owner.flat() : [global.owner]
    return owners.some(v => {
      if (!v) return false
      const id = typeof v === 'string' ? v : (Array.isArray(v) ? v[0] : String(v))
      const ownerJid = (typeof normalizeJid === 'function') ? normalizeJid(id) : String(id)
      return ownerJid && sender && sender === ownerJid
    })
  }
  return sender && sender.startsWith('56') // fallback local
}

const handler = async (m, { conn, command = '', args = [], usedPrefix = '/' }) => {
  const cmd = (command || '').toLowerCase()
  const userJid = (typeof normalizeJid === 'function') ? normalizeJid(m.sender) : String(m.sender)

  const db = loadRespectDB()
  ensureUserEntry(db, userJid)
  const data = db[userJid]

  if (cmd === 'mirespect') {
    const robosDisponibles = Math.max(0, 3 - (data.robCount || 0))
    return conn.reply ? conn.reply(m.chat, `✦ Tu RESPECT — SW SYSTEM\n\n✦ RESPECT: *${data.respect}*\n✦ Robos disponibles: *${robosDisponibles}*\n✦ Robos realizados: *${data.totalRobs || 0}*`, m) : null
  }

  if (cmd === 'respectrango') {
    const rango = getRespectRank(data.respect)
    return conn.reply ? conn.reply(m.chat,
      `✦ Tu Rango — SW SYSTEM\n\n✦ RESPECT: *${data.respect}*\n✦ Rango actual: *${rango}*\n\n▸ 0–99 → Busta\n▸ 100–299 → Gangsta\n▸ 300–799 → OG\n▸ 800–1999 → Grove Street Legend\n▸ 2000+ → Big Smoke Tier`, m) : null
  }

  if (cmd === 'respectinfo') {
    return conn.reply ? conn.reply(m.chat,
      `✦ Sistema RESPECT — SW SYSTEM\n\n✦ Cada robo de sticker dentro del límite suma *+5 RESPECT*.\n✦ Máximo *3 robos* por ventana de *5 minutos*.\n✦ Después del 3° robo, cada robo extra aplica un *castigo progresivo*.\n✦ Pasados 5 minutos desde el 3er robo, la ventana se reinicia.\n✦ Tus puntos se guardan y no se pierden al reiniciar el bot.`, m) : null
  }

  // Comandos de administración (solo owner)
  if (['respectreset', 'respectgive', 'respecttake', 'respectset', 'respecttop'].includes(cmd)) {
    if (!isOwner(m)) {
      return conn.reply ? conn.reply(m.chat, '> Este comando solo puede usarlo el Creador del bot.', m) : null
    }
  }

  // respectreset
  if (cmd === 'respectreset') {
    const arg = (args[0] || '').toLowerCase()

    if (arg === 'all') {
      const dbAll = loadRespectDB()
      Object.keys(dbAll).forEach(jid => {
        dbAll[jid].respect = 0
        dbAll[jid].totalRobs = 0
        dbAll[jid].robCount = 0
        dbAll[jid].punishLevel = 0
      })
      await saveRespectDB(dbAll)
      return conn.reply ? conn.reply(m.chat, '✦ Todos los registros de RESPECT han sido reiniciados.', m) : null
    }

    // intentar resolver target (mención / respuesta / número / arg)
    const target = parseTarget(m, args)
    if (!target) {
      return conn.reply ? conn.reply(m.chat,
        `✦ Usa:\n• ${usedPrefix}respectreset @usuario → resetear 1 usuario\n• ${usedPrefix}respectreset all → resetear todos`, m) : null
    }

    const t = (typeof normalizeJid === 'function') ? normalizeJid(target) : target
    const db2 = loadRespectDB()
    ensureUserEntry(db2, t)
    db2[t].respect = 0
    db2[t].totalRobs = 0
    db2[t].robCount = 0
    db2[t].punishLevel = 0
    await saveRespectDB(db2)
    return conn.reply ? conn.reply(m.chat, `✦ RESPECT de *@${t.split('@')[0]}* ha sido reiniciado.`, m, { mentions: [t] }) : null
  }

  // respectgive / respecttake / respectset
  if (['respectgive', 'respecttake', 'respectset'].includes(cmd)) {
    // resolver target y cantidad
    const target = parseTarget(m, args)
    // extraer cantidad: primer token numérico en args o segundo token si se usó mención
    let amount = null
    // buscar en args cualquier número
    for (const a of args) {
      if (!a) continue
      const n = parseInt(String(a).replace(/[^\d-]/g, ''), 10)
      if (!isNaN(n)) { amount = n; break }
    }
    // si no hay en args, intentar extraer del texto del mensaje
    if (amount === null) {
      const body = (m?.text || m?.message?.conversation || m?.message?.extendedTextMessage?.text || '').toString()
      const mnum = body.match(/(-?\d{1,6})/)
      if (mnum) amount = parseInt(mnum[1], 10)
    }

    if (!target || isNaN(amount)) {
      return conn.reply ? conn.reply(m.chat,
        `✦ Uso correcto:\n• ${usedPrefix}respectgive @usuario 50\n• ${usedPrefix}respecttake @usuario 20\n• ${usedPrefix}respectset @usuario 150`, m) : null
    }

    const t = (typeof normalizeJid === 'function') ? normalizeJid(target) : target
    const db3 = loadRespectDB()
    ensureUserEntry(db3, t)

    if (cmd === 'respectgive') {
      db3[t].respect += amount
    } else if (cmd === 'respecttake') {
      db3[t].respect -= amount
      if (db3[t].respect < 0) db3[t].respect = 0
    } else if (cmd === 'respectset') {
      db3[t].respect = amount
    }

    await saveRespectDB(db3)
    const rango = getRespectRank(db3[t].respect)
    return conn.reply ? conn.reply(m.chat,
      `✦ RESPECT actualizado para *@${t.split('@')[0]}*\n\n✦ RESPECT: *${db3[t].respect}*\n✦ Rango: *${rango}*`, m, { mentions: [t] }) : null
  }

  // respecttop
  if (cmd === 'respecttop') {
    const dbTop = loadRespectDB()
    const entries = Object.entries(dbTop)
      .filter(([jid, info]) => typeof info.respect === 'number')
      .sort((a, b) => b[1].respect - a[1].respect)
      .slice(0, 10)

    if (!entries.length) return conn.reply ? conn.reply(m.chat, '✦ No hay datos de RESPECT aún.', m) : null

    let texto = '✦ TOP 10 RESPECT — SW SYSTEM\n\n'
    let pos = 1
    for (const [jid, info] of entries) {
      const rango = getRespectRank(info.respect)
      const tag = '@' + jid.split('@')[0]
      texto += `${pos}) ${tag} — *${info.respect}* RESPECT (${rango})\n`
      pos++
    }

    return conn.reply ? conn.reply(m.chat, texto, m, { mentions: entries.map(([jid]) => jid) }) : null
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
