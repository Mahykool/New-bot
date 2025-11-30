// plugins/roles-management.js
// SW SYSTEM — Roles Manager (versión final optimizada)

import {
  getRolesConfig,
  saveRolesConfig,
  getUserRoles,
  getUserRolesMap,
  setUserRole,
  addUserRole,
  removeUserRole,
  getRoleInfo,
  normalizeRoleId,
  normalizeJid,
  saveUserRolesMap,
  reloadRoles,
  roleExists,
  listRoles
} from '../lib/lib-roles.js'

import { requireCommandAccess } from '../lib/permissions-middleware.js'

// ------------------------------
// Helpers
// ------------------------------
function parseTarget(m, args = []) {
  if (Array.isArray(m.mentionedJid) && m.mentionedJid.length > 0)
    return normalizeJid(m.mentionedJid[0])

  if (m.quoted) {
    const q = m.quoted
    const cand = q.sender || q.participant || q.key?.participant || q.key?.remoteJid
    if (cand) return normalizeJid(cand)
  }

  for (const a of args) {
    if (!a) continue
    const raw = String(a).replace(/[^\d@.+]/g, '')
    if (!raw) continue
    return normalizeJid(raw.includes('@') ? raw : raw)
  }

  return null
}

function extractRoleArg(args = []) {
  for (const a of args) {
    if (!a || a.startsWith('@') || /^@\d+/.test(a)) continue
    return normalizeRoleId(a)
  }
  return normalizeRoleId(args[args.length - 1] || '')
}

const format = txt => `*ROLES* — ${txt}`

