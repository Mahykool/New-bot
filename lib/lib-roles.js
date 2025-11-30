// lib/lib-roles.js
// Sistema de roles centralizado para SW SYSTEM — versión estable con caché en memoria + auditoría

import fs from 'fs'
import path from 'path'
import { auditLog } from './audit.js'

const __dirname = process.cwd()

const ROLES_PATH = path.join(__dirname, 'lib', 'roles.json')
const USER_ROLES_PATH = path.join(__dirname, 'lib', 'user-roles.json')
const LEVELS_PATH = path.join(__dirname, 'lib', 'levels.json')

// -------------------------------
// Helpers JSON
// -------------------------------
function loadJson(filePath, defaultValue = {}) {
  try {
    if (!fs.existsSync(filePath)) return defaultValue
    const raw = fs.readFileSync(filePath, 'utf8') || ''
    if (!raw) return defaultValue
    return JSON.parse(raw)
  } catch (e) {
    console.error(`loadJson error ${filePath}:`, e)
    return defaultValue
  }
}

function saveJson(filePath, data) {
  try {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
    return true
  } catch (e) {
    console.error(`saveJson error ${filePath}:`, e)
    return false
  }
}

// -------------------------------
// Normalización de JID y roles
// -------------------------------
export function normalizeJid(jid) {
  if (!jid) return jid
  if (typeof jid !== 'string') jid = String(jid)
  jid = jid.trim()
  const base = jid.split(':')[0].split('/')[0]
  if (base.includes('@')) return base
  return `${base}@s.whatsapp.net`
}

export function normalizeRoleId(roleId) {
  if (!roleId) return 'user'
  return String(roleId).trim().toLowerCase()
}

// -------------------------------
// Caché en memoria
// -------------------------------
let rolesCache = null
let userRolesCache = null
let levelsCache = null

function loadRolesCache() {
  if (!rolesCache) {
    rolesCache = loadJson(ROLES_PATH, {
      creador: {
        name: 'CREADOR',
        icon: '👑',
        description: 'Control total del sistema',
        roleLevel: 'full',
        globalPermissions: ['MANAGE_ROLES', 'USE_ALL_PLUGINS']
      },
      mod: {
        name: 'MOD',
        icon: '🛡️',
        description: 'Moderación y soporte avanzado',
        roleLevel: 'manage',
        globalPermissions: ['MODERATE_GROUPS']
      },
      vip_plus: {
        name: 'VIP+',
        icon: '🔥',
        description: 'Usuario élite con beneficios superiores',
        roleLevel: 'vip_plus',
        globalPermissions: []
      },
      vip: {
        name: 'VIP',
        icon: '💎',
        description: 'Usuario distinguido con beneficios especiales',
        roleLevel: 'vip',
        globalPermissions: []
      },
      user: {
        name: 'USER',
        icon: '🔹',
        description: 'Usuario estándar',
        roleLevel: 'basic',
        globalPermissions: []
      }
    })
  }
  return rolesCache
}

function loadUserRolesCache() {
  if (!userRolesCache) {
    userRolesCache = loadJson(USER_ROLES_PATH, {})
  }
  return userRolesCache
}

function loadLevelsCache() {
  if (!levelsCache) {
    levelsCache = loadJson(LEVELS_PATH, {
      basic: 1,
      vip: 2,
      vip_plus: 3,
      manage: 4,
      full: 5
    })
  }
  return levelsCache
}

// -------------------------------
// Loaders / Savers públicos
// -------------------------------
export function getRolesConfig() {
  return loadRolesCache()
}

export function saveRolesConfig(obj) {
  rolesCache = obj
  return saveJson(ROLES_PATH, obj)
}

export function getUserRolesMap() {
  return loadUserRolesCache()
}

export function saveUserRolesMap(obj) {
  userRolesCache = obj
  return saveJson(USER_ROLES_PATH, obj)
}

export function getLevelsConfig() {
  return loadLevelsCache()
}

// -------------------------------
// Operaciones sobre roles de usuario
// -------------------------------
export function getUserRoles(userJid) {
  const users = getUserRolesMap()
  const jid = normalizeJid(userJid)
  return users[jid] || ['user']
}

// ✅ SETROLE — reemplaza todo y pone el rol como principal
export function setUserRole(userJid, roleId, actor = null) {
  const users = getUserRolesMap()
  const jid = normalizeJid(userJid)
  const r = normalizeRoleId(roleId)

  users[jid] = [r]
  const ok = saveUserRolesMap(users)

  try {
    auditLog({ actor: actor || null, target: jid, action: 'SET_ROLE', role: r, ok: !!ok })
  } catch (e) {
    console.warn('auditLog error in setUserRole', e?.message || e)
  }

  return users[jid]
}

