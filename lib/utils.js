// lib/utils.js — versión segura para SW SYSTEM
// Corrige targets incorrectos, elimina números aleatorios y asegura precisión absoluta

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

/**
 * ✅ parseTarget seguro:
 * - SOLO usa menciones reales
 * - SOLO usa quoted reales
 * - SOLO usa args válidos
 */
export function parseTarget(m = {}, args = []) {
  try {
    // ✅ 1) Mención directa
    if (Array.isArray(m.mentionedJid) && m.mentionedJid.length > 0) {
      const j = ensureJid(m.mentionedJid[0])
      if (j) return j
    }

    // ✅ 2) Quoted (mensaje respondido)
    if (m.quoted) {
      const q = m.quoted
      const cand =
        q.sender ||
        q.participant ||
        q.key?.participant ||
        q.key?.remoteJid

      if (cand) {
        const j = ensureJid(cand)
        if (j) return j
      }
    }

    // ✅ 3) Args: solo si parecen número o JID
    for (const a of args || []) {
      if (!a) continue
      const s = String(a).trim()

      // JID directo
      if (s.includes('@')) {
        const j = ensureJid(s)
        if (j) return j
      }

      // Número válido
      const num = extractNumberFromString(s)
      if (num) return ensureJid(num)
    }

    return null
  } catch {
    return null
  }
}

/**
 * ✅ formatUserTag seguro:
 * - Normaliza JID
 * - Obtiene nombre si existe
 * - Devuelve siempre algo válido (nombre o número)
 */
export async function formatUserTag(conn, jid) {
  try {
    const normalized = ensureJid(jid)
    if (!normalized) return ''

    const name = await conn.getName(normalized).catch(() => null)
    const tag = `@${normalized.split('@')[0]}`

    return name ? `${name} (${tag})` : tag
  } catch {
    return `@${String(jid).split('@')[0]}`
  }
}