// ------------------------------
// Handler principal
// ------------------------------
const handler = async (m, { conn, command, args, usedPrefix }) => {
  const cmd = (command || '').toLowerCase()
  const ctxErr = global.rcanalx || {}
  const ctxWarn = global.rcanalw || {}
  const ctxOk = global.rcanalr || {}

  const rolesConfig = getRolesConfig()
  const validLevels = ['none', 'basic', 'manage', 'full']

  // ------------------------------
  // MENÚ PRINCIPAL — .rolmenu
  // ------------------------------
  if (cmd === 'rolmenu') {
    const info = getRoleInfo(m.sender)
    const userRoles = getUserRoles(m.sender).join(', ') || 'none'
    const available = Object.keys(rolesConfig)
      .map(r => `${r} — ${rolesConfig[r].name}`)
      .join('\n')

    const text = `
🐙 *MENÚ DE ROLES — SW SYSTEM*

👤 *Tu rol principal:* ${info.icon} ${info.name}
🔹 *Roles asignados:* ${userRoles}

━━━━━━━━━━━━━━━━━━
📌 *COMANDOS PARA USUARIOS*
(No requieren permisos especiales)

${usedPrefix}rolmenu  
→ Muestra este menú con toda la información de roles.

${usedPrefix}whois @usuario  
→ Muestra el rol principal y los roles asignados de un usuario.

${usedPrefix}roleinfo <rol>  
→ Muestra información detallada sobre un rol específico.

${usedPrefix}grouproles  
→ Muestra los roles de todos los integrantes del grupo.

${usedPrefix}roles  
→ Lista todos los roles disponibles en el sistema.

━━━━━━━━━━━━━━━━━━
🛡️ *COMANDOS DE MODERACIÓN*
(Los permisos se administran en plugin-permissions.json)

${usedPrefix}setrole @usuario <rol>  
→ Establece un rol principal para el usuario (reemplaza todos los roles anteriores).

${usedPrefix}addrole @usuario <rol>  
→ Agrega un rol adicional al usuario sin eliminar los existentes.

${usedPrefix}removerole @usuario <rol>  
→ Elimina un rol específico del usuario.

${usedPrefix}setpluginrole <rol> <pluginId> <nivel>  
→ Configura el nivel de acceso de un rol para un plugin específico.

${usedPrefix}rolelist  (o ${usedPrefix}role list / ${usedPrefix}role-list)  
→ Muestra todos los roles asignados a un usuario.

${usedPrefix}role reload  (o ${usedPrefix}role-reload)  
→ Recarga todos los roles desde los archivos del sistema.

━━━━━━━━━━━━━━━━━━
📚 *Roles disponibles:*
${available}
`.trim()

    return conn.reply(m.chat, text, m, ctxOk)
  }

  // WHOIS
  if (cmd === 'whois') {
    const target = parseTarget(m, args)
    if (!target)
      return conn.reply(m.chat, format('Debes mencionar o responder a un usuario.'), m, ctxWarn)

    const info = getRoleInfo(target)
    const roles = getUserRoles(target).join(', ') || 'none'

    const text = `
👤 Usuario: ${target}
👑 Rol principal: ${info.icon} ${info.name}
🔹 Roles asignados: ${roles}
`.trim()

    return conn.reply(m.chat, format(text), m, ctxOk)
  }

  // ROLEINFO
  if (cmd === 'roleinfo') {
    const roleId = extractRoleArg(args)
    if (!roleExists(roleId))
      return conn.reply(m.chat, format('Rol inválido. Usa .rolmenu para ver la lista.'), m, ctxWarn)

    const role = rolesConfig[roleId]
    const perms = (role.globalPermissions || []).join(', ') || 'none'
    const plugins = Object.entries(role.pluginPermissions || {})
      .map(([p, lvl]) => `- ${p}: ${lvl}`)
      .join('\n') || 'none'

    const text = `
ID: ${roleId}
Nombre: ${role.name}
Icono: ${role.icon}
Nivel de rol: ${role.roleLevel || 'basic'}
Descripción: ${role.description}

Permisos globales:
${perms !== 'none' ? `- ${perms}` : 'none'}

Permisos por plugin:
${plugins}
`.trim()

    return conn.reply(m.chat, format(text), m, ctxOk)
  }

  // GROUPOLES — lista roles del grupo
  if (cmd === 'grouproles') {
    if (!m.isGroup)
      return conn.reply(m.chat, format('Este comando solo funciona en grupos.'), m, ctxWarn)

    const group = await conn.groupMetadata(m.chat)
    const participants = group.participants || []

    let text = `👥 *ROLES DEL GRUPO*\n\n`

    for (const p of participants) {
      const jid = normalizeJid(p.id)
      const roles = getUserRoles(jid).join(', ') || 'user'
      text += `@${jid.split('@')[0]} — ${roles}\n`
    }

    return conn.reply(m.chat, text.trim(), m, {
      mentions: participants.map(p => p.id)
    })
  }

  // LISTA DE ROLES — .roles
  if (cmd === 'roles') {
    requireCommandAccess(m.sender, 'roles-management', 'roles')

    const all = listRoles()
    const text = `
📚 *ROLES DISPONIBLES EN EL SISTEMA*

${all.map(r => `- ${r}`).join('\n')}
`.trim()

    return conn.reply(m.chat, format(text), m, ctxOk)
  }

  // ------------------------------
  // COMANDOS DE MODERACIÓN
  // ------------------------------

  // SETROLE
  if (cmd === 'setrole') {
    requireCommandAccess(m.sender, 'roles-management', 'setrole')

    const target = parseTarget(m, args)
    const roleId = extractRoleArg(args)

    if (!target || !roleExists(roleId))
      return conn.reply(m.chat, format('Uso: .setrole @usuario <rol>'), m, ctxWarn)

    const updated = setUserRole(target, roleId)
    try { global.userRoles = getUserRolesMap() } catch {}

    return conn.reply(
      m.chat,
      format(`Rol principal actualizado.\nUsuario: ${target}\nRoles: ${updated.join(', ')}`),
      m,
      ctxOk
    )
  }

  // ADDROLE
  if (cmd === 'addrole') {
    requireCommandAccess(m.sender, 'roles-management', 'addrole')

    const target = parseTarget(m, args)
    const roleId = extractRoleArg(args)

    if (!target || !roleExists(roleId))
      return conn.reply(m.chat, format('Uso: .addrole @usuario <rol>'), m, ctxWarn)

    const updated = addUserRole(target, roleId)
    try { global.userRoles = getUserRolesMap() } catch {}

    return conn.reply(
      m.chat,
      format(`Rol agregado.\nUsuario: ${target}\nRoles: ${updated.join(', ')}`),
      m,
      ctxOk
    )
  }

  // REMOVEROLE
  if (cmd === 'removerole') {
    requireCommandAccess(m.sender, 'roles-management', 'removerole')

    const target = parseTarget(m, args)
    const roleId = extractRoleArg(args)

    if (!target || !roleExists(roleId))
      return conn.reply(m.chat, format('Uso: .removerole @usuario <rol>'), m, ctxWarn)

    const updated = removeUserRole(target, roleId)
    try { global.userRoles = getUserRolesMap() } catch {}

    return conn.reply(
      m.chat,
      format(`Rol removido.\nUsuario: ${target}\nRoles: ${updated.join(', ')}`),
      m,
      ctxOk
    )
  }

  // SETPLUGINROLE
  if (cmd === 'setpluginrole') {
    requireCommandAccess(m.sender, 'roles-management', 'setpluginrole')

    const roleId = normalizeRoleId(args[0] || '')
    const pluginId = (args[1] || '').toLowerCase()
    const level = (args[2] || '').toLowerCase()

    if (!roleExists(roleId))
      return conn.reply(m.chat, format('Rol inválido.'), m, ctxWarn)

    if (!pluginId)
      return conn.reply(m.chat, format('Debes indicar pluginId.'), m, ctxWarn)

    if (!validLevels.includes(level))
      return conn.reply(m.chat, format('Nivel inválido.'), m, ctxWarn)

    rolesConfig[roleId].pluginPermissions =
      rolesConfig[roleId].pluginPermissions || {}

    rolesConfig[roleId].pluginPermissions[pluginId] = level

    saveRolesConfig(rolesConfig)
    reloadRoles?.()

    return conn.reply(
      m.chat,
      format(`Nivel actualizado.\nRol: ${roleId}\nPlugin: ${pluginId}\nNivel: ${level}`),
      m,
      ctxOk
    )
  }

  // role reload (soporta variantes: "role reload", "role-reload")
  if (cmd === 'role-reload') {
    requireCommandAccess(m.sender, 'roles-management', 'role-reload')

    reloadRoles?.()
    try { global.userRoles = getUserRolesMap() } catch {}

    return conn.reply(m.chat, format('Roles recargados desde disco.'), m, ctxOk)
  }

  // role list (soporta variantes: "role list", "role-list", "rolelist")
  if (cmd === 'role-list' || cmd === 'rolelist') {
    requireCommandAccess(m.sender, 'roles-management', 'role-list')

    const target = parseTarget(m, args)
    if (!target)
      return conn.reply(m.chat, format('Uso: .rolelist @usuario'), m, ctxWarn)

    const roles = getUserRoles(target)
    const info = getRoleInfo(target)

    const text = `
Usuario: ${target}
Roles: ${roles.join(', ')}
Principal: ${info.name || info.id}
`.trim()

    return conn.reply(m.chat, format(text), m, ctxOk)
  }

  // legacy: support "role <subcommand>" (space) for backward compatibility
  if (cmd === 'role') {
    // role reload
    if (args[0] === 'reload') {
      requireCommandAccess(m.sender, 'roles-management', 'role-reload')

      reloadRoles?.()
      try { global.userRoles = getUserRolesMap() } catch {}

      return conn.reply(m.chat, format('Roles recargados desde disco.'), m, ctxOk)
    }

    // role list
    if (args[0] === 'list') {
      requireCommandAccess(m.sender, 'roles-management', 'role-list')

      const target = parseTarget(m, args.slice(1))
      if (!target)
        return conn.reply(m.chat, format('Uso: .role list @usuario'), m, ctxWarn)

      const roles = getUserRoles(target)
      const info = getRoleInfo(target)

      const text = `
Usuario: ${target}
Roles: ${roles.join(', ')}
Principal: ${info.name || info.id}
`.trim()

      return conn.reply(m.chat, format(text), m, ctxOk)
    }
  }
}

// ------------------------------
// Registro de comandos
// ------------------------------
handler.help = ['rolmenu']
handler.tags = ['roles']
handler.command = [
  'rolmenu',
  'whois',
  'roleinfo',
  'grouproles',
  'roles',
  'setrole',
  'addrole',
  'removerole',
  'setpluginrole',
  'role',
  'role-reload',
  'role-list',
  'rolelist'
]

export default handler
