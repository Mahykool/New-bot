// plugins/owner-mute.js — FINAL COMPLETO
import fs from 'fs'
import path from 'path'
import { requireCommandAccess } from '../lib/permissions-middleware.js'
import { normalizeJid, getUserRoles } from '../lib/lib-roles.js'
import { formatUserTag, resolveAliasToJid, ensureJid } from '../lib/utils.js'

/* ============================
   CONFIG
============================ */
const DATA_DIR = path.join(process.cwd(), 'data')
const FILE = path.join(DATA_DIR, 'shadowbans.json')
const AUDIT_LOG = path.join(DATA_DIR, 'shadowbans-audit.log')

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}
function auditLog(line) {
  try {
    ensureDataDir()
    const ts = new Date().toISOString()
    fs.appendFileSync(AUDIT_LOG, `[${ts}] ${line}\n`, 'utf8')
  } catch {}
}

/* ============================
   PERSISTENCIA
============================ */
let shadowMap = new Map()
function loadShadowbans() {
  try {
    if (!fs.existsSync(FILE)) return
    const raw = fs.readFileSync(FILE, 'utf8') || '[]'
    const arr = JSON.parse(raw)
    const now = Date.now()
    for (const item of arr) {
      const jid = normalizeJid(item.jid)
      if (!jid) continue
      if (item.expiresAt && item.expiresAt <= now) continue
      shadowMap.set(jid, { ...item, timeoutId: null })
    }
  } catch (e) { console.warn('loadShadowbans error', e) }
}
function saveShadowbans() {
  try {
    ensureDataDir()
    const arr = [...shadowMap.entries()].map(([jid, v]) => ({
      jid, expiresAt: v.expiresAt, actor: v.actor, createdAt: v.createdAt, chat: v.chat, immutable: v.immutable
    }))
    fs.writeFileSync(FILE, JSON.stringify(arr, null, 2), 'utf8')
  } catch (e) { console.error('saveShadowbans error', e) }
}

/* ============================
   SCHEDULING
============================ */
function scheduleUnshadow(jid, ms, conn) {
  if (!ms || ms <= 0) return
  const prev = shadowMap.get(jid)
  if (prev?.timeoutId) { try { clearTimeout(prev.timeoutId) } catch {}; prev.timeoutId = null }
  const timeoutId = setTimeout(async () => {
    const entry = shadowMap.get(jid); if (!entry) return
    shadowMap.delete(jid); saveShadowbans(); auditLog(`AUTO-UNSHADOW ${jid}`)
    try {
      if (entry.chat && conn) {
        await conn.sendMessage(entry.chat, { text: `🎉 Shadowban finalizado\nUsuario: @${jid.split('@')[0]}`, mentions: [jid] })
      }
    } catch {}
  }, ms)
  shadowMap.set(jid, { ...shadowMap.get(jid), timeoutId })
}
function scheduleAllTimeouts(conn = null) {
  const now = Date.now()
  for (const [jid, v] of shadowMap.entries()) {
    if (v.expiresAt) {
      const ms = v.expiresAt - now
      if (ms <= 0) shadowMap.delete(jid)
      else scheduleUnshadow(jid, ms, conn)
    }
  }
  saveShadowbans()
}
/* ============================
   BORRADO AUTOMÁTICO
============================ */
async function tryDelete(conn, m) {
  try {
    if (typeof conn.deleteMessage === 'function') {
      await conn.deleteMessage(m.chat, m.key)
      return
    }
    if (typeof conn.sendMessage === 'function') {
      await conn.sendMessage(m.chat, { delete: m.key })
      return
    }
  } catch {}
}

/* ============================
   PARSING MINUTOS + TARGET
============================ */

// Número al final = minutos; soporta "5", "5,", "5,,", "5m", "10min"
function extractMinutes(parts) {
  if (!Array.isArray(parts) || parts.length < 2) return NaN
  let last = String(parts[parts.length - 1] || '').trim()

  // Quitar comas y espacios extra
  last = last.replace(/,+$/g, '').trim()
  // Soportar sufijos tipo "5m" o "10min"
  const match = last.match(/^(\d+)(m|min)?$/i)
  if (!match) return NaN

  const value = parseInt(match[1], 10)
  return Number.isFinite(value) && value > 0 ? value : NaN
}

