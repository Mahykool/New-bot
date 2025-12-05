// lib/utils.js — versión segura para SW SYSTEM
import { normalizeJid } from './lib-roles.js'

// Corrige targets incorrectos, elimina números aleatorios y asegura precisión absoluta
export function ensureJid(raw) {
  if (!raw) return null
  raw = String(raw).trim()

  // Elimina @, ~, paréntesis, guiones, espacios, etc.
  raw = raw.replace(/[@~()\s\-]/g, '')

  // Si ya tiene @s.whatsapp.net, lo dejamos
  if (raw.includes('@') && raw.endsWith('@s.whatsapp.net')) {
    return raw.split(':')[0]
  }

  // Extrae solo números válidos
  let cleaned = raw.replace(/[^\d+]/g, '')
  if (cleaned.startsWith('+')) cleaned = cleaned.slice(1)
  if (!cleaned || cleaned.length < 6) return null

  return `${cleaned}@s.whatsapp.net`
}

export function extractNumberFromString(str = '') {
  if (!str) return null
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
    if (Array.isArray(m.mentionedJid) && m.mentionedJid.length > 0) {
      const j = ensureJid(m.mentionedJid[0])
      if (j) return j
    }

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

/**
 * ✅ isOwner:
 * - Compara contra global.owner con JIDs normalizados
 * - Soporta estructura [jid, name, isCreator]
 */
export function isOwner(jid) {
  const norm = normalizeJid(jid)
  if (!norm) return false
  return Array.isArray(global.owner)
    ? global.owner.some(entry => {
        // entry puede ser ['jid', 'name', true] o 'jid' plano
        const ejid = Array.isArray(entry) ? entry[0] : entry
        return normalizeJid(ejid) === norm
      })
    : false
}

/**
 * ✅ resolveAliasToJid:
 * - Busca alias visibles en el grupo y devuelve el JID real
 * - Útil para casos como "@~Rosalia"
 */
export async function resolveAliasToJid(conn, m, alias) {
  try {
    const metadata = await conn.groupMetadata(m.chat)
    const cleaned = String(alias).replace(/^@/, '').replace(/^~/, '').trim().toLowerCase()

    for (const p of metadata.participants) {
      const name = (await conn.getName(p.id).catch(() => null)) || ''
      if (name.toLowerCase().includes(cleaned)) return p.id
    }

    return null
  } catch {
    return null
  }
}