// plugins/roles-management.js
import {
  getUserRoles, getUserLevel, listRoles,
  addUserRole, removeUserRole, setUserRole, getRoleInfo,
  normalizeJid, normalizeRole
} from '../lib/lib-roles.js'

import { parseTarget } from '../lib/utils.js'

const handler = async (m, { args, command }) => {
  const senderNorm = normalizeJid(m.sender)
  const roles = getUserRoles(senderNorm)

  if (!roles.includes('creador')) {
    return m.reply('❌ Solo el *CREADOR* puede gestionar roles.')
  }

  const target = parseTarget(m, args)
  if (!target) return m.reply('⚠️ Debes mencionar o responder a un usuario válido.')
  const targetNorm = normalizeJid(target)
  if (!targetNorm) return m.reply('⚠️ No se pudo normalizar el usuario.')

  const roleInput = args[1]
  const roleNorm = normalizeRole(roleInput)
  const availableRoles = listRoles().map(r => r.role)

  if (['addrolec','removerolec','setrolec'].includes(command)) {
    if (!roleNorm || !availableRoles.includes(roleNorm)) {
      return m.reply(`⚠️ Rol inválido.\nRoles disponibles: ${availableRoles.join(', ')}`)
    }
  }

  if (command === 'addrolec') {
    const ok = addUserRole(targetNorm, roleNorm)
    return m.reply(ok ? `✅ Rol añadido: *${roleNorm}*` : '⚠️ Ese usuario ya tiene ese rol.', null, { mentions: [targetNorm] })
  }

  if (command === 'removerolec') {
    const ok = removeUserRole(targetNorm, roleNorm)
    return m.reply(ok ? `✅ Rol removido: *${roleNorm}*` : '⚠️ Ese usuario no tiene ese rol.', null, { mentions: [targetNorm] })
  }

  if (command === 'setrolec') {
    const ok = setUserRole(targetNorm, roleNorm)
    return m.reply(ok ? `✅ Rol establecido: *${roleNorm}*` : '⚠️ No se pudo establecer el rol.', null, { mentions: [targetNorm] })
  }

  if (command === 'nofunka') {
    const level = getUserLevel(senderNorm)
    const roleInfo = getRoleInfo(level)
    let txt = `👑 *MENÚ DE ROLES DEL CREADOR*\n\n`
    txt += `👤 Usuario: @${senderNorm.split('@')[0]}\n`
    txt += `🎭 Roles: ${roles.join(', ')}\n`
    txt += `📖 Descripción: ${roleInfo.description}\n\n`
    txt += `📌 Roles disponibles:\n\n`
    for (const r of listRoles()) {
      txt += `${r.icon || ''} *${r.role}* → Nivel ${r.level}\n${r.description}\n\n`
    }
    return m.reply(txt, null, { mentions: [senderNorm] })
  }
}

handler.help = ['addrolec','removerolec','setrolec']
handler.tags = []
handler.command = ['addrolec','removerolec','setrolec']
handler.group = true

export default handler

