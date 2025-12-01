// lib-roles.js
import fs from 'fs'
import path from 'path'

const ROLES_FILE = path.join('./database', 'roles.json')
const USER_ROLES_FILE = path.join('./database', 'user-roles.json')
const LEVELS_FILE = path.join('./database', 'levels.json')

// ===============================
// ✅ CARGA SEGURA DE ARCHIVOS
// ===============================
function loadJSON(file, fallback = {}) {
    try {
        if (!fs.existsSync(file)) {
            fs.writeFileSync(file, JSON.stringify(fallback, null, 2))
            return fallback
        }
        return JSON.parse(fs.readFileSync(file))
    } catch (e) {
        console.error(`Error cargando ${file}:`, e)
        return fallback
    }
}

function saveJSON(file, data) {
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2))
    } catch (e) {
        console.error(`Error guardando ${file}:`, e)
    }
}

// ===============================
// ✅ BASES DE DATOS
// ===============================
let rolesDB = loadJSON(ROLES_FILE, {})
let userRolesDB = loadJSON(USER_ROLES_FILE, {})
let levelsDB = loadJSON(LEVELS_FILE, {})

// ===============================
// ✅ NORMALIZAR JID
// ===============================
export function normalizeJid(jid) {
    return String(jid).trim().replace(/[^0-9@s\.]/g, '')
}

// ===============================
// ✅ OBTENER ROLES DE UN USUARIO
// ===============================
export function getUserRoles(jid) {
    jid = normalizeJid(jid)
    return userRolesDB[jid] || []
}

// ===============================
// ✅ OBTENER INFO DE UN ROL
// ===============================
export function getRoleInfo(role) {
    return rolesDB[role] || null
}

// ===============================
// ✅ ASIGNAR ROL A UN USUARIO
// ===============================
export function addUserRole(jid, role) {
    jid = normalizeJid(jid)
    if (!rolesDB[role]) return false

    if (!userRolesDB[jid]) userRolesDB[jid] = []
    if (!userRolesDB[jid].includes(role)) {
        userRolesDB[jid].push(role)
        saveJSON(USER_ROLES_FILE, userRolesDB)
        return true
    }
    return false
}

// ===============================
// ✅ QUITAR ROL A UN USUARIO
// ===============================
export function removeUserRole(jid, role) {
    jid = normalizeJid(jid)
    if (!userRolesDB[jid]) return false

    userRolesDB[jid] = userRolesDB[jid].filter(r => r !== role)
    saveJSON(USER_ROLES_FILE, userRolesDB)
    return true
}

// ===============================
// ✅ ESTABLECER UN ÚNICO ROL
// ===============================
export function setUserRole(jid, role) {
    jid = normalizeJid(jid)
    if (!rolesDB[role]) return false

    userRolesDB[jid] = [role]
    saveJSON(USER_ROLES_FILE, userRolesDB)
    return true
}

// ===============================
// ✅ OBTENER NIVEL REQUERIDO DE UN COMANDO
// ===============================
export function getRequiredLevel(command) {
    return levelsDB[command] || 0
}

// ===============================
// ✅ OBTENER NIVEL DE UN USUARIO
// ===============================
export function getUserLevel(jid) {
    jid = normalizeJid(jid)
    const roles = getUserRoles(jid)

    let maxLevel = 0

    for (const role of roles) {
        const info = rolesDB[role]
        if (!info) continue

        const roleLevelKey = info.roleLevel
        const levelValue = levelsDB[roleLevelKey] || 0

        if (levelValue > maxLevel) {
            maxLevel = levelValue
        }
    }

    return maxLevel
}

// ===============================
// ✅ VERIFICAR SI UN USUARIO TIENE PERMISO
// ===============================
export function hasRequiredLevel(jid, command) {
    const userLevel = getUserLevel(jid)
    const required = getRequiredLevel(command)
    return userLevel >= required
}

// ===============================
// ✅ LISTAR ROLES DISPONIBLES
// ===============================
export function listRoles() {
    return Object.keys(rolesDB).map(role => ({
        role,
        name: rolesDB[role].name,
        icon: rolesDB[role].icon,
        description: rolesDB[role].description,
        roleLevel: rolesDB[role].roleLevel,
        level: levelsDB[rolesDB[role].roleLevel] || 0
    }))
}

// ===============================
// ✅ EXPORTAR TODO
// ===============================
export default {
    getUserRoles,
    getRoleInfo,
    addUserRole,
    removeUserRole,
    setUserRole,
    getUserLevel,
    getRequiredLevel,
    hasRequiredLevel,
    listRoles,
    normalizeJid
}
