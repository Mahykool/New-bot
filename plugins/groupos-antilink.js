// sw IA - Sistema Antilink Ultra Fuerte (versión final con strikes progresivos y roles SW)

import { normalizeJid, getUserRoles } from '../lib/lib-roles.js'

let handler = async (m, { conn, args, usedPrefix, command, isAdmin, isBotAdmin }) => {
  if (!m.isGroup) return conn.sendMessage(m.chat, { react: { text: '✖', key: m.key } })
  if (!isAdmin) return conn.sendMessage(m.chat, { react: { text: '✖', key: m.key } })

  const action = args[0]?.toLowerCase()
  if (!global.antilinkStatus) global.antilinkStatus = {}

  if (!action) {
    let txt = `ㅤׄㅤׅㅤׄ MENÚ ANTILINK ㅤ֢ㅤׄㅤׅ\n\n`
    txt += `> 🗝 ${usedPrefix}antilink on      → Activar\n`
    txt += `> 🗝 ${usedPrefix}antilink off     → Desactivar\n`
    txt += `> 🗝 ${usedPrefix}antilink status  → Estado\n\n`
    txt += `⚡ *Versión v2 Actualizada* – Protección inteligente con detección avanzada.\n\n`
    txt += `_Mahykol — swill_`
    return m.reply(txt)
  }

  switch (action) {
    case 'on':
    case 'activar':
      global.antilinkStatus[m.chat] = true
      await conn.reply(m.chat, '🛡️ ANTILINK ACTIVADO ✅️', m)
      break

    case 'off':
    case 'desactivar':
      if (global.antilinkStatus && typeof global.antilinkStatus[m.chat] !== 'undefined') {
        delete global.antilinkStatus[m.chat]
      }
      await conn.reply(m.chat, '🔓 ANTILINK DESACTIVADO ❌', m)
      break

    case 'status':
    case 'estado':
      const status = (global.antilinkStatus && global.antilinkStatus[m.chat]) ? '🟢 ACTIVO' : '🔴 DESACTIVADO'
      await conn.reply(m.chat, `🔰 Estado del Antilink: ${status}`, m)
      break

    default:
      return conn.sendMessage(m.chat, { react: { text: '✖', key: m.key } })
  }
}

// 🌸 Detector Antilink Activo (antes del handler)
if (!global.antilinkStrikes) global.antilinkStrikes = {}
function addStrike(chat, user) {
  const key = `${chat}:${user}`
  if (!global.antilinkStrikes[key]) global.antilinkStrikes[key] = 1
  else global.antilinkStrikes[key]++
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
    const targetRoles = getUserRoles(sender) || []
    const rolesLower = targetRoles.map(r => r.toLowerCase())
    if (rolesLower.length === 0) rolesLower.push('user')

    const isUser = rolesLower.includes('user')
    const isVip  = rolesLower.includes('vip')

    if (!(isUser || isVip)) return

    if (isBotAdmin && m.key) {
      try { await conn.sendMessage(m.chat, { delete: m.key }) } catch {}
    }

    const strikes = addStrike(m.chat, sender)

    if (strikes === 1) {
      await conn.sendMessage(m.chat, {
        text: `ㅤׄㅤׅㅤׄ _*LINK DETECTADO*_ ㅤ֢ㅤׄㅤׅ\n> ⚘ Strike 1/3\n> .shadowban @${sender.split('@')[0]} 15`,
        mentions: [sender]
      })
    } else if (strikes === 2) {
      await conn.sendMessage(m.chat, {
        text: `ㅤׄㅤׅㅤׄ _*LINK DETECTADO*_ ㅤ֢ㅤׄㅤׅ\n> ⚘ Strike 2/3\n> .shadowban @${sender.split('@')[0]} 30`,
        mentions: [sender]
      })
    } else if (strikes >= 3) {
      await conn.sendMessage(m.chat, {
        text: `ㅤׄㅤׅㅤׄ _*LINK DETECTADO*_ ㅤ֢ㅤׄㅤׅ\n> ⚘ Strike 3/3\n> Expulsión inmediata`,
        mentions: [sender]
      })
      if (isBotAdmin) await conn.groupParticipantsUpdate(m.chat, [sender], 'remove')
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
handler.description = 'Sistema Antilink Ultra Fuerte con strikes progresivos'

export default handler