// lib/lib-roles.js
// Sistema de roles centralizado para SW SYSTEM — versión final y lista para reemplazar

import fs from 'fs'
import path from 'path'

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
  // eliminar sufijos de recurso y rutas (ej: ':1A2B' o '/device')
  const base = jid.split(':')[0].split('/')[0]
  if (base.includes('@')) return base
  return `${base}@s.whatsapp.net`
}

export function normalizeRoleId(roleId) {
  if (!roleId) return 'user'
  return String(roleId).trim().toLowerCase()
}

// -------------------------------
// Loaders / Savers
// -------------------------------
export function getRolesConfig() {
  return loadJson(ROLES_PATH, {
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

export function saveRolesConfig(obj) {
  return saveJson(ROLES_PATH, obj)
}

export function getUserRolesMap() {
  return loadJson(USER_ROLES_PATH, {})
}

export function saveUserRolesMap(obj) {
  return saveJson(USER_ROLES_PATH, obj)
}

export function getLevelsConfig() {
  // formato esperado: { basic: 1, manage: 5, full: 10 } o similar
  return loadJson(LEVELS_PATH, { basic: 1, manage: 5, full: 10 })
}

// -------------------------------
// Operaciones sobre roles de usuario
// -------------------------------
export function getUserRoles(userJid) {
  const users = getUserRolesMap()
  const jid = normalizeJid(userJid)
  return users[jid] || ['user']
}

export function setUserRole(userJid, roleId) {
  const users = getUserRolesMap()
  const jid = normalizeJid(userJid)
  users[jid] = [normalizeRoleId(roleId)]
  saveUserRolesMap(users)
  return users[jid]
}

export function addUserRole(userJid, roleId) {
  const users = getUserRolesMap()
  const jid = normalizeJid(userJid)
  const current = users[jid] || ['user']
  const r = normalizeRoleId(roleId)
  if (!current.includes(r)) current.push(r)
  users[jid] = current
  saveUserRolesMap(users)
  return users[jid]
}

export function removeUserRole(userJid, roleId) {
  const users = getUserRolesMap()
  const jid = normalizeJid(userJid)
  const current = users[jid] || ['user']
  const r = normalizeRoleId(roleId)
  users[jid] = current.filter(x => x !== r)
  if (!users[jid] || users[jid].length === 0) users[jid] = ['user']
  saveUserRolesMap(users)
  return users[jid]
}

// -------------------------------
// Información de rol
// -------------------------------
export function getRoleInfo(userJid) {
  const rolesConfig = getRolesConfig()
  const userRoles = getUserRoles(userJid)
  const primary = userRoles[0] || 'user'
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

export function getUserLevel(userJid) {
  const rolesConfig = getRolesConfig()
  const userRoles = getUserRoles(userJid)
  const primary = userRoles[0] || 'user'
  const role = rolesConfig[primary]
  return role?.roleLevel || 'basic'
}

// -------------------------------
// Utilidades adicionales
// -------------------------------
export function roleExists(roleId) {
  const roles = getRolesConfig()
  return Boolean(roles && roles[roleId])
}

export function listRoles() {
  const roles = getRolesConfig()
  return Object.keys(roles || {})
}
