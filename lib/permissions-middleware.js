// permissions-middleware.js
import fs from 'fs'
import { getUserLevel } from './lib-roles.js'

// ===============================
// ✅ CARGAR PERMISOS POR PLUGIN
// ===============================
const PERMISSIONS_FILE = './database/plugin-permissions.json'
let pluginPermissions = {}

try {
    pluginPermissions = JSON.parse(fs.readFileSync(PERMISSIONS_FILE))
} catch (e) {
    console.error('Error cargando plugin-permissions.json:', e)
    pluginPermissions = {}
}

// ===============================
// ✅ CARGAR LEVELS.JSON
// ===============================
const LEVELS_FILE = './database/levels.json'
let levelsDB = {}

try {
    levelsDB = JSON.parse(fs.readFileSync(LEVELS_FILE))
} catch (e) {
    console.error('Error cargando levels.json:', e)
    levelsDB = {}
}

// ===============================
// ✅ OBTENER NIVEL REQUERIDO
// ===============================
function getRequiredLevel(pluginName, commandName) {
    const plugin = pluginPermissions[pluginName]

    // ✅ Si el plugin existe y define el comando
    if (plugin && plugin[commandName]) {
        const levelKey = plugin[commandName]
        return levelsDB[levelKey] || 0
    }

    // ✅ Si el plugin tiene default
    if (plugin && plugin.__defaults__?.command) {
        const levelKey = plugin.__defaults__.command
        return levelsDB[levelKey] || 0
    }

    // ✅ Default global
    if (pluginPermissions.__defaults__?.command) {
        const levelKey = pluginPermissions.__defaults__.command
        return levelsDB[levelKey] || 0
    }

    // ✅ Si no hay nada definido → nivel 0
    return 0
}

// ===============================
// ✅ MIDDLEWARE PRINCIPAL
// ===============================
export function requireCommandAccess(m, pluginName, commandName) {
    try {
        const sender = m.sender

        // ✅ Nivel del usuario
        const userLevel = getUserLevel(sender)

        // ✅ Nivel requerido según plugin-permissions.json
        const requiredLevel = getRequiredLevel(pluginName, commandName)

        // ✅ Validación principal
        if (userLevel < requiredLevel) {
            throw new Error(
                `Este comando requiere nivel ${requiredLevel}, pero tu nivel actual es ${userLevel}.`
            )
        }

        return true
    } catch (e) {
        console.error('Error en requireCommandAccess:', e)
        throw e
    }
}

export default {
    requireCommandAccess
}
