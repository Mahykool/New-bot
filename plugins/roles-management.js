// plugins/roles-management.js
// SW SYSTEM — Roles Manager (Versión PRO con confirmación interactiva)
// - Control 100% por roles (requireCommandAccess)
// - Targets resueltos con parseTarget + fallback robusto
// - Menciones reales en las respuestas clave
// - Confirmación con botones: ✅ Confirmar / ❌ Denegar

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
  for (const a of args) {
    if (!a || a.startsWith('@') || /^@\d+/.test(a)) continue
    return normalizeRoleId(a)
  }
  return normalizeRoleId(args[args.length - 1] || '')
}

function resolveTarget(m, args = []) {
  let raw = null
  try { raw = parseTarget(m, args) } catch {}

  if (!raw && m.mentionedJid?.length) raw = m.mentionedJid[0]
  if (!raw && m.quoted) raw = m.quoted.sender || m.quoted.participant

  return raw ? normalizeJid(raw) : null
}

const format = txt => `*ROLES* — ${txt}`

// ------------------------------
// Confirmación interactiva
// ------------------------------
async function confirmAction(conn, m, text, confirmId, denyId, mentions = []) {
  return conn.sendMessage(
    m.chat,
    {
      text,
      footer: 'SW SYSTEM — Confirmación requerida',
      templateButtons: [
        { index: 1, quickReplyButton: { displayText: '✅ Confirmar', id: confirmId } },
        { index: 2, quickReplyButton: { displayText: '❌ Denegar', id: denyId } }
      ],
      mentions
    },
    { quoted: m }
  )
}

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
  const chatCfg = global.db?.data?.chats?.[m.chat] || {}
  const actor = normalizeJid(m.sender)

  // ------------------------------
  // MENÚ PRINCIPAL — .rolmenu
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
${usedPrefix}rolmenu
${usedPrefix}whois @usuario
${usedPrefix}roleinfo <rol>
${usedPrefix}grouproles
${usedPrefix}roles