// ✅ ADDROLE — ahora pone el nuevo rol como principal
export function addUserRole(userJid, roleId, actor = null) {
  const users = getUserRolesMap()
  const jid = normalizeJid(userJid)
  const current = users[jid] || ['user']
  const r = normalizeRoleId(roleId)

  if (!current.includes(r)) {
    users[jid] = [r, ...current.filter(x => x !== r)]
  }

  const ok = saveUserRolesMap(users)

  try {
    auditLog({ actor: actor || null, target: jid, action: 'ADD_ROLE', role: r, ok: !!ok })
  } catch (e) {
    console.warn('auditLog error in addUserRole', e?.message || e)
  }

  return users[jid]
}

// ✅ REMOVEROLE — reordena automáticamente según nivel
export function removeUserRole(userJid, roleId, actor = null) {
  const users = getUserRolesMap()
  const jid = normalizeJid(userJid)
  const current = users[jid] || ['user']
  const r = normalizeRoleId(roleId)

  const filtered = current.filter(x => x !== r)
  users[jid] = filtered.length ? filtered : ['user']

  // Reordenar según nivel
  const levels = getLevelsConfig()
  users[jid].sort((a, b) => (levels[b] || 0) - (levels[a] || 0))

  const ok = saveUserRolesMap(users)

  try {
    auditLog({ actor: actor || null, target: jid, action: 'REMOVE_ROLE', role: r, ok: !!ok })
  } catch (e) {
    console.warn('auditLog error in removeUserRole', e?.message || e)
  }

  return users[jid]
}

// -------------------------------
// Información de rol
// -------------------------------
export function getRoleInfo(userJid) {
  const rolesConfig = getRolesConfig()
  const userRoles = getUserRoles(userJid)

  // ✅ Seleccionar el rol más alto
  const levels = getLevelsConfig()
  let primary = 'user'
  let max = 0

  for (const r of userRoles) {
    const lvl = rolesConfig[r]?.roleLevel || 'basic'
    if ((levels[lvl] || 0) > max) {
      max = levels[lvl]
      primary = r
    }
  }

  const role = rolesConfig[primary] || rolesConfig['user'] || {}

  return {
    id: primary,
    name: role.name || primary,
    icon: role.icon || '',
    description: role.description || '',
    level: role.roleLevel || 'basic',
    meta: role
  }
}

// ✅ GETUSERLEVEL — ahora devuelve el nivel más alto
export function getUserLevel(userJid) {
  const rolesConfig = getRolesConfig()
  const levels = getLevelsConfig()
  const userRoles = getUserRoles(userJid)

  let maxLevel = 'basic'
  for (const r of userRoles) {
    const lvl = rolesConfig[r]?.roleLevel || 'basic'
    if ((levels[lvl] || 0) > (levels[maxLevel] || 0)) {
      maxLevel = lvl
    }
  }

  return maxLevel
}

// -------------------------------
// Utilidades adicionales
// -------------------------------
export function roleExists(roleId) {
  const roles = getRolesConfig()
  const r = normalizeRoleId(roleId)
  return Boolean(roles && roles[r])
}

export function listRoles() {
  const roles = getRolesConfig()
  return Object.keys(roles || {})
}

// -------------------------------
// Recarga y alias útiles
// -------------------------------
export function loadRoles() {
  rolesCache = null
  return getRolesConfig()
}

export function reloadRoles() {
  rolesCache = null
  userRolesCache = null
  levelsCache = null
  return {
    roles: getRolesConfig(),
    users: getUserRolesMap(),
    levels: getLevelsConfig()
  }
}

export function reloadUserRoles() {
  userRolesCache = loadJson(USER_ROLES_PATH, {})
  return userRolesCache
}

// -------------------------------
// Export por defecto
// -------------------------------
export default {
  normalizeJid,
  normalizeRoleId,
  getRolesConfig,
  saveRolesConfig,
  getUserRolesMap,
  saveUserRolesMap,
  getLevelsConfig,
  getUserRoles,
  setUserRole,
  addUserRole,
  removeUserRole,
  getRoleInfo,
  getUserLevel,
  roleExists,
  listRoles,
  loadRoles,
  reloadRoles,
  reloadUserRoles
}
