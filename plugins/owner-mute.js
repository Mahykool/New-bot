// plugins/owner-mute.js
import fs from 'fs'
import path from 'path'
import { requireCommandAccess } from '../lib/permissions-middleware.js'
import { normalizeJid, getUserRoles, addUserRole, removeUserRole, setUserRole } from '../lib/lib-roles.js'

const DATA_DIR = path.join(process.cwd(), 'data')
const FILE = path.join(DATA_DIR, 'shadowbans.json')

const TITLE = 'ㅤׄㅤׅㅤׄ _*SHADOWBAN*_ ㅤ֢ㅤׄㅤׅ'
const DEFAULT_GTA_THUMB = process.env.GTA_THUMB_1 || 'https://i.imgur.com/ejemploGTA1.jpg'

function ensureDataDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }) } catch {}
}

let shadowMap = new Map()

function loadShadowbansFromDisk() {
  try {
    if (!fs.existsSync(FILE)) return
    const raw = fs.readFileSync(FILE, 'utf8')
    const arr = JSON.parse(raw || '[]')
    if (!Array.isArray(arr)) return
    const now = Date.now()
    for (const item of arr) {
      const jid = item.jid
      const expiresAt = item.expiresAt || null
      const actor = item.actor || null
      const createdAt = item.createdAt || null
      const chat = item.chat || null
      const immutable = !!item.immutable
      if (!jid) continue
      if (expiresAt && expiresAt <= now) continue
      shadowMap.set(jid, { expiresAt, timeoutId: null, actor, createdAt, chat, immutable })
    }
  } catch (e) {
    console.warn('loadShadowbansFromDisk error', e)
  }
}

function saveShadowbansToDisk() {
  try {
    ensureDataDir()
    const arr = Array.from(shadowMap.entries()).map(([jid, v]) => ({
      jid,
      expiresAt: v.expiresAt || null,
      actor: v.actor || null,
      createdAt: v.createdAt || null,
      chat: v.chat || null,
      immutable: !!v.immutable
    }))
    fs.writeFileSync(FILE, JSON.stringify(arr, null, 2), 'utf8')
  } catch (e) {
    console.error('saveShadowbansToDisk error', e)
  }
}

function formatTitle() {
  return `${TITLE}\n`
}

function msgCreatorAttemptPublic() {
  return `${formatTitle()}*En serio intentaste shadowbanear al creador?* 💀\n\nNo lo intentes de nuevo.`
}

function msgCreatorPunishPublic(punisherShort) {
  return `${formatTitle()}✅ CASTIGO APLICADO\n\nHas sido shadowbaneado por intentar shadowbanear al creador.\nDuración: *5 minutos* — *INMUTABLE*\nResponsable: @${punisherShort}`
}

function msgCreatorPunishDM() {
  return `${formatTitle()}ATENCIÓN\n\nHas sido automáticamente shadowbaneado por intentar shadowbanear al creador.\nDuración: 5 minutos (INMUTABLE).`
}

function msgModProtected() {
  return `${formatTitle()}❌ No puedes shadowbanear a un moderador.\n\nSi crees que hay un problema, contacta con el creador.`
}

function msgShadowbanTemp(minutes, targetShort) {
  return `${formatTitle()}✨ SHADOWBAN TEMPORAL\n\nUsuario: @${targetShort}\nDuración: ${minutes} minuto(s)\n\nTe avisaré cuando termine.`
}

function msgShadowbanPerm(targetShort) {
  return `${formatTitle()}🔒 SHADOWBAN PERMANENTE\n\nUsuario: @${targetShort}\nHasta que se ejecute unshadowban.`
}

function msgShadowbanExpired(targetShort) {
  return `${formatTitle()}🎉 SHADOWBAN TERMINADO\n\nEl shadowban temporal de @${targetShort} ha finalizado.`
}

function msgUsage() {
  return `${formatTitle()}USO\n\n1) Shadowban indefinido — Responde y escribe: *shadowban*\n2) Shadowban temporal — Responde y escribe: *shadowban <minutos>* (ej. *shadowban 30*)\n\nComandos: unshadowban, mute, unmute`
}

