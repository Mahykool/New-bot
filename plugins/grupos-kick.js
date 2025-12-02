// plugins/group-kick.js — Versión PRO FINAL SW corregida
// Kick con:
// ✅ Roles SW
// ✅ Permisos SW
// ✅ Jerarquía real
// ✅ Shadowban REAL al intentar expulsar al creador
// ✅ Expulsión sin admin si el bot tiene rol suficiente
// ✅ Auditoría opcional
// ✅ Menciones y nombres corregidos con formatUserTag

import { normalizeJid, getUserRoles } from '../lib/lib-roles.js'
import { requireCommandAccess } from '../lib/permissions-middleware.js'
import { parseTarget, formatUserTag } from '../lib/utils.js'

function msgUsage() {
  return (
    `📌 *¿Cómo usar kick?*\n\n` +
    `1️⃣ *Expulsar a un usuario*\nResponde al mensaje del usuario y escribe:\n> *kick*\n\n` +
    `2️⃣ *También puedes mencionar*\n> *kick @usuario*\n\n` +
    `🛠 Comandos disponibles:\n• *kick* — expulsar\n• *echar*, *sacar*, *ban* — alias`
  )
}

const handler = async (m, { conn, command }) => {
  const chatCfg = global.db?.data?.chats?.[m.chat] || {}
  const actor = normalizeJid(m.sender)

  /* ============================
     PERMISOS SW
  ============================ */
  try {
    requireCommandAccess(m, 'group-kick', 'kick', chatCfg)
  } catch {
    return conn.reply(m.chat, `❌ No tienes permiso para usar este comando.`, m)
  }

  /* ============================
     AYUDA SI NO HAY TARGET
  ============================ */
  if (!m.quoted && (!m.mentionedJid || m.mentionedJid.length === 0)) {
    return conn.reply(m.chat, msgUsage(), m)
  }

  /* ============================
     RESOLVER TARGET
  ============================ */
  let targetRaw = null
  try {
    const argsText = (m.text || '').trim().split(/\s+/).slice(1)
    targetRaw = parseTarget(m, argsText)
  } catch {}

  if (!targetRaw) {
    const mentioned = Array.isArray(m.mentionedJid) ? m.mentionedJid : []
    targetRaw = mentioned[0] || (m.quoted?.sender || m.quoted?.participant) || null
  }

  const user = targetRaw ? normalizeJid(targetRaw) : null
  if (!user) {
    return conn.reply(m.chat, `⚠️ Debes mencionar o responder a un usuario para expulsarlo.`, m)
  }

  const display = await formatUserTag(conn, user)

  /* ============================
     PROTECCIONES
  ============================ */

  // No expulsar al bot
  if (user === normalizeJid(conn.user?.id)) {
    return conn.reply(m.chat, `🤖 No puedo expulsarme a mí mismo.`, m)
  }

  // Roles del actor y del target
  const actorRoles = getUserRoles(actor).map(r => r.toLowerCase())
  const targetRoles = getUserRoles(user).map(r => r.toLowerCase())

  const actorIsCreator = actorRoles.includes('creador') || actorRoles.includes('owner')

  /* ============================
     DETECTAR CREADOR REAL
  ============================ */
  const creators = []
  if (Array.isArray(global.owner)) creators.push(...global.owner)
  if (global.ownerJid) creators.push(global.ownerJid)
  if (global.ownerNumber) creators.push(global.ownerNumber)

  const normalizedCreators = creators
    .map(o => normalizeJid(Array.isArray(o) ? o[0] : o))
    .filter(Boolean)

  const isTargetCreator =
    normalizedCreators.includes(user) ||
    targetRoles.includes('creador') ||
    targetRoles.includes('owner')

  if (isTargetCreator) {
    await conn.reply(m.chat, `💀 ¿En serio intentaste expulsar al creador?`, m)

    // Shadowban al actor
    const shadowPlugin = Object.values(global.plugins).find(p =>
      p.command?.includes?.('shadowban')
    )

    if (shadowPlugin?.default) {
      const fake = {
        ...m,
        text: `.shadowban @${actor.split('@')[0]} 15`,
        sender: m.sender,
        chat: m.chat,
        isCommand: true
      }

      const extra = {
        conn,
        args: [actor, 15],
        usedPrefix: '.',
        command: 'shadowban'
      }

      await shadowPlugin.default.call(conn, fake, extra)
    }

    return
  }

  /* ============================
     PROTECCIÓN DE MODERADORES
  ============================ */
  const protectedRoles = ['mod', 'moderador', 'moderator', 'admin', 'staff']
  if (!actorIsCreator && targetRoles.some(r => protectedRoles.includes(r))) {
    return conn.reply(m.chat, `✖️ No puedes expulsar a un moderador o superior.`, m)
  }

  /* ============================
     PODER DEL BOT
  ============================ */
  let botIsAdmin = false
  try {
    const meta = await conn.groupMetadata(m.chat)
    const me = meta.participants.find(p => normalizeJid(p.id) === normalizeJid(conn.user.id))
    botIsAdmin = !!(me && (me.admin || me.isAdmin || me.role === 'admin'))
  } catch {}

  const botRoles = getUserRoles(conn.user.id).map(r => r.toLowerCase())
  const botHasPower =
    botIsAdmin ||
    botRoles.includes('mod') ||
    botRoles.includes('moderador') ||
    botRoles.includes('creador') ||
    botRoles.includes('owner')

  if (!botHasPower) {
    return conn.reply(
      m.chat,
      `✅ El usuario ${display} sería expulsado, pero el bot no tiene permisos suficientes.`,
      m,
      { mentions: [user] }
    )
  }

  /* ============================
     EXPULSIÓN REAL
  ============================ */
  try {
    await conn.groupParticipantsUpdate(m.chat, [user], 'remove')
    await conn.sendMessage(
      m.chat,
      {
        text: `⛔️ ${display} ha sido expulsado del grupo.`,
        mentions: [user]
      },
      { quoted: m }
    )

    // Auditoría opcional
    try {
      if (global.audit?.log) {
        global.audit.log({
          action: 'KICK',
          actor,
          target: user,
          chat: m.chat,
          plugin: 'group-kick',
          command
        })
      }
    } catch {}
  } catch (e) {
    return conn.reply(
      m.chat,
      `⚠️ Ocurrió un error al expulsar al usuario.\n${e?.message || e}`,
      m
    )
  }
}

handler.help = ['kick']
handler.tags = ['modmenu']
handler.command = ['kick', 'echar', 'sacar', 'ban']
handler.group = true
handler.botAdmin = false
handler.admin = false

export default handler
