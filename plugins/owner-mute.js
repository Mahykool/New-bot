// plugins/owner-mute.js — Versión PRO (Opción C)
// Shadowban / Mute con roles, auditoría, auto-detección silenciosa y formato limpio

import fs from 'fs'
import path from 'path'
import { requireCommandAccess } from '../lib/permissions-middleware.js'
import { normalizeJid, getUserRoles } from '../lib/lib-roles.js'
import { parseTarget } from '../lib/utils.js'

/* ============================
   CONFIG & ARCHIVOS
============================ */
const DATA_DIR = path.join(process.cwd(), 'data')
const FILE = path.join(DATA_DIR, 'shadowbans.json')
const AUDIT_LOG = path.join(DATA_DIR, 'shadowbans-audit.log')

const TITLE = 'ㅤׄㅤׅㅤׄ _*SHADOWBAN*_ ㅤ֢ㅤׄㅤׅ'
const formatTitle = () => `${TITLE}\n`

function ensureDataDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }) } catch {}
}

function auditLog(line) {
  try {
    ensureDataDir()
    const ts = new Date().toISOString()
    fs.appendFileSync(AUDIT_LOG, `[${ts}] ${line}\n`, 'utf8')
  } catch {}
}

/* ============================
   MENSAJES
============================ */
function msgUsage() {
  return `${formatTitle()}📌 *¿Cómo usar shadowban?*\n\n` +
    `1️⃣ *Shadowban permanente*\nResponde al mensaje del usuario y escribe:\n> *shadowban*\n\n` +
    `2️⃣ *Shadowban temporal*\nResponde al mensaje del usuario y escribe:\n> *shadowban <minutos>*\nEjemplo:\n> *shadowban 30*\n\n` +
    `🛠 Comandos disponibles:\n• *shadowban* — castigo\n• *unshadowban* — quitar castigo\n• *mute* — alias de shadowban\n• *unmute* — alias de unshadowban`
}

const msgCreatorAttempt = () =>
  `${formatTitle()}❌ No puedes shadowbanear al creador.\n\nNo lo intentes de nuevo.`

const msgModProtected = () =>
  `${formatTitle()}❌ No puedes shadowbanear a un moderador.`

const msgShadowbanTemp = (min, tag) =>
  `${formatTitle()}✨ SHADOWBAN TEMPORAL\n\nUsuario: ${tag}\nDuración: ${min} minuto(s).`

const msgShadowbanPerm = (tag) =>
  `${formatTitle()}🔒 SHADOWBAN PERMANENTE\n\nUsuario: ${tag}\nHasta que se ejecute *unshadowban*.`

const msgShadowbanExpired = (tag) =>
  `${formatTitle()}🎉 SHADOWBAN TERMINADO\n\nEl shadowban temporal de ${tag} ha finalizado.`

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

      shadowMap.set(jid, {
        expiresAt: item.expiresAt || null,
        actor: item.actor || null,
        createdAt: item.createdAt || null,
        chat: item.chat || null,
        immutable: !!item.immutable,
        timeoutId: null
      })
    }
  } catch {}
}

function saveShadowbans() {
  try {
    ensureDataDir()
    const arr = [...shadowMap.entries()].map(([jid, v]) => ({
      jid,
      expiresAt: v.expiresAt,
      actor: v.actor,
      createdAt: v.createdAt,
      chat: v.chat,
      immutable: v.immutable
    }))
    fs.writeFileSync(FILE, JSON.stringify(arr, null, 2), 'utf8')
  } catch {}
}

/* ============================
   SCHEDULING
============================ */
function scheduleUnshadow(jid, ms, conn) {
  if (!ms || ms <= 0) return

  const timeoutId = setTimeout(async () => {
    const entry = shadowMap.get(jid)
    if (!entry) return

    shadowMap.delete(jid)
    saveShadowbans()
    auditLog(`AUTO-UNSHADOW ${jid}`)

    const tag = `@${jid.split('@')[0]}`
    try {
      await conn.sendMessage(entry.chat, { text: msgShadowbanExpired(tag), mentions: [jid] })
    } catch {}
  }, ms)

  const entry = shadowMap.get(jid)
  if (entry) entry.timeoutId = timeoutId
}

/* ============================
   CARGA INICIAL
============================ */
loadShadowbans()

