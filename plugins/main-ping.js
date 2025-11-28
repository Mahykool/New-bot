// plugins/main-ping.js
import { getUserRoles } from '../lib/lib-roles.js'

let handler = async (m, { conn }) => {
  const ctxErr = (global.rcanalx || {})
  const ctxWarn = (global.rcanalw || {})
  const ctxOk = (global.rcanalr || {})
  const ctxht = (global.rcanal08 || {})

  try {
    // ---------- Control de acceso: solo staff (mod), owner y roowner ----------
    const userJid = m.sender
    const roles = getUserRoles(userJid) || []

    // roowner en config.js (fallback) — si lo tienes definido en config.js
    const isRoOwner = Array.isArray(global.roowner) && global.roowner.includes(userJid)

    const isOwner = roles.includes('owner') || isRoOwner
    const isStaff = roles.includes('staff') // 'staff' es el id unificado para mod

    if (!(isOwner || isStaff)) {
      return await conn.reply(
        m.chat,
        '✘ *SW SYSTEM — Acceso denegado*\n\n' +
        'Este comando solo está disponible para STAFF (mod) y OWNER.\n' +
        'Si crees que deberías tener acceso, contacta con el OWNER.',
        m,
        ctxWarn
      )
    }
    // ---------- Fin control de acceso ----------

    // Tiempo inicial
    const start = Date.now()

    // Mensaje inicial estilo SW SYSTEM
    await conn.reply(
      m.chat,
      '🕶️🏁 *SW SYSTEM — Analizando latencia...*\n\n⌛ *Procesando datos del sistema...*',
      m,
      ctxOk
    )

    // Tiempo final
    const end = Date.now()

    // Calcular ping REAL
    const ping = end - start

    // Evaluación estilo GTA SA
    let speed, emoji, status
    if (ping < 100) {
      speed = '*🚨 Velocidad Criminal*'
      emoji = '💥'
      status = 'Excelente'
    } else if (ping < 300) {
      speed = '*⚡ Rápido como Grove Street*'
      emoji = '⚡'
      status = 'Óptimo'
    } else if (ping < 600) {
      speed = '*🏁 Estable*'
      emoji = '🏁'
      status = 'Bueno'
    } else if (ping < 1000) {
      speed = '*📡 Regular*'
      emoji = '📡'
      status = 'Normal'
    } else {
      speed = '*🐢 Lento*'
      emoji = '🐢'
      status = 'Bajo'
    }

    // Uso de memoria
    const used = process.memoryUsage()
    const memory = Math.round(used.rss / 1024 / 1024) + ' MB'

    // Uptime
    const uptime = process.uptime()
    const hours = Math.floor(uptime / 3600)
    const minutes = Math.floor((uptime % 3600) / 60)
    const seconds = Math.floor(uptime % 60)
    const uptimeString = `${hours}h ${minutes}m ${seconds}s`

    // Info del sistema
    const platform = process.platform
    const arch = process.arch
    const nodeVersion = process.version

    // Mensaje final estilo SW SYSTEM
    const pingMessage = `
🕶️ **SW SYSTEM — Diagnóstico del Sistema** 🏁

${emoji} *Latencia:* ${ping} ms
📡 *Conexión:* ${speed}
✅ *Estado:* ${status}

💾 *Memoria:* ${memory}
⏱️ *Uptime:* ${uptimeString}
🖥️ *Plataforma:* ${platform}
🔧 *Arquitectura:* ${arch}
📦 *Node.js:* ${nodeVersion}

🎮 *"Todo bien, todo correcto. SW SYSTEM operativo."*
    `.trim()

    await conn.reply(m.chat, pingMessage, m, ctxOk)

  } catch (error) {
    console.error('Error en ping:', error)
    await conn.reply(
      m.chat,
      `❌ *SW SYSTEM — Error en el diagnóstico*\n\n` +
      `🔧 *Detalles:* ${error.message}`,
      m,
      ctxErr
    )
  }
}

handler.help = ['ping']
handler.tags = ['main']
handler.command = ['p', 'ping']

export default handler
