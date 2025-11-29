// ✦ Menú Oficial LATAM ✦ Swill v3.8.0
// Diseñado por Mahykol ✦ Estilo GTA SA

import { existsSync } from 'fs'
import { join } from 'path'
import { prepareWAMessageMedia, generateWAMessageFromContent, proto } from '@whiskeysockets/baileys'

let handler = async (m, { conn, usedPrefix: _p }) => {
  try {
    let help = Object.values(global.plugins)
      .filter(p => !p.disabled)
      .map(p => ({
        help: Array.isArray(p.help) ? p.help : p.help ? [p.help] : [],
        tags: Array.isArray(p.tags) ? p.tags : p.tags ? [p.tags] : [],
      }))

    // ✅ Encabezado GTA SA aplicado
    let menuText = `ஓீ🐙 ㅤׄㅤׅㅤׄ *MENUS* ㅤ֢ㅤׄㅤׅ`

    const categories = {
      '*INFO*': ['main', 'info'],
      '*INTELIGENCIA*': ['bots', 'ia'],
      '*JUEGOS*': ['game', 'gacha'],
      '*ECONOMÍA*': ['economy', 'rpgnk'],
      '*GRUPOS*': ['group'],
      '*DESCARGAS*': ['downloader'],
      '*MULTIMEDIA*': ['sticker', 'audio', 'anime'],
      '*TOOLS*': ['tools', 'advanced'],
      '*BÚSQUEDA*': ['search', 'buscador'],
      '*PREMIUM*': ['fun', 'premium', 'social', 'custom'],
      '*CREADOR*': ['owner', 'creador'],
      '*ROLES*': ['roles'],

    }

    for (let catName in categories) {
      let catTags = categories[catName]
      let comandos = help.filter(menu => menu.tags.some(tag => catTags.includes(tag)))

      if (comandos.length) {
        menuText += `\n╭─ ${catName.replace(/\*/g, '')} ─╮\n`
        let uniqueCommands = [...new Set(comandos.flatMap(menu => menu.help))]
        for (let cmd of uniqueCommands) {
          menuText += `│ ✘ ${_p}${cmd}\n`
        }
        menuText += `╰──────────────╯\n`
      }
    }

    menuText += `\n✦ Diseñado por Mahykol — Estilo GTA SA\n`

    await conn.sendMessage(m.chat, { react: { text: '✨', key: m.key } })

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
          display_text: '✘ COMMUNITY LATAM', 
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

    const interactiveMessage = proto.Message.InteractiveMessage.fromObject({
      body: proto.Message.InteractiveMessage.Body.fromObject({ text: menuText }),
      footer: proto.Message.InteractiveMessage.Footer.fromObject({ text: `ஓீ🐙 ㅤׄㅤׅㅤׄ *Swill-Bot* ㅤ֢ㅤׄㅤׅ` }),
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
      text: `🍙 *ITSUNI MENÚ BÁSICO*\n\n• ${_p}menu - Menú principal\n• ${_p}ping - Estado del bot\n• ${_p}prefijos - Ver prefijos\n\n⚠️ *Error:* ${e.message}`
    }, { quoted: m })
  }
}

handler.help = ['menu','help']
handler.tags = ['main']
handler.command = ['Swill', 'menu', 'help']

handler.before = async function (m, { conn }) {}

export default handler
