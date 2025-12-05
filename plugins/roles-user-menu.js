// ✦ Menú principal de roles ✦ Swill v3.8.0
// Diseñado por Mahykol ✦ Estilo GTA SA

import {
  getUserRoles, getUserLevel, listRoles,
  getRoleInfo, normalizeJid
} from '../lib/lib-roles.js'

import { resolveAliasToJid } from '../lib/utils.js'

// ────────────────
// Comando principal: /rolesmenu
// ────────────────
const handlerRolesMenu = async (m, { conn, args }) => {
  let senderNorm = normalizeJid(m.sender)
  if (args && args[0]) {
    const aliasTarget = await resolveAliasToJid(conn, m, args[0])
    if (aliasTarget) senderNorm = normalizeJid(aliasTarget)
  }

  const roles = getUserRoles(senderNorm)
  const level = getUserLevel(senderNorm)
  const roleInfo = getRoleInfo(level)

  let txt = `ㅤׄㅤׅㅤׄ MENÚ DE ROLES ㅤ֢ㅤׄㅤׅ\n\n`
  txt += `> 🗣️ Usuario: @${senderNorm.split('@')[0]}\n`
  txt += `> 🎭 Rol actual: ${roles.length ? roles.join(', ') : `${roleInfo.icon} ${roleInfo.name}`}\n`
  txt += `> 📖 Descripción: ${roleInfo.description}\n`
  txt += `> ⭐ Nivel: ${level}\n\n`

txt += `ㅤׄㅤׅㅤׄ USUARIOS CON ROLES ㅤ֢ㅤׄㅤׅ\n`

const usersDb = global.db?.data?.users || {}
const seen = new Set()
const mentions = new Set([senderNorm])
let count = 0

for (const jid of Object.keys(usersDb)) {
  const norm = normalizeJid(jid)
  if (seen.has(norm)) continue
  seen.add(norm)

  const rolesUsuario = getUserRoles(norm)
  if (rolesUsuario && rolesUsuario.length > 0) {
    txt += `> 👥 @${norm.split('@')[0]} → ${rolesUsuario.join(', ')}\n`
    mentions.add(norm)
    count++
  }
}

if (count === 0) {
  txt += `> ⚠️ No hay usuarios con roles asignados.\n`
}


  txt += `\nㅤׄㅤׅㅤׄ COMANDOS DISPONIBLES ㅤ֢ㅤׄㅤׅ\n`
  txt += `> 🗝 rolesdisponibles\n`
  txt += `> _Ver todos los roles actuales._\n\n`
  txt += `> 🗝 rolbest\n`
  txt += `> _Información para ascender de rol._\n\n`
  txt += `Mahykol — SWILL`

  return m.reply(txt, null, { mentions: [...mentions] })
}


handlerRolesMenu.help = ['rolesmenu']
handlerRolesMenu.tags = ['info']
handlerRolesMenu.command = ['rolesmenu']
handlerRolesMenu.group = true
handlerRolesMenu.description = 'Menú principal de roles'

export default handlerRolesMenu

// ────────────────
// Comando secundario: /rolesdisponibles
// ────────────────
export const handlerRolesDisponibles = async (m) => {
  let txt = `ㅤׄㅤׅㅤׄ ROLES DISPONIBLES ㅤ֢ㅤׄㅤׅ\n\n`
  for (const r of listRoles()) {
    txt += `> 🗝 *${r.role}* (Nivel ${r.level})\n`
    txt += `> _${r.description}_\n\n`
  }
  txt += `Mahykol — SWILL`
  return m.reply(txt)
}

handlerRolesDisponibles.help = ['rolesdisponibles']
handlerRolesDisponibles.tags = ['info']
handlerRolesDisponibles.command = ['rolesdisponibles']
handlerRolesDisponibles.group = true
handlerRolesDisponibles.description = 'Lista todos los roles actuales'

// ────────────────
// Comando secundario: /rolbest
// ────────────────
export const handlerRolBest = async (m) => {
  let txt = `ㅤׄㅤׅㅤׄ CÓMO MEJORAR DE ROL ㅤ֢ㅤׄㅤׅ\n\n`
  txt += `> 💬 _Los roles se asignan según tu participación y nivel._\n`
  txt += `> 📈 _Mientras más activo seas en el grupo, más rápido subirás de nivel._\n`
  txt += `> 🎭 _Al alcanzar ciertos niveles, podrás obtener nuevos roles._\n`
  txt += `> 👑 _Solo el *CREADOR* puede asignar o modificar roles._\n\n`
  txt += `Mahykol — swill`
  return m.reply(txt)
}

handlerRolBest.help = ['rolbest']
handlerRolBest.tags = ['info']
handlerRolBest.command = ['rolbest']
handlerRolBest.group = true
handlerRolBest.description = 'Información para ascender de rol'