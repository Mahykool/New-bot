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
// ✅ OBTENER ROLES DE UN USUARIO
// ===============================
export function getUserRoles(jid) {
    jid = String(jid).trim()
    return userRolesDB[jid] || []
}

// ===============================
// ✅ ASIGNAR ROL A UN USUARIO
// ===============================
export function addUserRole(jid, role) {
    jid = String(jid).trim()
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
    jid = String(jid).trim()
    if (!userRolesDB[jid]) return false
    userRolesDB[jid] = userRolesDB[jid].filter(r => r !== role)
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
    jid = String(jid).trim()
    const roles = getUserRoles(jid)
    let maxLevel = 0

    for (const role of roles) {
        if (rolesDB[role] && rolesDB[role].level > maxLevel) {
            maxLevel = rolesDB[role].level
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
        level: rolesDB[role].level || 0,
        description: rolesDB[role].description || ''
    }))
}

// ===============================
// ✅ CREAR NUEVO ROL
// ===============================
export function createRole(role, level = 0, description = '') {
    if (rolesDB[role]) return false
    rolesDB[role] = { level, description }
    saveJSON(ROLES_FILE, rolesDB)
    return true
}

// ===============================
// ✅ ELIMINAR ROL
// ===============================
export function deleteRole(role) {
    if (!rolesDB[role]) return false
    delete rolesDB[role]

    // Quitar el rol de todos los usuarios
    for (const jid of Object.keys(userRolesDB)) {
        userRolesDB[jid] = userRolesDB[jid].filter(r => r !== role)
    }

    saveJSON(ROLES_FILE, rolesDB)
    saveJSON(USER_ROLES_FILE, userRolesDB)
    return true
}

// ===============================
// ✅ EXPORTAR TODO
// =================