// Resolver target: respuesta → mención → @token explícito → alias → número limpio
async function resolveTarget(conn, m, parts, minutesArg) {
  // 1) Respuesta
  if (m.quoted?.sender) return normalizeJid(m.quoted.sender)

  // 2) Menciones reales (prioridad absoluta)
  const mentioned = []
  if (Array.isArray(m.mentionedJid)) mentioned.push(...m.mentionedJid)
  const ctx = m.message?.extendedTextMessage?.contextInfo || m.msg?.contextInfo || m.message?.contextInfo
  if (Array.isArray(ctx?.mentionedJid)) mentioned.push(...ctx.mentionedJid)
  if (mentioned.length > 0) return normalizeJid(mentioned[0])

  // 3) Tokens después del comando
  let tokens = (parts || []).slice(1).map(t => String(t).trim()).filter(Boolean)

  // Si el último token era minutos, quitarlo
  if (Number.isFinite(minutesArg) && tokens.length > 0) {
    const lastToken = tokens[tokens.length - 1].replace(/,+$/g, '').trim()
    if (/^(\d+)(m|min)?$/i.test(lastToken)) {
      tokens = tokens.slice(0, -1)
    }
  }

  if (tokens.length === 0) return null

  // 3a) Fallback: detectar @tokens explícitos cuando no hay mentionedJid
  if (tokens[0].startsWith('@')) {
    let raw = tokens[0].replace(/^@+/, '').replace(/,+$/g, '').trim()
    const aliasJid = await resolveAliasToJid(conn, m, raw)
    if (aliasJid) return normalizeJid(aliasJid)
    const ensured = ensureJid(raw)
    if (ensured) return normalizeJid(ensured)
  }

  // 4) Alias o número (multi-palabra también)
  let rawTarget = tokens.join(' ').trim()
  if (rawTarget.startsWith('@')) rawTarget = rawTarget.slice(1)

  const aliasJid = await resolveAliasToJid(conn, m, rawTarget)
  if (aliasJid) return normalizeJid(aliasJid)

  const ensured = ensureJid(rawTarget)
  return ensured ? normalizeJid(ensured) : null
}

/* ============================
   PROTECCIONES
============================ */
function isProtectedTarget(conn, target, actor) {
  const botJid = normalizeJid(conn.user?.id)
  if (target === botJid) return { protected: true, reason: 'bot' }

  const targetRoles = getUserRoles(target).map(r => r.toLowerCase())
  const creators = []
  if (Array.isArray(global.owner)) creators.push(...global.owner)
  if (global.ownerJid) creators.push(global.ownerJid)
  if (global.ownerNumber) creators.push(global.ownerNumber)
  const normalizedCreators = creators.map(o => normalizeJid(Array.isArray(o) ? o[0] : o)).filter(Boolean)

  const isCreatorTarget =
    normalizedCreators.includes(target) ||
    targetRoles.includes('creador') ||
    targetRoles.includes('owner')

  const isCreatorActor = normalizedCreators.includes(actor)

  if (isCreatorTarget) return { protected: true, reason: 'creator' }

  const protectedRoles = new Set(['mod','moderador','moderator','admin','staff'])
  if (targetRoles.some(r => protectedRoles.has(r)) && !isCreatorActor) {
    return { protected: true, reason: 'role' }
  }

  return { protected: false }
}

