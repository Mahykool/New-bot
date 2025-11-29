// plugins/group/kick.js
import { requireCommandAccess } from '../../lib/permissions-middleware.js'
import { getRoleInfo } from '../../lib/lib-roles.js'

const handler = async (m, { conn, participants, usedPrefix, command }) => {
  // ✅ Verificación de permisos con el nuevo sistema
  requireCommandAccess(m.sender, 'group-kick', 'kick')

  let mentionedJid = m.mentionedJid
  let user = mentionedJid && mentionedJid.length
    ? mentionedJid[0]
    : m.quoted?.sender
      ? m.quoted.sender
      : null

  if (!user)
    return conn.reply(m.chat, `> Debes mencionar o responder a un usuario para expulsarlo.`, m)

  try {
    const groupInfo = await conn.groupMetadata(m.chat)
    const ownerGroup = groupInfo.owner || m.chat.split`-`[0] + '@s.whatsapp.net'
    const ownerBot = global.owner[0][0] + '@s.whatsapp.net'
    const botJid = conn.user.jid

    // 📌 Info de roles internos
    const targetRole = getRoleInfo(user)      // rol del objetivo
    const senderRole = getRoleInfo(m.sender) // rol del que ejecuta

    const targetRoleId = targetRole.id
    const senderRoleId = senderRole.id

    const targetIsCreador = targetRoleId === 'creador'
    const targetIsMod = targetRoleId === 'mod'
    const senderIsCreador = senderRoleId === 'creador'

    // 📌 Info de admins en el grupo
    const targetInGroup = participants.find(p => p.id === user)
    const senderInGroup = participants.find(p => p.id === m.sender)

    const isTargetAdmin =
      targetInGroup?.admin === 'admin' || targetInGroup?.admin === 'superadmin'
    const isSenderAdmin =
      senderInGroup?.admin === 'admin' || senderInGroup?.admin === 'superadmin'

    // 🔒 Protecciones absolutas
    if (user === botJid)
      return conn.reply(m.chat, `> No puedo eliminarme a mí mismo del grupo.`, m)

    if (user === ownerGroup)
      return conn.reply(m.chat, `> No puedo eliminar al propietario del grupo.`, m)

    if (user === ownerBot)
      return conn.reply(m.chat, `> No puedo eliminar al propietario del bot.`, m)

    // 🔒 Intento de expulsar al creador (rol interno)
    if (targetIsCreador) {
      return conn.reply(
        m.chat,
        `> ¿En serio intentaste eliminar al *CREADOR*? 💀\n> Eso merece al menos un facepalm imaginario.`,
        m
      )
    }

    // 🔒 Intento de expulsar a un MOD
    if (targetIsMod && !senderIsCreador) {
      return conn.reply(
        m.chat,
        `> Buen intento, pero no puedes expulsar a un *MOD* 😏\n> Mejor guarda ese poder para alguien de tu nivel.`,
        m
      )
    }

    // 🔒 Intento de admin vs admin (grupo)
    if (isTargetAdmin && !senderIsCreador) {
      return conn.reply(
        m.chat,
        `> Intentaste expulsar a otro admin del grupo 🧐\n> Eso no se ve muy sano para la paz del grupo, ¿no?`,
        m
      )
    }

    // ✅ Si pasa todos los filtros, expulsar al usuario
    await conn.groupParticipantsUpdate(m.chat, [user], 'remove')

    await conn.sendMessage(
      m.chat,
      {
        text: `> ⛔️ @${user.split('@')[0]} ha sido expulsado del grupo correctamente ✅`,
        mentions: [user]
      },
      { quoted: m }
    )

  } catch (e) {
    conn.reply(
      m.chat,
      `> ⚠︎ Error al expulsar al usuario.\n> Usa *${usedPrefix}report* para informarlo.\n\n${e.message}`,
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
