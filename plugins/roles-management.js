// plugins/roles-management.js
import {
  getUserRoles,
  getRoleInfo,
  addUserRole,
  removeUserRole,
  setUserRole,
  normalizeJid
} from '../lib/lib-roles.js'

const handler = async (m, { conn, args, command }) => {
  const target = m.mentionedJid?.[0]
  if (!target) return m.reply('Debes mencionar a un usuario.')

  const role = args[1]
  if (!role) return m.reply('Debes indicar un rol.')

  if (command === 'addrole') {
    addUserRole(target, role, m.sender)
    return m.reply(`✅ Rol añadido: ${role}`, null, { mentions: [target] })
  }

  if (command === 'removerole') {
    removeUserRole(target, role, m.sender)
    return m.reply(`✅ Rol removido: ${role}`, null, { mentions: [target] })
  }

  if (command === 'setrole') {
    setUserRole(target, role, m.sender)
    return m.reply(`✅ Rol establecido: ${role}`, null, { mentions: [target] })
  }

  if (command === 'roles') {
    const roles = getUserRoles(target)
    return m.reply(`Roles: ${roles.join(', ')}`, null, { mentions: [target] })
  }

  if (command === 'roleinfo') {
    const info = getRoleInfo(role)
    return m.reply(`Rol: ${info.name}\nNivel: ${info.roleLevel}`)
  }
}

handler.command = ['addrole', 'removerole', 'setrole', 'roles', 'roleinfo']
handler.tags = ['roles']
handler.group = true

export default handler
