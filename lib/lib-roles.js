// lib/lib-roles.js
// Sistema de roles centralizado para SW SYSTEM — versión estable con caché en memoria + auditoría

import fs from 'fs'
import path from 'path'
import { auditLog } from './audit.js'

const __dirname = process.cwd()

const ROLES_PATH = path.join(__dirname, 'roles.json')
const USER_ROLES_PATH = path.join(__dirname, 'user-roles.json')
const LEVELS_PATH = path.join(__dirname, 'levels.json')

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
// Normalización de JID
// -------------------------------
export function normalizeJid(jid) {
  if (!jid) return jid
  if (typeof jid !== 'string') jid = String(jid)
  jid = jid.trim()
  const base = jid.split(':')[0].split('/')[0]
  if (base.includes('@')) return base
  return `${base}@s.whatsapp.net`
}

// -------------------------------
// Caché en memoria
// -------------------------------
let rolesCache = null
let userRolesCache = null
let levelsCache = null

function loadRolesCache() {
  if (!rolesCache) {
    rolesCache = loadJson(ROLES_PATH, {})
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
    levelsCache = loadJson(LEVELS_PATH, {})
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

export function setUserRole(userJid, roleId, actor = null) {
  const users = getUserRolesMap()
  const jid = normalizeJid(userJid)
  const r = roleId.toLowerCase()

  users[jid] = [r]
  saveUserRolesMap(users)

  auditLog({ actor, target: jid, action: 'SET_ROLE', role: r })
  return users[jid]
}

export function addUserRole(userJid, roleId, actor = null) {
  const users = getUserRolesMap()
  const jid = normalizeJid(userJid)
  const r = roleId.toLowerCase()

  const current = users[jid] || ['user']
  if (!current.includes(r)) {
    users[jid] = [r, ...current.filter(x => x !== r)]
  }

  saveUserRolesMap(users)
  auditLog({ actor, target: jid, action: 'ADD_ROLE', role: r })
  return users[jid]
}

export function removeUserRole(userJid, roleId, actor = null) {
  const users = getUserRolesMap()
  const jid = normalizeJid(userJid)
  const r = roleId.toLowerCase()

  const filtered = (users[jid] || []).filter(x => x !== r)
  users[jid] = filtered.length ? filtered : ['user']

  saveUserRolesMap(users)
  auditLog({ actor, target: jid, action: 'REMOVE_ROLE', role: r })
  return users[jid]
}

// -------------------------------
// Información de rol
// -------------------------------
export function getRoleInfo(userJid) {
  const rolesConfig = getRolesConfig()
  const userRoles = getUserRoles(userJid)
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

  return rolesConfig[primary] || rolesConfig['user']
}

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
