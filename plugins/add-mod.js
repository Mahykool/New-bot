// plugins/add-mod-confirm.js
import { addRole, toNum } from '../lib/lib-roles.js'
import { hasRole } from '../lib/lib-roles.js'
import { requireRoowner } from '../lib/permissions-middleware.js'

/**
 * Flujo:
 * - Si el mensaje contiene buttonId (respuesta a los botones), procesar confirmación/cancelación.
 * - Si no, iniciar: resolver target (mención / reply / número), enviar botones con payloads seguros.
 */

// Helper para normalizar JID
const getToJid = () => (typeof global.toJid === 'function' ? global.toJid : (j => String(j)))

// Resolver objetivo: m.mentionedJid -> quoted -> args (primer token)
const resolveTarget = (m, text) => {
  if (m.mentionedJid && m.mentionedJid.length) return m.mentionedJid[0]
  if (m.quoted && (m.quoted.sender || m.quoted.key?.participant)) return m.quoted.sender || m.quoted.key?.participant
  if (text && text.trim()) {
    const t = text.trim().split(/\s+/)[0]
    return t.includes('@') ? t : `${t.replace(/\D/g, '')}@s.whatsapp.net`
  }
  return null
}

var handler = async (m, { conn, text, usedPrefix, command }) => {
  try {
    const toJid = getToJid()
    const senderJid = toJid(m.sender)

    // Si es respuesta de botón (Baileys/otros frameworks suelen poner buttonId o selectedButtonId)
    const buttonId = (m?.buttonId) || (m?.selectedButtonId) || (m?.msg?.selectedButtonId) || null
    if (buttonId) {
      // buttonId formato: addmod:confirm:<targetJid>  o addmod:cancel:<targetJid>
      if (!buttonId.startsWith('addmod:')) return // no es nuestro botón
      const parts = buttonId.split(':')
      const action = parts[1] // 'confirm' | 'cancel'
      const rawTarget = parts.slice(2).join(':') // targetJid (puede contener ':', por eso slice)
      const targetJid = toJid(rawTarget)

      // Validar permisos del que confirma (debe ser roowner u owner)
      const isOwner = hasRole('owners', senderJid)
      const isRowner = hasRole('roowner', senderJid)
      if (!isOwner && !isRowner) return conn.reply(m.chat, '🚫 No tienes permisos para confirmar esta acción.', m)

      if (action === 'cancel') {
        return conn.reply(m.chat, `❎ Operación cancelada.`, m)
      }

      if (action === 'confirm') {
        // Ejecutar addRole
        try {
          const ok = await addRole('mods', targetJid, '', { actor: senderJid, source: m.chat })
          if (ok) {
            return conn.reply(m.chat, `✅ ${toNum(targetJid)} agregado como moderador.`, m)
          } else {
            return conn.reply(m.chat, `ℹ️ ${toNum(targetJid)} ya es moderador o no se pudo agregar.`, m)
          }
        } catch (err) {
          console.error('add-mod confirm error', err)
          return conn.reply(m.chat, `❌ Error al agregar moderador: ${err.message || err}`, m)
        }
      }

      return // fin del flujo de botón
    }

    // --- Inicio del flujo: comando normal ---
    // Verificar permisos iniciales (requireRoowner lanza si no tiene permiso)
    try {
      requireRoowner(m)
    } catch (err) {
      // Si requireRoowner lanza, responder con mensaje claro
      return conn.reply(m.chat, '🚫 Solo el roowner puede usar este comando.', m)
    }

    // Resolver target y normalizar
    const rawTarget = resolveTarget(m, text)
    const targetJid = toJid(rawTarget)
    if (!targetJid) return conn.reply(m.chat, `Uso: ${usedPrefix}${command} 569XXXXXXXX  o responde/menciona al usuario.`, m)

    // Preparar botones con payload seguro (no exponer datos extra)
    const confirmId = `addmod:confirm:${targetJid}`
    const cancelId = `addmod:cancel:${targetJid}`

    // Texto de confirmación
    const body = `⚠️ Confirmar agregar como moderador a:\n\n${toNum(targetJid)}\n\nPresiona *Confirmar* para proceder o *Cancelar* para abortar.`

    // Botones (estructura compatible con Baileys v4/v5; si usas otro adaptador, ajusta)
    const buttons = [
      { buttonId: confirmId, buttonText: { displayText: 'Confirmar' }, type: 1 },
      { buttonId: cancelId, buttonText: { displayText: 'Cancelar' }, type: 1 }
    ]

    const buttonMessage = {
      text: body,
      footer: global.wm || '',
      buttons,
      headerType: 1
    }

    await conn.sendMessage(m.chat, buttonMessage, { quoted: m })
    return
  } catch (e) {
    console.error('add-mod-confirm handler error', e)
    return conn.reply(m.chat, '❌ Error interno al procesar el comando.', m)
  }
}

handler.help = ['addmod 569XXXXXXXX', 'addmod @user']
handler.tags = ['admin']
handler.command = /^(addmod|promote|agregarmod|mod\+)$/i
handler.rowner = true
export default handler
