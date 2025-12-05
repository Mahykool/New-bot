// plugins/welcome-control.js — SW SYSTEM PRO corregido
// Control de Welcome con:
// ✅ Roles SW
// ✅ Permisos SW
// ✅ Integración con lib/welcome.js
// ✅ Menciones y nombres corregidos con formatUserTag

import { requireCommandAccess } from '../lib/permissions-middleware.js'
import { formatUserTag } from '../lib/utils.js'
import { setWelcomeState, isWelcomeEnabled, sendWelcomeOrBye } from '../lib/welcome.js'

let handler = async (m, { conn, usedPrefix, command }) => {
  const chatCfg = global.db?.data?.chats?.[m.chat] || {}

  // Validar permisos
  try {
    requireCommandAccess(m, 'group-welcome', 'welcome', chatCfg)
  } catch {
    return conn.reply(m.chat, '❌ No tienes nivel suficiente para configurar el *WELCOME*.', m)
  }

  // Normalizar acción
  const parts = (m.text || '').trim().split(/\s+/)
  let action = (parts[1] || '').toString().toLowerCase().replace(/\s+/g, '')

  if (['1','true','enable','activar','on'].includes(action)) action = 'on'
  else if (['0','false','disable','desactivar','off'].includes(action)) action = 'off'
  else if (['status','estado'].includes(action)) action = 'status'
  else if (!action) action = ''

  const jid = m.chat
  const display = await formatUserTag(conn, m.sender)

  if (action === 'on') {
    setWelcomeState(jid, true)
    return conn.reply(
      m.chat,
      `ㅤׄㅤׅㅤׄ _*WELCOME*_ ㅤ֢ㅤׄㅤׅ\n\n✅ *ACTIVADO*\n\nConfigurado por: ${display}`,
      m
    )
  }

  if (action === 'off') {
    setWelcomeState(jid, false)
    return conn.reply(
      m.chat,
      `ㅤׄㅤׅㅤׄ _*WELCOME*_ ㅤ֢ㅤׄㅤׅ\n\n❌ *DESACTIVADO*\n\nConfigurado por: ${display}`,
      m
    )
  }

  if (action === 'status') {
    const status = isWelcomeEnabled(jid) ? '🟢 ACTIVADO' : '🔴 DESACTIVADO'
    return conn.reply(
      m.chat,
      `ㅤׄㅤׅㅤׄ _*WELCOME*_ ㅤ֢ㅤׄㅤׅ\n\n📊 *ESTADO DEL WELCOME*\n\nEstado actual: ${status}\n\nSolicitado por: ${display}`,
      m
    )
  }

  // Ayuda si no hay acción válida
  return conn.reply(
    m.chat,
    `ㅤׄㅤׅㅤׄ _*WELCOME*_ ㅤ֢ㅤׄㅤׅ\n\n⚙️ *CONFIGURACIÓN DEL WELCOME*\n\nComandos disponibles:\n• ${usedPrefix}welcome on — Activar welcome\n• ${usedPrefix}welcome off — Desactivar welcome\n• ${usedPrefix}welcome status — Ver estado\n\nAlias aceptados: on/off, enable/disable, 1/0, activar/desactivar\n\n✦ SW SYSTEM v3.9.0`,
    m
  )
}

/* ============================
   HOOK: ENVÍO DE WELCOME/BYE
============================ */
handler.before = async (m, { conn }) => {
  try {
    if (!m.isGroup) return
    const jid = m.chat

    if (!isWelcomeEnabled(jid)) return

    if (m.messageStubType === 27) { // nuevo miembro
      const participant = m.messageStubParameters[0]
      const name = await conn.getName(participant)
      await sendWelcomeOrBye(conn, { jid, userName: name, type: 'welcome', participant })
    }

    if (m.messageStubType === 28) { // miembro salió
      const participant = m.messageStubParameters[0]
      const name = await conn.getName(participant)
      await sendWelcomeOrBye(conn, { jid, userName: name, type: 'bye', participant })
    }
  } catch (e) {
    console.error('Error en welcome-control before:', e)
  }
}

handler.pluginId = 'group-welcome'
handler.help = ['welcome']
handler.tags = ['modmenu']
handler.command = ['welcome', 'bienvenida', 'welcomeon', 'welcomeoff', 'welcomestatus']
handler.group = true
handler.botAdmin = false
handler.admin = false
handler.description = 'Cambiar el status del anuncio de bienvenida'

export default handler
