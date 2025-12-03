// plugins/main-ping.js — SW SYSTEM corregido
// Ping con:
// ✅ Roles SW
// ✅ Permisos SW
// ✅ Diagnóstico completo
// ✅ Menciones y nombres corregidos con formatUserTag

import { requireCommandAccess } from '../lib/permissions-middleware.js'
import { getRoleInfo, normalizeJid, getUserLevel } from '../lib/lib-roles.js'
import { formatUserTag } from '../lib/utils.js'

const DIAG_TITLE = 'ㅤׄㅤׅㅤׄ _*DIAGNOSTICO*_ ㅤ֢ㅤׄㅤׅ'

const formatUptime = (secs) => {
  const hours = Math.floor(secs / 3600)
  const minutes = Math.floor((secs % 3600) / 60)
  const seconds = Math.floor(secs % 60)
  return `${hours}h ${minutes}m ${seconds}s`
}

let handler = async (m, { conn }) => {
  const chatCfg = global.db?.data?.chats?.[m.chat] || {}

  try {
    // Validar permisos
    requireCommandAccess(m, 'main-ping', 'ping', chatCfg)
  } catch {
    return conn.reply(m.chat, '❌ No tienes permiso para usar ping.', m)
  }

  // Normalizar sender y obtener info de rol
  const senderJid = normalizeJid(m.sender)
  const display = await formatUserTag(conn, senderJid)
  const level = getUserLevel(senderJid) || 0
  const roleInfo = getRoleInfo(level) || {}
  const roleLabel = `${roleInfo.icon || ''} ${roleInfo.name || roleInfo.id || 'user'}`.trim()

  // Medición de latencia
  const t0 = process.hrtime.bigint()
  try {
    await conn.reply(m.chat, `${DIAG_TITLE}\n\n⌛ *Iniciando revisión de latencia...*`, m)
  } catch {}
  const t1 = process.hrtime.bigint()
  const ping = Number((t1 - t0) / BigInt(1e6)) // ms

  let speed, emoji, status
  if (ping < 100) {
    speed = '*🐆 MODO FELINO*'
    emoji = '🐆'
    status = 'Rendimiento excelente'
  } else if (ping < 300) {
    speed = '*🦅 VUELO RÁPIDO*'
    emoji = '🦅'
    status = 'Rendimiento óptimo'
  } else if (ping < 600) {
    speed = '*🦌 FLUJO ESTABLE*'
    emoji = '🦌'
    status = 'Rendimiento bueno'
  } else if (ping < 1000) {
    speed = '*🐢 SESIÓN CARGADA*'
    emoji = '🐢'
    status = 'Rendimiento normal'
  } else {
    speed = '*🐌 MODO LENTO*'
    emoji = '🐌'
    status = 'Rendimiento bajo'
  }

  const used = process.memoryUsage()
  const memory = Math.round(used.rss / 1024 / 1024) + ' MB'
  const uptimeString = formatUptime(process.uptime())
  const platform = process.platform
  const arch = process.arch
  const nodeVersion = process.version

  const pingMessage = `
${DIAG_TITLE}

🐾 *Solicitado por:* ${display}
🌿 *Rol:* ${roleLabel}

${emoji} *Latencia:* ${ping} ms
📡 *Perfil de conexión:* ${speed}
✅ *Estado general:* ${status}

🌱 *Memoria en uso:* ${memory}
⏱️ *Tiempo activo:* ${uptimeString}
🖥️ *Plataforma:* ${platform}
🛠️ *Arquitectura:* ${arch}
📦 *Node.js:* ${nodeVersion}
`.trim()

  await conn.reply(m.chat, pingMessage, m)
}

handler.pluginId = 'main-ping'
handler.help = ['ping']
handler.tags = ['main']
handler.command = ['p', 'ping']
handler.description = 'Ver el status de SW'


export default handler