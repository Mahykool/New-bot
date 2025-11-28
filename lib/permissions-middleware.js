// lib/permissions-middleware.js
// Middleware de permisos SW SYSTEM — usa lib-roles.js

import {
  getRolesConfig,
  getUserRoles,
  getUserPluginAccess
} from './lib-roles.js'

// Mapea niveles a potencia numérica
const LEVEL_POWER = { none: 0, basic: 1, manage: 2, full: 3 }

// Comprueba permisos globales definidos en roles.json
export function hasPermission(userJid, permissionId) {
  const rolesConfig = getRolesConfig()
  const userRoles = getUserRoles(userJid)

  for (const roleId of userRoles) {
    const role = rolesConfig[roleId]
    if (!role) continue

    const perms = role.globalPermissions || []
    if (perms.includes('USE_ALL_PLUGINS')) return true
    if (perms.includes(permissionId)) return true
  }

  return false
}

// Comprueba si un usuario tiene el nivel requerido para usar un plugin
export function canUsePlugin(userJid, pluginId, requiredLevel = 'basic') {
  const userLevel = getUserPluginAccess(userJid, pluginId) || 'none'
  return (LEVEL_POWER[userLevel] || 0) >= (LEVEL_POWER[requiredLevel] || 1)
}

// Helper para lanzar errores amigables desde plugins
export function requirePluginAccess(userJid, pluginId, requiredLevel = 'basic') {
  if (!canUsePlugin(userJid, pluginId, requiredLevel)) {
    const userLevel = getUserPluginAccess(userJid, pluginId) || 'none'
    const msg = `ACCESS_DENIED: required=${requiredLevel} user=${userLevel}`
    const err = new Error(msg)
    err.code = 'ACCESS_DENIED'
    err.required = requiredLevel
    err.userLevel = userLevel
    throw err
  }
}
