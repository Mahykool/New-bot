// plugins/group-antilink.js — Versión PRO FINAL SW
// Antilink 100% integrado con permisos SW, roles, shadowban real y strikes progresivos.

import { requireCommandAccess } from '../lib/permissions-middleware.js'
import { normalizeJid, getUserRoles } from '../lib/lib-roles.js'

/* ============================
   CONFIG
============================ */
const STRIKE_RESET_HOURS = 24

const STRIKE_ACTIONS = {
  1: { type: 'shadowban', minutes: 5 },
  2: { type: 'shadowban', minutes: 15 },
  3: { type: 'kick' }
}

const LINK_PATTERNS = [
  /https?:\/\/[^\s]+/gi,
  /www\.[^\s]+/gi,
  /chat\.whatsapp\.com\/[A-Za-z0-9]+/gi,
  /t\.me\/[^\s]+/gi,
  /instagram\.com\/[^\s]+/gi,
  /facebook\.com\/[^\s]+/gi,
  /youtube\.com\/[^\s]+/gi,
  /youtu\.be\/[^\s]+/gi,
  /twitter\.com\/[^\s]+/gi,
  /x\.com\/[^\s]+/gi,
  /discord\.gg\/[^\s]+/gi,
  /tiktok\.com\/[^\s]+/gi
]

function formatTitle() {
  return 'ㅤׄㅤׅㅤׄ _*ANTILINK*_ ㅤ֢ㅤㅤׅ'
}

/* ============================
   STRIKES
============================ */
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

/* ============================
   COMANDO PRINCIPAL
============================ */
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
    return conn.reply(
      m.chat,
      `${formatTitle()}

➤ ${usedPrefix}antilink on  
   Activa la protección.

➤ ${usedPrefix}antilink off  
   Desactiva la protección.

➤ ${usedPrefix}antilink status  
   Muestra el estado actual.

⚡ Protección reforzada con shadowban progresivo y kick automático.`,
      m
    )
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

/* ============================
   BEFORE: DETECCIÓN DE LINKS
============================ */
handler.before = async (m, { conn }) => {
  try {
    if (!m.isGroup || !global.antilinkStatus?.[m.chat]) return

    const text = (m.text || m.caption || '').trim()
    if (!text) return

    const hasLink = LINK_PATTERNS.some(p => p.test(text))
    if (!hasLink) return

    const sender = normalizeJid(m.sender)
    if (!sender) return

    const botJid = normalizeJid(conn.user?.id)
    if (sender === botJid) return

    /* ============================
       PERMISOS SW (MANDAN)
    ============================ */
    const chatCfg = global.db?.data?.chats?.[m.chat] || {}

    try {
      // Si el usuario tiene permiso → NO castigar
      requireCommandAccess(m, 'group-antilink', 'antilink-detect', chatCfg)
      return
    } catch {
      // Si NO tiene permiso → castigo
    }

    /* ============================
       MENSAJE DE DETECCIÓN
    ============================ */
    await conn.sendMessage(m.chat, {
      text: `${formatTitle()}\n⚠️ *ENLACE DETECTADO*\nUsuario: @${sender.split('@')[0]}`,
      mentions: [sender]
    })

    /* ============================
       BORRAR MENSAJE
    ============================ */
    try {
      if (typeof conn.deleteMessage === 'function') {
        await conn.deleteMessage(m.chat, m.key)
      } else {
        await conn.sendMessage(m.chat, { delete: m.key })
      }
    } catch {}

    /* ============================
       STRIKES
    ============================ */
    const strikes = addStrike(m.chat, sender)
    const action = STRIKE_ACTIONS[strikes] || STRIKE_ACTIONS[3]

    await conn.sendMessage(m.chat, {
      text: `${formatTitle()}\n⚠️ *ENLACE DETECTADO*\nUsuario: @${sender.split('@')[0]}\nStrike: *${strikes}/3*\nAcción: *${action.type === 'kick' ? 'Expulsión' : 'Shadowban ' + action.minutes + 'm'}*`,
      mentions: [sender]
    })

    /* ============================
       SHADOWBAN REAL
    ============================ */
    if (action.type === 'shadowban') {
      const fake = {
        ...m,
        text: `.shadowban @${sender.split('@')[0]} ${action.minutes}`,
        sender: m.sender,
        chat: m.chat,
        isCommand: true
      }

      const extra = {
        conn,
        args: [sender, action.minutes],
        usedPrefix: '.',
        command: 'shadowban'
      }

      const shadowPlugin = Object.values(global.plugins).find(p =>
        p.command?.includes?.('shadowban')
      )

      if (shadowPlugin?.default) {
        await shadowPlugin.default.call(conn, fake, extra)
      }
    }

    /* ============================
       EXPULSIÓN REAL
    ============================ */
    if (action.type === 'kick') {
      const botRoles = getUserRoles(conn.user.id).map(r => r.toLowerCase())
      const botHasPower =
        botRoles.includes('mod') ||
        botRoles.includes('moderador') ||
        botRoles.includes('creador') ||
        botRoles.includes('owner')

      if (botHasPower) {
        await conn.groupParticipantsUpdate(m.chat, [sender], 'remove')
      }
    }

  } catch (e) {
    console.error('Error en Antilink PRO FINAL:', e)
  }
}

handler.command = ['antilink']
handler.tags = ['modmenu']
handler.group = true
handler.botAdmin = false
handler.admin = false

export default handler
