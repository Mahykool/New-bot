// lib/permissions-middleware.js
// Middleware de permisos SW SYSTEM — versión corregida y compatible con ESM

import fs from 'fs'
import path from 'path'
import {
  getRolesConfig,
  getUserRoles
} from './lib-roles.js'

// Lectura segura de JSON: si falla devuelve fallback
function safeReadJson(filePath, fallback = {}) {
  try {
    if (!fs.existsSync(filePath)) return fallback
    const raw = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(raw)
  } catch (e) {
    console.warn(`safeReadJson: fallo leyendo ${filePath}`, e)
    return fallback
  }
}

// Carga niveles desde levels.json (mínimo cambio)
// Devuelve un objeto con claves de nivel => potencia (ej: { basic: 1, manage: 5, full: 10 })
function getLevels() {
  const file = path.join(process.cwd(), 'lib', 'levels.json')
  return safeReadJson(file, { basic: 1, manage: 5, full: 10 })
}

// Carga permisos por plugin/command desde plugin-permissions.json
function getPluginPermissions() {
  const file = path.join(process.cwd(), 'lib', 'plugin-permissions.json')
  return safeReadJson(file, {})
}

// Normaliza y obtiene el nivel del usuario como clave ('basic','manage','full', etc.)
function getUserLevel(userJid) {
  const rolesConfig = getRolesConfig()
  const userRoles = getUserRoles(userJid)

  // Primer rol asignado o 'user' por defecto
  const roleId = userRoles[0] || 'user'
  const role = rolesConfig[roleId]

  // rawLevel puede ser string ('basic') o número (5)
  const rawLevel = role?.roleLevel ?? 'basic'

  // Si ya es string y coincide con una clave de levels, devolverla
  if (typeof rawLevel === 'string') {
    const levels = getLevels()
    if (Object.prototype.hasOwnProperty.call(levels, rawLevel)) return rawLevel
    // Si no coincide, fallback a 'basic'
    return 'basic'
  }

  // Si es numérico, mapearlo a la clave correspondiente en levels
  if (typeof rawLevel === 'number') {
    const levels = getLevels()
    for (const [key, value] of Object.entries(levels)) {
      if (value === rawLevel) return key
    }
    // Si no se encuentra, fallback a 'basic'
    return 'basic'
  }

  // Cualquier otro caso, fallback
  return 'basic'
}

// Comprueba permisos globales definidos en roles.json
export function hasPermission(userJid, permissionId) {
  const rolesConfig = getRolesConfig()
  const userRoles = getUserRoles(userJid)

  for (const roleId of userRoles) {
    const role = rolesConfig[roleId]
    if (!role) continue

    const perms = role.globalPermissions || []

    // Permiso universal
    if (perms.includes('USE_ALL_PLUGINS')) return true

    // Permiso específico
    if (perms.includes(permissionId)) return true
  }

  return false
}

// Comprueba si un usuario puede usar un comando según niveles
export function canUseCommand(userJid, pluginId, command) {
  const pluginPermissions = getPluginPermissions()
  const levels = getLevels()

  const userLevel = getUserLevel(userJid)
  const requiredLevel = pluginPermissions?.[pluginId]?.[command] || 'basic'

  const userPower = levels[userLevel] ?? 0
  const requiredPower = levels[requiredLevel] ?? 1

  return userPower >= requiredPower
}

// Alias export para compatibilidad con plugins que importen canUsePlugin
export const canUsePlugin = canUseCommand

// Helper para lanzar errores amigables desde plugins (sin cambiar comportamiento)
export function requireCommandAccess(userJid, pluginId, command) {
  if (!canUseCommand(userJid, pluginId, command)) {
    const userLevel = getUserLevel(userJid)
    const pluginPermissions = getPluginPermissions()
    const requiredLevel = pluginPermissions?.[pluginId]?.[command] || 'basic'

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
