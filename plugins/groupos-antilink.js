// plugins/group-antilink.js — Versión PRO FINAL SW corregida
import { requireCommandAccess } from '../lib/permissions-middleware.js'
import { normalizeJid } from '../lib/lib-roles.js'
import { formatUserTag } from '../lib/utils.js'

const STRIKE_RESET_HOURS = 24
const STRIKE_ACTIONS = {
  1: { type: 'shadowban', minutes: 5 },
  2: { type: 'shadowban', minutes: 15 },
  3: { type: 'kick' }
}

const LINK_PATTERNS = [
  /https?:\/\/[^\s]+/gi,
  /chat\.whatsapp\.com\/[A-Za-z0-9]+/gi,
  /t\.me\/[^\s]+/gi,
  /discord\.gg\/[^\s]+/gi
]

function formatTitle() {
  return 'ㅤׄㅤׅㅤׄ _*ANTILINK*_ ㅤ֢ㅤㅤׅ'
}

if (!global.antilinkStrikes) global.antilinkStrikes = {}

function getStrikes(chat, user) {
  const key = `${chat}:${user}`
  const entry = global.antilinkStrikes[key]
  if (!entry) return 0
  const now = Date.now()
  const diff = now - entry.timestamp
  const resetMs = STRIKE_RESET_HOURS * 60 * 60 * 1000
  if (diff > resetMs) {
    delete global.antilinkStrikes[key]
    return 0
  }
  return entry.count
}

function addStrike(chat, user) {
  const key = `${chat}:${user}`
  const now = Date.now()
  if (!global.antilinkStrikes[key]) {
    global.antilinkStrikes[key] = { count: 1, timestamp: now }
  } else {
    global.antilinkStrikes[key].count++
    global.antilinkStrikes[key].timestamp = now
  }
  return global.antilinkStrikes[key].count
}

let handler = async (m, { conn, args, usedPrefix }) => {
  const chatCfg = global.db?.data?.chats?.[m.chat] || {}
  try {
    requireCommandAccess(m, 'group-antilink', 'antilink', chatCfg)
  } catch {
    return conn.reply(m.chat, `${formatTitle()}\n❌ No tienes permiso para usar este comando.`, m)
  }

  const action = (args[0] || '').toLowerCase()
  if (!global.antilinkStatus) global.antilinkStatus = {}

  if (!action) {
    return conn.reply(m.chat, `${formatTitle()}\n\n➤ ${usedPrefix}antilink on\n➤ ${usedPrefix}antilink off\n➤ ${usedPrefix}antilink status`, m)
  }

  switch (action) {
    case 'on':
      global.antilinkStatus[m.chat] = true
      return conn.reply(m.chat, `${formatTitle()}\n🛡️ ANTILINK ACTIVADO ✅`, m)
    case 'off':
      delete global.antilinkStatus[m.chat]
      return conn.reply(m.chat, `${formatTitle()}\n🔓 ANTILINK DESACTIVADO ❌`, m)
    case 'status':
      const status = global.antilinkStatus[m.chat] ? '🟢 ACTIVO' : '🔴 DESACTIVADO'
      return conn.reply(m.chat, `${formatTitle()}\n🔰 Estado del Antilink: ${status}`, m)
    default:
      return conn.reply(m.chat, `${formatTitle()}\n❌ Opción no válida.`, m)
  }
}

handler.before = async (m, { conn }) => {
  try {
    if (!m.isGroup || !global.antilinkStatus?.[m.chat]) return
    const text = (m.text || m.caption || '').trim()
    if (!text) return
    const hasLink = LINK_PATTERNS.some(p => p.test(text))
    if (!hasLink) return

    const sender = normalizeJid(m.sender)
    const display = await formatUserTag(conn, sender)

    await conn.sendMessage(m.chat, {
      text: `${formatTitle()}\n⚠️ *ENLACE DETECTADO*\nUsuario: ${display}`,
      mentions: [sender]
    })

    const strikes = addStrike(m.chat, sender)
    const action = STRIKE_ACTIONS[strikes] || STRIKE_ACTIONS[3]

    await conn.sendMessage(m.chat, {
      text: `${formatTitle()}\nStrike: *${strikes}/3*\nAcción: ${action.type}`,
      mentions: [sender]
    })

    if (action.type === 'kick') {
      await conn.groupParticipantsUpdate(m.chat, [sender], 'remove')
    }
  } catch (e) {
    console.error('Error en Antilink:', e)
  }
}

handler.command = ['antilink']
handler.tags = ['modmenu']
handler.group = true

export default handler
