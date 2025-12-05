// plugins/_nable.js
// Refactor: enable/disable settings handler
// Imagen local en vez de URL externa

import fs from 'fs'
import path from 'path'
import { saveDatabase } from '../lib/db.js'
import { requireCommandAccess } from '../lib/permissions-middleware.js'
import { normalizeJid } from '../lib/lib-roles.js'

// Audit log simple (append a line a data/settings-audit.log)
const AUDIT_FILE = path.join(process.cwd(), 'data', 'settings-audit.log')
function auditLog(line) {
  try {
    fs.mkdirSync(path.dirname(AUDIT_FILE), { recursive: true })
    const ts = new Date().toISOString()
    fs.appendFileSync(AUDIT_FILE, `[${ts}] ${line}\n`, 'utf8')
  } catch (e) {
    console.warn('auditLog error', e)
  }
}

let handler = async (m, { conn, usedPrefix, command, args }) => {
  try {
    const toNum = (jid = '') => String(jid).split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
    const senderRaw = m?.sender || ''
    const sender = (typeof normalizeJid === 'function') ? normalizeJid(senderRaw) : senderRaw
    const senderNum = toNum(sender)

    const botIdRaw = conn?.user?.id || conn?.user?.jid || ''
    const botId = (typeof normalizeJid === 'function') ? normalizeJid(botIdRaw) : botIdRaw
    const ownersRaw = Array.isArray(global.owner) ? global.owner.flat() : (global.owner ? [global.owner] : [])
    const owners = ownersRaw.map(v => (Array.isArray(v) ? v[0] : v)).filter(Boolean).map(v => (typeof normalizeJid === 'function' ? normalizeJid(v) : v))
    const ownerNums = owners.map(o => toNum(o))
    const isROwner = [botId, ...owners].map(v => toNum(v)).includes(senderNum)
    const isOwner = isROwner || !!m.fromMe

    const isAdmin = !!m.isAdmin
    const chat = global.db?.data?.chats?.[m.chat] || (global.db.data.chats[m.chat] = {})
    const settings = global.db?.data?.settings || (global.db.data.settings = {})
    const botSettings = settings[conn.user.jid] || (settings[conn.user.jid] = {})

    // contacto de quoted fallback
    const fkontak = {
      key: { participants: "0@s.whatsapp.net", remoteJid: "status@broadcast", fromMe: false, id: "Halo" },
      message: {
        contactMessage: {
          vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:y\nitem1.TEL;waid=${sender.split('@')[0]}:${sender.split('@')[0]}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
        }
      },
      participant: "0@s.whatsapp.net"
    }

    // Imagen local del proyecto
    const localImagePath = path.join(process.cwd(), 'src', 'menumain.jpg')
    let imageBuffer = null
    try {
      imageBuffer = fs.readFileSync(localImagePath)
    } catch (e) {
      console.warn('No se pudo cargar la imagen local', e)
      imageBuffer = null
    }

    const listMessage = {
      image: imageBuffer,
      caption: `
╭━━━〔  ${global.botname || 'Bot'}  〕━━━⬣
┃ 📌 Uso del comando
┃ 🍒 Ejemplo: ${usedPrefix || '.'}on antitoxic
┃ 🎈 Descripción: Activa/Desactiva funciones
┃ 📚 Funciones disponibles: welcome, public, chatbot, nsfw, autosticker, antitraba, anticall, autoread, etc.
┃ ☂️ Usa: ${usedPrefix || '.'}on/.off <opción>  •  ${usedPrefix || '.'}menu para más
╰━━━━━━━━━━━━━━━━━━━━━━⬣`.trim()
    }

    if (!args || !args[0]) {
      return conn.sendMessage ? await conn.sendMessage(m.chat, listMessage, { quoted: fkontak }) : null
    }

    const isEnable = /^(true|enable|(turn)?on|1|activar|on)$/i.test(command)
    const type = (args[0] || '').toString().toLowerCase()

    // Solo comandos críticos pasan por requireCommandAccess
    const protectedCommands = new Set([
      'restrict','public','jadibotmd','anticall','autoread'
    ])

    if (protectedCommands.has(type)) {
      try {
        const chatCfg = global.db?.data?.chats?.[m.chat] || {}
        requireCommandAccess(m, 'settings', type, chatCfg)
      } catch (err) {
        try { if (typeof global.dfail === 'function') global.dfail('access', m, conn) } catch {}
        return
      }
    }

    async function persistAndAudit(actionLine) {
      try { await saveDatabase() } catch (err) {
        console.error('saveDatabase error', err)
        try { await conn.sendMessage(m.chat, { text: '⚠️ Error guardando configuración. Intenta de nuevo.' }, { quoted: fkontak }) } catch {}
      }
      try { auditLog(`${sender} ${actionLine}`) } catch {}
    }

    let isAll = false
    let isUser = false

    switch (type) {
      case 'welcome':
      case 'bienvenida':
        if (m.isGroup && !(isAdmin || isOwner)) return
        chat.welcome = isEnable
        await persistAndAudit(`CHAT ${m.chat} SET welcome=${isEnable}`)
        break

      case 'public':
        isAll = true
        if (!isOwner) return
        botSettings.public = isEnable
        await persistAndAudit(`SET public=${isEnable}`)
        break

      default:
        return conn.sendMessage ? await conn.sendMessage(m.chat, listMessage, { quoted: fkontak }) : null
    }

    const aplicaA = isAll ? 'ESTE BOT' : (isUser ? 'USUARIO' : 'ESTE CHAT')
    const txt = `
╭━━━〔 🌸 ${global.botname || 'Bot'}  〕━━━⬣
┃ ➺ OPCIÓN: ${type.toUpperCase()}
┃ ➺ ESTADO: ${isEnable ? '🟢 ON' : '🔴 OFF'}
┃ ➺ APLICA A: ${aplicaA}
╰━━━━━━━━━━━━━━━━━━━━━━⬣`.trim()

    await conn.sendMessage(m.chat, { text: txt }, { quoted: fkontak })
  } catch (err) {
    console.error('nable handler error', err)
    try { if (typeof global.dfail === 'function') global.dfail('error', m, conn) } catch {}
    try { await conn.sendMessage(m.chat, { text: '❌ Ocurrió un error procesando la solicitud.' }, { quoted: m }) } catch {}
  }
}

handler.help = []       // no aparece en el menú
handler.tags = []       // sin categoría visible
handler.command = ['enable','disable','on','off','true','false','1','0']

export default handler