/* ============================
   HANDLER PRINCIPAL
============================ */
const handler = async (m, { conn, command }) => {
  const chatCfg = global.db?.data?.chats?.[m.chat] || {}
  try { requireCommandAccess(m, 'moderation-plugin', 'shadowban', chatCfg) }
  catch { return conn.reply(m.chat, `❌ No tienes permiso para usar este comando.`, m) }

  // SHADOWBAN / MUTE
  if (command === 'shadowban' || command === 'mute') {
    const parts = (m.text || '').trim().split(/\s+/)
    const minutesArg = extractMinutes(parts)
    const isDuration = Number.isFinite(minutesArg) && minutesArg > 0

    const targetJid = await resolveTarget(conn, m, parts, minutesArg)
    if (!targetJid) {
      return conn.reply(m.chat, `⚠️ Debes responder, mencionar o usar un alias/número válido.`, m)
    }

    const target = normalizeJid(targetJid)
    const display = await formatUserTag(conn, target)
    const actor = normalizeJid(m.sender)
    const prot = isProtectedTarget(conn, target, actor)

    // 🚫 Intento contra el bot
    if (prot.protected && prot.reason === 'bot') {
      return conn.reply(m.chat, `🤖 No puedes shadowbanear al bot.`, m)
    }

    // 🚫 Intento contra un rol protegido
    if (prot.protected && prot.reason === 'role') {
      return conn.reply(m.chat, `🛡️ No puedes shadowbanear a un rol protegido (mod/admin/staff).`, m, { mentions: [target] })
    }

    // 💀 Intento contra el creador → castigo de 5 minutos
    if (prot.protected && prot.reason === 'creator') {
      const expiresAtPunisher = Date.now() + 5 * 60 * 1000
      shadowMap.set(actor, {
        expiresAt: expiresAtPunisher,
        actor: 'system',
        createdAt: Date.now(),
        chat: m.chat,
        immutable: true,
        timeoutId: null
      })
      saveShadowbans()
      scheduleUnshadow(actor, expiresAtPunisher - Date.now(), conn)
      auditLog(`PUNISH-SHADOW ${actor} (attempted shadowban creator)`)

      const displayPunisher = await formatUserTag(conn, actor)
      return conn.reply(
        m.chat,
        `En serio intentaste shadowbanear al creador ? 💀\nCastigo: 5 minutos para ${displayPunisher}\nSolo el creador puede retirarlo.`,
        m,
        { mentions: [actor] }
      )
    }

    // ✅ Aplicación normal de shadowban
    if (shadowMap.has(target)) {
      return conn.reply(m.chat, `⚠️ El usuario ya está shadowbaneado: ${display}`, m, { mentions: [target] })
    }

    const expiresAt = isDuration ? Date.now() + minutesArg * 60 * 1000 : null
    shadowMap.set(target, {
      expiresAt,
      actor,
      createdAt: Date.now(),
      chat: m.chat,
      immutable: false,
      timeoutId: null
    })
    saveShadowbans()
    auditLog(`SHADOW ${target} by ${actor} duration=${isDuration ? minutesArg + 'm' : 'perm'}`)

    if (isDuration) {
      scheduleUnshadow(target, expiresAt - Date.now(), conn)
      return conn.reply(m.chat, `✨ Shadowban aplicado\nUsuario: ${display}\nDuración: ${minutesArg} minutos.`, m, { mentions: [target] })
    } else {
      return conn.reply(m.chat, `🔒 Shadowban permanente aplicado\nUsuario: ${display}`, m, { mentions: [target] })
    }
  }

  // UNSHADOWBAN / UNMUTE
  if (command === 'unshadowban' || command === 'unmute') {
    const parts = (m.text || '').trim().split(/\s+/) // ✅ recalcular parts aquí
    const targetJid = await resolveTarget(conn, m, parts, NaN)
    if (!targetJid) {
      return conn.reply(m.chat, `⚠️ Debes responder, mencionar o usar un alias/número válido.`, m)
    }

    const target = normalizeJid(targetJid)
    const display = await formatUserTag(conn, target)

    const entry = shadowMap.get(target)
    if (!entry) {
      return conn.reply(m.chat, `⚠️ El usuario no está shadowbaneado: ${display}`, m, { mentions: [target] })
    }

    // Inmutable → solo creador o bot pueden retirarlo
    if (entry.immutable) {
      const actor = normalizeJid(m.sender)
      const botJid = normalizeJid(conn.user?.id)
      const creators = []
      if (Array.isArray(global.owner)) creators.push(...global.owner)
      if (global.ownerJid) creators.push(global.ownerJid)
      if (global.ownerNumber) creators.push(global.ownerNumber)
      const normalizedCreators = creators.map(o => normalizeJid(Array.isArray(o) ? o[0] : o)).filter(Boolean)
      const isActorAllowed = actor === botJid || normalizedCreators.includes(actor)
      if (!isActorAllowed) {
        return conn.reply(m.chat, `⛔ Este shadowban solo puede ser retirado por el creador o el bot.`, m, { mentions: [target] })
      }
    }

    if (entry.timeoutId) { try { clearTimeout(entry.timeoutId) } catch {} }
    shadowMap.delete(target)
    saveShadowbans()
    auditLog(`UNSHADOW ${target} by ${normalizeJid(m.sender)}`)
    return conn.reply(m.chat, `✅ Shadowban removido\nUsuario: ${display}`, m, { mentions: [target] })
  }
} // ← cierre del handler completo

/* ============================
   BEFORE: BORRADO AUTOMÁTICO + EXPIRACIÓN SUAVE
============================ */
handler.before = async (m, { conn }) => {
  try {
    if (!m || !m.sender) return
    const sender = normalizeJid(m.sender)
    const entry = shadowMap.get(sender)
    if (!entry) return

    // Expiración suave
    if (entry.expiresAt && Date.now() >= entry.expiresAt) {
      if (entry.timeoutId) { try { clearTimeout(entry.timeoutId) } catch {} }
      shadowMap.delete(sender)
      saveShadowbans()
      auditLog(`SOFT-UNSHADOW ${sender}`)
      return
    }

    // Permitir stickers
    if (m.mtype === 'stickerMessage') return

    await tryDelete(conn, m)
  } catch (e) { console.error('shadowban before error:', e) }
}

/* ============================
   PROPS DEL HANDLER
============================ */
handler.help = ['shadowban', 'unshadowban']
handler.tags = ['modmenu']
handler.command = ['shadowban', 'unshadowban', 'mute', 'unmute']
handler.group = true
handler.botAdmin = false
handler.admin = false

// Inicializar persistencia al cargar
loadShadowbans()
scheduleAllTimeouts()
handler.description = 'Silenciar / desilenciar a un usuario'

export default handler