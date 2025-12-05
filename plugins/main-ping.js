// plugins/main-ping.js
// SW SYSTEM — Main Ping (versión final: respeta permisos, muestra alias y rol con mención)
// Título personalizado: 'ㅤׄㅤׅㅤׄ _*DIAGNOSTICO*_ ㅤ֢ㅤׄㅤׅ'

import { requireCommandAccess } from '../lib/permissions-middleware.js'
import { getUserRoles, getUserLevel, getRoleInfo, normalizeJid } from '../lib/lib-roles.js'

const DIAG_TITLE = 'ㅤׄㅤׅㅤׄ _*DIAGNOSTICO*_ ㅤ֢ㅤׄㅤׅ'

const formatUptime = (secs) => {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  return `${h}h ${m}m ${s}s`
}

let handler = async (m, { conn }) => {
  const ctxErr = (global.rcanalx || {})
  const ctxOk = (global.rcanalr || {})

  try {
    const chatCfg = global.db?.data?.chats?.[m.chat] || {}

    // Validar permisos
    try {
      requireCommandAccess(m, 'main-ping', 'ping', chatCfg)
    } catch {
      // Solo reaccionar con ✖, sin texto
      return conn.sendMessage(m.chat, { react: { text: '✖', key: m.key } })
    }

    // Normalizar sender y obtener info de rol
    const senderJid = normalizeJid(m.sender)

    // Alias o nombre del usuario, pero siempre con @mención
    const alias = `@${senderJid.split('@')[0]}`

    // Roles y nivel
    const roles = getUserRoles(senderJid)
    const level = getUserLevel(senderJid)
    const roleInfo = getRoleInfo(level)

    const roleLabel = roles.length
      ? roles.map(r => `${r}`).join(', ')
      : `${roleInfo.icon || ''} ${roleInfo.name || 'Usuario'}`

    // Medición de latencia
    const t0 = process.hrtime.bigint()
    try {
      await conn.reply(
        m.chat,
        `${DIAG_TITLE}\n\n⌛ *Iniciando revisión de latencia...*`,
        m,
        ctxOk
      )
    } catch {}
    const t1 = process.hrtime.bigint()
    const ping = Number((t1 - t0) / BigInt(1e6))

    let speed, emoji, status
    if (ping < 100) { speed = '*🐆 MODO FELINO*'; emoji = '🐆'; status = 'Rendimiento excelente — Grove Street representando' }
    else if (ping < 300) { speed = '*🦅 VUELO RÁPIDO*'; emoji = '🦅'; status = 'Rendimiento óptimo — Cruza la ciudad como un lowrider' }
    else if (ping < 600) { speed = '*🦌 FLUJO ESTABLE*'; emoji = '🦌'; status = 'Rendimiento bueno — Mantén el ritmo, no te detengas' }
    else if (ping < 1000) { speed = '*🐢 SESIÓN CARGADA*'; emoji = '🐢'; status = 'Rendimiento normal — Toma la curva con cuidado' }
    else { speed = '*🐌 MODO LENTO*'; emoji = '🐌'; status = 'Rendimiento bajo — Necesitas un tune-up, homie' }

    const used = process.memoryUsage()
    const memory = Math.round(used.rss / 1024 / 1024) + ' MB'
    const uptimeString = formatUptime(process.uptime())
    const platform = process.platform
    const arch = process.arch
    const nodeVersion = process.version

    const pingMessage = `
${DIAG_TITLE}

🐾 *Solicitado por:* ${alias}
🌿 *Rol actual:* ${roleLabel}

${emoji} *Latencia:* ${ping} ms
📡 *Perfil de conexión:* ${speed}
✅ *Estado general:* ${status}

🪴 *Memoria en uso:* ${memory}
⏳ *Tiempo activo:* ${uptimeString}
💻 *Plataforma:* ${platform}
🛠️ *Arquitectura:* ${arch}
📦 *Node.js:* ${nodeVersion}
`.trim()

    await conn.reply(m.chat, pingMessage, m, { ...ctxOk, mentions: [senderJid] })
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
      console.error('Error enviando mensaje de error en ping:', e)
    }
  }
}

handler.pluginId = 'main-ping'
handler.help = ['ping']
handler.tags = ['main']
handler.command = ['p', 'ping']

export default handler
