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
// ✅ OBTENER NIVEL REQUERIDO
// ===============================
function getRequiredLevelForCommand(pluginName, commandName, levelsDB) {
    const plugin = pluginPermissions[pluginName]

    // ✅ Si el plugin existe y define el comando
    if (plugin && plugin[commandName]) {
        return levelsDB[plugin[commandName]] || 0
    }

    // ✅ Si el plugin existe pero no define el comando → usar default del plugin
    if (plugin && plugin.__defaults__ && plugin.__defaults__.command) {
        return levelsDB[plugin.__defaults__.command] || 0
    }

    // ✅ Si existe default global
    if (pluginPermissions.__defaults__?.command) {
        return levelsDB[pluginPermissions.__defaults__.command] || 0
    }

    // ✅ Si no hay nada definido → nivel 0
    return 0
}

// ===============================
// ✅ MIDDLEWARE PRINCIPAL
// ===============================
export function requireCommandAccess(m, pluginName, commandName, levelsDB, chatCfg = {}) {
    try {
        const sender = m.sender

        // ✅ Nivel del usuario
        const userLevel = getUserLevel(sender)

        // ✅ Nivel requerido según plugin-permissions.json
        const requiredLevel = getRequiredLevelForCommand(pluginName, commandName, levelsDB)

        // ✅ Validación principal
        if (userLevel < requiredLevel) {
            throw new Error(
                `Este comando requiere nivel ${requiredLevel}, pero tu nivel actual es ${userLevel}.`
            )
        }

        // ✅ Restricciones por chat
        if (chatCfg?.blockedCommands?.includes(commandName)) {
            throw new Error(`Este comando está bloqueado en este grupo.`)
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
