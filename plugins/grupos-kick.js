// plugins/grupos-kick.js — Versión final Mahykol con shadowban invisible
import { normalizeJid, getUserRoles } from '../lib/lib-roles.js'
import { requireCommandAccess } from '../lib/permissions-middleware.js'
import { resolveAliasToJid, ensureJid } from '../lib/utils.js'
import { applyShadowban } from './owner-mute.js' // Importa la función invisible

async function resolveTarget(conn, m, args) {
  if (m.quoted?.sender) return normalizeJid(m.quoted.sender)

  const mentioned = []
  if (Array.isArray(m.mentionedJid)) mentioned.push(...m.mentionedJid)
  const ctx = m.message?.extendedTextMessage?.contextInfo || m.msg?.contextInfo || m.message?.contextInfo
  if (Array.isArray(ctx?.mentionedJid)) mentioned.push(...ctx.mentionedJid)
  if (mentioned.length > 0) return normalizeJid(mentioned[0])

  let tokens = (args || []).map(t => String(t).trim()).filter(Boolean)
  if (tokens.length === 0) return null

  let rawTarget = tokens.join(' ').trim()
  if (rawTarget.startsWith('@')) rawTarget = rawTarget.slice(1)

  const aliasJid = await resolveAliasToJid(conn, m, rawTarget)
  if (aliasJid) return normalizeJid(aliasJid)

  const ensured = ensureJid(rawTarget)
  return ensured ? normalizeJid(ensured) : null
}

const handler = async (m, { conn }) => {
  const chatCfg = global.db?.data?.chats?.[m.chat] || {}

  // Permisos → reacción ✖ si no tiene acceso
  try {
    requireCommandAccess(m, 'moderation-plugin', 'kick', chatCfg)
  } catch {
    return conn.sendMessage(m.chat, { react: { text: '✖', key: m.key } })
  }

  const actor = normalizeJid(m.sender)
  const actorRoles = getUserRoles(actor).map(r => r.toLowerCase())
  const actorIsCreator = actorRoles.includes('creador') || actorRoles.includes('owner')

  const parts = (m.text || '').trim().split(/\s+/)
  const args = parts.slice(1)
  const user = await resolveTarget(conn, m, args)

  if (!user) {
    return conn.reply(m.chat, `⚠️ Debes responder, mencionar o usar un alias/número válido.`, m)
  }

  const targetRoles = getUserRoles(user).map(r => r.toLowerCase())
  const creators = []
  if (Array.isArray(global.owner)) creators.push(...global.owner)
  if (global.ownerJid) creators.push(global.ownerJid)
  if (global.ownerNumber) creators.push(global.ownerNumber)
  const normalizedCreators = creators.map(o => normalizeJid(Array.isArray(o) ? o[0] : o)).filter(Boolean)

  const isTargetCreator =
    normalizedCreators.includes(user) ||
    targetRoles.includes('creador') ||
    targetRoles.includes('owner')

  // Kick al creador → mensaje + shadowban invisible al actor
  if (isTargetCreator) {
    await conn.reply(m.chat, `¿En serio intentaste shadowbanear al creador? ☠️`, m)
    await applyShadowban(conn, actor, 10, 'system', m.chat) // invisible
    return conn.sendMessage(m.chat, { react: { text: '✖', key: m.key } })
  }

  // Kick al bot → solo ✖ (no se puede auto eliminar ni eliminar al creador)
  if (user === normalizeJid(conn.user?.id)) {
    return conn.sendMessage(m.chat, { react: { text: '✖', key: m.key } })
  }

  // Kick a moderador
  const isTargetMod = targetRoles.includes('mod') || targetRoles.includes('moderador')
  if (isTargetMod) {
    if (!actorIsCreator) {
      return conn.sendMessage(m.chat, { react: { text: '✖', key: m.key } })
    }
    // Creador sí puede expulsar moderador
    try {
      await conn.groupParticipantsUpdate(m.chat, [user], 'remove')
    } catch (e) {
      return conn.reply(m.chat, `⚠️ No se aplicó bien el kick. Recuerda usar: kick + mención (@usuario) o respuesta al mensaje del usuario.`, m)
    }
    return
  }

  // Kick a usuario normal
  try {
    await conn.groupParticipantsUpdate(m.chat, [user], 'remove')
  } catch (e) {
    return conn.reply(m.chat, `⚠️ No se aplicó bien el kick. Recuerda usar: kick + mención (@usuario) o respuesta al mensaje del usuario.`, m)
  }
}

handler.help = ['kick', 'echar', 'sacar', 'ban']
handler.tags = ['modmenu']
handler.command = ['kick', 'echar', 'sacar', 'ban']
handler.group = true
handler.botAdmin = true
handler.admin = false
handler.description = 'Expulsar (con roles protegidos y shadowban automático invisible)'

export default handler
