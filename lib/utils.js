// lib/utils.js
export function ensureJid(raw) {
  if (!raw) return null
  raw = String(raw).trim()
  // Si ya parece un JID, quitar sufijos como :1234 y devolver
  if (raw.includes('@')) return raw.split(':')[0]
  // Limpiar: mantener + y dígitos
  let cleaned = raw.replace(/[^\d+]/g, '')
  if (cleaned.startsWith('+')) cleaned = cleaned.slice(1)
  if (!cleaned) return null
  return `${cleaned}@s.whatsapp.net`
}

export function extractNumberFromString(str = '') {
  if (!str) return null
  // Busca secuencia de + y dígitos o solo dígitos (6-15)
  const m = str.match(/(\+?\d{6,15})/)
  return m ? m[1] : null
}

export function parseTarget(m = {}, args = []) {
  try {
    // 1) m.mentionedJid
    if (Array.isArray(m.mentionedJid) && m.mentionedJid.length > 0) {
      const j = ensureJid(m.mentionedJid[0])
      if (j) return j
    }

    // 2) m.quoted (varias ubicaciones posibles)
    if (m.quoted) {
      const q = m.quoted
      const cand = q.sender || q.participant || q.key?.participant || q.key?.remoteJid
      if (cand) {
        const j = ensureJid(cand)
        if (j) return j
      }
      // intentar extraer número del texto citado
      const text = (q?.text || q?.message?.conversation || q?.message?.extendedTextMessage?.text || '').toString()
      const num = extractNumberFromString(text)
      if (num) return ensureJid(num)
    }

    // 3) args: primer arg que parezca número o jid
    for (const a of args || []) {
      if (!a) continue
      const s = String(a).trim()
      if (s.includes('@')) {
        const j = ensureJid(s)
        if (j) return j
      }
      const num = extractNumberFromString(s)
      if (num) return ensureJid(num)
    }

    // 4) fallback: buscar número en el cuerpo del mensaje
    const body = (m?.text || m?.message?.conversation || m?.message?.extendedTextMessage?.text || '').toString()
    const numBody = extractNumberFromString(body)
    if (numBody) return ensureJid(numBody)

    return null
  } catch {
    return null
  }
}
