// lib/permissions-config.js
// Configuración mínima de permisos para Swill-bot
export default {
  admins: [],            // lista de jids de administradores, p. ej. ['56912345678@s.whatsapp.net']
  roles: {               // definiciones de permisos por rol (opcional)
    // ejemplo:
    // owner: { canAddMods: true, canKick: true },
    // mod:   { canAddMods: true, canKick: false }
  },
  defaults: {            // permisos por defecto aplicables si no hay rol específico
    canAddMods: false,
    canKick: false,
    canManageRoles: false
  }
}
