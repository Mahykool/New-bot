// plugins/rolesmenumods.js
// ✦ Menú de comandos para MODS ✦ Swill v3.8.0
// Diseñado por Mahykol ✦ Estilo GTA SA

import { getUserRoles, normalizeJid } from '../lib/lib-roles.js'

const handler = async (m, { conn, usedPrefix: _p = '/' }) => {
  const senderNorm = normalizeJid(m.sender)
  const roles = getUserRoles(senderNorm)

  // Si no tiene rol "mod", solo reaccionamos con ✖
  if (!roles.includes('mod')) {
    return conn.sendMessage(m.chat, { react: { text: '✖', key: m.key } })
  }

  let txt = `ㅤׄㅤׅㅤׄ *_MENÚ DE MODERACIÓN DE ROLES_* ㅤ֢ㅤׄㅤׅ\n\n`

  txt += `👤 Usuario: @${senderNorm.split('@')[0]}\n`
  txt += `🎭 Rol actual: ${roles.join(', ')}\n\n`

  txt += `ㅤׄㅤׅㅤׄ *_COMANDOS DISPONIBLES_* ㅤ֢ㅤׄㅤׅ\n`
  txt += `> ⚘ *_${_p}addrolem @usuario rol_*\n`
  txt += `> Añade un rol permitido (VIP o VIP+).\n\n`

  txt += `> ⚘ *_${_p}removerolem @usuario rol_*\n`
  txt += `> Quita un rol permitido (VIP o VIP+).\n\n`

  txt += `> ⚘ *_${_p}setrolem @usuario rol_*\n`
  txt += `> Establece un rol único permitido (VIP o VIP+).\n\n`

  txt += `> ⚘ *_${_p}rolesmenumods_*\n`
  txt += `> Muestra tus roles y los disponibles.\n\n`

  txt += `Mahykol — SWILL`

  return m.reply(txt, null, { mentions: [senderNorm] })
}

handler.help = ['rolesmenumods']
handler.tags = ['modmenu']
handler.command = ['rolesmenumods']
handler.group = true
handler.description = 'Menú de asignamiento de ciertos roles'

export default handler
