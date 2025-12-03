// plugins/group-kick.js — Versión FINAL robusta
import fs from 'fs'
import path from 'path'
import { requireCommandAccess } from '../lib/permissions-middleware.js'
import { normalizeJid, getUserRoles } from '../lib/lib-roles.js'
import { formatUserTag, resolveAliasToJid, ensureJid } from '../lib/utils.js'

/* ============================
   CONFIG
============================ */
const DATA_DIR = path.join(process.cwd(), 'data')
const FILE = path.join(DATA_DIR, 'kicks.json')
const AUDIT_LOG = path.join(DATA_DIR, 'kicks-audit.log')

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
let pendingConfirmations = new Map()

function savePending() {
  try {
    ensureDataDir()
    const arr = [...pendingConfirmations.entries()].map(([chat, jid]) => ({ chat, jid }))
    fs.writeFileSync(FILE, JSON.stringify(arr, null, 2), 'utf8')
  } catch (e) {
    console.error('savePending error', e)
  }
}

function loadPending() {
  try {
    if (!fs.existsSync(FILE)) return
    const raw = fs.readFileSync(FILE, 'utf8') || '[]'
    const arr = JSON.parse(raw)
    for (const item of arr) {
      if (item.chat && item.jid) {
        pendingConfirmations.set(item.chat, normalizeJid(item.jid))
      }
    }
  } catch (e) {
    console.warn('loadPending error', e)
  }
}

/* ============================
   HANDLER PRINCIPAL
============================ */
const handler = async (m, { conn, command }) => {
  const chatCfg = global.db?.data?.chats?.[m.chat] || {}

  // Permisos
  try {
    requireCommandAccess(m, 'moderation-plugin', 'kick', chatCfg)
  } catch {
    return conn.reply(m.chat, `❌ No tienes permiso para usar este comando.`, m)
  }

  const actor = normalizeJid(m.sender)
  const actorRoles = getUserRoles(actor).map(r => r.toLowerCase())
  const actorIsCreator = actorRoles.includes('creador') || actorRoles.includes('owner')

  // Confirmación
  if ((m.text || '').trim().toLowerCase() === 'confirmar') {
    const target = pendingConfirmations.get(m.chat)
    if (!target) {
      return conn.reply(m.chat, `⚠️ No hay acción pendiente. Usa *kick @usuario* primero.`, m)
    }

    const display = await formatUserTag(conn, target)

    // Shadowban 15m en vez de expulsar
    const shadowPlugin = Object.values(global.plugins).find(p =>
      p.command?.includes?.('shadowban')
    )
    if (shadowPlugin?.default) {
      const fake = {
        ...m,
        text: `.shadowban @${target.split('@')[0]} 15`,
        sender: m.sender,
        chat: m.chat,
        isCommand: true
      }
      const extra = { conn, args: [target, 15], usedPrefix: '.', command: 'shadowban' }
      await shadowPlugin.default.call(conn, fake, extra)
    }

    auditLog(`TEMP-SHADOW ${target} by ${actor} duration=15m`)
    pendingConfirmations.delete(m.chat)
    savePending()

    return conn.reply(m.chat, `⚠️ ${display} recibió un shadowban de 15 minutos en vez de ser expulsado.`, m, { mentions: [target] })
  }

  // Resolver target inicial con prioridad: respuesta → mención → alias → número
  const parts = (m.text || '').trim().split(/\s+/)
  const args = parts.slice(1)

  let rawTarget = null

  // 1) Respuesta
  if (m.quoted?.sender) {
    rawTarget = normalizeJid(m.quoted.sender)
  }

  // 2) Mención real
  if (!rawTarget) {
    const mentioned = []
    if (Array.isArray(m.mentionedJid)) mentioned.push(...m.mentionedJid)
    const ctx = m.message?.extendedTextMessage?.contextInfo || m.msg?.contextInfo || m.message?.contextInfo
    if (Array.isArray(ctx?.mentionedJid)) mentioned.push(...ctx.mentionedJid)
    if (mentioned.length > 0) rawTarget = normalizeJid(mentioned[0])
  }

  // 3) Alias explícito (multi-palabra)
  if (!rawTarget && args.length > 0) {
    const aliasJid = await resolveAliasToJid(conn, m, args.join(' '))
    if (aliasJid) rawTarget = normalizeJid(aliasJid)
  }

  // 4) Número limpio
  if (!rawTarget && args.length > 0) {
    const ensured = ensureJid(args.join(' '))
    if (ensured) rawTarget = normalizeJid(ensured)
  }

  const user = rawTarget || null
  if (!user) {
    return conn.reply(m.chat, `⚠️ Debes responder, mencionar o usar un alias/número válido.`, m)
  }

  const display = await formatUserTag(conn, user)

  // Protecciones absolutas
  if (user === normalizeJid(conn.user?.id)) {
    return conn.reply(m.chat, `🤖 No puedo expulsarme a mí mismo.`, m)
  }

  const targetRoles = getUserRoles(user).map(r => r.toLowerCase())
  const creators = []
  if (Array.isArray(global.owner)) creators.push(...global.owner)
  if (global.ownerJid) creators.push(global.ownerJid)
  if (global.ownerNumber) creators.push(global.ownerNumber)
  const normalizedCreators = creators.map(o => normalizeJid(Array.isArray(o) ? o[0] : o)).filter(Boolean)

  const isTargetCreator =
    normalizedCreators.includes(user) ||
    targetRoles.includes('creador') ||
    targetRoles.includes('owner')

  if (isTargetCreator) {
    return conn.reply(m.chat, `💀 No puedes expulsar al creador.`, m)
  }

  // Roles protegidos → solo creador puede, con confirmación
  const protectedRoles = ['mod', 'moderador', 'moderator', 'admin', 'staff']
  const isProtected = targetRoles.some(r => protectedRoles.includes(r)) || user === normalizeJid(conn.user?.id)

  if (isProtected) {
    if (!actorIsCreator) {
      return conn.reply(m.chat, `❌ No tienes permiso para expulsar a un rol protegido.`, m)
    }
    pendingConfirmations.set(m.chat, user)
    savePending()
    return conn.reply(m.chat, `⚠️ Estás a punto de aplicar shadowban 15m a ${display} (rol protegido).\n\nEscribe *confirmar* para proceder.`, m, { mentions: [user] })
  }

  // Expulsión directa para usuarios normales
  try {
    await conn.groupParticipantsUpdate(m.chat, [user], 'remove')
    await conn.sendMessage(m.chat, { text: `⛔️ ${display} ha sido expulsado del grupo.`, mentions: [user] }, { quoted: m })

    auditLog(`KICK ${user} by ${actor}`)
  } catch (e) {
    return conn.reply(m.chat, `⚠️ Error al expulsar.\n${e?.message || e}`, m)
  }
}

/* ============================
   PROPS DEL HANDLER
============================ */
handler.help = ['ban']
handler.tags = ['modmenu']
handler.command = ['kick', 'echar', 'sacar', 'ban']
handler.group = true
handler.botAdmin = true
handler.admin = false
handler.description = 'Banear a usuario'


// Inicializar persistencia al cargar el plugin
loadPending()

export default handler
