// plugins/roles-management.js
// SW SYSTEM — Roles Manager (Versión PRO, con targets y menciones corregidas)
// - Control 100% por roles (requireCommandAccess)
// - Targets resueltos con parseTarget + fallback robusto
// - JIDs normalizados correctamente
// - Menciones reales en las respuestas clave

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
  reloadRoles,
  roleExists,
  listRoles
} from '../lib/lib-roles.js'

import { requireCommandAccess } from '../lib/permissions-middleware.js'
import { parseTarget } from '../lib/utils.js'

// ------------------------------
// Helpers
// ------------------------------
function extractRoleArg(args = []) {
  // Toma el primer arg que no sea mención ni vacío
  for (const a of args) {
    if (!a || a.startsWith('@') || /^@\d+/.test(a)) continue
    return normalizeRoleId(a)
  }
  return normalizeRoleId(args[args.length - 1] || '')
}

// Resolver target usando parseTarget + fallbacks (mención, reply)
function resolveTarget(m, args = []) {
  let raw = null

  // 1) Intentar parseTarget centralizado
  try {
    if (typeof parseTarget === 'function') {
      raw = parseTarget(m, args)
    }
  } catch {}

  // 2) Fallback: menciones del mensaje
  if (!raw && Array.isArray(m.mentionedJid) && m.mentionedJid.length > 0) {
    raw = m.mentionedJid[0]
  }

  // 3) Fallback: reply
  if (!raw && m.quoted) {
    raw = m.quoted.sender || m.quoted.participant || null
  }

  // 4) Normalizar
  const target = raw ? normalizeJid(raw) : null
  return target
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

  const chatCfg = global.db?.data?.chats?.[m.chat] || global.chatDefaults || {}
  const actor = normalizeJid(m.sender)

  // ------------------------------
  // MENÚ PRINCIPAL — .rolmenu (público)
  // ------------------------------
  if (cmd === 'rolmenu') {
    const info = getRoleInfo(m.sender)
    const userRoles = getUserRoles(m.sender)
    const userRolesStr = userRoles.length ? userRoles.join(', ') : 'none'

    const available = Object.keys(rolesConfig)
      .map(r => `${r} — ${rolesConfig[r].name}`)
      .join('\n')

    const text = `
🐙 *MENÚ DE ROLES — SW SYSTEM*

👤 *Tu rol principal:* ${info.icon} ${info.name}
🔹 *Roles asignados:* ${userRolesStr}

━━━━━━━━━━━━━━━━━━
📌 *COMANDOS PARA USUARIOS*
(No requieren permisos especiales)

${usedPrefix}rolmenu  
→ Muestra este menú.

${usedPrefix}whois @usuario  
→ Muestra el rol principal y los roles de un usuario.

${usedPrefix}roleinfo <rol>  
→ Info detallada de un rol.

${usedPrefix}grouproles  
→ Roles de todos los integrantes del grupo.

${usedPrefix}roles  
→ Lista todos los roles del sistema (según permisos).

━━━━━━━━━━━━━━━━━━
🛡️ *COMANDOS DE MODERACIÓN*
(Controlados por plugin-permissions.json)

${usedPrefix}setrole @usuario <rol>  
${usedPrefix}addrole @usuario <rol>  
${usedPrefix}removerole @usuario <rol>  
${usedPrefix}setpluginrole <rol> <pluginId> <nivel>  
${usedPrefix}rolelist @usuario  
${usedPrefix}role reload

━━━━━━━━━━━━━━━━━━
📚 *Roles disponibles:*
${available}
`.trim()

    return conn.reply(m.chat, text, m, ctxOk)
  }

  // WHOIS — público
  if (cmd === 'whois') {
    const target = resolveTarget(m, args)
    if (!target) {
      return conn.reply(
        m.chat,
        format('Debes mencionar o responder a un usuario.'),
        m,
        ctxWarn
      )
    }

    const info = getRoleInfo(target)
    const roles = getUserRoles(target)
    const rolesStr = roles.length ? roles.join(', ') : 'none'

    const text = `
👤 Usuario: @${target.split('@')[0]}
👑 Rol principal: ${info.icon} ${info.name}
🔹 Roles asignados: ${rolesStr}
`.trim()

    return conn.reply(m.chat, format(text), m, {
      ...ctxOk,
      mentions: [target]
    })
  }

  // ROLEINFO — público
  if (cmd === 'roleinfo') {
    const roleId = extractRoleArg(args)
    if (!roleExists(roleId)) {
      return conn.reply(
        m.chat,
        format('Rol inválido. Usa .rolmenu para ver la lista.'),
        m,
        ctxWarn
      )
    }

    const role = rolesConfig[roleId]
    const perms = role.globalPermissions || []
    const permsStr = perms.length ? perms.join(', ') : 'none'

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
${permsStr !== 'none' ? `- ${permsStr}` : 'none'}

Permisos por plugin:
${plugins}
`.trim()

    return conn.reply(m.chat, format(text), m, ctxOk)
  }

  // GROUPOLES — público pero solo en grupos
  if (cmd === 'grouproles') {
    if (!m.isGroup) {
      return conn.reply(
        m.chat,
        format('Este comando solo funciona en grupos.'),
        m,
        ctxWarn
      )
    }

    const group = await conn.groupMetadata(m.chat)
    const participants = group.participants || []

    let text = `👥 *ROLES DEL GRUPO*\n\n`
    const mentions = []

    for (const p of participants) {
      const jid = normalizeJid(p.id || p)
      const roles = getUserRoles(jid)
      const rolesStr = roles.length ? roles.join(', ') : 'user'
      const tag = `@${jid.split('@')[0]}`
      text += `${tag} — ${rolesStr}\n`
      mentions.push(jid)
    }

    return conn.reply(
      m.chat,
      text.trim(),
      m,
      {
        mentions,
        ...ctxOk
      }
    )
  }

  // ROLES — protegido por roles
  if (cmd === 'roles') {
    try {
      requireCommandAccess(m, 'roles-management', 'roles', chatCfg)
    } catch {
      return conn.reply(
        m.chat,
        format('No tienes permisos para usar este comando.'),
        m,
        ctxWarn
      )
    }

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
    try {
      requireCommandAccess(m, 'roles-management', 'setrole', chatCfg)
    } catch {
      return conn.reply(
        m.chat,
        format('No tienes permisos para usar este comando.'),
        m,
        ctxWarn
      )
    }

    const target = resolveTarget(m, args)
    const roleId = extractRoleArg(args)

    if (!target || !roleExists(roleId)) {
      return conn.reply(
        m.chat,
        format('Uso: .setrole @usuario <rol>'),
        m,
        ctxWarn
      )
    }

    const updated = setUserRole(target, roleId, actor)
    try { global.userRoles = getUserRolesMap() } catch {}

    const rolesStr = updated.length ? updated.join(', ') : 'none'
    const tag = `@${target.split('@')[0]}`

    const text = `
Rol principal actualizado.
Usuario: ${tag}
Roles: ${rolesStr}
`.trim()

    return conn.reply(
      m.chat,
      format(text),
      m,
      {
        ...ctxOk,
        mentions: [target]
      }
    )
  }

  // ADDROLE
  if (cmd === 'addrole') {
    try {
      requireCommandAccess(m, 'roles-management', 'addrole', chatCfg)
    } catch {
      return conn.reply(
        m.chat,
        format('No tienes permisos para usar este comando.'),
        m,
        ctxWarn
      )
    }

    const target = resolveTarget(m, args)
    const roleId = extractRoleArg(args)

    if (!target || !roleExists(roleId)) {
      return conn.reply(
        m.chat,
        format('Uso: .addrole @usuario <rol>'),
        m,
        ctxWarn
      )
    }

    const updated = addUserRole(target, roleId, actor)
    try { global.userRoles = getUserRolesMap() } catch {}

    const rolesStr = updated.length ? updated.join(', ') : 'none'
    const tag = `@${target.split('@')[0]}`]

    const text = `
Rol agregado.
Usuario: ${tag}
Roles: ${rolesStr}
`.trim()

    return conn.reply(
      m.chat,
      format(text),
      m,
      {
        ...ctxOk,
        mentions: [target]
      }
    )
  }

  // REMOVEROLE
  if (cmd === 'removerole') {
    try {
      requireCommandAccess(m, 'roles-management', 'removerole', chatCfg)
    } catch {
      return conn.reply(
        m.chat,
        format('No tienes permisos para usar este comando.'),
        m,
        ctxWarn
      )
    }

    const target = resolveTarget(m, args)
    const roleId = extractRoleArg(args)

    if (!target || !roleExists(roleId)) {
      return conn.reply(
        m.chat,
        format('Uso: .removerole @usuario <rol>'),
        m,
        ctxWarn
      )
    }

    const updated = removeUserRole(target, roleId, actor)
    try { global.userRoles = getUserRolesMap() } catch {}

    const rolesStr = updated.length ? updated.join(', ') : 'none'
    const tag = `@${target.split('@')[0]}`

    const text = `
Rol removido.
Usuario: ${tag}
Roles: ${rolesStr}
`.trim()

    return conn.reply(
      m.chat,
      format(text),
      m,
      {
        ...ctxOk,
        mentions: [target]
      }
    )
  }

  // SETPLUGINROLE
  if (cmd === 'setpluginrole') {
    try {
      requireCommandAccess(m, 'roles-management', 'setpluginrole', chatCfg)
    } catch {
      return conn.reply(
        m.chat,
        format('No tienes permisos para usar este comando.'),
        m,
        ctxWarn
      )
    }

    const roleId = normalizeRoleId(args[0] || '')
    const pluginId = (args[1] || '').toLowerCase()
    const level = (args[2] || '').toLowerCase()

    if (!roleExists(roleId)) {
      return conn.reply(m.chat, format('Rol inválido.'), m, ctxWarn)
    }
    if (!pluginId) {
      return conn.reply(m.chat, format('Debes indicar pluginId.'), m, ctxWarn)
    }
    if (!validLevels.includes(level)) {
      return conn.reply(m.chat, format('Nivel inválido.'), m, ctxWarn)
    }

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

  // ROLE-RELOAD
  if (cmd === 'role-reload') {
    try {
      requireCommandAccess(m, 'roles-management', 'role-reload', chatCfg)
    } catch {
      return conn.reply(
        m.chat,
        format('No tienes permisos para usar este comando.'),
        m,
        ctxWarn
      )
    }

    reloadRoles?.()
    try { global.userRoles = getUserRolesMap() } catch {}

    return conn.reply(
      m.chat,
      format('Roles recargados desde disco.'),
      m,
      ctxOk
    )
  }

  // ROLE-LIST / ROLELIST
  if (cmd === 'role-list' || cmd === 'rolelist') {
    try {
      requireCommandAccess(m, 'roles-management', 'role-list', chatCfg)
    } catch {
      return conn.reply(
        m.chat,
        format('No tienes permisos para usar este comando.'),
        m,
        ctxWarn
      )
    }

    const target = resolveTarget(m, args)
    if (!target) {
      return conn.reply(
        m.chat,
        format('Uso: .rolelist @usuario'),
        m,
        ctxWarn
      )
    }

    const roles = getUserRoles(target)
    const info = getRoleInfo(target)
    const rolesStr = roles.length ? roles.join(', ') : 'none'
    const tag = `@${target.split('@')[0]}`

    const text = `
Usuario: ${tag}
Roles: ${rolesStr}
Principal: ${info.name || info.id}
`.trim()

    return conn.reply(
      m.chat,
      format(text),
      m,
      {
        ...ctxOk,
        mentions: [target]
      }
    )
  }

  // LEGACY: role <subcommand>
  if (cmd === 'role') {
    // role reload
    if (args[0] === 'reload') {
      try {
        requireCommandAccess(m, 'roles-management', 'role-reload', chatCfg)
      } catch {
        return conn.reply(
          m.chat,
          format('No tienes permisos para usar este comando.'),
          m,
          ctxWarn
        )
      }

      reloadRoles?.()
      try { global.userRoles = getUserRolesMap() } catch {}

      return conn.reply(
        m.chat,
        format('Roles recargados desde disco.'),
        m,
        ctxOk
      )
    }

    // role list
    if (args[0] === 'list') {
      try {
        requireCommandAccess(m, 'roles-management', 'role-list', chatCfg)
      } catch {
        return conn.reply(
          m.chat,
          format('No tienes permisos para usar este comando.'),
          m,
          ctxWarn
        )
      }

      const target = resolveTarget(m, args.slice(1))
      if (!target) {
        return conn.reply(
          m.chat,
          format('Uso: .role list @usuario'),
          m,
          ctxWarn
        )
      }

      const roles = getUserRoles(target)
      const info = getRoleInfo(target)
      const rolesStr = roles.length ? roles.join(', ') : 'none'
      const tag = `@${target.split('@')[0]}`

      const text = `
Usuario: ${tag}
Roles: ${rolesStr}
Principal: ${info.name || info.id}
`.trim()

      return conn.reply(
        m.chat,
        format(text),
        m,
        {
          ...ctxOk,
          mentions: [target]
        }
      )
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

// Sin handler.admin ni handler.botAdmin: todo por roles
export default handler
