// lib/permissions-middleware.js
// Middleware de permisos SW SYSTEM — versión final (ESM)

import fs from 'fs'
import path from 'path'
import {
  getRolesConfig,
  getUserRoles,
  normalizeJid,
  getUserLevel as rolesGetUserLevel
} from './lib-roles.js'

// --- utilidades de lectura segura y cache simple ---
function safeReadJson(filePath, fallback = {}) {
  try {
    if (!fs.existsSync(filePath)) return fallback
    const raw = fs.readFileSync(filePath, 'utf8')
    return raw ? JSON.parse(raw) : fallback
  } catch (e) {
    console.warn(`safeReadJson: fallo leyendo ${filePath}`, e?.message || e)
    return fallback
  }
}

const CACHE = {
  pluginPermissions: null,
  levels: null,
  pluginPermissionsMtime: 0,
  levelsMtime: 0
}

function loadPluginPermissions() {
  const file = path.join(process.cwd(), 'lib', 'plugin-permissions.json')
  try {
    const stat = fs.existsSync(file) ? fs.statSync(file).mtimeMs : 0
    if (CACHE.pluginPermissions && CACHE.pluginPermissionsMtime === stat) return CACHE.pluginPermissions
    const data = safeReadJson(file, {})
    CACHE.pluginPermissions = data
    CACHE.pluginPermissionsMtime = stat
    return data
  } catch (e) {
    return {}
  }
}

function loadLevels() {
  const file = path.join(process.cwd(), 'lib', 'levels.json')
  try {
    const stat = fs.existsSync(file) ? fs.statSync(file).mtimeMs : 0
    if (CACHE.levels && CACHE.levelsMtime === stat) return CACHE.levels
    const data = safeReadJson(file, { basic: 1, manage: 4, full: 5 })
    CACHE.levels = data
    CACHE.levelsMtime = stat
    return data
  } catch (e) {
    return { basic: 1, manage: 4, full: 5 }
  }
}

// --- helpers de niveles y comparación ---
function levelKeyToPower(levelKey) {
  const levels = loadLevels()
  return levels[levelKey] ?? 0
}

// Convierte nivel de plugin (none/basic/manage/full) a rol mínimo (clave de levels)
function pluginLevelToMinRole(level) {
  const map = {
    none: 'creador',
    basic: 'user',
    manage: 'mod',
    full: 'creador'
  }
  return map[level] || 'mod'
}

// Reexport del getUserLevel del módulo de roles para consistencia
export function getUserLevel(userJid) {
  return rolesGetUserLevel(userJid)
}

// --- comprobaciones principales ---

// Comprueba permisos globales definidos en roles.json
export function hasPermission(userJid, permissionId) {
  const rolesConfig = getRolesConfig()
  const normalized = normalizeJid(userJid)
  const userRoles = getUserRoles(normalized) || []

  for (const roleId of userRoles) {
    const role = rolesConfig[roleId]
    if (!role) continue
    const perms = role.globalPermissions || []
    if (perms.includes('USE_ALL_PLUGINS')) return true
    if (perms.includes(permissionId)) return true
  }

  // fallback: si el usuario es listado en global.owner, permitir (owner override)
  try {
    if (global.owner) {
      const owners = Array.isArray(global.owner) ? global.owner.flat() : [global.owner]
      for (const o of owners) {
        if (!o) continue
        if (normalizeJid(o) === normalized) return true
      }
    }
  } catch (e) {}

  return false
}

// Comprueba si un usuario puede usar un comando según plugin-permissions.json y levels
export function canUseCommand(userJid, pluginId, command) {
  const pluginPermissions = loadPluginPermissions()
  const levels = loadLevels()

  const normalized = normalizeJid(userJid)

  // Owner override
  try {
    if (global.owner) {
      const owners = Array.isArray(global.owner) ? global.owner.flat() : [global.owner]
      for (const o of owners) {
        if (!o) continue
        if (normalizeJid(o) === normalized) return true
      }
    }
  } catch (e) {}

  // Global permission override (roles with USE_ALL_PLUGINS)
  if (hasPermission(normalized, 'USE_ALL_PLUGINS')) return true

  const pluginEntry = pluginPermissions?.[pluginId] || {}
  const requiredLevelKey = pluginEntry?.[command] || null

  if (requiredLevelKey) {
    const userLevelKey = getUserLevel(normalized)
    const userPower = levels[userLevelKey] ?? 0
    const requiredPower = levels[requiredLevelKey] ?? 1
    return userPower >= requiredPower
  }

  // fallback si no hay entrada específica: require 'manage'
  const defaultRequired = 'manage'
  const userLevelKey = getUserLevel(normalized)
  const userPower = levels[userLevelKey] ?? 0
  const requiredPower = levels[defaultRequired] ?? 4
  return userPower >= requiredPower
}

// Alias para compatibilidad
export const canUsePlugin = canUseCommand

// Helper para lanzar errores amigables desde plugins
export function requireCommandAccess(userJid, pluginId, command) {
  if (!canUseCommand(userJid, pluginId, command)) {
    const userLevel = getUserLevel(userJid)
    const pluginPermissions = loadPluginPermissions()
    const requiredLevel = pluginPermissions?.[pluginId]?.[command] || 'manage'
    const msg = `ACCESS_DENIED: required=${requiredLevel} user=${userLevel}`
    const err = new Error(msg)
    err.code = 'ACCESS_DENIED'
    err.required = requiredLevel
    err.userLevel = userLevel
    err.permissionId = `${pluginId}:${command}`
    err.plugin = pluginId
    err.command = command
    throw err
  }
}

// Export por defecto para compatibilidad con import default
export default {
  hasPermission,
  canUseCommand,
  canUsePlugin,
  getUserLevel,
  requireCommandAccess
}
