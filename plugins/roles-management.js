// plugins/roles-management.js
import {
  getUserRoles,
  addUserRole,
  removeUserRole,
  listRoles
} from '../lib/lib-roles.js'

const handler = async (m, { conn, args, command }) => {
  const sender = m.sender

  // ✅ Solo el creador puede gestionar roles
  const isCreator = global.owner?.includes(sender)
  if (!isCreator && command !== 'roles' && command !== 'roleinfo') {
    return m.reply('❌ Solo el *CREADOR* puede gestionar roles.')
  }

  // ✅ Comandos que requieren usuario mencionado
  const target = m.mentionedJid?.[0]
  if (['addrole', 'removerole', 'setrole', 'roles'].includes(command)) {
    if (!target) return m.reply('Debes mencionar a un usuario.')
  }

  // ✅ Rol requerido
  const role = args[1]

  // ✅ Validar rol existente
  const rolesList = listRoles().map(r => r.role)
  if (['addrole', 'removerole', 'setrole', 'roleinfo'].includes(command)) {
    if (!role) return m.reply('Debes indicar un rol.')
    if (!rolesList.includes(role)) {
      return m.reply(`❌ El rol *${role}* no existe.`)
    }
  }

  // ============================
  // ✅ AÑADIR ROL
  // ============================
  if (command === 'addrole') {
    const ok = addUserRole(target, role)
    if (!ok) return m.reply('⚠️ Ese usuario ya tiene ese rol.')
    return m.reply(`✅ Rol añadido: *${role}*`, null, { mentions: [target] })
  }

  // ============================
  // ✅ REMOVER ROL
  // ============================
  if (command === 'removerole') {
    const ok = removeUserRole(target, role)
    if (!ok) return m.reply('⚠️ Ese usuario no tiene ese rol.')
    return m.reply(`✅ Rol removido: *${role}*`, null, { mentions: [target] })
  }

  // ============================
  // ✅ SETROLE (limpia y asigna)
  // ============================
  if (command === 'setrole') {
    // Quitar todos los roles
    const current = getUserRoles(target)
    for (const r of current) removeUserRole(target, r)

    // Asignar el nuevo
    addUserRole(target, role)
    return m.reply(`✅ Rol establecido: *${role}*`, null, { mentions: [target] })
  }

  // ============================
  // ✅ VER ROLES DEL USUARIO
  // ============================
  if (command === 'roles') {
    const roles = getUserRoles(target)
    if (!roles.length) return m.reply('🔹 Ese usuario no tiene roles.')
    return m.reply(`✅ Roles: ${roles.join(', ')}`, null, { mentions: [target] })
  }

  // ============================
  // ✅ INFORMACIÓN DE UN ROL
  // ============================
  if (command === 'roleinfo') {
    const all = listRoles()
    const info = all.find(r => r.role === role)

    return m.reply(
      `📌 *Información del rol*\n\n` +
      `🔹 Rol: *${info.role}*\n` +
      `🔹 Nivel: *${info.level}*\n` +
      `🔹 Descripción: ${info.description}`
    )
  }
}

handler.command = ['addrole', 'removerole', 'setrole', 'roles', 'roleinfo']
handler.tags = ['roles']
handler.group = true

export default handler
