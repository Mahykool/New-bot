// plugins/main-menu.js
// ✦ Menú Oficial LATAM ✦ Swill v3.8.0 (parcheado: robustez, compatibilidad y permisos)
// Diseñado por Mahykol ✦ Estilo GTA SA
// Cambios: integración con requireCommandAccess, muestra rol del solicitante, manejo seguro de plugins faltantes,
// protección ante denegación de acceso (envía menú básico), y defensas adicionales.

import { existsSync } from 'fs'
import { join } from 'path'
import { prepareWAMessageMedia, generateWAMessageFromContent, proto } from '@whiskeysockets/baileys'
import { requireCommandAccess } from '../lib/permissions-middleware.js'
import { getRoleInfo, normalizeJid } from '../lib/lib-roles.js'

let handler = async (m, { conn, usedPrefix: _p = '/' }) => {
  try {
    const ctxErr = (global.rcanalx || {})
    const ctxOk = (global.rcanalr || {})

    // contexto de chat para whitelist por chat
    const chatCfg = global.db?.data?.chats?.[m.chat] || {}

    // Intentar validar acceso al plugin; si se deniega, enviamos un menú básico y no fallamos
    try {
      requireCommandAccess(m, 'main-menu', 'menu', chatCfg)
    } catch (errAccess) {
      try {
        const fail = (m && (m.plugin && global.plugins?.[m.plugin]?.fail)) ? global.plugins[m.plugin].fail : global.dfail
        if (fail) {
          // llamar a dfail para mantener UX consistente
          try { fail('access', m, conn) } catch {}
        }
      } catch {}
      // Enviar menú básico y salir
      const fallback = `🍙 *MENÚ BÁSICO*\n\n• ${_p}menu - Menú principal\n• ${_p}ping - Estado del bot\n• ${_p}prefijos - Ver prefijos\n\n⚠️ No tienes acceso al menú completo.`
      try { await conn.sendMessage(m.chat, { text: fallback }, { quoted: m }) } catch {}
      return
    }

    // Recolectar ayuda desde plugins cargados (filtrar deshabilitados y entradas inválidas)
    const help = Object.values(global.plugins || {})
      .filter(p => p && !p.disabled)
      .map(p => ({
        help: Array.isArray(p.help) ? p.help.flat().filter(Boolean) : (p.help ? [p.help] : []),
        tags: Array.isArray(p.tags) ? p.tags.flat().filter(Boolean) : (p.tags ? [p.tags] : [])
      }))

    // Encabezado y título
    let menuText = `ஓீ🐙 ㅤׄㅤׅㅤׄ *MENÚS* ㅤ֢ㅤׄㅤׅ\n\n`

    // Categorías y mapeo de tags a secciones
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
      const comandos = help.filter(menu => Array.isArray(menu.tags) && menu.tags.some(tag => catTags.includes(tag)))
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
        header = proto.Message.InteractiveMessage.Header.fromObject({ hasMediaAttachment: false })
      }
    } else {
      header = proto.Message.InteractiveMessage.Header.fromObject({ hasMediaAttachment: false })
    }

    // Obtener info de rol del solicitante para mostrar en footer o encabezado
    let roleLabel = 'user'
    try {
      const senderJid = (typeof normalizeJid === 'function') ? normalizeJid(m.sender) : (m.sender || '')
      const roleInfo = (typeof getRoleInfo === 'function') ? getRoleInfo(senderJid) || {} : {}
      roleLabel = `${roleInfo.icon || ''} ${roleInfo.name || roleInfo.id || 'user'}`.trim()
    } catch (e) {
      roleLabel = 'user'
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
      footer: proto.Message.InteractiveMessage.Footer.fromObject({ text: `Rol: ${roleLabel} • Swill-Bot` }),
      header,
      nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
        buttons: nativeButtons
      })
    })

    // Asegurar userJid válido
    const userJid = (conn && (conn.user?.id || conn.user?.jid)) ? (conn.user.id || conn.user.jid) : (global?.botNumber ? `${global.botNumber}@s.whatsapp.net` : null)

    // Generar y enviar mensaje interactivo con defensas
    try {
      const msg = generateWAMessageFromContent(m.chat, { interactiveMessage }, { userJid, quoted: m })
      await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
    } catch (e) {
      // Fallback: enviar texto plano si la generación interactiva falla
      try {
        await conn.sendMessage(m.chat, { text: menuText + `\n\nRol: ${roleLabel}` }, { quoted: m })
      } catch (err) {
        console.error('Error enviando fallback del menú:', err)
      }
    }
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
handler.pluginId = 'main-menu'

handler.before = async function (m, { conn }) {}

export default handler