━━━━━━━━━━━━━━━━━━
🛡️ *COMANDOS DE MODERACIÓN*
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
    if (!target)
      return conn.reply(m.chat, format('Debes mencionar o responder a un usuario.'), m, ctxWarn)

    const info = getRoleInfo(target)
    const roles = getUserRoles(target)
    const rolesStr = roles.length ? roles.join(', ') : 'none'

    const text = `
👤 Usuario: @${target.split('@')[0]}
👑 Rol principal: ${info.icon} ${info.name}
🔹 Roles asignados: ${rolesStr}
`.trim()

    return conn.reply(m.chat, format(text), m, { ...ctxOk, mentions: [target] })
  }

  // ROLEINFO — público
  if (cmd === 'roleinfo') {
    const roleId = extractRoleArg(args)
    if (!roleExists(roleId))
      return conn.reply(m.chat, format('Rol inválido. Usa .rolmenu para ver la lista.'), m, ctxWarn)

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

  // GROUPOLES — público
  if (cmd === 'grouproles') {
    if (!m.isGroup)
      return conn.reply(m.chat, format('Este comando solo funciona en grupos.'), m, ctxWarn)

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

    return conn.reply(m.chat, text.trim(), m, { mentions, ...ctxOk })
  }

  // ROLES — protegido
  if (cmd === 'roles') {
    try {
      requireCommandAccess(m, 'roles-management', 'roles', chatCfg)
    } catch {
      return conn.reply(m.chat, format('No tienes permisos para usar este comando.'), m, ctxWarn)
    }

    const all = listRoles()
    const text = `
📚 *ROLES DISPONIBLES EN EL SISTEMA*

${all.map(r => `- ${r}`).join('\n')}
`.trim()

    return conn.reply(m.chat, format(text), m, ctxOk)
  }

  // ------------------------------
  // COMANDOS DE MODERACIÓN (van en Parte 2)
  // ------------------------------

    // ------------------------------
  // COMANDOS DE MODERACIÓN
  // ------------------------------

  // SETROLE — con confirmación
  if (cmd === 'setrole') {
    try {
      requireCommandAccess(m, 'roles-management', 'setrole', chatCfg)
    } catch {
      return conn.reply(m.chat, format('No tienes permisos para usar este comando.'), m, ctxWarn)
    }

    const target = resolveTarget(m, args)
    const roleId = extractRoleArg(args)

    if (!target || !roleExists(roleId)) {
      return conn.reply(m.chat, format('Uso: .setrole @usuario <rol>'), m, ctxWarn)
    }

    const tag = `@${target.split('@')[0]}`
    const confirmId = `confirm:setrole:${target}:${roleId}`
    const denyId = `deny:setrole:${target}:${roleId}`

    return confirmAction(
      conn,
      m,
      `¿Confirmas asignar el rol *${roleId}* como principal a ${tag}?`,
      confirmId,
      denyId,
      [target]
    )
  }

  // ADDROLE — con confirmación
  if (cmd === 'addrole') {
    try {
      requireCommandAccess(m, 'roles-management', 'addrole', chatCfg)
    } catch {
      return conn.reply(m.chat, format('No tienes permisos para usar este comando.'), m, ctxWarn)
    }

    const target = resolveTarget(m, args)
    const roleId = extractRoleArg(args)

    if (!target || !roleExists(roleId)) {
      return conn.reply(m.chat, format('Uso: .addrole @usuario <rol>'), m, ctxWarn)
    }

    const tag = `@${target.split('@')[0]}`
    const confirmId = `confirm:addrole:${target}:${roleId}`
    const denyId = `deny:addrole:${target}:${roleId}`

    return confirmAction(
      conn,
      m,
      `¿Confirmas agregar el rol *${roleId}* a ${tag}?`,
      confirmId,
      denyId,
      [target]
    )
  }

  // REMOVEROLE — con confirmación
  if (cmd === 'removerole') {
    try {
      requireCommandAccess(m, 'roles-management', 'removerole', chatCfg)
    } catch {
      return conn.reply(m.chat, format('No tienes permisos para usar este comando.'), m, ctxWarn)
    }

    const target = resolveTarget(m, args)
    const roleId = extractRoleArg(args)

    if (!target || !roleExists(roleId)) {
      return conn.reply(m.chat, format('Uso: .removerole @usuario <rol>'), m, ctxWarn)
    }

    const tag = `@${target.split('@')[0]}`
    const confirmId = `confirm:removerole:${target}:${roleId}`
    const denyId = `deny:removerole:${target}:${roleId}`

    return confirmAction(
      conn,
      m,
      `¿Confirmas remover el rol *${roleId}* de ${tag}?`,
      confirmId,
      denyId,
      [target]
    )
  }

  // ------------------------------
  // EJECUCIÓN FINAL DE BOTONES
  // ------------------------------

  const btn =
    m?.message?.templateButtonReplyMessage?.selectedId ||
    m?.message?.buttonsResponseMessage?.selectedButtonId

  if (btn) {
    // ------------------------------
    // CONFIRMAR SETROLE
    // ------------------------------
    if (btn.startsWith('confirm:setrole:')) {
      const [, , target, roleId] = btn.split(':')

      const updated = setUserRole(target, roleId, actor)
      try { global.userRoles = getUserRolesMap() } catch {}

      const rolesStr = updated.length ? updated.join(', ') : 'none'
      const tag = `@${target.split('@')[0]}`

      return conn.reply(
        m.chat,
        format(`✅ Rol principal actualizado.\nUsuario: ${tag}\nRoles: ${rolesStr}`),
        m,
        { mentions: [target], ...ctxOk }
      )
    }

    // ------------------------------
    // DENEGAR SETROLE
    // ------------------------------
    if (btn.startsWith('deny:setrole:')) {
      return conn.reply(m.chat, format('❌ Acción denegada.'), m, ctxWarn)
    }

    // ------------------------------
    // CONFIRMAR ADDROLE
    // ------------------------------
    if (btn.startsWith('confirm:addrole:')) {
      const [, , target, roleId] = btn.split(':')

      const updated = addUserRole(target, roleId, actor)
      try { global.userRoles = getUserRolesMap() } catch {}

      const rolesStr = updated.length ? updated.join(', ') : 'none'
      const tag = `@${target.split('@')[0]}`

      return conn.reply(
        m.chat,
        format(`✅ Rol agregado.\nUsuario: ${tag}\nRoles: ${rolesStr}`),
        m,
        { mentions: [target], ...ctxOk }
      )
    }

    // ------------------------------
    // DENEGAR ADDROLE
    // ------------------------------
    if (btn.startsWith('deny:addrole:')) {
      return conn.reply(m.chat, format('❌ Acción denegada.'), m, ctxWarn)
    }

    // ------------------------------
    // CONFIRMAR REMOVEROLE
    // ------------------------------
    if (btn.startsWith('confirm:removerole:')) {
      const [, , target, roleId] = btn.split(':')

      const updated = removeUserRole(target, roleId, actor)
      try { global.userRoles = getUserRolesMap() } catch {}

      const rolesStr = updated.length ? updated.join(', ') : 'none'
      const tag = `@${target.split('@')[0]}`

      return conn.reply(
        m.chat,
        format(`✅ Rol removido.\nUsuario: ${tag}\nRoles: ${rolesStr}`),
        m,
        { mentions: [target], ...ctxOk }
      )
    }

    // ------------------------------
    // DENEGAR REMOVEROLE
    // ------------------------------
    if (btn.startsWith('deny:removerole:')) {
      return conn.reply(m.chat, format('❌ Acción denegada.'), m, ctxWarn)
    }
  }

  // ------------------------------
  // SETPLUGINROLE — sin confirmación
  // ------------------------------
  if (cmd === 'setpluginrole') {
    try {
      requireCommandAccess(m, 'roles-management', 'setpluginrole', chatCfg)
    } catch {
      return conn.reply(m.chat, format('No tienes permisos para usar este comando.'), m, ctxWarn)
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
      return conn.reply(m.chat, format('No tienes permisos para usar este comando.'), m, ctxWarn)
    }

    reloadRoles?.()
    try { global.userRoles = getUserRolesMap() } catch {}

    return conn.reply(m.chat, format('Roles recargados desde disco.'), m, ctxOk)
  }

  // ROLELIST
  if (cmd === 'role-list' || cmd === 'rolelist') {
    try {
      requireCommandAccess(m, 'roles-management', 'role-list', chatCfg)
    } catch {
      return conn.reply(m.chat, format('No tienes permisos para usar este comando.'), m, ctxWarn)
    }

    const target = resolveTarget(m, args)
    if (!target) {
      return conn.reply(m.chat, format('Uso: .rolelist @usuario'), m, ctxWarn)
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
      { mentions: [target], ...ctxOk }
    )
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
