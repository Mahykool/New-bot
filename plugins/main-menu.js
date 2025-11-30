// ✦ Menú Oficial LATAM ✦ Swill v3.8.0 (parcheado: robustez y compatibilidad)
// Diseñado por Mahykol ✦ Estilo GTA SA
// Mejoras: manejo seguro de plugins faltantes, deduplicación, soporte opcional de imagen local,
// uso seguro de conn.user.jid y protección contra plugins sin help/tags.

import { existsSync } from 'fs'
import { join } from 'path'
import { prepareWAMessageMedia, generateWAMessageFromContent, proto } from '@whiskeysockets/baileys'

let handler = async (m, { conn, usedPrefix: _p = '/' }) => {
  try {
    // Recolectar ayuda desde plugins cargados (filtrar deshabilitados y entradas inválidas)
    const help = Object.values(global.plugins || {})
      .filter(p => p && !p.disabled)
      .map(p => ({
        help: Array.isArray(p.help) ? p.help.flat().filter(Boolean) : (p.help ? [p.help] : []),
        tags: Array.isArray(p.tags) ? p.tags.flat().filter(Boolean) : (p.tags ? [p.tags] : [])
      }))

    // Encabezado
    let menuText = `ஓீ🐙 ㅤׄㅤׅㅤׄ *MENUS* ㅤ֢ㅤׄㅤׅ\n\n`

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
      const comandos = help.filter(menu => menu.tags.some(tag => catTags.includes(tag)))
      if (!comandos.length) continue

      menuText += `╭─ ${catName.replace(/\*/g, '')} ─╮\n`
      // Unificar y ordenar comandos
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

    // React rápido si la librería lo soporta
    try {
      if (conn && typeof conn.sendMessage === 'function' && m?.key) {
        await conn.sendMessage(m.chat, { react: { text: '✨', key: m.key } })
      }
    } catch (e) {
      // no crítico, continuar
    }

    // Preparar header (imagen local opcional)
    const localImagePath = join(process.cwd(), 'src', 'menu.jpg')
    let header
    if (existsSync(localImagePath) && typeof conn?.waUploadToServer === 'function') {
      try {
        const media = await prepareWAMessageMedia({ image: { url: localImagePath } }, { upload: conn.waUploadToServer })
        header = proto.Message.InteractiveMessage.Header.fromObject({
          hasMediaAttachment: true,
          imageMessage: media.imageMessage
        })
      } catch (e) {
        // si falla la carga, usar header sin media
        header = proto.Message.InteractiveMessage.Header.fromObject({ hasMediaAttachment: false })
      }
    } else {
      header = proto.Message.InteractiveMessage.Header.fromObject({ hasMediaAttachment: false })
    }

    // Botones nativos (compatibilidad básica)
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
      footer: proto.Message.InteractiveMessage.Footer.fromObject({ text: `ஓீ🐙 ㅤׄㅤׅㅤׄ *Swill-Bot* ㅤ֢ㅤׄㅤׄ` }),
      header,
      nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
        buttons: nativeButtons
      })
    })

    // Asegurar userJid válido
    const userJid = (conn && (conn.user?.id || conn.user?.jid)) ? (conn.user.id || conn.user.jid) : (global?.botNumber ? `${global.botNumber}@s.whatsapp.net` : null)

    const msg = generateWAMessageFromContent(m.chat, { interactiveMessage }, { userJid, quoted: m })
    await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
  } catch (e) {
    console.error('❌ Error en el menú:', e)
    try {
      await conn.sendMessage(m.chat, {
        text: `🍙 *MENÚ BÁSICO*\n\n• ${_p}menu - Menú principal\n• ${_p}ping - Estado del bot\n• ${_p}prefijos - Ver prefijos\n\n⚠️ *Error:* ${e?.message || String(e)}`
      }, { quoted: m })
    } catch (err) {
      console.error('❌ Error enviando fallback del menú:', err)
    }
  }
}

handler.help = ['menu','help']
handler.tags = ['main']
handler.command = ['Swill', 'menu', 'help']

handler.before = async function (m, { conn }) {}

export default handler
