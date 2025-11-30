// plugins/group-antilink.js
// Sistema Antilink Ultra Fuerte (parcheado: normalización, parseTarget, protecciones y robustez)

import { requireCommandAccess } from '../lib/permissions-middleware.js'
import { normalizeJid, getUserRoles, getRoleInfo } from '../lib/lib-roles.js'
import { parseTarget } from '../lib/utils.js'

const PROTECTED_ROLES = ['creador', 'mod'] // roles que no deben ser expulsados por antilink
const DEFAULT_LINK_PATTERNS = [
  /https?:\/\/[^\s]+/gi,
  /www\.[^\s]+/gi,
  /[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/[^\s]*)?/gi,
  /wa\.me\/[0-9]+/gi,
  /chat\.whatsapp\.com\/[A-Za-z0-9]+/gi,
  /t\.me\/[^\s]+/gi,
  /instagram\.com\/[^\s]+/gi,
  /facebook\.com\/[^\s]+/gi,
  /youtube\.com\/[^\s]+/gi,
  /youtu\.be\/[^\s]+/gi,
  /twitter\.com\/[^\s]+/gi,
  /x\.com\/[^\s]+/gi,
  /discord\.gg\/[^\s]+/gi,
  /tiktok\.com\/[^\s]+/gi,
  /bit\.ly\/[^\s]+/gi,
  /tinyurl\.com\/[^\s]+/gi,
  /goo\.gl\/[^\s]+/gi
]

function formatTitle() {
  return 'ஓீ🐙 ㅤׄㅤׅㅤׄ *ANTILINK* ㅤ֢ㅤׄㅤׅ'
}

let handler = async (m, { conn, args = [], usedPrefix = '/', isAdmin, isBotAdmin }) => {
  const ctxErr = (global.rcanalx || {})
  const ctxWarn = (global.rcanalw || {})
  const ctxOk = (global.rcanalr || {})

  if (!m.isGroup) return conn.reply(m.chat, '❌ Solo puedo usarse en grupos.', m, ctxErr)

  // Verificar permiso en el sistema de roles
  try {
    requireCommandAccess(m.sender, 'group-antilink', 'antilink')
  } catch (e) {
    if (e && e.code === 'ACCESS_DENIED') {
      return conn.reply(m.chat, '> ❌ No tienes nivel suficiente para configurar el ANTILINK.', m, ctxErr)
    }
    throw e
  }

  // Además exigimos ser admin del grupo para cambiar la configuración
  if (!isAdmin) {
    return conn.reply(m.chat, '⚠️ Solo los administradores del grupo pueden usar este comando.', m, ctxErr)
  }

  const action = (args[0] || '').toString().toLowerCase()
  if (!global.antilinkStatus) global.antilinkStatus = {}

  if (!action) {
    return conn.reply(
      m.chat,
      `
${formatTitle()}

➤ ${usedPrefix}antilink on
   Activa la protección contra enlaces.

➤ ${usedPrefix}antilink off
   Desactiva la protección.

➤ ${usedPrefix}antilink status
   Muestra el estado actual.

⚡ Protección reforzada con detección avanzada de enlaces y redirecciones.
      `.trim(),
      m,
      ctxWarn
    )
  }

  switch (action) {
    case 'on':
    case 'activar':
      global.antilinkStatus[m.chat] = true
      await conn.reply(m.chat, '🛡️ ANTILINK ACTIVADO ✅', m, ctxOk)
      break

    case 'off':
    case 'desactivar':
      if (global.antilinkStatus && typeof global.antilinkStatus[m.chat] !== 'undefined') {
        delete global.antilinkStatus[m.chat]
      }
      await conn.reply(m.chat, '🔓 ANTILINK DESACTIVADO ❌', m, ctxWarn)
      break

    case 'status':
    case 'estado':
      {
        const status = (global.antilinkStatus && global.antilinkStatus[m.chat]) ? '🟢 ACTIVO' : '🔴 DESACTIVADO'
        await conn.reply(m.chat, `🔰 Estado del Antilink: ${status}`, m, ctxOk)
      }
      break

    default:
      await conn.reply(m.chat, '❌ Opción no válida.', m, ctxErr)
  }
}

