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

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = process.cwd()
const ROLES_PATH = path.join(PROJECT_ROOT, 'lib', 'roles.json')

let handler = async (m, { conn, command, args = [], usedPrefix = '/' }) => {
  const ctxErr = (global.rcanalx || {})
  const ctxWarn = (global.rcanalw || {})
  const ctxOk = (global.rcanalr || {})

  try {
    // Permiso requerido para administrar roles
    if (!hasPermission(m.sender, 'MANAGE_ROLES')) {
      return await conn.reply(m.chat, '✘ No tienes permisos para administrar roles.', m, ctxWarn)
    }

    const rolesConfig = getRolesConfig ? getRolesConfig() : {}
    const cmd = (command || '').toLowerCase()

    // rolesmenu
    if (cmd === 'rolesmenu') {
      handler.pluginId = 'rolesmenu'
      const info = getRoleInfo(m.sender) || { icon: '', name: 'Usuario' }
      const userRoles = (getUserRoles(m.sender) || []).join(', ') || 'ninguno'
      const rolesList = Object.keys(rolesConfig).map(r => `${r} — ${rolesConfig[r].name || r}`).join('\n') || 'ninguno'

      const text = `
ஓீ🐙 ㅤׄㅤׅㅤׄ _*ROLES*_ ㅤ֢ㅤׄㅤׅ

👤 Tu rol principal: ${info.icon || ''} ${info.name || 'Usuario'}
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

    // whois
    if (cmd === 'whois') {
      handler.pluginId = 'whois'
      if (!m.mentionedJid || !m.mentionedJid[0]) {
        return await conn.reply(m.chat, `✘ Debes mencionar a un usuario.\nEjemplo: ${usedPrefix}whois @usuario`, m, ctxWarn)
      }
      const target = m.mentionedJid[0]
      const info = getRoleInfo(target) || { icon: '', name: 'Usuario' }
      const roles = (getUserRoles(target) || []).join(', ') || 'ninguno'

      const text = `ஓீ🐙 ㅤׄㅤׅㅤׄ _*ROLES*_ ㅤ֢ㅤׄㅤׅ`

👤 Usuario: ${target}
👑 Rol principal: ${info.icon || ''} ${info.name || 'Usuario'}
🔹 Roles asignados: ${roles}
`.trim()

      return await conn.reply(m.chat, text, m, ctxOk)
    }

    // setrole
    if (cmd === 'setrole') {
      handler.pluginId = 'setrole'
      if (!m.mentionedJid || !m.mentionedJid[0]) {
        return await conn.reply(m.chat, `✘ Debes mencionar a un usuario.\nEjemplo: ${usedPrefix}setrole @usuario staff`, m, ctxWarn)
      }
      const target = m.mentionedJid[0]
      const raw = (args[1] || '').toLowerCase()
      const roleId = normalizeRoleId(raw)

      if (!roleId || !rolesConfig[roleId]) {
        const available = Object.keys(rolesConfig).join(', ') || 'ninguno'
        return await conn.reply(m.chat, `✘ Rol inválido.\nRoles disponibles: ${available}`, m, ctxWarn)
      }

      const newRoles = setUserRole(target, roleId) || []
      return await conn.reply(m.chat, `✅ Rol principal actualizado.\nUsuario: ${target}\nRoles actuales: ${newRoles.join(', ')}`, m, ctxOk)
    }

    // addrole
    if (cmd === 'addrole') {
      handler.pluginId = 'addrole'
      if (!m.mentionedJid || !m.mentionedJid[0]) {
        return await conn.reply(m.chat, `✘ Debes mencionar a un usuario.\nEjemplo: ${usedPrefix}addrole @usuario staff`, m, ctxWarn)
      }
      const target = m.mentionedJid[0]
      const raw = (args[1] || '').toLowerCase()
      const roleId = normalizeRoleId(raw)

      if (!roleId || !rolesConfig[roleId]) {
        const available = Object.keys(rolesConfig).join(', ') || 'ninguno'
        return await conn.reply(m.chat, `✘ Rol inválido.\nRoles disponibles: ${available}`, m, ctxWarn)
      }

      const newRoles = addUserRole(target, roleId) || []
      return await conn.reply(m.chat, `✅ Rol agregado.\nUsuario: ${target}\nRoles actuales: ${newRoles.join(', ')}`, m, ctxOk)
    }

    // removerole
    if (cmd === 'removerole') {
      handler.pluginId = 'removerole'
      if (!m.mentionedJid || !m.mentionedJid[0]) {
        return await conn.reply(m.chat, `✘ Debes mencionar a un usuario.\nEjemplo: ${usedPrefix}removerole @usuario staff`, m, ctxWarn)
      }
      const target = m.mentionedJid[0]
      const raw = (args[1] || '').toLowerCase()
      const roleId = normalizeRoleId(raw)

      const newRoles = removeUserRole(target, roleId) || []
      return await conn.reply(m.chat, `✅ Rol removido.\nUsuario: ${target}\nRoles actuales: ${newRoles.join(', ')}`, m, ctxOk)
    }

    // roleinfo
    if (cmd === 'roleinfo') {
      handler.pluginId = 'roleinfo'
      const raw = (args[0] || '').toLowerCase()
      const roleId = normalizeRoleId(raw)

      if (!roleId || !rolesConfig[roleId]) {
        const available = Object.keys(rolesConfig).join(', ') || 'ninguno'
        return await conn.reply(m.chat, `✘ Rol inválido.\nRoles disponibles: ${available}`, m, ctxWarn)
      }

      const role = rolesConfig[roleId] || {}
      let text = `ஓீ🐙 ㅤׄㅤׅㅤׄ _*ROLES*_ ㅤ֢ㅤׄㅤׅ`

ID: ${roleId}
Nombre: ${role.name || roleId}
Icono: ${role.icon || ''}
Descripción: ${role.description || 'ninguna'}

Permisos globales: ${ (role.globalPermissions || []).join(', ') || 'ninguno' }

Plugins:
`.trim()

      for (const p in (role.pluginPermissions || {})) {
        text += `\n- ${p}: ${role.pluginPermissions[p]}`
      }

      return await conn.reply(m.chat, text, m, ctxOk)
    }

    // setpluginrole
    if (cmd === 'setpluginrole') {
      handler.pluginId = 'setpluginrole'
      const rawRole = (args[0] || '').toLowerCase()
      const roleId = normalizeRoleId(rawRole)
      const pluginId = (args[1] || '').toLowerCase()
      const level = (args[2] || '').toLowerCase()
      const validLevels = ['none', 'basic', 'manage', 'full']

      if (!roleId || !rolesConfig[roleId]) {
        const available = Object.keys(rolesConfig).join(', ') || 'ninguno'
        return await conn.reply(m.chat, `✘ Rol inválido.\nRoles disponibles: ${available}`, m, ctxWarn)
      }

      if (!pluginId) {
        return await conn.reply(m.chat, `✘ Debes indicar el pluginId.\nEjemplo: ${usedPrefix}setpluginrole staff ping manage`, m, ctxWarn)
      }

      if (!validLevels.includes(level)) {
        return await conn.reply(m.chat, `✘ Nivel inválido.\nNiveles válidos: ${validLevels.join(', ')}`, m, ctxWarn)
      }

      // Asegurar que el archivo existe y es JSON válido
      try {
        if (!fs.existsSync(ROLES_PATH)) {
          // crear plantilla mínima si no existe
          fs.mkdirSync(path.dirname(ROLES_PATH), { recursive: true })
          fs.writeFileSync(ROLES_PATH, JSON.stringify({}, null, 2))
        }
        const rolesDataRaw = fs.readFileSync(ROLES_PATH, 'utf8') || '{}'
        const rolesData = JSON.parse(rolesDataRaw)

        rolesData[roleId] = rolesData[roleId] || {}
        rolesData[roleId].pluginPermissions = rolesData[roleId].pluginPermissions || {}
        rolesData[roleId].pluginPermissions[pluginId] = level

        fs.writeFileSync(ROLES_PATH, JSON.stringify(rolesData, null, 2))

        return await conn.reply(m.chat, `✅ Nivel de acceso actualizado.\nRol: ${roleId}\nPlugin: ${pluginId}\nNuevo nivel: ${level}`, m, ctxOk)
      } catch (errFile) {
        console.error('setpluginrole file error:', errFile)
        return await conn.reply(m.chat, `✘ Error al actualizar roles.json: ${errFile.message}`, m, ctxErr)
      }
    }

    return null
  } catch (e) {
    console.error('Roles Manager error:', e)
    await conn.reply(m.chat, `❌ Error en Roles Manager\n\n${e.message || String(e)}`, m, ctxErr)
  }
}

handler.help = ['rolesmenu', 'whois', 'setrole', 'addrole', 'removerole', 'roleinfo', 'setpluginrole']
handler.tags = ['roles']
handler.command = ['rolesmenu', 'whois', 'setrole', 'addrole', 'removerole', 'roleinfo', 'setpluginrole']

export default handler
