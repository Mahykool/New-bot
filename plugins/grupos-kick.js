// plugins/group-kick.js
// Kick mínimo compatible con el middleware de permisos y auditoría
// Protecciones añadidas: no expulsar a mods ni superiores; mensaje especial si intentan expulsar al creador
// Además: si intentan expulsar al creador, se envía mensaje divertido y se intenta aplicar .shadowban 15m

import { normalizeJid, getUserRoles } from '../lib/lib-roles.js'
import { requireCommandAccess } from '../lib/permissions-middleware.js'
import { parseTarget } from '../lib/utils.js' // si no existe, el plugin usa fallback a m.mentionedJid / m.quoted

const handler = async (m, { conn, usedPrefix, command }) => {
  const chatCfg = global.db?.data?.chats?.[m.chat] || {}
  const actor = normalizeJid(m.sender)

  // Verificación centralizada de permisos
  try {
    requireCommandAccess(m, 'group-kick', 'kick', chatCfg)
  } catch (err) {
    try {
      const fail = (m && (m.plugin && global.plugins?.[m.plugin]?.fail)) ? global.plugins[m.plugin].fail : global.dfail
      if (fail) fail('access', m, conn)
    } catch {}
    return
  }

  // Resolver target (parseTarget si existe, si no fallback)
  let targetRaw = null
  try {
    if (typeof parseTarget === 'function') {
      const argsText = (m.text || '').trim().split(/\s+/).slice(1)
      targetRaw = parseTarget(m, argsText)
    }
  } catch (e) {}

  if (!targetRaw) {
    const mentioned = Array.isArray(m.mentionedJid) ? m.mentionedJid : (m.mentionedJid ? [m.mentionedJid] : [])
    targetRaw = (mentioned && mentioned.length) ? mentioned[0] : (m.quoted && (m.quoted.sender || m.quoted.participant) ? (m.quoted.sender || m.quoted.participant) : null)
  }

  const user = normalizeJid(targetRaw)
  if (!user) return conn.reply(m.chat, `> Debes mencionar o responder a un usuario para expulsarlo.`, m)

  try {
    const groupInfo = await conn.groupMetadata(m.chat).catch(() => null)
    const ownerGroup = (groupInfo && (groupInfo.owner || (groupInfo.participants?.find(p => p.isOwner)?.id))) || (m.chat.split`-`[0] + '@s.whatsapp.net')

    // ownerBot puede estar en global.owner en varias formas
    let ownerBot = null
    try {
      if (Array.isArray(global.owner) && Array.isArray(global.owner[0])) ownerBot = normalizeJid(global.owner[0][0])
      else if (Array.isArray(global.owner)) ownerBot = normalizeJid(global.owner[0])
      else if (global.owner) ownerBot = normalizeJid(global.owner)
    } catch (e) { ownerBot = null }

    // No expulsar al bot, al owner del grupo ni al owner del bot
    if (user === conn.user.jid) return conn.reply(m.chat, `> No puedo eliminar el bot del grupo.`, m)
    if (user === ownerGroup) return conn.reply(m.chat, `> No puedo eliminar al propietario del grupo.`, m)
    if (ownerBot && user === ownerBot) return conn.reply(m.chat, `> No puedo eliminar al propietario del bot.`, m)

    // PROTECCIÓN: no expulsar a usuarios con rol 'mod' o superior ni al creador
    const protectedRoleIds = ['creador', 'owner', 'mod', 'admin', 'staff'] // ajusta si tus ids son distintos
    let targetRoles = []
    try {
      targetRoles = Array.isArray(getUserRoles(user)) ? getUserRoles(user) : []
    } catch (e) {
      targetRoles = []
    }

    // Si el target tiene rol 'creador' o 'owner' -> mensaje especial + shadowban 15m
    if (targetRoles.includes('creador') || targetRoles.includes('owner')) {
      // Mensaje solicitado por el usuario
      const skullText = '(en serio intentaste eliminar al creador? 💀)'
      try {
        await conn.reply(m.chat, skullText, m)
      } catch {}

      // Intentar aplicar .shadowban 15m usando el plugin correspondiente (si existe)
      try {
        // Buscar plugin que soporte el comando 'shadowban' o con pluginId 'moderation-plugin'
        const pluginsList = Object.values(global.plugins || {})
        let shadowPlugin = pluginsList.find(p => {
          if (!p) return false
          // buscar por comando declarado
          if (Array.isArray(p.command)) {
            return p.command.some(c => (typeof c === 'string' && c.toLowerCase() === 'shadowban') || (c instanceof RegExp && c.test('shadowban')))
          }
          if (typeof p.command === 'string') return p.command.toLowerCase() === 'shadowban'
          if (p.pluginId && String(p.pluginId).toLowerCase().includes('moderation')) return true
          return false
        })

        if (shadowPlugin) {
          // Construir mensaje simulado para pasar al plugin: ".shadowban @user 15m"
          const prefix = usedPrefix || '.'
          const shadowCmdText = `${prefix}shadowban @${user.split('@')[0]} 15m`
          const fakeMsg = {
            ...m,
            text: shadowCmdText,
            sender: m.sender,
            from: m.from || m.chat,
            chat: m.chat,
            isCommand: true,
            plugin: shadowPlugin.name || shadowPlugin.pluginId || 'shadowban-invoke'
          }
          // extra mínimo (plugins suelen esperar extra con conn, args, etc.)
          const extra = { conn, args: [user, '15m'], usedPrefix: prefix, command: 'shadowban' }
          try {
            // Ejecutar el plugin en contexto del connection (no bloquear si falla)
            if (typeof shadowPlugin === 'function') {
              await shadowPlugin.call(conn, fakeMsg, extra)
            } else if (typeof shadowPlugin.default === 'function') {
              await shadowPlugin.default.call(conn, fakeMsg, extra)
            } else if (typeof shadowPlugin.run === 'function') {
              await shadowPlugin.run.call(conn, fakeMsg, extra)
            }
          } catch (e) {
            // si falla la invocación, no interrumpir; informar en consola
            console.error('Invocación shadowban fallida:', e)
          }
        } else {
          // No se encontró plugin; informar al chat (silencioso)
          try {
            await conn.reply(m.chat, `> Nota: no se encontró el plugin de shadowban para aplicar la sanción automática.`, m)
          } catch {}
        }
      } catch (e) {
        console.error('Error aplicando shadowban automático:', e)
      }

      return
    }

    // Si el target tiene cualquier rol protegido (mod o superior), denegar
    const hasProtected = targetRoles.some(r => protectedRoleIds.includes(r))
    if (hasProtected) {
      return conn.reply(m.chat, `✖️ No puedes expulsar a un moderador o a un usuario con nivel igual o superior a moderador.`, m)
    }

    // Ejecutar expulsión
    await conn.groupParticipantsUpdate(m.chat, [user], 'remove')

    // Mensaje confirmación (mencionando al expulsado)
    await conn.sendMessage(m.chat, {
      text: `> ⛔️ @${user.split('@')[0]} ha sido expulsado del grupo correctamente ✅️`,
      mentions: [user]
    }, { quoted: m })

    // Auditoría opcional (no rompe si no existe)
    try {
      if (global.audit && typeof global.audit.log === 'function') {
        global.audit.log({
          action: 'KICK',
          actor,
          target: user,
          chat: m.chat,
          plugin: 'group-kick',
          command
        })
      }
    } catch (e) { /* no bloquear por fallo de auditoría */ }

  } catch (e) {
    conn.reply(m.chat, `> ⚠︎ Error al expulsar al usuario.\n> Usa *${usedPrefix}report* para informarlo.\n\n${e?.message || e}`, m)
  }
}

handler.help = ['kick']
handler.tags = ['group']
handler.command = ['kick', 'echar', 'hechar', 'sacar', 'ban']
handler.admin = true
handler.group = true
handler.botAdmin = true

export default handler