// Detector Antilink (before hook)
handler.before = async (m, { conn, isAdmin, isBotAdmin }) => {
  try {
    if (!m || !m.isGroup) return
    if (!global.antilinkStatus || !global.antilinkStatus[m.chat]) return

    const messageText = ((m.text || m.caption) || '') + ''
    if (!messageText) return

    // Detectar enlace con patrones
    let hasLink = false
    for (const pattern of DEFAULT_LINK_PATTERNS) {
      const matches = messageText.match(pattern)
      if (matches && matches.length > 0) {
        hasLink = true
        break
      }
    }
    // IP fallback
    const ipPattern = /\b(?:\d{1,3}\.){3}\d{1,3}\b/gi
    if (!hasLink && ipPattern.test(messageText)) hasLink = true
    if (!hasLink) return

    // Si el remitente es admin del grupo, no actuar
    if (isAdmin) return

    // Evitar actuar sobre el propio bot
    const botJid = normalizeJid(conn.user?.jid || conn.user?.id || '')
    const senderJid = normalizeJid(m.sender)
    if (!senderJid || senderJid === botJid) return

    // Comprobar roles del remitente: si tiene rol protegido, no actuar
    try {
      const senderRoles = (getUserRoles(senderJid) || []).map(r => String(r).toLowerCase())
      const senderRoleInfo = getRoleInfo(senderJid) || {}
      for (const pr of PROTECTED_ROLES) {
        if (senderRoles.includes(pr)) return
      }
      if (PROTECTED_ROLES.includes((senderRoleInfo.id || '').toLowerCase())) return
    } catch (e) {
      // si falla la comprobación de roles, no bloqueamos por defecto; seguimos con precaución
    }

    // Aviso público con mención
    try {
      await conn.sendMessage(
        m.chat,
        {
          text: `> 💢 𝐄𝐍𝐋𝐀𝐂𝐄 𝐃𝐄𝐓𝐄𝐂𝐓𝐀𝐃𝐎 @${senderJid.split('@')[0]} ⚠️ 𝐀𝐂𝐂𝐈𝐎́𝐍`,
          mentions: [senderJid]
        }
      )
    } catch (e) {
      // no crítico
    }

    // Intentar borrar el mensaje con fallbacks compatibles
    try {
      if (typeof conn.deleteMessage === 'function') {
        try { await conn.deleteMessage(m.chat, m.key) } catch (e) {}
      } else if (typeof conn.sendMessage === 'function') {
        try {
          await conn.sendMessage(m.chat, { delete: { remoteJid: m.chat, fromMe: false, id: m.key?.id, participant: senderJid } })
        } catch (e) {}
      }
    } catch (e) {
      // no crítico
    }

    // Si el bot es admin, expulsar; si no, solo avisar
    if (isBotAdmin) {
      try {
        if (typeof conn.groupParticipantsUpdate === 'function') {
          await conn.groupParticipantsUpdate(m.chat, [senderJid], 'remove')
        } else if (typeof conn.groupRemove === 'function') {
          await conn.groupRemove(m.chat, [senderJid])
        } else if (typeof conn.groupParticipants === 'function') {
          await conn.groupParticipants(m.chat, [senderJid], 'remove')
        } else {
          // no hay método de expulsión conocido
        }
      } catch (e) {
        console.error('Expulsión fallida (antilink):', e)
      }
    }
  } catch (err) {
    console.error('Error en antilink.before:', err)
  }
}

handler.command = ['antilink', 'antienlace', 'nolink']
handler.help = ['antilink']
handler.pluginId = 'group-antilink'
handler.tags = ['modmenu']
handler.group = true
handler.botAdmin = true

export default handler
