// permissions-middleware.js
import { 
    getUserRoles, 
    getUserLevel, 
    getRequiredLevel, 
    hasRequiredLevel 
} from './lib-roles.js'

// ======================================================
// ✅ VALIDAR SI UN USUARIO PUEDE USAR UN COMANDO
// ======================================================
export function canUsePlugin(jid, command) {
    try {
        const userLevel = getUserLevel(jid)
        const required = getRequiredLevel(command)
        return userLevel >= required
    } catch (e) {
        console.error('Error en canUsePlugin:', e)
        return false
    }
}

// ======================================================
// ✅ MIDDLEWARE PRINCIPAL
// ======================================================
export function requireCommandAccess(m, command, rawCommand = null, chatCfg = {}) {
    try {
        const sender = m.sender
        const cmd = rawCommand || command

        // Nivel requerido según levels.json
        const requiredLevel = getRequiredLevel(cmd)
        const userLevel = getUserLevel(sender)

        // Si el usuario no cumple el nivel → error
        if (userLevel < requiredLevel) {
            throw new Error(
                `Este comando requiere nivel ${requiredLevel}, pero tu nivel actual es ${userLevel}.`
            )
        }

        // Si el chat tiene restricciones adicionales
        if (chatCfg?.blockedCommands && Array.isArray(chatCfg.blockedCommands)) {
            if (chatCfg.blockedCommands.includes(cmd)) {
                throw new Error(`Este comando está bloqueado en este grupo.`)
            }
        }

        return true
    } catch (e) {
        console.error('Error en requireCommandAccess:', e)
        throw e
    }
}

export default {
    canUsePlugin,
    requireCommandAccess
}
