// plugins/main-ping.js
import { requireCommandAccess } from '../lib/permissions-middleware.js'

let handler = async (m, { conn }) => {
  const ctxErr = (global.rcanalx || {})
  const ctxWarn = (global.rcanalw || {})
  const ctxOk = (global.rcanalr || {})
  const ctxht = (global.rcanal08 || {})

  try {
    // ---------- Control de acceso con el nuevo sistema ----------
    // pluginId: "main-ping"
    // command:  "ping"
    requireCommandAccess(m.sender, 'main-ping', 'ping')
    // ---------- Fin control de acceso ----------

    const start = Date.now()

    await conn.reply(
      m.chat,
      'ஓீ🐙 ㅤׄㅤׅㅤׄ *DIAGNOSTICO* ㅤ֢ㅤׄㅤׅ\n\n⌛ *Iniciando revisión de latencia...*',
      m,
      ctxOk
    )

    const end = Date.now()
    const ping = end - start

    let speed, emoji, status
    if (ping < 100) {
      speed = '*🚨 MODO CRIMINAL*'
      emoji = '💥'
      status = 'Rendimiento excelente'
    } else if (ping < 300) {
      speed = '*⚡ GROVE STREET SPEED*'
      emoji = '⚡'
      status = 'Rendimiento óptimo'
    } else if (ping < 600) {
      speed = '*🏁 FLUJO ESTABLE*'
      emoji = '🏁'
      status = 'Rendimiento bueno'
    } else if (ping < 1000) {
      speed = '*📡 SESIÓN CARGADA*'
      emoji = '📡'
      status = 'Rendimiento normal'
    } else {
      speed = '*🐢 MODO TORTUGA*'
      emoji = '🐢'
      status = 'Rendimiento bajo'
    }

    const used = process.memoryUsage()
    const memory = Math.round(used.rss / 1024 / 1024) + ' MB'

    const uptime = process.uptime()
    const hours = Math.floor(uptime / 3600)
    const minutes = Math.floor((uptime % 3600) / 60)
    const seconds = Math.floor(uptime % 60)
    const uptimeString = `${hours}h ${minutes}m ${seconds}s`

    const platform = process.platform
    const arch = process.arch
    const nodeVersion = process.version

    const pingMessage = `
ஓீ🐙 ㅤׄㅤׅㅤׄ *DIAGNOSTICO* ㅤ֢ㅤׄㅤׅ

${emoji} *Latencia:* ${ping} ms
📡 *Perfil de conexión:* ${speed}
✅ *Estado general:* ${status}

💾 *Memoria en uso:* ${memory}
⏱️ *Tiempo activo:* ${uptimeString}
🖥️ *Plataforma:* ${platform}
🔧 *Arquitectura:* ${arch}
📦 *Node.js:* ${nodeVersion}
    `.trim()

    await conn.reply(m.chat, pingMessage, m, ctxOk)

  } catch (error) {
    console.error('Error en ping:', error)
    await conn.reply(
      m.chat,
      `❌ *Error en el diagnóstico*\n\n` +
      `🔧 *Detalle técnico:* ${error.message}`,
      m,
      ctxErr
    )
  }
}

handler.pluginId = 'main-ping'
handler.help = ['ping']
handler.tags = ['main']
handler.command = ['p', 'ping']

export default handler
