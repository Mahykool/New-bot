// plugins/group-tagall-trigger.js
// ✦ Tagall invisible con cita directa al mensaje, sin @ ni nombres ✦
// Diseñado por Mahykol ✦ Estilo GTA SA

import { requireCommandAccess } from '../lib/permissions-middleware.js'

const handler = async (m, { conn }) => {
  if (!m.isGroup) return

  const text = m?.text || ''
  const trigger = /^#tagall\b/i
  if (!trigger.test(text)) return

  // Validación de permisos
  const chatCfg = global.db?.data?.chats?.[m.chat] || {}
  try {
    requireCommandAccess(m, 'group-tagall', 'tagall', chatCfg)
  } catch (e) {
    try { const fail = global.dfail; if (fail) fail('access', m, conn) } catch {}
    return
  }

  // Obtener participantes
  let jids = []
  try {
    const meta = await conn.groupMetadata(m.chat)
    jids = (meta?.participants || []).map(p => p.id).filter(Boolean)
  } catch {
    jids = (m?.participants || []).map(p => p.id).filter(Boolean)
  }

  // Excluir al autor
  jids = jids.filter(id => id !== m.sender)

  // Detectar menciones explícitas
  const explicitMentions = Array.isArray(m?.mentionedJid) ? m.mentionedJid : []
  for (const jid of explicitMentions) {
    if (jid && !jids.includes(jid)) jids.push(jid)
  }

  // Texto estilizado
  const mensaje = text.replace(trigger, '').trim() || '⚘ Todos han sido mencionados invisiblemente.'
  const txt = `ㅤׄㅤׅㅤׄ 🐙 ㅤ֢ㅤׄㅤׅ\n> "${mensaje}"`

  // Enviar mensaje citando el reply (sin @ ni nombres)
  try {
    const options = { mentions: jids }
    options.quoted = m.quoted || m
    await conn.sendMessage(m.chat, { text: txt, ...options })
  } catch (e) {
    return m.reply(`⚠️ Error al ejecutar tagall: ${e.message}`)
  }

  // Borrar el trigger original
  try {
    await conn.sendMessage(m.chat, { delete: m.key })
  } catch {}
}
handler.help = ['tagall']
handler.tags = ['premium']
handler.group = true
handler.description = 'mencion pro'
handler.customPrefix = /^#tagall\b/i
handler.command = new RegExp

export default handler