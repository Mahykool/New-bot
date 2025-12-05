// plugins/main-menu.js
// ✦ Menú Oficial LATAM ✦ Swill v3.8.0
// Diseñado por Mahykol ✦ Estilo GTA SA

import { existsSync } from 'fs'
import { join } from 'path'
import { prepareWAMessageMedia, generateWAMessageFromContent, proto } from '@whiskeysockets/baileys'
import { requireCommandAccess } from '../lib/permissions-middleware.js'
import { getUserRoles, getUserLevel, getRoleInfo, normalizeJid } from '../lib/lib-roles.js'

let handler = async (m, { conn, usedPrefix: _p = '/' }) => {
  try {
    const chatCfg = global.db?.data?.chats?.[m.chat] || {}

    // Validar acceso
    try {
      requireCommandAccess(m, 'main-menu', 'menu', chatCfg)
    } catch {
      const fallback = `🍙 *MENÚ BÁSICO*\n\n• ${_p}menu - Menú principal\n• ${_p}ping - Estado del bot\n• ${_p}prefijos - Ver prefijos\n\n⚠️ No tienes acceso al menú completo.`
      await conn.sendMessage(m.chat, { text: fallback }, { quoted: m })
      return
    }

    // Recolectar ayuda desde plugins
    const plugins = Object.values(global.plugins || {}).filter(p => p && !p.disabled)

    // Encabezado principal
    let menuText = `ஓீ ㅤׄㅤׅㅤׄ *MENÚS* ㅤ֢ㅤ🐙ㅤׅ\n\n`

    // Categorías
    const categories = {
      '*INFO*': ['main', 'info'],
      '*INTELIGENCIA*': ['bots', 'ia'],
      '*JUEGOS*': ['game', 'gacha'],
      '*ECONOMÍA*': ['economy', 'rpgnk'],
      '*GRUPOS*': ['group'],
      '*DESCARGAS*': ['downloader'],
      '*MULTIMEDIA*': ['multimedia'],
      '*TOOLS*': ['tools', 'advanced'],
      '*BÚSQUEDA*': ['search', 'buscador'],
      '*ROLES*': ['roles'],
      '*VIPS*': ['fun', 'premium', 'social', 'custom'],
      '*MODERACIÓN*': ['modmenu'],
      '*CREADOR*': ['owner', 'creador']
    }

    for (const catName of Object.keys(categories)) {
      const catTags = categories[catName]
      const comandos = plugins.filter(p => Array.isArray(p.tags) && p.tags.some(tag => catTags.includes(tag)))
      if (!comandos.length) continue

      // Título centrado
      menuText += `ㅤׄㅤׅㅤׄ ${catName} ㅤ֢ㅤׄㅤׅ\n`

      const uniqueCommands = [...new Set(comandos.flatMap(p => Array.isArray(p.help) ? p.help : [p.help]).filter(Boolean))]
        .map(c => String(c).trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))

      for (const cmd of uniqueCommands) {
  const plugin = plugins.find(p =>
    p.help && (Array.isArray(p.help) ? p.help.includes(cmd) : p.help === cmd)
  )
  const desc = plugin?.description || 'Sin descripción disponible'

  menuText += `> ⚘ *_${_p}${cmd}_*\n`
  menuText += `> ${desc}\n\n`   // ← aquí agregamos un salto de línea extra
}
      menuText += `\n`
    }

    // Detectar roles correctamente
    let roleLabel = 'user'
    try {
      const senderNorm = normalizeJid(m.sender || '')
      const roles = getUserRoles(senderNorm)
      const level = getUserLevel(senderNorm)
      const roleInfo = getRoleInfo(level)

      if (roles.length) {
        roleLabel = roles.join(', ')
      } else if (roleInfo && (roleInfo.name || roleInfo.id)) {
        roleLabel = `${roleInfo.icon || ''} ${roleInfo.name || roleInfo.id}`.trim()
      }
    } catch (err) {
      console.error('Error detectando rol:', err)
    }

    menuText += `Mahykol — SWILL\n`

    // 1) Enviar menú como texto
    await conn.sendMessage(m.chat, { text: menuText + `\n\nRol: ${roleLabel}` }, { quoted: m })

    // 2) Header opcional con imagen (NO se toca tu bloque)
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

    // Botones nativos
const nativeButtons = [
  {
    name: 'cta_url',
    buttonParamsJson: JSON.stringify({
      display_text: 'Ver comunidad',
      url: 'https://chat.whatsapp.com/K02sv6Fm87fBQvlNKIGOQB'
    })
  },
  {
    name: 'cta_url',
    buttonParamsJson: JSON.stringify({
      display_text: 'Ver general',
      url: 'https://chat.whatsapp.com/C01CZDKL88uEFRZqlLxOdg'
    })
  }
]


    const buttonsBodyText = `ㅤׄㅤׅㅤׄ *_COMUNIDAD_* ㅤ֢ㅤׄㅤׅ\n> ⚘ _Agrupate en tu juego fav._`

    const interactiveButtons = proto.Message.InteractiveMessage.fromObject({
      body: proto.Message.InteractiveMessage.Body.fromObject({ text: buttonsBodyText }),
      footer: proto.Message.InteractiveMessage.Footer.fromObject({ text: `Rol: ${roleLabel} • Swill-Bot` }),
      header,
      nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
        buttons: nativeButtons
      })
    })

    const userJid = (conn.user?.id || conn.user?.jid) || (global?.botNumber ? `${global.botNumber}@s.whatsapp.net` : null)

    try {
      const msgButtons = generateWAMessageFromContent(m.chat, { interactiveMessage: interactiveButtons }, { userJid, quoted: m })
      await conn.relayMessage(m.chat, msgButtons.message, { messageId: msgButtons.key.id })
    } catch (e) {
      await conn.sendMessage(m.chat, {
        text: `${buttonsBodyText}\n\n• Comunidad: https://chat.whatsapp.com/K02sv6Fm87fBQvlNKIGOQB`
      }, { quoted: m })
    }

  } catch (e) {
    await conn.sendMessage(m.chat, {
      text: `🍙 *MENÚ BÁSICO*\n\n• ${_p}menu - Menú principal\n• ${_p}ping - Estado del bot\n• ${_p}prefijos - Ver prefijos\n\n⚠️ *Error:* ${e?.message || String(e)}`
    }, { quoted: m })
  }
}

handler.help = ['menu']
handler.tags = ['main']
handler.command = ['menuswill', 'menu', 'help']
handler.pluginId = 'main-menu'
handler.description = 'Menu donde se encuentran los comandos'

export default handler