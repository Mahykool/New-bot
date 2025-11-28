// lib/lib-roles.js
import fs from 'fs'
import path from 'path'
const __dirname = process.cwd()
const ROLES_PATH = path.join(__dirname, 'lib', 'roles.json')
const USER_ROLES_PATH = path.join(__dirname, 'lib', 'user-roles.json')

function loadJson(filePath, defaultValue = {}) {
  try { if (!fs.existsSync(filePath)) return defaultValue
    return JSON.parse(fs.readFileSync(filePath,'utf8')) } catch (e) { console.error(e); return defaultValue }
}
function saveJson(filePath, data) { try { fs.writeFileSync(filePath, JSON.stringify(data,null,2)) } catch (e) { console.error(e) } }

export function getRolesConfig(){ return loadJson(ROLES_PATH,{}) }
export function getUserRolesMap(){ return loadJson(USER_ROLES_PATH,{}) }

export function normalizeRoleId(roleId){
  if (!roleId) return roleId
  const r = roleId.toLowerCase()
  if (r === 'mod') return 'staff'
  return r
}

export function getUserRoles(userJid){
  const users = getUserRolesMap()
  return users[userJid] || ['user']
}

export function setUserRole(userJid, roleId){
  const users = getUserRolesMap()
  users[userJid] = [normalizeRoleId(roleId)]
  saveJson(USER_ROLES_PATH, users)
  return users[userJid]
}

export function addUserRole(userJid, roleId){
  const users = getUserRolesMap()
  const current = users[userJid] || ['user']
  const r = normalizeRoleId(roleId)
  if (!current.includes(r)) current.push(r)
  users[userJid] = current
  saveJson(USER_ROLES_PATH, users)
  return users[userJid]
}

export function removeUserRole(userJid, roleId){
  const users = getUserRolesMap()
  const current = users[userJid] || ['user']
  const r = normalizeRoleId(roleId)
  users[userJid] = current.filter(x => x !== r)
  users[userJid] = users[userJid].length ? users[userJid] : ['user']
  saveJson(USER_ROLES_PATH, users)
  return users[userJid]
}

export function getRoleInfo(userJid){
  const rolesConfig = getRolesConfig()
  const userRoles = getUserRoles(userJid)
  const primary = userRoles[0] || 'user'
  const role = rolesConfig[primary] || rolesConfig['user'] || {name:'USER',icon:'🔹',description:'Usuario estándar'}
  return { id: primary, name: role.name, icon: role.icon, description: role.description }
}

export function getUserPluginAccess(userJid, pluginId){
  const rolesConfig = getRolesConfig()
  const userRoles = getUserRoles(userJid)
  const levelPower = { none:0, basic:1, manage:2, full:3 }
  let bestLevel = 'none', bestPower = 0
  for (const roleId of userRoles){
    const role = rolesConfig[roleId]; if (!role) continue
    const level = (role.pluginPermissions && role.pluginPermissions[pluginId]) || 'none'
    const power = levelPower[level] || 0
    if (power > bestPower){ bestPower = power; bestLevel = level }
  }
  return bestLevel
}
