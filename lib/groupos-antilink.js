// 🌸 Itsuki Nakano IA - Sistema Antilink Ultra Fuerte (versión final con strikes progresivos y roles SW)

import { normalizeJid, getUserRoles } from '../lib/lib-roles.js'

let handler = async (m, { conn, args, usedPrefix, command, isAdmin, isBotAdmin }) => {
  const ctxErr = (global.rcanalx || {})
  const ctxWarn = (global.rcanalw || {})
  const ctxOk = (global.rcanalr || {})

  if (!m.isGroup) return conn.reply(m.chat, '❌ Solo puedo usarse en grupos.', m, ctxErr)
  if (!isAdmin) return conn.reply(m.chat, '⚠️ Solo los administradores pueden usar este comando.', m, ctxErr)

  const action = args[0]?.toLowerCase()
  if (!global.antilinkStatus) global.antilinkStatus = {}

  if (!action) {
    return conn.reply(m.chat, `
╭━━━〔 𝐒𝐈𝐒𝐓𝐄𝐌𝐀 𝐀𝐍𝐓𝐈𝐋𝐈𝐍𝐊 🖇️🚫 〕━━━⬣
┃ ➡️ ${usedPrefix}antilink on      → Activar
┃ ➡️ ${usedPrefix}antilink off     → Desactivar
┃ ➡️ ${usedPrefix}antilink status  → Estado
╰━━━━━━━━━━━━━━⬣

> ⚡ *Versión v2 Actualizada* – Protección inteligente con detección avanzada.
    `.trim(), m, ctxWarn)
  }

  switch (action) {
    case 'on':
    case 'activar':
      global.antilinkStatus[m.chat] = true
      await conn.reply(m.chat, '🛡️ 𝐀𝐍𝐓𝐈𝐋𝐈𝐍𝐊 𝐀𝐂𝐓𝐈𝐕𝐀𝐃𝐎 ✅️', m, ctxOk)
      break

    case 'off':
    case 'desactivar':
      if (global.antilinkStatus && typeof global.antilinkStatus[m.chat] !== 'undefined') {
        delete global.antilinkStatus[m.chat]
      }
      await conn.reply(m.chat, '🔓 𝐀𝐍𝐓𝐈𝐋𝐈𝐍𝐊 𝐃𝐄𝐒𝐀𝐂𝐓𝐈𝐕𝐀𝐃𝐎 ❌', m, ctxWarn)
      break

    case 'status':
    case 'estado':
      const status = (global.antilinkStatus && global.antilinkStatus[m.chat]) ? '🟢 𝐀𝐂𝐓𝐈𝐕𝐎' : '🔴 𝐃𝐄𝐒𝐀𝐂𝐓𝐈𝐕𝐀𝐃𝐎'
      await conn.reply(m.chat, `🔰 Estado del Antilink: ${status}`, m, ctxOk)
      break

    default:
      await conn.reply(m.chat, '❌ Opción no válida.', m, ctxErr)
  }
}

// 🌸 Detector Antilink Activo (antes del handler)
if (!global.antilinkStrikes) global.antilinkStrikes = {}
function addStrike(chat, user) {
  const key = `${chat}:${user}` // clave única por chat+usuario
  if (!global.antilinkStrikes[key]) {
    global.antilinkStrikes[key] = 1
  } else {
    global.antilinkStrikes[key]++
  }
  return global.antilinkStrikes[key]
}

handler.before = async (m, { conn, isBotAdmin }) => {
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

    let hasLink = linkPatterns.some(p => p.test(messageText))
    if (!hasLink) return

    const sender = normalizeJid(m.sender)

    // 🔒 Roles protegidos
   const targetRoles = getUserRoles(sender) || []
const rolesLower = targetRoles.map(r => r.toLowerCase())

// Si no tiene roles, asignar 'user' por defecto
if (rolesLower.length === 0) rolesLower.push('user')

const isUser = rolesLower.includes('user')
const isVip  = rolesLower.includes('vip')


    // 👉 Solo sancionar a user y vip
    if (!(isUser || isVip)) {
  console.log('[ANTILINK] Ignorado por rol:', sender, targetRoles)
  return
}


    // 🗑️ Borrar mensaje siempre
    if (isBotAdmin && m.key) {
      try {
        await conn.sendMessage(m.chat, { delete: m.key })
      } catch (e) {}
    }

    // ⚡ Aplicar strikes progresivos
    const strikes = addStrike(m.chat, sender)

    if (strikes === 1) {
      await conn.sendMessage(m.chat, {
        text: `⚠️ LINK DETECTADO – Strike 1/3\n.shadowban @${sender.split('@')[0]} 15`,
        mentions: [sender]
      })
    } else if (strikes === 2) {
      await conn.sendMessage(m.chat, {
        text: `⚠️ LINK DETECTADO – Strike 2/3\n.shadowban @${sender.split('@')[0]} 30`,
        mentions: [sender]
      })
    } else if (strikes >= 3) {
      await conn.sendMessage(m.chat, {
        text: `⚠️ LINK DETECTADO – Strike 3/3\nExpulsión inmediata`,
        mentions: [sender]
      })
      if (isBotAdmin) {
        await conn.groupParticipantsUpdate(m.chat, [sender], 'remove')
      }
    }

  } catch (err) {
    console.error('Error en antilink.before:', err)
  }
}

handler.help = ['antilink']
handler.tags = ['modmenu']
handler.command = ['antilink', 'antienlace']
handler.group = true
handler.admin = true
handler.botAdmin = true

export default handler