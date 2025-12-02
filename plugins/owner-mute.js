// plugins/owner-mute.js — Versión FINAL SW corregida
// Shadowban real con:
// ✅ Persistencia
// ✅ Auto-expiración
// ✅ Borrado automático
// ✅ Auditoría
// ✅ Protección de creador y mods
// ✅ Integración con roles y permisos SW
// ✅ Compatible con kick y antilink
// ✅ Menciones y nombres corregidos con formatUserTag

import fs from 'fs'
import path from 'path'
import { requireCommandAccess } from '../lib/permissions-middleware.js'
import { normalizeJid, getUserRoles } from '../lib/lib-roles.js'
import { parseTarget, formatUserTag } from '../lib/utils.js'

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

      shadowMap.set(jid, {
        expiresAt: item.expiresAt || null,
        actor: item.actor || null,
        createdAt: item.createdAt || null,
        chat: item.chat || null,
        immutable: !!item.immutable,
        timeoutId: null
      })
    }
  } catch (e) {
    console.warn('loadShadowbans error', e)
  }
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
  } catch (e) {
    console.error('saveShadowbans error', e)
  }
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

    try {
      if (entry.chat && conn) {
        await conn.sendMessage(entry.chat, {
          text: `🎉 *Shadowban finalizado*\nUsuario: @${jid.split('@')[0]}`,
          mentions: [jid]
        })
      }
    } catch {}
  }, ms)

  const current = shadowMap.get(jid) || {}
  current.timeoutId = timeoutId
  shadowMap.set(jid, current)
}

function scheduleAllTimeouts() {
  const now = Date.now()
  for (const [jid, v] of shadowMap.entries()) {
    if (v.expiresAt) {
      const ms = v.expiresAt - now
      if (ms <= 0) {
        shadowMap.delete(jid)
      } else {
        scheduleUnshadow(jid, ms, null)
      }
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
   HANDLER PRINCIPAL
============================ */
const handler = async (m, { conn, command }) => {
  const chatCfg = global.db?.data?.chats?.[m.chat] || {}

  try {
    requireCommandAccess(m, 'moderation-plugin', 'shadowban', chatCfg)
  } catch {
    return conn.reply(m.chat, `❌ No tienes permiso para usar este comando.`, m)
  }

  const rawTarget = parseTarget(m, [])
  const target = rawTarget ? normalizeJid(rawTarget) : null
  if (!target) return conn.reply(m.chat, `⚠️ Debes responder o mencionar a un usuario.`, m)

  const display = await formatUserTag(conn, target)

  const targetRoles = getUserRoles(target).map(r => r.toLowerCase())
  const creators = []
  if (Array.isArray(global.owner)) creators.push(...global.owner)
  if (global.ownerJid) creators.push(global.ownerJid)
  if (global.ownerNumber) creators.push(global.ownerNumber)
  const normalizedCreators = creators.map(o => normalizeJid(Array.isArray(o) ? o[0] : o)).filter(Boolean)

  const isCreator =
    normalizedCreators.includes(target) ||
    targetRoles.includes('creador') ||
    targetRoles.includes('owner')

  if (isCreator) {
    const punisher = normalizeJid(m.sender)
    const expiresAt = Date.now() + 5 * 60 * 1000
    shadowMap.set(punisher, {
      expiresAt,
      actor: 'system',
      createdAt: Date.now(),
      chat: m.chat,
      immutable: true,
      timeoutId: null
    })
    saveShadowbans()
    scheduleUnshadow(punisher, expiresAt - Date.now(), conn)
    auditLog(`IMMUTABLE-SHADOW ${punisher} (attempted shadowban creator)`)

    const displayPunisher = await formatUserTag(conn, punisher)
    return conn.reply(m.chat, `💀 Intentaste shadowbanear al creador\nHas sido castigado: ${displayPunisher}`, m, { mentions: [punisher] })
  }

  if (targetRoles.includes('mod') || targetRoles.includes('moderador')) {
    return conn.reply(m.chat, `❌ No puedes shadowbanear a un moderador.`, m)
  }

  const parts = (m.text || '').trim().split(/\s+/)
  const minutes = parseInt(parts[1], 10)
  const isDuration = !isNaN(minutes) && minutes > 0

  if (command === 'shadowban' || command === 'mute') {
    if (shadowMap.has(target)) {
      return conn.reply(m.chat, `⚠️ El usuario ya está shadowbaneado: ${display}`, m, { mentions: [target] })
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
      return conn.reply(m.chat, `✨ Shadowban aplicado\nUsuario: ${display}\nDuración: ${minutes} minutos.`, m, { mentions: [target] })
    } else {
      return conn.reply(m.chat, `🔒 Shadowban permanente aplicado\nUsuario: ${display}`, m, { mentions: [target] })
    }
  }

  if (command === 'unshadowban' || command === 'unmute') {
    const entry = shadowMap.get(target)
    if (!entry) return conn.reply(m.chat, `⚠️ El usuario no está shadowbaneado: ${display}`, m, { mentions: [target] })
    if (entry.immutable) return conn.reply(m.chat, `❌ Este shadowban es inmutable.`, m)

    if (entry.timeoutId) clearTimeout(entry.timeoutId)
    shadowMap.delete(target)
    saveShadowbans()
    auditLog(`UNSHADOW ${target} by ${normalizeJid(m.sender)}`)

    return conn.reply(m.chat, `✅ Shadowban removido\nUsuario: ${display}`, m, { mentions: [target] })
  }
}

/* ============================
   BEFORE: BORRADO AUTOMÁTICO
============================ */
handler.before = async
