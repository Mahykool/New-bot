// lib/permissions-middleware.js
// Middleware de permisos SW SYSTEM — cambios mínimos para lecturas seguras

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
function getLevels() {
  const file = path.join(process.cwd(), 'lib', 'levels.json')
  // Si no existe, devolvemos un mapa básico para no romper comparaciones
  return safeReadJson(file, { basic: 1, manage: 5, full: 10 })
}

// Carga permisos por comando desde plugin-permissions.json (mínimo cambio)
function getPluginPermissions() {
  const file = path.join(process.cwd(), 'lib', 'plugin-permissions.json')
  return safeReadJson(file, {})
}

// ✅ Comprueba permisos globales definidos en roles.json
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

// ✅ Obtiene el nivel del rol del usuario
function getUserLevel(userJid) {
  const rolesConfig = getRolesConfig()
  const userRoles = getUserRoles(userJid)

  // Mantengo la lógica original: primer rol o 'user'
  const roleId = userRoles[0] || 'user'
  const role = rolesConfig[roleId]

  return role?.roleLevel || 'basic'
}

// ✅ Comprueba si un usuario puede usar un comando según niveles
export function canUseCommand(userJid, pluginId, command) {
  const pluginPermissions = getPluginPermissions()
  const levels = getLevels()

  const userLevel = getUserLevel(userJid)
  const requiredLevel = pluginPermissions?.[pluginId]?.[command] || 'basic'

  const userPower = levels[userLevel] || 0
  const requiredPower = levels[requiredLevel] || 1

  return userPower >= requiredPower
}

// ✅ Helper para lanzar errores amigables desde plugins (sin cambiar comportamiento)
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
    throw err
  }
}
