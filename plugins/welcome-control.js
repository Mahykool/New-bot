// plugins/welcome-control.js
/**
 * CONTROL DE WELCOME — SW SYSTEM
 * DESARROLLADO POR: Mahykol
 * VERSIÓN: 3.8.1 (parche: normalización de acciones)
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

  // Normalizar acción: aceptar muchas variantes
  const parts = (m.text || '').trim().split(/\s+/)
  let action = (parts[1] || '').toString().toLowerCase().replace(/\s+/g, '')

  // Mapear alias comunes a 'on' / 'off' / 'status'
  if (['1', 'true', 'enable', 'activar', 'activarwelcome', 'activar-welcome', 'on'].includes(action)) action = 'on'
  else if (['0', 'false', 'disable', 'desactivar', 'desactivarwelcome', 'desactivar-welcome', 'off'].includes(action)) action = 'off'
  else if (['status', 'estado', 'estadowelcome', 'welcomestatus', 'statuswelcome'].includes(action)) action = 'status'
  // si no hay acción explícita, action quedará '' y se mostrará ayuda

  const jid = m.chat

  try {
    const { setWelcomeState, isWelcomeEnabled } = await import('../lib/welcome.js')

    if (action === 'on') {
      setWelcomeState(jid, true)
      return conn.reply(
        m.chat,
        [
          'ㅤׄㅤׅㅤׄ _*WELCOME*_ ㅤ֢ㅤׄㅤׅ',
          '',
          '✅ *ACTIVADO*',
          '',
          'Los mensajes de bienvenida y despedida están ahora activos en este grupo.',
          '',
          'sw'
        ].join('\n'),
        m,
        ctxOk
      )
    } else if (action === 'off') {
      setWelcomeState(jid, false)
      return conn.reply(
        m.chat,
        [
          'ㅤׄㅤׅㅤׄ _*WELCOME*_ ㅤ֢ㅤׄㅤׅ',
          '',
          '❌ *DESACTIVADO*',
          '',
          'Los mensajes de bienvenida y despedida han sido desactivados en este grupo.',
          '',
          'sw'
        ].join('\n'),
        m,
        ctxErr
      )
    } else if (action === 'status') {
      const status = isWelcomeEnabled(jid) ? '🟢 ACTIVADO' : '🔴 DESACTIVADO'
      return conn.reply(
        m.chat,
        [
          'ㅤׄㅤׅㅤׄ _*WELCOME*_ ㅤ֢ㅤׄㅤׅ',
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
          'sw'
        ].join('\n'),
        m,
        ctxWarn
      )
    } else {
      return conn.reply(
        m.chat,
        [
          'ㅤׄㅤׅㅤׄ _*WELCOME*_ ㅤ֢ㅤׄㅤׅ',
          '',
          '⚙️ *CONFIGURACIÓN DEL WELCOME*',
          '',
          'Comandos disponibles:',
          `• ${usedPrefix}welcome on — Activar welcome`,
          `• ${usedPrefix}welcome off — Desactivar welcome`,
          `• ${usedPrefix}welcome status — Ver estado`,
          '',
          'Alias aceptados: on/off, enable/disable, 1/0, activar/desactivar',
          '',
          '✦ SW SYSTEM v3.8.1'
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
        'sw'
      ].join('\n'),
      m,
      ctxErr
    )
  }
}

handler.pluginId = 'group-welcome'
handler.help = ['welcome']
handler.tags = ['modmenu']
handler.command = ['welcome', 'bienvenida', 'welcomeon', 'welcomeoff', 'welcomestatus']
handler.group = true
handler.botAdmin = true

export default handler