/* ============================
   BORRADO DE MENSAJES (AUTO)
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
   HANDLER PRINCIPAL
============================ */
const handler = async (m, { conn, command }) => {
  const ctxErr = global.rcanalx || {}
  const ctxWarn = global.rcanalw || {}
  const ctxOk = global.rcanalr || {}

  /* --- PERMISOS POR ROL --- */
  try {
    const chatCfg = global.db?.data?.chats?.[m.chat] || {}
    requireCommandAccess(m, 'moderation-plugin', command, chatCfg)
  } catch {
    return conn.reply(m.chat, `${formatTitle()}❌ No tienes permiso para usar este comando.`, m, ctxErr)
  }

  /* --- AYUDA SOLO SI NO HAY TARGET --- */
  if (!m.quoted && (!m.mentionedJid || m.mentionedJid.length === 0)) {
    try { await conn.reply(m.chat, msgUsage(), m, ctxWarn) } catch {}
  }

  /* --- RESOLVER TARGET --- */
  const rawTarget = parseTarget(m, [])
  const target = rawTarget ? normalizeJid(rawTarget) : null

  if (!target) {
    return conn.reply(
      m.chat,
      `${formatTitle()}⚠️ No se pudo identificar al usuario.\n\nResponde o menciona a alguien.`,
      m,
      ctxWarn
    )
  }

  const tag = `@${target.split('@')[0]}`

  /* --- PROTECCIÓN CREATOR --- */
  const creators = []
  if (Array.isArray(global.owner)) creators.push(...global.owner)
  if (global.ownerJid) creators.push(global.ownerJid)
  if (global.ownerNumber) creators.push(global.ownerNumber)

  const normalizedCreators = creators.map(o => normalizeJid(Array.isArray(o) ? o[0] : o)).filter(Boolean)
  const isCreator = normalizedCreators.includes(target)

  if (isCreator) {
    return conn.reply(m.chat, msgCreatorAttempt(), m, ctxErr)
  }

  /* --- PROTECCIÓN MODS --- */
  const roles = (getUserRoles(target) || []).map(r => r.toLowerCase())
  if (roles.includes('mod') || roles.includes('moderador') || roles.includes('moderator')) {
    return conn.reply(m.chat, msgModProtected(), m, ctxErr)
  }

  /* --- SHADOWBAN / UNSHADOWBAN --- */
  const text = (m.text || '').trim().split(/\s+/)
  const minutes = parseInt(text[1], 10)
  const isDuration = !isNaN(minutes) && minutes > 0

  if (command === 'shadowban' || command === 'mute') {
    if (shadowMap.has(target)) {
      return conn.reply(m.chat, `${formatTitle()}⚠️ Ya está shadowbaneado: ${tag}`, m, { mentions: [target] }, ctxWarn)
    }

    const expiresAt = isDuration ? Date.now() + minutes * 60 * 1000 : null

    shadowMap.set(target, {
      expiresAt,
      actor: normalizeJid(m.sender),
      createdAt: Date.now(),
      chat: m.chat,
      immutable: false,
      timeoutId: null
    })

    saveShadowbans()
    auditLog(`SHADOW ${target} by ${normalizeJid(m.sender)} duration=${isDuration ? minutes + 'm' : 'perm'}`)

    if (isDuration) {
      scheduleUnshadow(target, expiresAt - Date.now(), conn)
      return conn.reply(m.chat, msgShadowbanTemp(minutes, tag), m, { mentions: [target] }, ctxOk)
    }

    return conn.reply(m.chat, msgShadowbanPerm(tag), m, { mentions: [target] }, ctxOk)
  }

  if (command === 'unshadowban' || command === 'unmute') {
    const entry = shadowMap.get(target)
    if (!entry) {
      return conn.reply(m.chat, `${formatTitle()}⚠️ No está shadowbaneado: ${tag}`, m, { mentions: [target] }, ctxWarn)
    }

    if (entry.immutable) {
      return conn.reply(m.chat, `${formatTitle()}❌ Este shadowban es inmutable.`, m, ctxErr)
    }

    if (entry.timeoutId) clearTimeout(entry.timeoutId)
    shadowMap.delete(target)
    saveShadowbans()
    auditLog(`UNSHADOW ${target} by ${normalizeJid(m.sender)}`)

    return conn.reply(m.chat, `${formatTitle()}✅ Usuario des-shadowbaneado: ${tag}`, m, { mentions: [target] }, ctxOk)
  }
}

/* ============================
   BEFORE: BORRAR MENSAJES
   (Auto-detección silenciosa)
============================ */
handler.before = async (m, { conn }) => {
  if (!m || !m.sender) return
  const sender = normalizeJid(m.sender)

  if (!shadowMap.has(sender)) return
  if (m.mtype === 'stickerMessage') return

  // Si el bot es admin → borra. Si no → ignora silenciosamente.
  try { await tryDelete(conn, m) } catch {}
}

handler.help = ['shadowban']
handler.tags = ['modmenu']
handler.command = ['shadowban', 'unshadowban', 'mute', 'unmute']
handler.group = true

export default handler
