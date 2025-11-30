// plugins/_nable.js
// Refactor: enable/disable settings handler
// Mejoras: requireCommandAccess, normalizeJid, auditLog, saveDatabase seguro, sin throw false

import fetch from 'node-fetch'
import { saveDatabase } from '../lib/db.js'
import { requireCommandAccess } from '../lib/permissions-middleware.js'
import { normalizeJid } from '../lib/lib-roles.js'

// Audit log simple (append a line a data/settings-audit.log)
import fs from 'fs'
import path from 'path'
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

    // Mensaje de ayuda / lista
    const imageUrl = "https://iili.io/Ka6T0Xf.jpg"
    let imageBuffer = null
    try {
      const res = await fetch(imageUrl)
      if (res && res.ok) imageBuffer = await res.buffer()
    } catch (e) {
      imageBuffer = null
    }

    const listMessage = {
      image: imageBuffer,
      caption: `
╭━━━〔  ${global.botname || 'Bot'}  〕━━━⬣
┃ 📌 Uso del comando
┃ 🍒 Ejemplo: ${usedPrefix || '.'}on antitoxic
┃ 🎈 Descripción: Activa/Desactiva funciones
┃ 📚 Funciones disponibles:
┃ • antifake • antibot • antisubbots • welcome • public
┃ • chatbot • nsfw • autosticker • antitraba • antiprivado
┃ • antispam • anticall • antidelete • autolevelup • autoresponder
┃ • autoaceptar • autorechazar • detect • antiviewonce • autoread
┃ • antisticker • antiraid • modoadmin • reaction • jadibotmd
┃ • onlypv • onlygp • antiperu
┃ ☂️ Usa: ${usedPrefix || '.'}on/.off <opción>  •  ${usedPrefix || '.'}menu para más
╰━━━━━━━━━━━━━━━━━━━━━━⬣`.trim()
    }

    // Validar args
    if (!args || !args[0]) {
      return conn.sendMessage ? await conn.sendMessage(m.chat, listMessage, { quoted: fkontak }) : null
    }

    // Normalizar comando on/off
    const isEnable = /^(true|enable|(turn)?on|1|activar|on)$/i.test(command)
    const type = (args[0] || '').toString().toLowerCase()

    // Intentar control de acceso centralizado para opciones que afectan al bot o requieren permiso
    // Algunas opciones son globales (aplican al bot), otras al chat; usamos requireCommandAccess para adminCommands
    const adminCommands = new Set([
      'autotype','autotipo','autoprivate','autoprivado','autosticker','autolevelup',
      'public','restrict','anticall','autoread','jadibotmd','autoresponder','reaction'
    ])

    // Si la opción es considerada "adminCommand" o global, validar con middleware
    try {
      const chatCfg = global.db?.data?.chats?.[m.chat] || {}
      // pluginId genérico 'settings' y command = type para granularidad
      requireCommandAccess(m, 'settings', type, chatCfg)
    } catch (err) {
      // fallback: si requireCommandAccess lanza ACCESS_DENIED, usar dfail y salir
      try { if (typeof global.dfail === 'function') global.dfail('access', m, conn) } catch {}
      return
    }

    // Helper para persistir y auditar
    async function persistAndAudit(actionLine) {
      try {
        await saveDatabase()
      } catch (err) {
        console.error('saveDatabase error', err)
        try { await conn.sendMessage(m.chat, { text: '⚠️ Error guardando configuración. Intenta de nuevo.' }, { quoted: fkontak }) } catch {}
      }
      try { auditLog(`${sender} ${actionLine}`) } catch {}
    }

    // Aplicar cambios con permisos claros y sin throw false
    let isAll = false
    let isUser = false

    switch (type) {
      case 'autotype':
      case 'autotipo':
        isAll = true
        if (!isOwner) { try { if (typeof global.dfail === 'function') global.dfail('rowner', m, conn) } catch {} ; return }
        botSettings.autotypeDotOnly = isEnable
        await persistAndAudit(`SET autotype=${isEnable}`)
        break

      case 'welcome':
      case 'bienvenida':
        if (m.isGroup) { if (!(isAdmin || isOwner)) { try { if (typeof global.dfail === 'function') global.dfail('admin', m, conn) } catch {} ; return } }
        chat.welcome = isEnable
        await persistAndAudit(`CHAT ${m.chat} SET welcome=${isEnable}`)
        break

      case 'bye':
      case 'despedida':
        if (m.isGroup) { if (!(isAdmin || isOwner)) { try { if (typeof global.dfail === 'function') global.dfail('admin', m, conn) } catch {} ; return } }
        chat.bye = isEnable
        await persistAndAudit(`CHAT ${m.chat} SET bye=${isEnable}`)
        break

      case 'antiprivado':
      case 'antiprivate':
        isAll = true
        if (!isOwner) { try { if (typeof global.dfail === 'function') global.dfail('rowner', m, conn) } catch {} ; return }
        botSettings.antiPrivate = isEnable
        await persistAndAudit(`SET antiPrivate=${isEnable}`)
        break

      case 'antispam':
        isAll = true
        if (!isOwner) { try { if (typeof global.dfail === 'function') global.dfail('owner', m, conn) } catch {} ; return }
        botSettings.antiSpam = isEnable
        await persistAndAudit(`SET antiSpam=${isEnable}`)
        break

      case 'restrict':
      case 'restringir':
        isAll = true
        if (!isOwner) { try { if (typeof global.dfail === 'function') global.dfail('rowner', m, conn) } catch {} ; return }
        botSettings.restrict = isEnable
        await persistAndAudit(`SET restrict=${isEnable}`)
        break

      case 'antibot':
      case 'antibots':
        if (m.isGroup) { if (!(isAdmin || isOwner)) { try { if (typeof global.dfail === 'function') global.dfail('admin', m, conn) } catch {} ; return } }
        chat.antiBot = isEnable
        await persistAndAudit(`CHAT ${m.chat} SET antiBot=${isEnable}`)
        break

      case 'antisubbots':
      case 'antibot2':
        if (m.isGroup) { if (!(isAdmin || isOwner)) { try { if (typeof global.dfail === 'function') global.dfail('admin', m, conn) } catch {} ; return } }
        chat.antiBot2 = isEnable
        await persistAndAudit(`CHAT ${m.chat} SET antiBot2=${isEnable}`)
        break

      case 'antidelete':
      case 'antieliminar':
      case 'delete':
        if (m.isGroup) { if (!(isAdmin || isOwner)) { try { if (typeof global.dfail === 'function') global.dfail('admin', m, conn) } catch {} ; return } }
        chat.delete = isEnable
        await persistAndAudit(`CHAT ${m.chat} SET delete=${isEnable}`)
        break

      case 'autoaceptar':
      case 'aceptarauto':
        if (m.isGroup) { if (!(isAdmin || isOwner)) { try { if (typeof global.dfail === 'function') global.dfail('admin', m, conn) } catch {} ; return } } else { if (!isOwner) { try { if (typeof global.dfail === 'function') global.dfail('group', m, conn) } catch {} ; return } }
        chat.autoAceptar = isEnable
        await persistAndAudit(`CHAT ${m.chat} SET autoAceptar=${isEnable}`)
        break

      case 'autorechazar':
      case 'rechazarauto':
        if (m.isGroup) { if (!(isAdmin || isOwner)) { try { if (typeof global.dfail === 'function') global.dfail('admin', m, conn) } catch {} ; return } } else { if (!isOwner) { try { if (typeof global.dfail === 'function') global.dfail('group', m, conn) } catch {} ; return } }
        chat.autoRechazar = isEnable
        await persistAndAudit(`CHAT ${m.chat} SET autoRechazar=${isEnable}`)
        break

      case 'autoresponder':
      case 'autorespond':
        if (m.isGroup) { if (!(isAdmin || isOwner)) { try { if (typeof global.dfail === 'function') global.dfail('admin', m, conn) } catch {} ; return } }
        chat.autoresponder = isEnable
        await persistAndAudit(`CHAT ${m.chat} SET autoresponder=${isEnable}`)
        break

      case 'autolevelup':
      case 'autonivel':
      case 'nivelautomatico':
        if (m.isGroup) { if (!(isAdmin || isOwner)) { try { if (typeof global.dfail === 'function') global.dfail('admin', m, conn) } catch {} ; return } }
        chat.autolevelup = isEnable
        await persistAndAudit(`CHAT ${m.chat} SET autolevelup=${isEnable}`)
        break

      case 'modoadmin':
      case 'soloadmin':
        if (m.isGroup) { if (!(isAdmin || isOwner)) { try { if (typeof global.dfail === 'function') global.dfail('admin', m, conn) } catch {} ; return } }
        chat.modoadmin = isEnable
        await persistAndAudit(`CHAT ${m.chat} SET modoadmin=${isEnable}`)
        break

      case 'reaction':
      case 'reaccion':
        if (m.isGroup) { if (!(isAdmin || isOwner)) { try { if (typeof global.dfail === 'function') global.dfail('admin', m, conn) } catch {} ; return } } else { if (!isOwner) { try { if (typeof global.dfail === 'function') global.dfail('group', m, conn) } catch {} ; return } }
        chat.reaction = isEnable
        await persistAndAudit(`CHAT ${m.chat} SET reaction=${isEnable}`)
        break

      case 'nsfw':
      case 'modohorny':
        if (m.isGroup) { if (!(isAdmin || isOwner)) { try { if (typeof global.dfail === 'function') global.dfail('admin', m, conn) } catch {} ; return } }
        chat.nsfw = isEnable
        await persistAndAudit(`CHAT ${m.chat} SET nsfw=${isEnable}`)
        break

      case 'antitoxic':
      case 'antitoxicos':
        if (m.isGroup) { if (!(isAdmin || isOwner)) { try { if (typeof global.dfail === 'function') global.dfail('admin', m, conn) } catch {} ; return } }
        chat.antitoxic = isEnable
        await persistAndAudit(`CHAT ${m.chat} SET antitoxic=${isEnable}`)
        break

      case 'jadibotmd':
      case 'modejadibot':
        isAll = true
        if (!isOwner) { try { if (typeof global.dfail === 'function') global.dfail('rowner', m, conn) } catch {} ; return }
        botSettings.jadibotmd = isEnable
        await persistAndAudit(`SET jadibotmd=${isEnable}`)
        break

      case 'detect':
      case 'avisos':
        if (m.isGroup) { if (!(isAdmin || isOwner)) { try { if (typeof global.dfail === 'function') global.dfail('admin', m, conn) } catch {} ; return } } else { if (!isOwner) { try { if (typeof global.dfail === 'function') global.dfail('group', m, conn) } catch {} ; return } }
        chat.detect = isEnable
        await persistAndAudit(`CHAT ${m.chat} SET detect=${isEnable}`)
        break

      case 'antifake':
        if (m.isGroup) { if (!(isAdmin || isOwner)) { try { if (typeof global.dfail === 'function') global.dfail('admin', m, conn) } catch {} ; return } }
        chat.antifake = isEnable
        await persistAndAudit(`CHAT ${m.chat} SET antifake=${isEnable}`)
        break

      case 'public':
        isAll = true
        if (!isOwner) { try { if (typeof global.dfail === 'function') global.dfail('rowner', m, conn) } catch {} ; return }
        botSettings.public = isEnable
        await persistAndAudit(`SET public=${isEnable}`)
        break

      case 'chatbot':
        if (m.isGroup) { if (!(isAdmin || isOwner)) { try { if (typeof global.dfail === 'function') global.dfail('admin', m, conn) } catch {} ; return } }
        chat.chatbot = isEnable
        await persistAndAudit(`CHAT ${m.chat} SET chatbot=${isEnable}`)
        break

      case 'autosticker':
        if (m.isGroup) { if (!(isAdmin || isOwner)) { try { if (typeof global.dfail === 'function') global.dfail('admin', m, conn) } catch {} ; return } }
        chat.autoSticker = isEnable
        await persistAndAudit(`CHAT ${m.chat} SET autoSticker=${isEnable}`)
        break

      case 'antitraba':
        if (m.isGroup) { if (!(isAdmin || isOwner)) { try { if (typeof global.dfail === 'function') global.dfail('admin', m, conn) } catch {} ; return } }
        chat.antiTraba = isEnable
        await persistAndAudit(`CHAT ${m.chat} SET antiTraba=${isEnable}`)
        break

      case 'anticall':
        isAll = true
        if (!isOwner) { try { if (typeof global.dfail === 'function') global.dfail('rowner', m, conn) } catch {} ; return }
        botSettings.antiCall = isEnable
        await persistAndAudit(`SET antiCall=${isEnable}`)
        break

      case 'antiviewonce':
        if (m.isGroup) { if (!(isAdmin || isOwner)) { try { if (typeof global.dfail === 'function') global.dfail('admin', m, conn) } catch {} ; return } }
        chat.antiviewonce = isEnable
        await persistAndAudit(`CHAT ${m.chat} SET antiviewonce=${isEnable}`)
        break

      case 'autoread':
        isAll = true
        if (!isOwner) { try { if (typeof global.dfail === 'function') global.dfail('rowner', m, conn) } catch {} ; return }
        botSettings.autoread = isEnable
        await persistAndAudit(`SET autoread=${isEnable}`)
        break

      case 'antisticker':
        if (m.isGroup) { if (!(isAdmin || isOwner)) { try { if (typeof global.dfail === 'function') global.dfail('admin', m, conn) } catch {} ; return } }
        chat.antiSticker = isEnable
        await persistAndAudit(`CHAT ${m.chat} SET antiSticker=${isEnable}`)
        break

      case 'antiraid':
        if (m.isGroup) { if (!(isAdmin || isOwner)) { try { if (typeof global.dfail === 'function') global.dfail('admin', m, conn) } catch {} ; return } }
        chat.antiRaid = isEnable
        await persistAndAudit(`CHAT ${m.chat} SET antiRaid=${isEnable}`)
        break

      case 'onlypv':
        if (!isOwner) { try { if (typeof global.dfail === 'function') global.dfail('rowner', m, conn) } catch {} ; return }
        chat.onlyPv = isEnable
        await persistAndAudit(`CHAT ${m.chat} SET onlyPv=${isEnable}`)
        break

      case 'onlygp':
        if (!isOwner) { try { if (typeof global.dfail === 'function') global.dfail('rowner', m, conn) } catch {} ; return }
        chat.onlyGp = isEnable
        await persistAndAudit(`CHAT ${m.chat} SET onlyGp=${isEnable}`)
        break

      case 'antiperu':
        if (m.isGroup) { if (!(isAdmin || isOwner)) { try { if (typeof global.dfail === 'function') global.dfail('admin', m, conn) } catch {} ; return } }
        chat.antiperu = isEnable
        await persistAndAudit(`CHAT ${m.chat} SET antiperu=${isEnable}`)
        break

      default:
        return conn.sendMessage ? await conn.sendMessage(m.chat, listMessage, { quoted: fkontak }) : null
    }

    // Mensaje final coherente
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

handler.help = ['enable','disable']
handler.tags = ['nable','owner']
handler.command = ['enable','disable','on','off','true','false','1','0']

export default handler
