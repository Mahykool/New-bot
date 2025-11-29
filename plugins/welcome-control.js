// plugins/welcome-control.js
/**
 * CONTROL DE WELCOME — SW SYSTEM
 * DESARROLLADO POR: Mahykol
 * VERSIÓN: 3.8.0
 */

import { requireCommandAccess } from '../lib/permissions-middleware.js'

let handler = async (m, { conn, usedPrefix, command, isAdmin, isBotAdmin }) => {
  const ctxErr = (global.rcanalx || {})
  const ctxWarn = (global.rcanalw || {})
  const ctxOk = (global.rcanalr || {})

  if (!m.isGroup)
    return conn.reply(m.chat, '❌ Este comando solo funciona en grupos.', m, ctxErr)

  // Nivel SW SYSTEM (creador + mod)
  // pluginId: "group-welcome"
  // command:  "welcome"
  try {
    requireCommandAccess(m.sender, 'group-welcome', 'welcome')
  } catch (e) {
    if (e.code === 'ACCESS_DENIED') {
      return conn.reply(
        m.chat,
        '> No tienes nivel suficiente para configurar el *WELCOME*.',
        m,
        ctxErr
      )
    }
    throw e
  }

  // 🔓 Ya NO exigimos isAdmin:
  // if (!isAdmin) return ...

  const parts = (m.text || '').trim().split(/\s+/)
  const action = (parts[1] || '').toLowerCase()
  const jid = m.chat

  try {
    const { setWelcomeState, isWelcomeEnabled } = await import('../lib/welcome.js')

    if (action === 'on' || action === 'activar') {
      setWelcomeState(jid, true)
      return conn.reply(
        m.chat,
        [
          'ஓீ🐙 ㅤׄㅤׅㅤׄ *WELCOME* ㅤ֢ㅤׄㅤׅ',
          '',
          '✅ *WELCOME ACTIVADO*',
          '',
          'Los mensajes de bienvenida y despedida están ahora activos en este grupo.',
          '',
          '✦ SW SYSTEM v3.8.0'
        ].join('\n'),
        m,
        ctxOk
      )
    } else if (action === 'off' || action === 'desactivar') {
      setWelcomeState(jid, false)
      return conn.reply(
        m.chat,
        [
          'ஓீ🐙 ㅤׄㅤׅㅤׄ *WELCOME* ㅤ֢ㅤׄㅤׅ',
          '',
          '❌ *WELCOME DESACTIVADO*',
          '',
          'Los mensajes de bienvenida y despedida han sido desactivados en este grupo.',
          '',
          '✦ SW SYSTEM v3.8.0'
        ].join('\n'),
        m,
        ctxErr
      )
    } else if (action === 'status' || action === 'estado') {
      const status = isWelcomeEnabled(jid) ? '🟢 ACTIVADO' : '🔴 DESACTIVADO'
      return conn.reply(
        m.chat,
        [
          'ஓீ🐙 ㅤׄㅤׅㅤׄ *WELCOME* ㅤ֢ㅤׄㅤׅ',
          '',
          '📊 *ESTADO DEL WELCOME*',
          '',
          `Estado actual: ${status}`,
          '',
          'Comandos:',
          `• ${usedPrefix}welcome on`,
          `• ${usedPrefix}welcome off`,
          `• ${usedPrefix}welcome status`,
          '',
          '✦ SW SYSTEM v3.8.0'
        ].join('\n'),
        m,
        ctxWarn
      )
    } else {
      return conn.reply(
        m.chat,
        [
          'ஓீ🐙 ㅤׄㅤׅㅤׄ *WELCOME* ㅤ֢ㅤׄㅤׅ',
          '',
          '⚙️ *CONFIGURACIÓN DEL WELCOME*',
          '',
          'Comandos disponibles:',
          `• ${usedPrefix}welcome on — Activar welcome`,
          `• ${usedPrefix}welcome off — Desactivar welcome`,
          `• ${usedPrefix}welcome status — Ver estado`,
          '',
          '✦ SW SYSTEM v3.8.0'
        ].join('\n'),
        m,
        ctxWarn
      )
    }
  } catch (importError) {
    console.error('Error importing from lib/welcome.js:', importError)
    return conn.reply(
      m.chat,
      [
        'ஓீ🐙 ㅤׄㅤׅㅤׄ *WELCOME* ㅤ֢ㅤׄㅤׅ',
        '',
        '❌ Error: No se pudo cargar el sistema de welcome.',
        '',
        '✦ SW SYSTEM v3.8.0'
      ].join('\n'),
      m,
      ctxErr
    )
  }
}

handler.pluginId = 'group-welcome'
handler.help = ['welcome', 'bienvenida']
handler.tags = ['creador']
handler.command = ['welcome', 'bienvenida']
handler.group = true
handler.botAdmin = true

export default handler
