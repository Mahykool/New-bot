// ✦ Menú Oficial LATAM ✦ Swill v3.8.0
// Diseñado por Mahykol ✦ Estilo GTA SA

import { existsSync } from 'fs'
import { join } from 'path'
import { prepareWAMessageMedia, generateWAMessageFromContent, proto } from '@whiskeysockets/baileys'

import { getRoleInfo } from '../lib/lib-roles.js'
import { hasPermission, listAllPermissions } from '../lib/permissions-middleware.js'

let handler = async (m, { conn, usedPrefix: _p }) => {
  try {
    const user = m.sender

    // ✅ Obtener rol del usuario
    const role = getRoleInfo(user)

    // ✅ Obtener permisos activos
    const allPerms = listAllPermissions()
    const activePerms = allPerms.filter(p => hasPermission(user, p))

    const permsText = activePerms.length
      ? activePerms.map(p => `• ${p}`).join('\n')
      : '• Sin permisos especiales'

    // ✅ Encabezado estilo GTA SA
    let headerText = `
==============================
        SWILL MENU
==============================

${role.icon || '🔹'} *${role.name}*
${role.description}

🔐 *Permisos activos:*
${permsText}

`

    // ✅ Construcción del menú dinámico
    let help = Object.values(global.plugins)
      .filter(p => !p.disabled)
      .map(p => ({
        help: Array.isArray(p.help) ? p.help : p.help ? [p.help] : [],
        tags: Array.isArray(p.tags) ? p.tags : p.tags ? [p.tags] : [],
        desc: p.desc || null
      }))

    let menuText = headerText

    // ✅ Categorías organizadas estilo GTA SA
    const categories = {
      'SWILL INFO': ['main', 'info'],
      'GRUPOS': ['group'],
      'INTELIGENCIA': ['bots', 'ia'],
      'JUEGOS': ['game', 'gacha'],
      'ECONOMÍA': ['economy', 'rpgnk'],
      'DESCARGAS': ['downloader'],
      'MULTIMEDIA': ['sticker', 'audio', 'anime'],
      'TOOLS': ['tools', 'advanced'],
      'BÚSQUEDA': ['search', 'buscador'],
      'PREMIUM': ['fun', 'premium', 'social', 'custom'],
      'STAFF': ['staff', 'mod'],
      'ROLES': ['roles'],
      'OWNER': ['owner', 'creador'],
    }

    // ✅ Estilo GTA SA para cada categoría y comando
    for (let catName in categories) {
      let catTags = categories[catName]
      let comandos = help.filter(menu => menu.tags.some(tag => catTags.includes(tag)))

      if (comandos.length) {
        menuText += `\n╭─ ${catName} ─╮\n`
        let uniqueCommands = [...new Set(comandos.flatMap(menu => menu.help))]

        for (let cmd of uniqueCommands) {
          menuText += `│ ✘ ${_p}${cmd}\n`
        }

        menuText += `╰──────────────╯\n`
      }
    }

    // ✅ Reacción
    await conn.sendMessage(m.chat, { react: { text: '✨', key: m.key } })

    // ✅ Imagen del menú
    const localImagePath = join(process.cwd(), 'src', 'menu.jpg')

    const nativeButtons = [
      {
        name: 'quick_reply',
        buttonParamsJson: JSON.stringify({
          display_text: '📜 Menú Swill',
          id: '.menu'
        })
      },
      {
        name: 'cta_url',
        buttonParamsJson: JSON.stringify({ 
          display_text: '🌐 Comunidad LATAM', 
          url: 'https://chat.whatsapp.com/K02sv6Fm87fBQvlNKIGOQB' 
        })
      },
    ]

    let header
    if (existsSync(localImagePath)) {
      const media = await prepareWAMessageMedia({ image: { url: localImagePath } }, { upload: conn.waUploadToServer })
      header = proto.Message.InteractiveMessage.Header.fromObject({
        hasMediaAttachment: true,
        imageMessage: media.imageMessage
      })
    } else {
      header = proto.Message.InteractiveMessage.Header.fromObject({ hasMediaAttachment: false })
    }

    // ✅ Mensaje interactivo
    const interactiveMessage = proto.Message.InteractiveMessage.fromObject({
      body: proto.Message.InteractiveMessage.Body.fromObject({ text: menuText }),
      footer: proto.Message.InteractiveMessage.Footer.fromObject({
        text: '==============================\n      SWILL SYSTEM V3.8\n=============================='
      }),
      header,
      nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
        buttons: nativeButtons
      })
    })

    const msg = generateWAMessageFromContent(m.chat, { interactiveMessage }, { userJid: conn.user.jid, quoted: m })
    await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })

  } catch (e) {
    console.error('❌ Error en el menú:', e)
    await conn.sendMessage(m.chat, {
      text: `🍙 *Menú Básico LATAM ✦ Swill*\n\n• ${_p}menu - Menú principal\n• ${_p}ping - Estado del bot\n• ${_p}prefijos - Ver prefijos\n\n⚠️ *Error:* ${e.message}`
    }, { quoted: m })
  }
}

handler.help = ['menu','help']
handler.tags = ['main']
handler.command = ['Swill', 'menu', 'help']

export default handler
