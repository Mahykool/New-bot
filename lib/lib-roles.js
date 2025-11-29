// lib/lib-roles.js
// Sistema actualizado para SW SYSTEM — basado en niveles

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
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (e) {
    console.error(e)
    return defaultValue
  }
}

function saveJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
  } catch (e) {
    console.error(e)
  }
}

// -------------------------------
// Loaders
// -------------------------------
export function getRolesConfig() {
  return loadJson(ROLES_PATH, {})
}

export function getUserRolesMap() {
  return loadJson(USER_ROLES_PATH, {})
}

export function getLevelsConfig() {
  return loadJson(LEVELS_PATH, {})
}

// -------------------------------
// Role normalization (simple)
// -------------------------------
export function normalizeRoleId(roleId) {
  if (!roleId) return 'user'
  return roleId.toLowerCase()
}

// -------------------------------
// User roles
// -------------------------------
export function getUserRoles(userJid) {
  const users = getUserRolesMap()
  return users[userJid] || ['user']
}

export function setUserRole(userJid, roleId) {
  const users = getUserRolesMap()
  users[userJid] = [normalizeRoleId(roleId)]
  saveJson(USER_ROLES_PATH, users)
  return users[userJid]
}

export function addUserRole(userJid, roleId) {
  const users = getUserRolesMap()
  const current = users[userJid] || ['user']
  const r = normalizeRoleId(roleId)

  if (!current.includes(r)) current.push(r)

  users[userJid] = current
  saveJson(USER_ROLES_PATH, users)
  return users[userJid]
}

export function removeUserRole(userJid, roleId) {
  const users = getUserRolesMap()
  const current = users[userJid] || ['user']
  const r = normalizeRoleId(roleId)

  users[userJid] = current.filter(x => x !== r)
  if (!users[userJid].length) users[userJid] = ['user']

  saveJson(USER_ROLES_PATH, users)
  return users[userJid]
}

// -------------------------------
// Role info
// -------------------------------
export function getRoleInfo(userJid) {
  const rolesConfig = getRolesConfig()
  const userRoles = getUserRoles(userJid)

  const primary = userRoles[0] || 'user'
  const role = rolesConfig[primary] || rolesConfig['user']

  return {
    id: primary,
    name: role.name,
    icon: role.icon,
    description: role.description,
    level: role.roleLevel
  }
}

// -------------------------------
// NEW: Get user level (for middleware)
// -------------------------------
export function getUserLevel(userJid) {
  const rolesConfig = getRolesConfig()
  const userRoles = getUserRoles(userJid)
  const primary = userRoles[0] || 'user'

  const role = rolesConfig[primary]
  return role?.roleLevel || 'basic'
}
