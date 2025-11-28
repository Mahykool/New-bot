// plugins/roles-management.js
// SW SYSTEM — Roles Manager (gestión de roles desde WhatsApp)

import {
  getRolesConfig,
  getUserRoles,
  setUserRole,
  addUserRole,
  removeUserRole,
  getRoleInfo,
  normalizeRoleId
} from '../lib/lib-roles.js'

import { hasPermission } from '../lib/permissions-middleware.js'

let handler = async (m, { conn, command, args, usedPrefix }) => {
  const ctxErr = (global.rcanalx || {})
  const ctxWarn = (global.rcanalw || {})
  const ctxOk = (global.rcanalr || {})

  try {
    // Solo quien tenga MANAGE_ROLES puede usar estas funciones
    if (!hasPermission(m.sender, 'MANAGE_ROLES')) {
      return await conn.reply(m.chat, '✘ No tienes permisos para administrar roles.', m, ctxWarn)
    }

    const rolesConfig = getRolesConfig()

    // Normalizar comando
    const cmd = command.toLowerCase()

    // rolesmenu
    if (cmd === 'rolesmenu') {
      const info = getRoleInfo(m.sender)
      const userRoles = getUserRoles(m.sender).join(', ')
      let rolesList = Object.keys(rolesConfig).map(r => `${r} — ${rolesConfig[r].name}`).join('\n')
      const text = `
==============================
      SW SYSTEM — ROLES
==============================

👤 Tu rol principal: ${info.icon} ${info.name}
🔹 Roles asignados: ${userRoles}

Roles disponibles:
${rolesList}

Comandos:
${usedPrefix}rolesmenu
${usedPrefix}whois @usuario
${usedPrefix}setrole @usuario ROL
${usedPrefix}addrole @usuario ROL
${usedPrefix}removerole @usuario ROL
${usedPrefix}roleinfo ROL
${usedPrefix}setpluginrole ROL pluginId nivel
      `.trim()
      return await conn.reply(m.chat, text, m, ctxOk)
    }

    // whois @user
    if (cmd === 'whois') {
      if (!m.mentionedJid || !m.mentionedJid[0]) {
        return await conn.reply(m.chat, `✘ Debes mencionar a un usuario.\nEjemplo: ${usedPrefix}whois @usuario`, m, ctxWarn)
      }
      const target = m.mentionedJid[0]
      const info = getRoleInfo(target)
      const roles = getUserRoles(target).join(', ')
      const text = `
==============================
        USER ROLE INFO
==============================

👤 Usuario: ${target}
👑 Rol principal: ${info.icon} ${info.name}
🔹 Roles asignados: ${roles}
      `.trim()
      return await conn.reply(m.chat, text, m, ctxOk)
    }

    // setrole @user ROLE  -> sobrescribe roles
    if (cmd === 'setrole') {
      if (!m.mentionedJid || !m.mentionedJid[0]) {
        return await conn.reply(m.chat, `✘ Debes mencionar a un usuario.\nEjemplo: ${usedPrefix}setrole @usuario staff`, m, ctxWarn)
      }
      const target = m.mentionedJid[0]
      const raw = (args[1] || '').toLowerCase()
      const roleId = normalizeRoleId(raw)
      if (!roleId || !rolesConfig[roleId]) {
        const available = Object.keys(rolesConfig).join(', ')
        return await conn.reply(m.chat, `✘ Rol inválido.\nRoles disponibles: ${available}`, m, ctxWarn)
      }
      const newRoles = setUserRole(target, roleId)
      return await conn.reply(m.chat, `✅ Rol principal actualizado.\nUsuario: ${target}\nRoles actuales: ${newRoles.join(', ')}`, m, ctxOk)
    }

    // addrole @user ROLE  -> añade rol
    if (cmd === 'addrole') {
      if (!m.mentionedJid || !m.mentionedJid[0]) {
        return await conn.reply(m.chat, `✘ Debes mencionar a un usuario.\nEjemplo: ${usedPrefix}addrole @usuario staff`, m, ctxWarn)
      }
      const target = m.mentionedJid[0]
      const raw = (args[1] || '').toLowerCase()
      const roleId = normalizeRoleId(raw)
      if (!roleId || !rolesConfig[roleId]) {
        const available = Object.keys(rolesConfig).join(', ')
        return await conn.reply(m.chat, `✘ Rol inválido.\nRoles disponibles: ${available}`, m, ctxWarn)
      }
      const newRoles = addUserRole(target, roleId)
      return await conn.reply(m.chat, `✅ Rol agregado.\nUsuario: ${target}\nRoles actuales: ${newRoles.join(', ')}`, m, ctxOk)
    }

    // removerole @user ROLE
    if (cmd === 'removerole') {
      if (!m.mentionedJid || !m.mentionedJid[0]) {
        return await conn.reply(m.chat, `✘ Debes mencionar a un usuario.\nEjemplo: ${usedPrefix}removerole @usuario staff`, m, ctxWarn)
      }
      const target = m.mentionedJid[0]
      const raw = (args[1] || '').toLowerCase()
      const roleId = normalizeRoleId(raw)
      if (!roleId) {
        return await conn.reply(m.chat, `✘ Debes indicar el rol a quitar.\nEjemplo: ${usedPrefix}removerole @usuario staff`, m, ctxWarn)
      }
      const newRoles = removeUserRole(target, roleId)
      return await conn.reply(m.chat, `✅ Rol removido.\nUsuario: ${target}\nRoles actuales: ${newRoles.join(', ')}`, m, ctxOk)
    }

    // roleinfo ROLE
    if (cmd === 'roleinfo') {
      const raw = (args[0] || '').toLowerCase()
      const roleId = normalizeRoleId(raw)
      if (!roleId || !rolesConfig[roleId]) {
        const available = Object.keys(rolesConfig).join(', ')
        return await conn.reply(m.chat, `✘ Rol inválido.\nRoles disponibles: ${available}`, m, ctxWarn)
      }
      const role = rolesConfig[roleId]
      let text = `
==============================
         ROLE INFO
==============================

ID: ${roleId}
Nombre: ${role.name}
Icono: ${role.icon}
Descripción: ${role.description}

Permisos globales: ${ (role.globalPermissions || []).join(', ') || 'ninguno' }

Plugins:
`.trim()
      for (const p in (role.pluginPermissions || {})) {
        text += `\n- ${p}: ${role.pluginPermissions[p]}`
      }
      return await conn.reply(m.chat, text, m, ctxOk)
    }

    // setpluginrole ROLE pluginId nivel
    if (cmd === 'setpluginrole') {
      const rawRole = (args[0] || '').toLowerCase()
      const roleId = normalizeRoleId(rawRole)
      const pluginId = (args[1] || '').toLowerCase()
      const level = (args[2] || '').toLowerCase()
      const validLevels = ['none','basic','manage','full']

      if (!roleId || !rolesConfig[roleId]) {
        const available = Object.keys(rolesConfig).join(', ')
        return await conn.reply(m.chat, `✘ Rol inválido.\nRoles disponibles: ${available}`, m, ctxWarn)
      }
      if (!pluginId) {
        return await conn.reply(m.chat, `✘ Debes indicar el pluginId.\nEjemplo: ${usedPrefix}setpluginrole staff ping manage`, m, ctxWarn)
      }
      if (!validLevels.includes(level)) {
        return await conn.reply(m.chat, `✘ Nivel inválido.\nNiveles válidos: ${validLevels.join(', ')}`, m, ctxWarn)
      }

      // Modificar roles.json en disco
      import fs from 'fs'
      import path from 'path'
      const __dirname = process.cwd()
      const ROLES_PATH = path.join(__dirname, 'lib', 'roles.json')
      const rolesData = JSON.parse(fs.readFileSync(ROLES_PATH, 'utf8'))
      rolesData[roleId].pluginPermissions = rolesData[roleId].pluginPermissions || {}
      rolesData[roleId].pluginPermissions[pluginId] = level
      fs.writeFileSync(ROLES_PATH, JSON.stringify(rolesData, null, 2))

      return await conn.reply(m.chat, `✅ Nivel de acceso actualizado.\nRol: ${roleId}\nPlugin: ${pluginId}\nNuevo nivel: ${level}`, m, ctxOk)
    }

    // Si llega aquí, comando no reconocido por este plugin
    return null

  } catch (e) {
    console.error('Roles Manager error:', e)
    await conn.reply(m.chat, `❌ Error en Roles Manager\n\n${e.message}`, m, ctxErr)
  }
}

handler.help = ['rolesmenu','whois','setrole','addrole','removerole','roleinfo','setpluginrole']
handler.tags = ['roles','admin']
handler.command = ['rolesmenu','whois','setrole','addrole','removerole','roleinfo','setpluginrole']

export default handler
