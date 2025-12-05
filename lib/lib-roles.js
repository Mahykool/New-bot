// lib/lib-roles.js
import fs from 'fs'
import path from 'path'

const ROLES_FILE = path.join('./database', 'roles.json')
const USER_ROLES_FILE = path.join('./database', 'user-roles.json')
const LEVELS_FILE = path.join('./database', 'levels.json')

// -------------------------------
// Carga segura de archivos
// -------------------------------
function loadJSON(file, fallback = {}) {
  try {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify(fallback, null, 2))
      return fallback
    }
    return JSON.parse(fs.readFileSync(file))
  } catch {
    return fallback
  }
}
function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2))
  console.log(`💾 Archivo actualizado: ${file}`)
}

// -------------------------------
// Bases de datos
// -------------------------------
let rolesDB = loadJSON(ROLES_FILE, {})
let userRolesDB = loadJSON(USER_ROLES_FILE, {})
let levelsDB = loadJSON(LEVELS_FILE, {})

// -------------------------------
// Normalización
// -------------------------------
export function normalizeJid(jid) {
  if (!jid) return null
  jid = String(jid).trim()
  if (jid.endsWith('@s.whatsapp.net')) return jid
  if (/^\d+$/.test(jid)) return `${jid}@s.whatsapp.net`
  const num = jid.split('@')[0].replace(/\D/g, '')
  return num ? `${num}@s.whatsapp.net` : null
}

const roleAliases = { owner: 'creador', rowner: 'creador', roowner: 'creador' }
export function normalizeRole(role) {
  if (!role) return null
  role = String(role).toLowerCase().trim()
  return roleAliases[role] || role
}

// -------------------------------
// Roles de usuario
// -------------------------------
export function getUserRoles(jid) {
  const norm = normalizeJid(jid)
  if (!norm) return []
  return (userRolesDB[norm] || []).map(normalizeRole).filter(Boolean)
}

export function addUserRole(jid, role) {
  const norm = normalizeJid(jid)
  const nRole = normalizeRole(role)
  console.log(`➕ addUserRole: JID=${norm}, Rol=${nRole}`)
  if (!norm || !rolesDB[nRole]) {
    console.log('❌ Rol inválido o JID inválido')
    return false
  }
  const current = getUserRoles(norm).map(normalizeRole)
  if (current.includes(nRole)) {
    console.log('⚠️ Ya tenía ese rol')
    return false
  }
  userRolesDB[norm] = [...current, nRole]
  saveJSON(USER_ROLES_FILE, userRolesDB)
  console.log(`✅ Rol añadido: ${nRole} → ${norm}`)
  return true
}

export function removeUserRole(jid, role) {
  const norm = normalizeJid(jid)
  const nRole = normalizeRole(role)
  console.log(`➖ removeUserRole: JID=${norm}, Rol=${nRole}`)
  if (!norm) return false
  const current = getUserRoles(norm)
  if (!current.includes(nRole)) {
    console.log('⚠️ No tenía ese rol')
    return false
  }
  userRolesDB[norm] = current.filter(r => r !== nRole)
  saveJSON(USER_ROLES_FILE, userRolesDB)
  console.log(`✅ Rol removido: ${nRole} → ${norm}`)
  return true
}

export function setUserRole(jid, role) {
  const norm = normalizeJid(jid)
  const nRole = normalizeRole(role)
  console.log(`🎯 setUserRole: JID=${norm}, Rol=${nRole}`)
  if (!norm || !rolesDB[nRole]) {
    console.log('❌ Rol inválido o JID inválido')
    return false
  }
  userRolesDB[norm] = [nRole]
  saveJSON(USER_ROLES_FILE, userRolesDB)
  console.log(`✅ Rol establecido: ${nRole} → ${norm}`)
  return true
}

// -------------------------------
// Niveles y permisos
// -------------------------------
export function getRequiredLevel(levelKey) {
  return levelsDB[levelKey] || levelsDB.basic || 0
}

export function getUserLevel(jid) {
  const roles = getUserRoles(jid)
  let max = 0
  for (const role of roles) {
    const info = rolesDB[role]
    if (!info) continue
    const levelValue = levelsDB[info.roleLevel] || 0
    if (levelValue > max) max = levelValue
  }
  return max
}

export function hasRequiredLevel(jid, levelKey) {
  return getUserLevel(jid) >= getRequiredLevel(levelKey)
}

// -------------------------------
// Catálogo de roles
// -------------------------------
export function listRoles() {
  return Object.keys(rolesDB).map(role => ({
    role,
    ...rolesDB[role],
    level: levelsDB[rolesDB[role].roleLevel] || 0
  }))
}

export function getRoleInfo(level) {
  const all = listRoles().sort((a, b) => b.level - a.level)
  for (const r of all) if (level >= r.level) return r
  return { role: 'user', name: 'USER', icon: '🔹', description: 'Usuario estándar', roleLevel: 'basic', level: 0 }
}

// -------------------------------
// Mapa completo
// -------------------------------
export function getUserRolesMap() { return userRolesDB }
export function saveUserRolesMap(map) { userRolesDB = map; saveJSON(USER_ROLES_FILE, userRolesDB) }