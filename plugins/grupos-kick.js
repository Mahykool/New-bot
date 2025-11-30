// plugins/group-kick.js — Versión PRO
// Kick con roles, protección de creador/mods, auto-detección silenciosa de admin
// No exige admin para usar el comando (solo rol), pero si el bot ES admin, expulsa.

import { normalizeJid, getUserRoles } from '../lib/lib-roles.js'
import { requireCommandAccess } from '../lib/permissions-middleware.js'
import { parseTarget } from '../lib/utils.js'

/* ============================
   MENSAJE DE USO
============================ */
function msgUsage() {
  return (
    `📌 *¿Cómo usar kick?*\n\n` +
    `1️⃣ *Expulsar a un usuario*\nResponde al mensaje del usuario y escribe:\n> *kick*\n\n` +
    `2️⃣ *También puedes mencionar*\n> *kick @usuario*\n\n` +
    `🛠 Comandos disponibles:\n• *kick* — expulsar\n• *echar*, *sacar*, *ban* — alias`
  )
}

/* ============================
   HANDLER PRINCIPAL
============================ */
const handler = async (m, { conn, usedPrefix, command }) => {
  const chatCfg = global.db?.data?.chats?.[m.chat] || {}
  const actor = normalizeJid(m.sender)

  /* --- PERMISOS POR ROL --- */
  try {
    requireCommandAccess(m, 'group-kick', 'kick', chatCfg)
  } catch {
    return conn.reply(m.chat, `❌ No tienes permiso para usar este comando.`, m)
  }

  /* --- AYUDA SOLO SI NO HAY TARGET --- */
  if (!m.quoted && (!m.mentionedJid || m.mentionedJid.length === 0)) {
    try { await conn.reply(m.chat, msgUsage(), m) } catch {}
  }

  /* --- RESOLVER TARGET --- */
  let targetRaw = null
  try {
    if (typeof parseTarget === 'function') {
      const argsText = (m.text || '').trim().split(/\s+/).slice(1)
      targetRaw = parseTarget(m, argsText)
    }
  } catch {}

  if (!targetRaw) {
    const mentioned = Array.isArray(m.mentionedJid) ? m.mentionedJid : []
    targetRaw = mentioned[0] || (m.quoted?.sender || m.quoted?.participant) || null
  }

  const user = targetRaw ? normalizeJid(targetRaw) : null
  if (!user) {
    return conn.reply(m.chat, `⚠️ Debes mencionar o responder a un usuario para expulsarlo.`, m)
  }

  const tag = `@${user.split('@')[0]}`

  /* ============================
     PROTECCIONES
  ============================ */

  // No expulsar al bot
  if (user === normalizeJid(conn.user?.id)) {
    return conn.reply(m.chat, `🤖 No puedo expulsarme a mí mismo.`, m)
  }

  // Obtener roles del target
  let targetRoles = []
  try { targetRoles = getUserRoles(user) || [] } catch {}

  const lowerRoles = targetRoles.map(r => r.toLowerCase())

  // Protección creador
  const creators = []
  if (Array.isArray(global.owner)) creators.push(...global.owner)
  if (global.ownerJid) creators.push(global.ownerJid)
  if (global.ownerNumber) creators.push(global.ownerNumber)

  const normalizedCreators = creators
    .map(o => normalizeJid(Array.isArray(o) ? o[0] : o))
    .filter(Boolean)

  if (normalizedCreators.includes(user) || lowerRoles.includes('creador') || lowerRoles.includes('owner')) {
    return conn.reply(m.chat, `💀 ¿En serio intentaste expulsar al creador?`, m)
  }

  // Protección moderadores
  const protectedRoles = ['mod', 'moderador', 'moderator', 'admin', 'staff']
  if (lowerRoles.some(r => protectedRoles.includes(r))) {
    return conn.reply(m.chat, `✖️ No puedes expulsar a un moderador o superior.`, m)
  }

  /* ============================
     AUTO-DETECCIÓN SILENCIOSA DE ADMIN
  ============================ */

  let botIsAdmin = false
  try {
    const meta = await conn.groupMetadata(m.chat)
    const me = meta.participants.find(p => normalizeJid(p.id) === normalizeJid(conn.user.id))
    botIsAdmin = !!(me && (me.admin || me.isAdmin || me.role === 'admin'))
  } catch {}

  // Si el bot NO es admin → no expulsa, pero tampoco molesta
  if (!botIsAdmin) {
    return conn.reply(
      m.chat,
      `✅ El usuario ${tag} sería expulsado, pero el bot no es administrador.\n\n` +
      `El comando se ejecutó correctamente según permisos de rol.`,
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
        text: `⛔️ ${tag} ha sido expulsado del grupo.`,
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
handler.tags = ['group']
handler.command = ['kick', 'echar', 'sacar', 'ban']
handler.group = true
handler.botAdmin = false   // ✅ No exige admin
handler.admin = false      // ✅ No exige admin para usarlo (solo rol)

export default handler
