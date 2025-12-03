// plugins/delete-message.js — SW SYSTEM PRO v1.6
// ✦ Eliminar mensajes respondidos ✦
// ✅ Integrado con Roles SW y permisos
// ✅ Estilo SW SYSTEM inline
// ✅ Bot admin requerido para borrar mensajes ajenos
// ✅ Extracción robusta de id y participant (key/contextInfo/ephemeral/viewOnce)

import { requireCommandAccess } from '../lib/permissions-middleware.js'

// Estilo SW SYSTEM local
function swBlock(title, lines = [], version = 'v1.6') {
  const header = `ㅤׄㅤׅㅤׄ _*${title.toUpperCase()}*_ ㅤ֢ㅤׄㅤׅ`
  const body = lines.map(l => `> ${l}`).join('\n')
  const footer = ``
  return [header, body, footer].filter(Boolean).join('\n\n')
}

// Desenvuelve mensajes ephemeral/viewOnce para acceder a contextInfo
function unwrapMessage(msg) {
  if (!msg) return msg
  if (msg.ephemeralMessage?.message) return msg.ephemeralMessage.message
  if (msg.viewOnceMessage?.message) return msg.viewOnceMessage.message
  if (msg.viewOnceMessageV2?.message) return msg.viewOnceMessageV2.message
  if (msg.viewOnceMessageV2Extension?.message) return msg.viewOnceMessageV2Extension.message
  return msg
}

// Obtiene id y participant desde múltiples fuentes
function extractIdAndParticipant(quoted) {
  if (!quoted) return { id: null, participant: null }
  const key = quoted.key || {}

  // Base
  let id = key.id || quoted.id || null
  let participant = key.participant || quoted.participant || quoted.sender || null

  // Desenrollar mensaje para mirar contextInfo
  const qmsg = unwrapMessage(quoted.message)
  const maybeCtx =
    qmsg?.extendedTextMessage?.contextInfo ||
    qmsg?.imageMessage?.contextInfo ||
    qmsg?.videoMessage?.contextInfo ||
    qmsg?.audioMessage?.contextInfo ||
    qmsg?.documentMessage?.contextInfo ||
    qmsg?.stickerMessage?.contextInfo ||
    qmsg?.contactMessage?.contextInfo ||
    qmsg?.buttonsMessage?.contextInfo ||
    qmsg?.listMessage?.contextInfo ||
    null

  // Algunas implementaciones guardan el id en stanzaId/citation
  const stanzaId = maybeCtx?.stanzaId || maybeCtx?.quotedStanzaID || null
  const ctxParticipant = maybeCtx?.participant || maybeCtx?.remoteJid || null

  id = id || stanzaId || null
  participant = participant || ctxParticipant || null

  return { id, participant }
}

// Construye la clave delete compatible con Baileys
function buildDeleteKey(m) {
  const quoted = m?.quoted
  if (!quoted) return null

  const key = quoted.key || {}
  const remoteJid = key.remoteJid || m.chat
  const fromMe = key.fromMe === true

  const { id, participant } = extractIdAndParticipant(quoted)
  if (!remoteJid || !id) return null

  if (fromMe) {
    // Borrar mensaje enviado por el propio bot
    return { remoteJid, fromMe: true, id }
  } else {
    // Borrar mensaje de otro participante en grupo (bot admin requerido)
    return { remoteJid, id, participant }
  }
}

let handler = async (m, { conn, usedPrefix, command, isBotAdmin }) => {
  const chatCfg = global.db?.data?.chats?.[m.chat] || {}

  // Validar permisos con Roles SW
  try {
    requireCommandAccess(m, 'group-delete', 'delete', chatCfg)
  } catch {
    return conn.reply(m.chat, swBlock('DELETE', [
      '❌ No tienes nivel suficiente para usar *DELETE*.'
    ]), m)
  }

  // Debe ser respuesta a un mensaje
  if (!m.quoted) {
    return conn.reply(m.chat, swBlock('DELETE', [
      '⚠️ Debes responder al mensaje que quieres eliminar.',
      `Ejemplo: ${usedPrefix + command} (respondiendo al mensaje)`
    ]), m)
  }

  // Construir clave de borrado
  const delKey = buildDeleteKey(m)
  if (!delKey) {
    return conn.reply(m.chat, swBlock('DELETE', [
      '⚠️ No se pudo identificar el mensaje respondido para eliminar.',
      'Puede ser un mensaje de sistema o sin identificador.'
    ]), m)
  }

  // Si se va a borrar mensaje de otro, verificar que el bot sea admin
  const borrarAjeno = !delKey.fromMe
  if (borrarAjeno && !isBotAdmin) {
    return conn.reply(m.chat, swBlock('DELETE', [
      '❌ No puedo borrar mensajes de otros porque no soy administrador.',
      'Conviérteme en admin y vuelve a intentar.'
    ]), m)
  }

  try {
    await conn.sendMessage(m.chat, { delete: delKey })
    return conn.reply(m.chat, swBlock('DELETE', [
      '✅ Mensaje eliminado correctamente.'
    ]), m)
  } catch (e) {
    // Informar sin romper
    return conn.reply(m.chat, swBlock('DELETE', [
      '❌ No se pudo eliminar este mensaje.',
      'Es posible que sea de sistema, efímero o ya no exista.',
      `> ${e.message}`
    ]), m)
  }
}

// ✦ Metadatos ✦
handler.pluginId = 'group-delete'
handler.help = ['delete']
handler.tags = ['modmenu']
handler.command = ['delete','del','borrar']
handler.group = true
handler.botAdmin = true // requerido para borrar mensajes de otros
handler.admin = false
handler.description = 'Elimina el mensaje al que respondes (requiere roles SW)'

export default handler
