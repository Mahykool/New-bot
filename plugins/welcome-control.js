// welcome-control.js
/**
 * ✦ SWILL SYSTEM — CONTROL DE WELCOME
 * ✦ DESARROLLADO POR: Mahykol
 * ✦ VERSIÓN: 3.8.0
 */

let handler = async (m, { conn, usedPrefix, command, isAdmin, isBotAdmin }) => {
  const ctxErr = (global.rcanalx || {})
  const ctxWarn = (global.rcanalw || {})
  const ctxOk = (global.rcanalr || {})

  if (!m.isGroup) 
    return conn.reply(m.chat, '❌ Este comando solo funciona en grupos', m, ctxErr)

  if (!isAdmin) 
    return conn.reply(m.chat, '❌ Solo los administradores pueden usar este comando', m, ctxErr)

  const action = (m.text || '').toLowerCase().split(' ')[1]
  const jid = m.chat

  try {
    // Importar desde lib/welcome.js
    const { setWelcomeState, isWelcomeEnabled } = await import('../lib/welcome.js')
    
    if (action === 'on' || action === 'activar') {
      setWelcomeState(jid, true)
      return conn.reply(
        m.chat,
        `✅ *WELCOME ACTIVADO*\n\n` +
        `Los mensajes de bienvenida y despedida están ahora activos en este grupo.\n\n` +
        `✦ SWILL SYSTEM v3.8.0`,
        m,
        ctxOk
      )
    } 
    
    else if (action === 'off' || action === 'desactivar') {
      setWelcomeState(jid, false)
      return conn.reply(
        m.chat,
        `❌ *WELCOME DESACTIVADO*\n\n` +
        `Los mensajes de bienvenida y despedida han sido desactivados.\n\n` +
        `✦ SWILL SYSTEM v3.8.0`,
        m,
        ctxErr
      )
    }

    else if (action === 'status' || action === 'estado') {
      const status = isWelcomeEnabled(jid) ? '🟢 ACTIVADO' : '🔴 DESACTIVADO'
      return conn.reply(
        m.chat,
        `📊 *ESTADO DEL WELCOME*\n\n` +
        `Estado actual: ${status}\n\n` +
        `Comandos:\n` +
        `• ${usedPrefix}welcome on\n` +
        `• ${usedPrefix}welcome off\n` +
        `• ${usedPrefix}welcome status\n\n` +
        `✦ SWILL SYSTEM v3.8.0`,
        m,
        ctxWarn
      )
    }

    else {
      return conn.reply(
        m.chat,
        `⚙️ *CONFIGURACIÓN DEL WELCOME*\n\n` +
        `Comandos disponibles:\n` +
        `• ${usedPrefix}welcome on — Activar welcome\n` +
        `• ${usedPrefix}welcome off — Desactivar welcome\n` +
        `• ${usedPrefix}welcome status — Ver estado\n\n` +
        `✦ SWILL SYSTEM v3.8.0`,
        m,
        ctxWarn
      )
    }

  } catch (importError) {
    console.error('Error importing from lib/welcome.js:', importError)
    return conn.reply(
      m.chat,
      `❌ Error: No se pudo cargar el sistema de welcome.\n\n` +
      `✦ SWILL SYSTEM v3.8.0`,
      m,
      ctxErr
    )
  }
}

handler.help = ['welcome']
handler.tags = ['group']
handler.command = ['welcome']
handler.admin = true
handler.group = true

export default handler
