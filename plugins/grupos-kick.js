// plugins/group/kick.js
// SW SYSTEM — Group Kick (versión corregida y endurecida)
// Parche: usa parseTarget central, normaliza JIDs con lib-roles y mejora validaciones

import { requireCommandAccess } from '../../lib/permissions-middleware.js'
import { getRoleInfo, normalizeJid as normalizeJidLib } from '../../lib/lib-roles.js'
import { parseTarget } from '../../lib/utils.js'

/**
 * Kick handler mejorado
 * - Normaliza JIDs usando normalizeJid desde lib-roles
 * - Soporta menciones, reply y número en argumentos (vía parseTarget)
 * - Verifica permisos: requireCommandAccess, bot admin, sender admin/creador
 * - Protecciones: no expulsar al bot, al owner del grupo, ni al owner del bot; evita expulsar mods/creadores según roles internos
 * - Usa groupParticipantsUpdate con fallback y manejo de errores detallado
 */

const firstOwnerJid = () => {
  try {
    if (!global.owner) return null
    if (typeof global.owner === 'string') return normalizeJidLib(global.owner)
    if (Array.isArray(global.owner)) {
      for (const item of global.owner) {
        if (!item) continue
        if (typeof item === 'string') return normalizeJidLib(item)
        if (Array.isArray(item) && item.length && typeof item[0] === 'string') return normalizeJidLib(item[0])
      }
    }
    return null
  } catch (e) {
    return null
  }
}

