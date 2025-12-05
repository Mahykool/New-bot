// plugins/group-add.js
// ✦ Agregar personas al grupo por número ✦ Swill v3.8.0
// Diseñado por Mahykol ✦ Estilo GTA SA

import { normalizeJid } from '../lib/lib-roles.js'
import { requireCommandAccess } from '../lib/permissions-middleware.js'

const handler = async (m, { conn, args, command, usedPrefix: _p = '/' }) => {
  const chatCfg = global.db?.data?.chats?.[m.chat] || {}

  // Validación centralizada: roles y permisos
  try {
    requireCommandAccess(m, 'group-add', 'add', chatCfg)
  } catch (e) {
    try { const fail = global.dfail; if (fail) fail('access', m, conn) } catch {}
    return
  }

  if (!m.isGroup) {
    return m.reply('⚠️ Este comando solo funciona en grupos.')
  }

  if (!args[0]) {
    return m.reply(`ㅤׄㅤׅㅤׄ *_USO CORRECTO_* ㅤ֢ㅤׄㅤׅ\n\n> ⚘ *_${_p}add +56969066865_*\n> Agrega un número al grupo usando el bot.`)
  }

  // Normalizar número
  let number = args[0].replace(/[^0-9]/g, '')
  if (!number) return m.reply('⚠️ Número inválido.')

  // Crear JID
  const jid = number + '@s.whatsapp.net'

  try {
    await conn.groupParticipantsUpdate(m.chat, [jid], 'add')
    return m.reply(
      `ㅤׄㅤׅㅤׄ *_USUARIO AGREGADO_* ㅤ֢ㅤׄㅤׅ\n\n✅ Se agregó a *@${number}* al grupo.`,
      null,
      { mentions: [jid] }
    )
  } catch (e) {
    return m.reply(
      `ㅤׄㅤׅㅤׄ *_ERROR AL AGREGAR_* ㅤ֢ㅤׄㅤׅ\n\n⚠️ No se pudo agregar al número: ${args[0]}\n• Detalle: ${e.message}`
    )
  }
}

handler.help = ['add <numero>']
handler.tags = ['modmenu']
handler.command = ['add']
handler.group = true
handler.description = 'Agrega un número al grupo usando el sistema de roles y permisos'

export default handler