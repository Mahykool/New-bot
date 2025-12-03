// plugins/rolesmenucreador.js
// ✦ Menú de comandos del creador ✦ Swill v3.8.0
// Diseñado por Mahykol ✦ Estilo GTA SA

import { getUserRoles, normalizeJid } from '../lib/lib-roles.js'

const handler = async (m, { usedPrefix: _p = '/' }) => {
  const senderNorm = normalizeJid(m.sender)
  const roles = getUserRoles(senderNorm)

  if (!roles.includes('creador')) {
    return m.reply('❌ Solo el *CREADOR* puede ver este menú.')
  }

  let txt = `ㅤׄㅤׅㅤׄ *_MENÚ DE ROLES DEL CREADOR_* ㅤ֢ㅤׄㅤׅ\n\n`

  txt += `👤 Usuario: @${senderNorm.split('@')[0]}\n`
  txt += `🎭 Rol actual: creador\n\n`

  txt += `ㅤׄㅤׅㅤׄ *_COMANDOS DISPONIBLES_* ㅤ֢ㅤׄㅤׅ\n`
  txt += `> ⚘ *_${_p}addrolec @usuario rol_*\n`
  txt += `> Añade un rol a un usuario.\n\n`

  txt += `> ⚘ *_${_p}removerolec @usuario rol_*\n`
  txt += `> Quita un rol a un usuario.\n\n`

  txt += `> ⚘ *_${_p}setrolec @usuario rol_*\n`
  txt += `> Establece un rol único para un usuario.\n\n`

  txt += `> ⚘ *_${_p}rolesmenucreador_*\n`
  txt += `> Muestra tus roles y los disponibles.\n\n`

  txt += `Mahykol — SWILL`

  return m.reply(txt, null, { mentions: [senderNorm] })
}

handler.help = ['rolesmenucreador']
handler.tags = ['creador']
handler.command = ['rolesmenucreador']
handler.group = true
handler.description = 'No lo se rick parece falso'

export default handler