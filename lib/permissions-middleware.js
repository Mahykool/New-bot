// permissions-middleware.js
import fs from 'fs'
import { getUserLevel } from './lib-roles.js'

// ===============================
// ✅ CARGAR PERMISOS POR PLUGIN
// ===============================
const PERMISSIONS_FILE = './database/plugin-permissions.json'
let pluginPermissions = {}
try { pluginPermissions = JSON.parse(fs.readFileSync(PERMISSIONS_FILE)) }
catch (e) { console.error('Error cargando plugin-permissions.json:', e); pluginPermissions = {} }

// ===============================
// ✅ CARGAR LEVELS.JSON
// ===============================
const LEVELS_FILE = './database/levels.json'
let levelsDB = {}
try { levelsDB = JSON.parse(fs.readFileSync(LEVELS_FILE)) }
catch (e) { console.error('Error cargando levels.json:', e); levelsDB = {} }

// ===============================
// ✅ MAPEAR NIVELES A ROLES (presentación)
function getRoleInfo(level) {
  if (level === levelsDB.full)    return { name: 'OWNER', icon: '👑', description: 'Acceso total' }
  if (level === levelsDB.manage)  return { name: 'MANAGER', icon: '⚙️', description: 'Gestión avanzada' }
  if (level === levelsDB.vip_plus)return { name: 'VIP+', icon: '💠', description: 'Usuario premium' }
  if (level === levelsDB.vip)     return { name: 'VIP', icon: '💎', description: 'Usuario distinguido' }
  return { name: 'USER', icon: '🔹', description: 'Usuario estándar' }
}

// ===============================
// ✅ OBTENER NIVEL REQUERIDO
function getRequiredLevel(pluginName, commandName) {
  const plugin = pluginPermissions[pluginName]
  if (plugin && plugin[commandName]) {
    const levelKey = plugin[commandName]
    return levelsDB[levelKey] || levelsDB.basic
  }
  if (plugin && plugin.__defaults__?.command) {
    const levelKey = plugin.__defaults__.command
    return levelsDB[levelKey] || levelsDB.basic
  }
  if (pluginPermissions.__defaults__?.command) {
    const levelKey = pluginPermissions.__defaults__.command
    return levelsDB[levelKey] || levelsDB.basic
  }
  return levelsDB.basic
}

// ===============================
// ✅ MIDDLEWARE PRINCIPAL
export function requireCommandAccess(m, pluginName, commandName) {
  const userLevel = getUserLevel(m.sender)
  const requiredLevel = getRequiredLevel(pluginName, commandName)
  if (userLevel < requiredLevel) {
    const userRole = getRoleInfo(userLevel)
    const requiredRole = getRoleInfo(requiredLevel)
    throw new Error(
      `Este comando requiere rol ${requiredRole.name} (${requiredLevel}), pero tu rol actual es ${userRole.name} (${userLevel}).`
    )
  }
  return true
}

export default { requireCommandAccess, getRoleInfo }