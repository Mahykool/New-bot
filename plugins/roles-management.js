// plugins/roles-management.js
import {
  getUserRoles, getUserLevel, listRoles,
  addUserRole, removeUserRole, setUserRole, getRoleInfo,
  normalizeJid, normalizeRole
} from '../lib/lib-roles.js'

import { resolveAliasToJid, ensureJid } from '../lib/utils.js'

/* ============================
   Resolver de target completo
============================ */
async function resolveTarget(conn, m, args) {
  // 1) Respuesta a un mensaje
  if (m.quoted?.sender) return normalizeJid(m.quoted.sender)

  // 2) Menciones reales
  if (Array.isArray(m.mentionedJid) && m.mentionedJid.length > 0) {
    return normalizeJid(m.mentionedJid[0])
  }

  // 3) Token explícito después del comando
  if (args[0]) {
    let raw = String(args[0]).replace(/^@+/, '').replace(/,+$/g, '').trim()

    // Primero intenta resolver alias
    const aliasJid = await resolveAliasToJid(conn, m, raw)
    if (aliasJid) return normalizeJid(aliasJid)

    // Luego intenta número limpio
    const ensured = ensureJid(raw)
    if (ensured) return normalizeJid(ensured)
  }

  return null
}

/* ============================
   Handler principal
============================ */
const handler = async (m, { conn, args, command }) => {
  const senderNorm = normalizeJid(m.sender)
  const roles = getUserRoles(senderNorm)

  // Si no tiene rol "creador", solo reaccionamos con ✖
  if (!roles.includes('creador')) {
    return conn.sendMessage(m.chat, { react: { text: '✖', key: m.key } })
  }

  // Resolver target con alias/mención/reply/número
  const target = await resolveTarget(conn, m, args)
  if (!target) return m.reply('⚠️ Debes mencionar, responder o usar un alias válido.')
  const targetNorm = normalizeJid(target)
  if (!targetNorm) return m.reply('⚠️ No se pudo normalizar el usuario.')

  const roleInput = args[1]
  const roleNorm = normalizeRole(roleInput)
  const availableRoles = listRoles().map(r => r.role)

  if (['addrolec','removerolec','setrolec'].includes(command)) {
    if (!roleNorm || !availableRoles.includes(roleNorm)) {
      return m.reply(`⚠️ Rol inválido.\nRoles disponibles: ${availableRoles.join(', ')}`)
    }
  }

  if (command === 'addrolec') {
    const ok = addUserRole(targetNorm, roleNorm)
    return m.reply(ok ? `✅ Rol añadido: *${roleNorm}*` : '⚠️ Ese usuario ya tiene ese rol.', null, { mentions: [targetNorm] })
  }

  if (command === 'removerolec') {
    const ok = removeUserRole(targetNorm, roleNorm)
    return m.reply(ok ? `✅ Rol removido: *${roleNorm}*` : '⚠️ Ese usuario no tiene ese rol.', null, { mentions: [targetNorm] })
  }

  if (command === 'setrolec') {
    const ok = setUserRole(targetNorm, roleNorm)
    return m.reply(ok ? `✅ Rol establecido: *${roleNorm}*` : '⚠️ No se pudo establecer el rol.', null, { mentions: [targetNorm] })
  }

  if (command === 'nofunka') {
    const level = getUserLevel(senderNorm)
    const roleInfo = getRoleInfo(level)
    let txt = `👑 *MENÚ DE ROLES DEL CREADOR*\n\n`
    txt += `👤 Usuario: @${senderNorm.split('@')[0]}\n`
    txt += `🎭 Roles: ${roles.join(', ')}\n`
    txt += `📖 Descripción: ${roleInfo.description}\n\n`
    txt += `📌 Roles disponibles:\n\n`
    for (const r of listRoles()) {
      txt += `${r.icon || ''} *${r.role}* → Nivel ${r.level}\n${r.description}\n\n`
    }
    return m.reply(txt, null, { mentions: [senderNorm] })
  }
}

handler.help = ['addrolec','removerolec','setrolec']
handler.tags = []
handler.command = ['addrolec','removerolec','setrolec']
handler.group = true

export default handler