function scheduleUnshadow(jid, ms, conn = null) {
  const entry = shadowMap.get(jid)
  if (entry && entry.timeoutId) {
    clearTimeout(entry.timeoutId)
  }
  if (!ms || ms <= 0) return
  const timeoutId = setTimeout(async () => {
    try {
      const current = shadowMap.get(jid)
      if (!current) return
      shadowMap.delete(jid)
      saveShadowbansToDisk()
      const chatId = current.chat || null
      const connToUse = conn || global.conn || null
      if (chatId && connToUse && typeof connToUse.sendMessage === 'function') {
        try {
          await connToUse.sendMessage(chatId, { text: msgShadowbanExpired(jid.split('@')[0]) }, { mentions: [jid] })
        } catch (e) {
          console.warn('scheduleUnshadow: fallo al notificar finalización', e)
        }
      }
    } catch (e) {
      console.error('scheduleUnshadow error', e)
    }
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
  saveShadowbansToDisk()
}

loadShadowbansFromDisk()

/* ---------- extracción robusta del target ---------- */
function extractTargetJid(m) {
  try {
    if (m.quoted) {
      const q = m.quoted
      const candidate =
        q.sender ||
        q.participant ||
        q.key?.participant ||
        q.key?.remoteJid ||
        (q.key?.fromMe && (q.key?.participant || q.key?.remoteJid)) ||
        null
      if (candidate) return normalizeJid(candidate)
    }

    if (Array.isArray(m.mentionedJid) && m.mentionedJid.length > 0) {
      return normalizeJid(m.mentionedJid[0])
    }

    const text = (m.text || m.caption || '') + ''
    const match = text.match(/@?(\+?\d{6,15})/g)
    if (match && match.length > 0) {
      const raw = match[0].replace('@', '').replace('+', '')
      return normalizeJid(raw + '@s.whatsapp.net')
    }

    return null
  } catch (e) {
    console.warn('extractTargetJid error', e)
    return null
  }
}

/* ---------- handler principal ---------- */
const handler = async (m, { conn, usedPrefix, command }) => {
  const ctxErr = global.rcanalx || {}
  const ctxWarn = global.rcanalw || {}
  const ctxOk = global.rcanalr || {}

  try {
    requireCommandAccess(m.sender, 'moderation-plugin', 'shadowban')
  } catch (err) {
    return conn.reply(m.chat, `${formatTitle()}\n❌ No tienes permiso para usar este comando.`, m, ctxErr)
  }

  try {
    await conn.reply(m.chat, msgUsage(), m, ctxWarn)
  } catch (e) {}

  const target = extractTargetJid(m)
  if (!target) {
    return conn.reply(m.chat, `${formatTitle()}\n‼️ Responde al mensaje del usuario o menciónalo para aplicar shadowban/unshadowban.`, m, ctxWarn)
  }

  // creators desde globals
  const creators = []
  if (Array.isArray(global.owner)) creators.push(...global.owner)
  else if (global.owner) creators.push(global.owner)
  if (Array.isArray(global.ownerJid)) creators.push(...global.ownerJid)
  else if (global.ownerJid) creators.push(global.ownerJid)
  if (Array.isArray(global.ownerNumber)) creators.push(...global.ownerNumber)
  else if (global.ownerNumber) creators.push(global.ownerNumber)

  const normalizedCreators = creators
    .map(o => {
      if (!o) return null
      if (typeof o === 'string') return normalizeJid(o)
      if (Array.isArray(o) && o[0]) return normalizeJid(o[0])
      return null
    })
    .filter(Boolean)

  // roles usando lib/lib-roles.js
  const targetRoles = getUserRoles(target).map(r => String(r).toLowerCase())
  const punisherRoles = getUserRoles(normalizeJid(m.sender)).map(r => String(r).toLowerCase())

  const isTargetCreatorByRole = targetRoles.some(r => ['creador','creator','owner'].includes(r))
  const isTargetModByRole = targetRoles.some(r => ['mod','moderator','moderador'].includes(r))

  const allBots = Array.isArray(global.allBots) ? global.allBots.slice() : (Array.isArray(global.botNumbers) ? global.botNumbers.slice() : [])
  const normalizedAllBots = allBots.map(normalizeJid).filter(Boolean)

  // protección creator (globals o rol)
  const isCreatorTarget = normalizedCreators.includes(target) || isTargetCreatorByRole
  if (isCreatorTarget) {
    try { await conn.reply(m.chat, msgCreatorAttemptPublic(), m, ctxErr) } catch {}

    const punisher = normalizeJid(m.sender)

    // si el creador se intenta a sí mismo: solo aviso, no castigo
    if (punisher === target) {
      try {
        if (typeof conn.sendMessage === 'function') {
          await conn.sendMessage(punisher, { text: msgCreatorAttemptPublic() })
        }
      } catch (e) {}
      return
    }

    // aplicar castigo inmutable 5 minutos al punisher
    if (shadowMap.has(punisher)) {
      const existing = shadowMap.get(punisher)
      if (existing.immutable) {
        return conn.reply(m.chat, `${formatTitle()}\n⚠️ Ya estás bajo un castigo inmutable. Espera a que termine.`, m, ctxErr)
      } else {
        const expiresAt = Date.now() + 5 * 60 * 1000
        shadowMap.set(punisher, { expiresAt, timeoutId: null, actor: 'system', createdAt: Date.now(), chat: m.chat, immutable: true })
        saveShadowbansToDisk()
        scheduleUnshadow(punisher, expiresAt - Date.now(), conn)
        try { await conn.reply(m.chat, msgCreatorPunishPublic(punisher.split('@')[0]), m, { mentions: [punisher] }, ctxOk) } catch {}
        try { if (typeof conn.sendMessage === 'function') await conn.sendMessage(punisher, { text: msgCreatorPunishDM() }, { mentions: [punisher] }) } catch {}
        return
      }
    } else {
      const expiresAt = Date.now() + 5 * 60 * 1000
      shadowMap.set(punisher, { expiresAt, timeoutId: null, actor: 'system', createdAt: Date.now(), chat: m.chat, immutable: true })
      saveShadowbansToDisk()
      scheduleUnshadow(punisher, expiresAt - Date.now(), conn)
      try { await conn.reply(m.chat, msgCreatorPunishPublic(punisher.split('@')[0]), m, { mentions: [punisher] }, ctxOk) } catch {}
      try { if (typeof conn.sendMessage === 'function') await conn.sendMessage(punisher, { text: msgCreatorPunishDM() }, { mentions: [punisher] }) } catch {}
      return
    }
  }

  // protección por rol de moderador
  if (isTargetModByRole) {
    try { await conn.reply(m.chat, msgModProtected(), m, ctxErr) } catch {}
    return
  }

  // prevención de shadowban a bots del sistema
  const botJidRaw = conn.user?.id || conn.user?.jid || null
  const botJid = botJidRaw ? normalizeJid(botJidRaw) : null
  const isSystemBot = (target === botJid) || normalizedAllBots.includes(target)
  if (isSystemBot) {
    return conn.reply(m.chat, `${formatTitle()}\n🤖 No puedes shadowbanear a los bots del sistema. Contacta al creador si hay un problema.`, m, ctxErr)
  }

  // evitar shadowbanear administradores detectados por metadata
  try {
    const meta = typeof conn.groupMetadata === 'function' ? await conn.groupMetadata(m.chat) : null
    if (meta && Array.isArray(meta.participants)) {
      const p = meta.participants.find(x => {
        const pid = normalizeJid(x.id || x.jid || x.participant)
        return pid === target
      })
      if (p && (p.admin || p.isAdmin || p.role === 'admin')) {
        return conn.reply(m.chat, `${formatTitle()}\n❌ No puedes shadowbanear a un administrador.`, m, ctxErr)
      }
    }
  } catch (e) {}

  // parsear duración y ejecutar shadowban/unshadowban
  const text = (m.text || '').trim()
  const parts = text.split(/\s+/).filter(Boolean)
  const durationArg = parts[1] || ''
  const minutes = parseInt(durationArg, 10)
  const isDuration = !isNaN(minutes) && minutes > 0

  if (command === 'shadowban' || command === 'mute') {
    if (shadowMap.has(target)) {
      return conn.reply(m.chat, `${formatTitle()}\n⚠️ El usuario ya está shadowbaneado: @${target.split('@')[0]}`, m, { mentions: [target] }, ctxWarn)
    }

    let expiresAt = null
    if (isDuration) expiresAt = Date.now() + minutes * 60 * 1000

    const actor = normalizeJid(m.sender) || null
    const createdAt = Date.now()
    shadowMap.set(target, { expiresAt, timeoutId: null, actor, createdAt, chat: m.chat, immutable: false })
    saveShadowbansToDisk()

    let botIsAdmin = false
    try {
      const meta = typeof conn.groupMetadata === 'function' ? await conn.groupMetadata(m.chat) : null
      if (meta && Array.isArray(meta.participants)) {
        const me = meta.participants.find(x => normalizeJid(x.id || x.jid || x.participant) === botJid)
        botIsAdmin = !!(me && (me.admin || me.isAdmin || me.role === 'admin'))
      }
    } catch (e) {}

    if (!botIsAdmin) {
      try {
        await conn.reply(m.chat, `${formatTitle()}\n⚠️ Nota: el bot no es administrador en este grupo. El borrado automático de mensajes no funcionará hasta que el bot sea admin.`, m, ctxWarn)
      } catch (e) {}
    }

    if (isDuration) {
      scheduleUnshadow(target, expiresAt - Date.now(), conn)
      try { await conn.reply(m.chat, msgShadowbanTemp(minutes, target.split('@')[0]), m, { mentions: [target] }, ctxOk) } catch { await conn.reply(m.chat, `${formatTitle()}\n✅ Usuario shadowbaneado por ${minutes} minutos: @${target.split('@')[0]}`, m, { mentions: [target] }, ctxOk) }
      return
    } else {
      try { await conn.reply(m.chat, msgShadowbanPerm(target.split('@')[0]), m, { mentions: [target] }, ctxOk) } catch { await conn.reply(m.chat, `${formatTitle()}\n✅ Usuario shadowbaneado permanentemente: @${target.split('@')[0]}`, m, { mentions: [target] }, ctxOk) }
      return
    }
  } else if (command === 'unshadowban' || command === 'unmute') {
    if (!shadowMap.has(target)) {
      return conn.reply(m.chat, `${formatTitle()}\n⚠️ El usuario no está shadowbaneado: @${target.split('@')[0]}`, m, { mentions: [target] }, ctxWarn)
    }
    const entry = shadowMap.get(target)
    if (entry && entry.immutable) {
      return conn.reply(m.chat, `${formatTitle()}\n❌ No puedes quitar este shadowban manualmente. Es un castigo inmutable.`, m, ctxErr)
    }
    if (entry && entry.timeoutId) clearTimeout(entry.timeoutId)
    shadowMap.delete(target)
    saveShadowbansToDisk()
    return conn.reply(m.chat, `${formatTitle()}\n✅ Usuario des-shadowbaneado: @${target.split('@')[0]}`, m, { mentions: [target] }, ctxOk)
  }
}

/* ---------- before: borrar mensajes de shadowbaneados ---------- */
handler.before = async (m, { conn }) => {
  try {
    if (!m || !m.sender) return
    if (!handler._scheduled) {
      scheduleAllTimeouts()
      handler._scheduled = true
    }
    const sender = normalizeJid(m.sender)
    if (!shadowMap.has(sender)) return
    if (m.mtype === 'stickerMessage') return

    try {
      if (typeof conn.sendMessage === 'function') {
        await conn.sendMessage(m.chat, { delete: m.key })
      }
    } catch (e) {}
  } catch (e) {
    console.error('shadowban before error', e)
  }
}

handler.help = ['shadowban']
handler.tags = ['modmenu']
handler.command = ['shadowban', 'unshadowban', 'mute', 'unmute']
handler.group = true
handler.botAdmin = false

export default handler
