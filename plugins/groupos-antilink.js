// plugins/group-antilink.js
// Sistema Antilink Ultra Fuerte

import { requireCommandAccess } from '../lib/permissions-middleware.js'

let handler = async (m, { conn, args, usedPrefix, command, isAdmin, isBotAdmin }) => {
  const ctxErr = (global.rcanalx || {})
  const ctxWarn = (global.rcanalw || {})
  const ctxOk = (global.rcanalr || {})

  // Solo grupos
  if (!m.isGroup) return conn.reply(m.chat, '❌ Solo puedo usarse en grupos.', m, ctxErr)

  // Control de nivel (roles SW SYSTEM: creador / mod)
  // pluginId: "group-antilink"
  // command:  "antilink"
  try {
    requireCommandAccess(m.sender, 'group-antilink', 'antilink')
  } catch (e) {
    if (e.code === 'ACCESS_DENIED') {
      return conn.reply(
        m.chat,
        '> No tienes nivel suficiente para configurar el *ANTILINK*.',
        m,
        ctxErr
      )
    }
    throw e
  }

  // Extra: también exigimos ser admin de grupo para no romper grupos ajenos
  if (!isAdmin) {
    return conn.reply(
      m.chat,
      '⚠️ Solo los administradores del grupo pueden usar este comando.',
      m,
      ctxErr
    )
  }

  const action = args[0]?.toLowerCase()
  if (!global.antilinkStatus) global.antilinkStatus = {}

  if (!action) {
    return conn.reply(
      m.chat,
      `
ஓீ🐙 ㅤׄㅤׅㅤׄ *ANTILINK* ㅤ֢ㅤׄㅤׅ

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
      await conn.reply(m.chat, '🛡️ ANTILINK ACTIVADO ✅️', m, ctxOk)
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
      const status = (global.antilinkStatus && global.antilinkStatus[m.chat])
        ? '🟢 ACTIVO'
        : '🔴 DESACTIVADO'
      await conn.reply(m.chat, `🔰 Estado del Antilink: ${status}`, m, ctxOk)
      break

    default:
      await conn.reply(m.chat, '❌ Opción no válida.', m, ctxErr)
  }
}

// 🌸 Detector Antilink Activo (before)
handler.before = async (m, { conn, isAdmin, isBotAdmin }) => {
  try {
    if (m.isBaileys || !m.isGroup) return
    if (!global.antilinkStatus || !global.antilinkStatus[m.chat]) return

    const messageText = m.text || m.caption || ''
    if (!messageText) return

    const linkPatterns = [
      /https?:\/\/[^\s]*/gi,
      /www\.[^\s]*/gi,
      /[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/[^\s]*)?/gi,
      /wa\.me\/[0-9]+/gi,
      /chat\.whatsapp\.com\/[A-Za-z0-9]+/gi,
      /t\.me\/[^\s]*/gi,
      /instagram\.com\/[^\s]*/gi,
      /facebook\.com\/[^\s]*/gi,
      /youtube\.com\/[^\s]*/gi,
      /youtu\.be\/[^\s]*/gi,
      /twitter\.com\/[^\s]*/gi,
      /x\.com\/[^\s]*/gi,
      /discord\.gg\/[^\s]*/gi,
      /tiktok\.com\/[^\s]*/gi,
      /bit\.ly\/[^\s]*/gi,
      /tinyurl\.com\/[^\s]*/gi,
      /goo\.gl\/[^\s]*/gi,
      /ow\.ly\/[^\s]*/gi,
      /buff\.ly\/[^\s]*/gi,
      /adf\.ly\/[^\s]*/gi,
      /shorte\.st\/[^\s]*/gi,
      /snip\.ly\/[^\s]*/gi,
      /cutt\.ly\/[^\s]*/gi,
      /is\.gd\/[^\s]*/gi,
      /v\.gd\/[^\s]*/gi,
      /cli\.gs\/[^\s]*/gi,
      /bc\.vc\/[^\s]*/gi,
      /tr\.im\/[^\s]*/gi,
      /prettylink\.pro\/[^\s]*/gi,
      /[a-zA-Z0-9-]+\.blogspot\.[^\s]*/gi,
      /[a-zA-Z0-9-]+\.wordpress\.[^\s]*/gi,
      /[a-zA-Z0-9-]+\.weebly\.[^\s]*/gi,
      /[a-zA-Z0-9-]+\.wixsite\.[^\s]*/gi,
      /[a-zA-Z0-9-]+\.webnode\.[^\s]*/gi,
      /[a-zA-Z0-9-]+\.000webhostapp\.[^\s]*/gi,
      /[a-zA-Z0-9-]+\.github\.io\/[^\s]*/gi,
      /[a-zA-Z0-9-]+\.netlify\.app\/[^\s]*/gi,
      /[a-zA-Z0-9-]+\.herokuapp\.com\/[^\s]*/gi,
      /[a-zA-Z0-9-]+\.glitch\.me\/[^\s]*/gi,
      /[a-zA-Z0-9-]+\.repl\.co\/[^\s]*/gi,
      /[a-zA-Z0-9-]+\.vercel\.app\/[^\s]*/gi,
      /[a-zA-Z0-9-]+\.surge\.sh\/[^\s]*/gi,
      /[a-zA-Z0-9-]+\.pages\.dev\/[^\s]*/gi,
      /[a-zA-Z0-9-]+\.onrender\.com\/[^\s]*/gi,
      /[a-zA-Z0-9-]+\.railway\.app\/[^\s]*/gi,
      /[a-zA-Z0-9-]+\.fly\.dev\/[^\s]*/gi
    ]

    let hasLink = false

    for (const pattern of linkPatterns) {
      const matches = messageText.match(pattern)
      if (matches && matches.length > 0) {
        hasLink = true
        break
      }
    }

    const ipPattern = /\b(?:\d{1,3}\.){3}\d{1,3}\b/gi
    if (!hasLink && ipPattern.test(messageText)) {
      hasLink = true
    }

    if (!hasLink) return
    if (isAdmin) return
    if (m.sender === conn.user.jid) return

    await conn.sendMessage(
      m.chat,
      {
        text: `> 💢 𝐄𝐍𝐋𝐀𝐂𝐄 𝐃𝐄𝐓𝐄𝐂𝐓𝐀𝐃𝐎 @${m.sender.split('@')[0]} ⚠️ 𝐄𝐗𝐏𝐔𝐋𝐒𝐈𝐎́𝐍 𝐈𝐍𝐌𝐄𝐃𝐈𝐀𝐓𝐀`,
        mentions: [m.sender]
      }
    )

    if (isBotAdmin && m.key) {
      try {
        await conn.sendMessage(m.chat, {
        delete: {
            remoteJid: m.chat,
            fromMe: false,
            id: m.key.id,
            participant: m.sender
          }
        })
      } catch (e) {}
    }

    if (isBotAdmin) {
      try {
        await conn.groupParticipantsUpdate(m.chat, [m.sender], 'remove')
      } catch (e) {
        console.error('Expulsión fallida:', e)
      }
    }
  } catch (err) {
    console.error('Error en antilink.before:', err)
  }
}

handler.pluginId = 'group-antilink'
handler.help = ['antilink']
handler.tags = ['modmenu']
handler.command = ['antilink', 'antienlace']
handler.group = true
handler.botAdmin = true

export default handler
