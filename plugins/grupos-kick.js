// plugins/group/kick.js
import { requireCommandAccess } from '../../lib/permissions-middleware.js'
import { getRoleInfo } from '../../lib/lib-roles.js'

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
  if (jid.includes('@')) return jid
  return `${jid}@s.whatsapp.net`
}

const firstOwnerJid = () => {
  try {
    if (!global.owner) return null
    if (typeof global.owner === 'string') return normalizeJid(global.owner)
    if (Array.isArray(global.owner)) {
      for (const item of global.owner) {
        if (!item) continue
        if (typeof item === 'string') return normalizeJid(item)
        if (Array.isArray(item) && item.length && typeof item[0] === 'string') return normalizeJid(item[0])
      }
    }
    return null
  } catch (e) {
    return null
  }
}

const handler = async (m, { conn, participants, usedPrefix, command }) => {
  // Verificar permisos con el nuevo sistema
  try {
    requireCommandAccess(m.sender, 'group-kick', 'kick')
  } catch (err) {
    return conn.reply(m.chat, '> ❌ No tienes permiso para usar este comando.', m)
  }

  // Determinar objetivo: menciones > reply > argumento (número o jid)
  let user = null
  if (Array.isArray(m.mentionedJid) && m.mentionedJid.length) {
    user = normalizeJid(m.mentionedJid[0])
  } else if (m.quoted && m.quoted.sender) {
    user = normalizeJid(m.quoted.sender)
  } else {
    const parts = (m.text || '').trim().split(/\s+/)
    if (parts.length > 1) {
      user = normalizeJid(parts[1])
    }
  }

  if (!user) {
    return conn.reply(m.chat, `> Debes mencionar o responder a un usuario para expulsarlo.`, m)
  }

  try {
    // Metadata del grupo
    const groupInfo = typeof conn.groupMetadata === 'function' ? await conn.groupMetadata(m.chat) : null
    const ownerGroup = groupInfo?.owner ? normalizeJid(groupInfo.owner) : (m.chat.split`-`[0] ? normalizeJid(m.chat.split`-`[0] + '@s.whatsapp.net') : null)
    const ownerBot = firstOwnerJid()
    const botJid = conn.user?.jid || conn.user?.id || null

    // Roles internos
    const targetRole = getRoleInfo(user) || {}
    const senderRole = getRoleInfo(m.sender) || {}
    const targetRoleId = targetRole.id || null
    const senderRoleId = senderRole.id || null
    const targetIsCreador = targetRoleId === 'creador'
    const targetIsMod = targetRoleId === 'mod'
    const senderIsCreador = senderRoleId === 'creador'

    // Participantes del grupo (si se pasó por el framework)
    const targetInGroup = Array.isArray(participants) ? participants.find(p => (p.id || p.jid) === user) : null
    const senderInGroup = Array.isArray(participants) ? participants.find(p => (p.id || p.jid) === m.sender) : null

    const isTargetAdmin = !!(targetInGroup && (targetInGroup.admin === 'admin' || targetInGroup.admin === 'superadmin'))
    const isSenderAdmin = !!(senderInGroup && (senderInGroup.admin === 'admin' || senderInGroup.admin === 'superadmin'))

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
    if (Array.isArray(participants)) {
      const botInGroup = participants.find(p => (p.id || p.jid) === botJid)
      const botIsAdmin = !!(botInGroup && (botInGroup.admin === 'admin' || botInGroup.admin === 'superadmin'))
      if (!botIsAdmin) {
        return conn.reply(m.chat, `> ❌ Necesito ser administrador del grupo para expulsar usuarios. Promuévame y vuelve a intentarlo.`, m)
      }
    }

    // Intentar expulsar
    try {
      if (typeof conn.groupParticipantsUpdate === 'function') {
        await conn.groupParticipantsUpdate(m.chat, [user], 'remove')
      } else if (typeof conn.groupRemove === 'function') {
        await conn.groupRemove(m.chat, [user])
      } else {
        throw new Error('No se encontró método de expulsión compatible en la conexión.')
      }

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
      `> ⚠️ Error al procesar la expulsión.\n> Usa *${usedPrefix}report* para informarlo.\n\n${e?.message || ''}`,
      m
    )
  }
}

handler.pluginId = 'group-kick'
handler.help = ['kick', 'echar', 'hechar', 'sacar', 'ban', 'fuistee', 'chaoo', 'eraas', 'techingee']
handler.tags = ['modmenu']
handler.command = ['kick', 'echar', 'hechar', 'sacar', 'ban', 'fuistee', 'chaoo', 'eraas', 'techingee']
handler.group = true
handler.botAdmin = true

export default handler
