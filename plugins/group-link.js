// plugins/group-link.js — SW SYSTEM PRO v1.0
// ✦ Obtener y pasar el link del grupo ✦
// ✅ Integrado con Roles SW y permisos
// ✅ Estilo GTA SA centrado inline
// ✅ Bot debe ser admin en el grupo para generar link

import { requireCommandAccess } from '../lib/permissions-middleware.js'

// Estilo SW SYSTEM local
function swBlock(title, lines = [], version = 'v1.0') {
  const header = `ㅤׄㅤׅㅤׄ _*${title.toUpperCase()}*_ ㅤ֢ㅤׄㅤׅ`
  const body = lines.map(l => `> ${l}`).join('\n')
  const footer = ``
  return [header, body, footer].filter(Boolean).join('\n\n')
}

let handler = async (m, { conn, usedPrefix, command, isBotAdmin }) => {
  const chatCfg = global.db?.data?.chats?.[m.chat] || {}

  // Validar permisos con Roles SW
  try {
    requireCommandAccess(m, 'group-link', 'link', chatCfg)
  } catch {
    return conn.reply(m.chat, swBlock('GROUP LINK', [
      '❌ No tienes nivel suficiente para usar *GROUP LINK*.'
    ]), m)
  }

  // Verificar que sea grupo
  if (!m.isGroup) {
    return conn.reply(m.chat, swBlock('GROUP LINK', [
      '⚠️ Este comando solo funciona en grupos.'
    ]), m)
  }

  // Verificar que el bot sea admin
  if (!isBotAdmin) {
    return conn.reply(m.chat, swBlock('GROUP LINK', [
      '❌ No soy administrador, no puedo generar el link del grupo.'
    ]), m)
  }

  try {
    const code = await conn.groupInviteCode(m.chat)
    const link = `https://chat.whatsapp.com/${code}`
    return conn.reply(m.chat, swBlock('GROUP LINK', [
      '✅ Aquí está el link de invitación:',
      link
    ]), m)
  } catch (e) {
    return conn.reply(m.chat, swBlock('GROUP LINK', [
      '❌ Error al obtener el link del grupo.',
      `> ${e.message}`
    ]), m)
  }
}

// ✦ Metadatos ✦
handler.pluginId = 'group-link'
handler.help = ['link']
handler.tags = ['tools']
handler.command = /^(linkgroup|grouplink|link)$/i
handler.group = true
handler.botAdmin = true
handler.admin = false
handler.description = 'Obtiene y pasa el link de invitación del grupo (requiere roles SW)'

export default handler
