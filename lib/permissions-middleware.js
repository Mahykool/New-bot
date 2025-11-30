// lib/permissions-middleware.js
// Middleware de permisos SW SYSTEM — versión integrado con lib-roles y plugin-permissions

import fs from 'fs'
import path from 'path'
import {
  getRolesConfig,
  getUserRoles,
  normalizeJid,
  getUserLevel as rolesGetUserLevel,
  getUserRolesMap
} from './lib-roles.js'

const PLUGIN_PERMS_FILE = path.join(process.cwd(), 'lib', 'plugin-permissions.json')
const LEVELS_FILE = path.join(process.cwd(), 'lib', 'levels.json')

const CACHE = {
  pluginPermissions: null,
  pluginPermissionsMtime: 0,
  levels: null,
  levelsMtime: 0
}

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

function loadPluginPermissions() {
  try {
    const stat = fs.existsSync(PLUGIN_PERMS_FILE) ? fs.statSync(PLUGIN_PERMS_FILE).mtimeMs : 0
    if (CACHE.pluginPermissions && CACHE.pluginPermissionsMtime === stat) return CACHE.pluginPermissions
    const data = safeReadJson(PLUGIN_PERMS_FILE, {})
    CACHE.pluginPermissions = data
    CACHE.pluginPermissionsMtime = stat
    return data
  } catch (e) {
    return {}
  }
}

function loadLevels() {
  try {
    const stat = fs.existsSync(LEVELS_FILE) ? fs.statSync(LEVELS_FILE).mtimeMs : 0
    if (CACHE.levels && CACHE.levelsMtime === stat) return CACHE.levels
    const data = safeReadJson(LEVELS_FILE, { basic: 1, vip: 2, vip_plus: 3, manage: 4, full: 5 })
    CACHE.levels = data
    CACHE.levelsMtime = stat
    return data
  } catch (e) {
    return { basic: 1, vip: 2, vip_plus: 3, manage: 4, full: 5 }
  }
}

function levelValue(key) {
  const levels = loadLevels()
  return levels[key] ?? 0
}

function isOwnerNormalized(njid) {
  try {
    const owners = []
      .concat(global.roowner || [])
      .concat(global.owner || [])
      .flat()
      .filter(Boolean)
    for (const o of owners) {
      const cand = Array.isArray(o) ? (o[0] || '') : (o.jid || o || '')
      if (!cand) continue
      if (normalizeJid(cand) === njid) return true
    }
  } catch (e) {}
  return false
}

export function getUserLevel(userJid) {
  return rolesGetUserLevel(userJid)
}

export function hasPermission(userJid, permissionId) {
  try {
    const rolesConfig = getRolesConfig()
    const n = normalizeJid(userJid)
    const userRoles = getUserRoles(n) || []
    for (const roleId of userRoles) {
      const role = rolesConfig[roleId]
      if (!role) continue
      const perms = role.globalPermissions || []
      if (perms.includes('USE_ALL_PLUGINS')) return true
      if (perms.includes(permissionId)) return true
    }
    // owner override
    if (isOwnerNormalized(n)) return true
  } catch (e) {}
  return false
}

function pluginKeyCandidates(pluginId) {
  if (!pluginId) return []
  const candidates = []
  candidates.push(pluginId)
  try {
    const base = path.basename(pluginId)
    if (base) candidates.push(base)
    const parts = pluginId.split('/')
    if (parts.length) candidates.push(parts[parts.length - 1])
  } catch {}
  return Array.from(new Set(candidates))
}

export function canUseCommand(userJid, pluginId, command, chatCfg = {}) {
  try {
    const n = normalizeJid(userJid)
    if (!n) return false

    // owner override
    if (isOwnerNormalized(n)) return true

    // global permission override
    if (hasPermission(n, 'USE_ALL_PLUGINS')) return true

    // whitelist por chat
    try {
      const per = Array.isArray(chatCfg?.per) ? chatCfg.per.map(p => normalizeJid(p)).filter(Boolean) : []
      if (per.includes(n)) return true
    } catch {}

    const pluginPermissions = loadPluginPermissions()
    const levels = loadLevels()

    const cmdKey = (command || '').toLowerCase().replace(/\s+/g, '')
    const candidates = pluginKeyCandidates(pluginId)

    // buscar entrada específica en cualquiera de los candidatos
    for (const key of candidates) {
      const entry = pluginPermissions?.[key]
      if (!entry) continue
      // si el plugin define __defaults__ a nivel de plugin, usarlo
      if (entry[cmdKey]) {
        const required = entry[cmdKey]
        const userLevelKey = getUserLevel(n) || 'basic'
        return (levels[userLevelKey] ?? 0) >= (levels[required] ?? 0)
      }
      if (entry.__defaults__ && entry.__defaults__.command) {
        const required = entry.__defaults__.command
        const userLevelKey = getUserLevel(n) || 'basic'
        return (levels[userLevelKey] ?? 0) >= (levels[required] ?? 0)
      }
    }

    // fallback global __defaults__ en plugin-permissions.json
    const globalDefaults = pluginPermissions?.__defaults__?.command || 'manage'
    const userLevelKey = getUserLevel(n) || 'basic'
    return (levels[userLevelKey] ?? 0) >= (levels[globalDefaults] ?? levelValue('manage'))
  } catch (e) {
    return false
  }
}

export const canUsePlugin = canUseCommand

export function requireCommandAccess(mOrJid, pluginId, command, chatCfg = {}) {
  // acepta tanto m (mensaje) como jid directo
  let jid = null
  if (typeof mOrJid === 'string') jid = mOrJid
  else if (mOrJid && typeof mOrJid === 'object') {
    jid = mOrJid?.sender || (mOrJid?.key && mOrJid.key.participant) || mOrJid?.from
  }
  jid = normalizeJid(jid)
  if (!jid) {
    const err = new Error('ACCESS_DENIED: invalid_jid')
    err.code = 'ACCESS_DENIED'
    throw err
  }
  if (!canUseCommand(jid, pluginId, command, chatCfg)) {
    const userLevel = getUserLevel(jid)
    const pluginPermissions = loadPluginPermissions()
    // intentar resolver required level para mensaje de error
    let required = null
    const candidates = pluginKeyCandidates(pluginId)
    const cmdKey = (command || '').toLowerCase().replace(/\s+/g, '')
    for (const key of candidates) {
      const entry = pluginPermissions?.[key]
      if (!entry) continue
      if (entry[cmdKey]) { required = entry[cmdKey]; break }
      if (entry.__defaults__ && entry.__defaults__.command) { required = entry.__defaults__.command; break }
    }
    if (!required) required = pluginPermissions?.__defaults__?.command || 'manage'
    const err = new Error(`ACCESS_DENIED: required=${required} user=${userLevel}`)
    err.code = 'ACCESS_DENIED'
    err.required = required
    err.userLevel = userLevel
    err.plugin = pluginId
    err.command = command
    throw err
  }
  return true
}

export default {
  hasPermission,
  canUseCommand,
  canUsePlugin,
  getUserLevel,
  requireCommandAccess
}
