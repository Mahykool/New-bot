// plugins/roles-admin-menu.js
import {
  getUserRoles,
  getUserLevel,
  listRoles,
  addUserRole,
  removeUserRole,
  getRoleInfo,
  normalizeJid
} from '../lib/lib-roles.js'

import { parseTarget, resolveAliasToJid } from '../lib/utils.js'

const handler = async (m, { conn, args, command }) => {
  const sender = m.sender
  const senderNorm = normalizeJid(sender)
  const roles = getUserRoles(senderNorm)
  const level = getUserLevel(senderNorm)
  const roleInfo = getRoleInfo(level)

  // primero intenta con parseTarget
  let target = parseTarget(m, args)

  // si no encontró nada, intenta resolver alias
  if (!target && args[0]) {
    target = await resolveAliasToJid(conn, m, args[0])
  }

  if (!target) return m.reply('⚠️ Debes mencionar, responder o usar un alias válido.')
  const targetNorm = normalizeJid(target)
  if (!targetNorm) return m.reply('⚠️ No se pudo normalizar el usuario.')

  // el rol siempre será el último argumento
  const role = args[args.length - 1]
  const allowedRolesForMods = ['vip', 'vip_plus']
  const allRoles = listRoles()

  if (['addrolem', 'removerolem', 'setrolem'].includes(command)) {
    if (!role) return m.reply('⚠️ Debes indicar un rol.')
    if (!allowedRolesForMods.includes(role)) {
      m.reply('💀 Intentaste modificar un rol superior al permitido... CARITA DE ESQUELETO 💀')
      conn.sendMessage(
        m.chat,
        { text: `#shadowban @${sender.split('@')[0]} 15` },
        { mentions: [senderNorm] }
      )
      return
    }
  }

  if (command === 'addrolem') {
    const ok = addUserRole(targetNorm, role)
    return m.reply(
      ok ? `✅ Rol añadido: *${role}*` : '⚠️ Ese usuario ya tiene ese rol.',
      null,
      { mentions: [targetNorm] }
    )
  }

  if (command === 'removerolem') {
    const ok = removeUserRole(targetNorm, role)
    return m.reply(
      ok ? `✅ Rol removido: *${role}*` : '⚠️ Ese usuario no tiene ese rol.',
      null,
      { mentions: [targetNorm] }
    )
  }

  if (command === 'setrolem') {
    const current = getUserRoles(targetNorm)
    for (const r of current) removeUserRole(targetNorm, r)
    addUserRole(targetNorm, role)
    return m.reply(`✅ Rol establecido: *${role}*`, null, { mentions: [targetNorm] })
  }

  if (command === 'memods') {
    let txt = `🛡️ *MENÚ DE MODERACIÓN DE ROLES*\n\n`
    txt += `👤 Usuario: @${senderNorm.split('@')[0]}\n`
    txt += `🎭 Roles: ${roles.length ? roles.join(', ') : `${roleInfo.icon} ${roleInfo.name}`}\n`
    txt += `📖 Descripción: ${roleInfo.description}\n\n`
    txt += `⚙️ Acciones rápidas (solo VIP y VIP+):\n• .addrolem @user <rol>\n• .removerolem @user <rol>\n• .setrolem @user <rol>\n\n`
    txt += `📌 Roles disponibles:\n\n`
    for (const r of allRoles) {
      txt += `${r.icon || ''} *${r.role}*\n• Nivel: ${r.level}\n• ${r.description}\n\n`
    }

    return m.reply(txt, null, { mentions: [senderNorm] })
  }
}

handler.help = ['memods', 'addrolem', 'removerolem', 'setrolem']
handler.tags = []
handler.command = ['memods', 'addrolem', 'removerolem', 'setrolem']
handler.group = true

export default handler