const handler = async (m, { conn, participants = [], usedPrefix = '', command = '' }) => {
  // Permisos del sistema
  try {
    requireCommandAccess(m.sender, 'group-kick', 'kick')
  } catch (err) {
    return conn.reply(m.chat, '> ❌ No tienes permiso para usar este comando.', m)
  }

  // Resolver objetivo con parseTarget (mención, reply, número, args)
  const targetRaw = parseTarget(m, (m?.text || '').trim().split(/\s+/).slice(1))
  const user = targetRaw ? normalizeJidLib(targetRaw) : null

  if (!user) {
    return conn.reply(m.chat, `> ❌ Debes mencionar o responder a un usuario para expulsarlo.\nUso: ${usedPrefix || ''}kick @usuario`, m)
  }

  try {
    // Metadata del grupo (fallback si no se pasa participants)
    const groupInfo = typeof conn.groupMetadata === 'function' ? await conn.groupMetadata(m.chat) : null
    const ownerGroup = groupInfo?.owner ? normalizeJidLib(groupInfo.owner) : null
    const ownerBot = firstOwnerJid()
    const botJid = normalizeJidLib(conn.user?.jid || conn.user?.id || '')

    // Roles internos
    const targetRole = getRoleInfo(user) || {}
    const senderRole = getRoleInfo(normalizeJidLib(m.sender)) || {}
    const targetRoleId = (targetRole.id || '').toString().toLowerCase()
    const senderRoleId = (senderRole.id || '').toString().toLowerCase()
    const targetIsCreador = ['creador', 'creator', 'owner'].includes(targetRoleId)
    const targetIsMod = ['mod', 'moderator', 'moderador'].includes(targetRoleId)
    const senderIsCreador = ['creador', 'creator', 'owner'].includes(senderRoleId)

    // Participantes del grupo (si se pasó por el framework)
    const targetInGroup = Array.isArray(participants) ? participants.find(p => normalizeJidLib(p.id || p.jid) === user) : null
    const senderInGroup = Array.isArray(participants) ? participants.find(p => normalizeJidLib(p.id || p.jid) === normalizeJidLib(m.sender)) : null

    const isTargetAdmin = !!(targetInGroup && (targetInGroup.admin === 'admin' || targetInGroup.admin === 'superadmin' || targetInGroup.isAdmin))
    const isSenderAdmin = !!(senderInGroup && (senderInGroup.admin === 'admin' || senderInGroup.admin === 'superadmin' || senderInGroup.isAdmin))

    // Protecciones absolutas
    if (user === botJid) {
      return conn.reply(m.chat, `> ❌ No puedo eliminarme a mí mismo del grupo.`, m)
    }

    if (ownerGroup && user === ownerGroup) {
      return conn.reply(m.chat, `> ❌ No puedo eliminar al propietario del grupo.`, m)
    }

    if (ownerBot && user === ownerBot) {
      return conn.reply(m.chat, `> ❌ No puedo eliminar al propietario del bot.`, m)
    }

    // Protecciones por rol interno
    if (targetIsCreador) {
      return conn.reply(
        m.chat,
        `> ❌ Intentaste eliminar al *CREADOR* (rol interno). Esta acción está prohibida.`,
        m
      )
    }

    if (targetIsMod && !senderIsCreador) {
      return conn.reply(
        m.chat,
        `> ❌ No puedes expulsar a un *MOD* a menos que seas el creador.`,
        m
      )
    }

    // Evitar expulsar admins del grupo si quien ejecuta no es creador
    if (isTargetAdmin && !senderIsCreador) {
      return conn.reply(
        m.chat,
        `> ❌ No puedes expulsar a otro administrador del grupo.`,
        m
      )
    }

    // Verificar que el bot sea admin si handler.botAdmin = true
    // Si no se pasó participants, intentamos inferir desde groupInfo
    let botIsAdmin = false
    if (Array.isArray(participants) && participants.length) {
      const botInGroup = participants.find(p => normalizeJidLib(p.id || p.jid) === botJid)
      botIsAdmin = !!(botInGroup && (botInGroup.admin === 'admin' || botInGroup.admin === 'superadmin' || botInGroup.isAdmin))
    } else if (groupInfo && groupInfo.participants) {
      const botInGroup = groupInfo.participants.find(p => normalizeJidLib(p.id || p.jid) === botJid)
      botIsAdmin = !!(botInGroup && (botInGroup.admin === 'admin' || botInGroup.admin === 'superadmin' || botInGroup.isAdmin))
    }

    if (!botIsAdmin) {
      return conn.reply(m.chat, `> ❌ Necesito ser administrador del grupo para expulsar usuarios. Promuévame y vuelve a intentarlo.`, m)
    }

    // Intentar expulsar con varios fallbacks
    try {
      if (typeof conn.groupParticipantsUpdate === 'function') {
        await conn.groupParticipantsUpdate(m.chat, [user], 'remove')
      } else if (typeof conn.groupRemove === 'function') {
        await conn.groupRemove(m.chat, [user])
      } else if (typeof conn.groupParticipants === 'function') {
        await conn.groupParticipants(m.chat, [user], 'remove')
      } else {
        throw new Error('group-api-not-found')
      }

      // Confirmación con mención
      await conn.sendMessage(
        m.chat,
        {
          text: `> ⛔️ @${user.split('@')[0]} ha sido expulsado del grupo ✅`,
          mentions: [user]
        },
        { quoted: m }
      )
    } catch (errKick) {
      console.error('kick error:', errKick)
      let reason = errKick?.message || String(errKick)
      if (reason.length > 300) reason = reason.slice(0, 300) + '...'
      return conn.reply(
        m.chat,
        `> ⚠️ No pude expulsar al usuario.\n> Razón: ${reason}\n> Asegúrate de que tengo permisos y que el objetivo no es admin/propietario.`,
        m
      )
    }
  } catch (e) {
    console.error('kick handler error:', e)
    return conn.reply(
      m.chat,
      `> ⚠️ Error al procesar la expulsión.\n> Usa *${usedPrefix || ''}report* para informarlo.\n\n${e?.message || ''}`,
      m
    )
  }
}

handler.pluginId = 'group-kick'
handler.help = ['kick','ban']
handler.tags = ['modmenu']
handler.command = ['kick', 'echar', 'sacar', 'ban']
handler.group = true
handler.botAdmin = true

export default handler
