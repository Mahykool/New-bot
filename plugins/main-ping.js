// plugins/main-ping.js
// SW SYSTEM — Main Ping (versión actualizada: respeta permisos y muestra rol)
// Título personalizado: 'ㅤׄㅤׅㅤׄ _*DIAGNOSTICO*_ ㅤ֢ㅤׄㅤׅ'

import { requireCommandAccess } from '../lib/permissions-middleware.js'
import { getRoleInfo } from '../lib/lib-roles.js'
import { normalizeJid } from '../lib/lib-roles.js'

const DIAG_TITLE = 'ㅤׄㅤׅㅤׄ _*DIAGNOSTICO*_ ㅤ֢ㅤׄㅤׅ'

const formatUptime = (secs) => {
  const hours = Math.floor(secs / 3600)
  const minutes = Math.floor((secs % 3600) / 60)
  const seconds = Math.floor(secs % 60)
  return `${hours}h ${minutes}m ${seconds}s`
}

let handler = async (m, { conn }) => {
  const ctxErr = (global.rcanalx || {})
  const ctxWarn = (global.rcanalw || {})
  const ctxOk = (global.rcanalr || {})

  try {
    // Control de acceso
    try {
      requireCommandAccess(m.sender, 'main-ping', 'ping')
    } catch (err) {
      return conn.reply(m.chat, '❌ No tienes permiso para ejecutar este comando.', m, ctxErr)
    }

    // Normalizar sender y obtener info de rol
    const senderJid = (typeof normalizeJid === 'function') ? normalizeJid(m.sender) : (m.sender || '')
    const roleInfo = getRoleInfo(senderJid) || {}
    const roleLabel = `${roleInfo.icon || ''} ${roleInfo.name || roleInfo.id || 'user'}`.trim()

    // Medición de latencia (simple y no bloqueante)
    const t0 = process.hrtime.bigint()
    try {
      await conn.reply(
        m.chat,
        `${DIAG_TITLE}\n\n⌛ *Iniciando revisión de latencia...*`,
        m,
        ctxOk
      )
    } catch (e) {
      // ignore reply errors for initial ping
    }
    const t1 = process.hrtime.bigint()
    const ping = Number((t1 - t0) / BigInt(1e6)) // ms

    let speed, emoji, status
    if (ping < 100) {
      speed = '*🐆 MODO FELINO*'
      emoji = '🐆'
      status = 'Rendimiento excelente — Grove Street representando'
    } else if (ping < 300) {
      speed = '*🦅 VUELO RÁPIDO*'
      emoji = '🦅'
      status = 'Rendimiento óptimo — Cruza la ciudad como un lowrider'
    } else if (ping < 600) {
      speed = '*🦌 FLUJO ESTABLE*'
      emoji = '🦌'
      status = 'Rendimiento bueno — Mantén el ritmo, no te detengas'
    } else if (ping < 1000) {
      speed = '*🐢 SESIÓN CARGADA*'
      emoji = '🐢'
      status = 'Rendimiento normal — Toma la curva con cuidado'
    } else {
      speed = '*🐌 MODO LENTO*'
      emoji = '🐌'
      status = 'Rendimiento bajo — Necesitas un tune-up, homie'
    }

    const used = process.memoryUsage()
    const memory = Math.round(used.rss / 1024 / 1024) + ' MB'
    const uptimeString = formatUptime(process.uptime())
    const platform = process.platform
    const arch = process.arch
    const nodeVersion = process.version

    const shortSender = (senderJid && senderJid.includes('@')) ? senderJid.split('@')[0] : (m.sender || 'unknown')

    const pingMessage = `
${DIAG_TITLE}

🐾 *Solicitado por:* ${shortSender}
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

    await conn.reply(m.chat, pingMessage, m, ctxOk)
  } catch (error) {
    console.error('Error en ping:', error)
    try {
      await conn.reply(
        m.chat,
        `❌ *Error en el diagnóstico*\n\n🔧 *Detalle técnico:* ${error?.message || String(error)}`,
        m,
        ctxErr
      )
    } catch (e) {
      // si falla el reply, al menos loguear
      console.error('Error enviando mensaje de error en ping:', e)
    }
  }
}

handler.pluginId = 'main-ping'
handler.help = ['ping']
handler.tags = ['main']
handler.command = ['p', 'ping']

export default handler
