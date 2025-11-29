// plugins/group/kick.js
// SW SYSTEM — Group Kick (versión corregida y endurecida)

import { requireCommandAccess } from '../../lib/permissions-middleware.js'
import { getRoleInfo, normalizeJid as normalizeJidLib } from '../../lib/lib-roles.js'

/**
 * Kick handler mejorado
 * - Normaliza JIDs
 * - Soporta menciones, reply y número en argumentos
 * - Verifica permisos: requireCommandAccess, bot admin, sender admin/creador
 * - Protecciones: no expulsar al bot, al owner del grupo, ni al owner del bot; evita expulsar mods/creadores según roles internos
 * - Usa groupParticipantsUpdate con fallback y manejo de errores detallado
 */

const normalizeJid = jid => {
  if (!jid) return jid
  if (typeof jid !== 'string') jid = String(jid)
  jid = jid.trim()
  // si ya contiene @ lo devolvemos tal cual, si no asumimos número y añadimos dominio
  if (jid.includes('@')) return jid.split(':')[0].split('/')[0]
  return `${jid}@s.whatsapp.net`
}

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

  // Determinar objetivo: menciones > reply > argumento (número o jid)
  let user = null
  if (Array.isArray(m.mentionedJid) && m.mentionedJid.length) {
    user = normalizeJid(m.mentionedJid[0])
  } else if (m.quoted && (m.quoted.sender || m.quoted.participant)) {
    user = normalizeJid(m.quoted.sender || m.quoted.participant)
  } else {
    const text = (m.text || '').trim()
    const parts = text.split(/\s+/)
    if (parts.length > 1) {
      user = normalizeJid(parts[1])
    }
  }

  if (!user) {
    return conn.reply(m.chat, `> ❌ Debes mencionar o responder a un usuario para expulsarlo.\nUso: ${usedPrefix || ''}kick @usuario`, m)
  }

  try {
    // Metadata del grupo (fallback si no se pasa participants)
    const groupInfo = typeof conn.groupMetadata === 'function' ? await conn.groupMetadata(m.chat) : null
    const ownerGroup = groupInfo?.owner ? normalizeJid(groupInfo.owner) : null
    const ownerBot = firstOwnerJid()
    const botJid = normalizeJid(conn.user?.jid || conn.user?.id || '')

    // Roles internos
    const targetRole = getRoleInfo(user) || {}
    const senderRole = getRoleInfo(m.sender) || {}
    const targetRoleId = targetRole.id || null
    const senderRoleId = senderRole.id || null
    const targetIsCreador = targetRoleId === 'creador'
    const targetIsMod = targetRoleId === 'mod'
    const senderIsCreador = senderRoleId === 'creador'

    // Participantes del grupo (si se pasó por el framework)
    const targetInGroup = Array.isArray(participants) ? participants.find(p => normalizeJid(p.id || p.jid) === normalizeJid(user)) : null
    const senderInGroup = Array.isArray(participants) ? participants.find(p => normalizeJid(p.id || p.jid) === normalizeJid(m.sender)) : null

    const isTargetAdmin = !!(targetInGroup && (targetInGroup.admin === 'admin' || targetInGroup.admin === 'superadmin'))
    const isSenderAdmin = !!(senderInGroup && (senderInGroup.admin === 'admin' || senderInGroup.admin === 'superadmin'))

    // Protecciones absolutas
    if (normalizeJid(user) === normalizeJid(botJid)) {
      return conn.reply(m.chat, `> ❌ No puedo eliminarme a mí mismo del grupo.`, m)
    }

    if (ownerGroup && normalizeJid(user) === normalizeJid(ownerGroup)) {
      return conn.reply(m.chat, `> ❌ No puedo eliminar al propietario del grupo.`, m)
    }

    if (ownerBot && normalizeJid(user) === normalizeJid(ownerBot)) {
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
      const botInGroup = participants.find(p => normalizeJid(p.id || p.jid) === normalizeJid(botJid))
      botIsAdmin = !!(botInGroup && (botInGroup.admin === 'admin' || botInGroup.admin === 'superadmin'))
    } else if (groupInfo && groupInfo.participants) {
      const botInGroup = groupInfo.participants.find(p => normalizeJid(p.id || p.jid) === normalizeJid(botJid))
      botIsAdmin = !!(botInGroup && (botInGroup.admin === 'admin' || botInGroup.admin === 'superadmin'))
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
          text: `> ⛔️ @${normalizeJid(user).split('@')[0]} ha sido expulsado del grupo ✅`,
          mentions: [normalizeJid(user)]
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
handler.help = ['kick', 'echar', 'sacar', 'ban']
handler.tags = ['modmenu']
handler.command = ['kick', 'echar', 'sacar', 'ban']
handler.group = true
handler.botAdmin = true

export default handler
