// plugins/main-menu.js — Versión PRO FINAL SW corregida
// Menú con:
// ✅ Roles SW
// ✅ Permisos SW
// ✅ Categorías organizadas
// ✅ Fallback seguro
// ✅ Menciones y nombres corregidos con formatUserTag

import { existsSync } from 'fs'
import { join } from 'path'
import { prepareWAMessageMedia, generateWAMessageFromContent, proto } from '@whiskeysockets/baileys'
import { requireCommandAccess } from '../lib/permissions-middleware.js'
import { getRoleInfo, normalizeJid } from '../lib/lib-roles.js'
import { formatUserTag } from '../lib/utils.js'

let handler = async (m, { conn, usedPrefix: _p = '/' }) => {
  try {
    const chatCfg = global.db?.data?.chats?.[m.chat] || {}

    // Validar permisos
    try {
      requireCommandAccess(m, 'main-menu', 'menu', chatCfg)
    } catch {
      const fallback = `🍙 *MENÚ BÁSICO*\n\n• ${_p}menu - Menú principal\n• ${_p}ping - Estado del bot\n• ${_p}prefijos - Ver prefijos\n\n⚠️ No tienes acceso al menú completo.`
      return conn.sendMessage(m.chat, { text: fallback }, { quoted: m })
    }

    // Recolectar ayuda desde plugins cargados
    const help = Object.values(global.plugins || {})
      .filter(p => p && !p.disabled)
      .map(p => ({
        help: Array.isArray(p.help) ? p.help.flat().filter(Boolean) : (p.help ? [p.help] : []),
        tags: Array.isArray(p.tags) ? p.tags.flat().filter(Boolean) : (p.tags ? [p.tags] : [])
      }))

    let menuText = `ஓீ🐙 ㅤׄㅤׅㅤׄ *MENÚS* ㅤ֢ㅤׄㅤׅ\n\n`

    const categories = {
      '*INFO*': ['main', 'info'],
      '*GRUPOS*': ['group'],
      '*MODERACIÓN*': ['modmenu'],
      '*ROLES*': ['roles'],
      '*CREADOR*': ['owner', 'creador']
    }

    for (const catName of Object.keys(categories)) {
      const catTags = categories[catName]
      const comandos = help.filter(menu => Array.isArray(menu.tags) && menu.tags.some(tag => catTags.includes(tag)))
      if (!comandos.length) continue

      menuText += `╭─ ${catName.replace(/\*/g, '')} ─╮\n`
      const uniqueCommands = [...new Set(comandos.flatMap(menu => menu.help || []))]
        .map(c => String(c).trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))

      for (const cmd of uniqueCommands) {
        menuText += `│ ✘ ${_p}${cmd}\n`
      }
      menuText += `╰──────────────╯\n\n`
    }

    menuText += `✦ Mahykol — SWILL\n`

    // Imagen opcional
    const localImagePath = join(process.cwd(), 'src', 'menu.jpg')
    let header
    if (existsSync(localImagePath) && typeof conn?.waUploadToServer === 'function') {
      try {
        const media = await prepareWAMessageMedia({ image: { url: localImagePath } }, { upload: conn.waUploadToServer })
        header = proto.Message.InteractiveMessage.Header.fromObject({
          hasMediaAttachment: true,
          imageMessage: media.imageMessage
        })
      } catch {
        header = proto.Message.InteractiveMessage.Header.fromObject({ hasMediaAttachment: false })
      }
    } else {
      header = proto.Message.InteractiveMessage.Header.fromObject({ hasMediaAttachment: false })
    }

    // Rol del solicitante
    const senderJid = normalizeJid(m.sender)
    const roleInfo = getRoleInfo(senderJid) || {}
    const roleLabel = `${roleInfo.icon || ''} ${roleInfo.name || roleInfo.id || 'user'}`.trim()
    const display = await formatUserTag(conn, senderJid)

    const nativeButtons = [
      {
        name: 'quick_reply',
        buttonParamsJson: JSON.stringify({
          display_text: '📜 Menú Swill',
          id: '#menu'
        })
      },
      {
        name: 'cta_url',
        buttonParamsJson: JSON.stringify({
          display_text: 'Ver comunidad',
          url: 'https://chat.whatsapp.com/K02sv6Fm87fBQvlNKIGOQB'
        })
      }
    ]

    const interactiveMessage = proto.Message.InteractiveMessage.fromObject({
      body: proto.Message.InteractiveMessage.Body.fromObject({ text: menuText }),
      footer: proto.Message.InteractiveMessage.Footer.fromObject({ text: `Rol: ${roleLabel} • Solicitado por: ${display}` }),
      header,
      nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
        buttons: nativeButtons
      })
    })

    const userJid = conn.user?.id || conn.user?.jid || `${global.botNumber}@s.whatsapp.net`
    const msg = generateWAMessageFromContent(m.chat, { interactiveMessage }, { userJid, quoted: m })
    await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
  } catch (e) {
    console.error('❌ Error en el menú:', e)
    await conn.sendMessage(m.chat, {
      text: `🍙 *MENÚ BÁSICO*\n\n• ${_p}menu - Menú principal\n• ${_p}ping - Estado del bot\n• ${_p}prefijos - Ver prefijos\n\n⚠️ *Error:* ${e?.message || String(e)}`
    }, { quoted: m })
  }
}

handler.help = ['menu','help']
handler.tags = ['main']
handler.command = ['Swill', 'menu', 'help']
handler.pluginId = 'main-menu'

export default handler
