// lib/lib-roles.js
// Sistema de roles centralizado para SW SYSTEM

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
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
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
  if (jid.includes('@')) return jid
  return `${jid}@s.whatsapp.net`
}

export function normalizeRoleId(roleId) {
  if (!roleId) return 'user'
  return String(roleId).trim().toLowerCase()
}

// -------------------------------
// Loaders / Savers
// -------------------------------
export function getRolesConfig() {
  return loadJson(ROLES_PATH, {})
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
  return loadJson(LEVELS_PATH, {})
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
