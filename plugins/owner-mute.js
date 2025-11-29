// plugins/owner-mute.js
import fs from 'fs'
import path from 'path'
import { requireCommandAccess } from '../lib/permissions-middleware.js'
import { normalizeJid } from '../lib/lib-roles.js'

const DATA_DIR = path.join(process.cwd(), 'data')
const FILE = path.join(DATA_DIR, 'shadowbans.json')

const TITLE = 'ㅤׄㅤׅㅤׄ _*SHADOWBAN*_ ㅤ֢ㅤׄㅤׅ'
const GTA_THUMB_1 = process.env.GTA_THUMB_1 || 'https://i.imgur.com/ejemploGTA1.jpg'
const GTA_THUMB_2 = process.env.GTA_THUMB_2 || 'https://i.imgur.com/ejemploGTA2.jpg'
const DEFAULT_GTA_THUMB = GTA_THUMB_1

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
  return `${formatTitle()}
*En serio intentaste shadowbanear al creador?* 💀

No lo intentes de nuevo.`
}

function msgCreatorPunishPublic(punisherShort) {
  return `${formatTitle()}
✅ CASTIGO APLICADO

Has sido shadowbaneado por intentar shadowbanear al creador.
Duración: *5 minutos* — *INMUTABLE*
Responsable: @${punisherShort}`
}

function msgCreatorPunishDM() {
  return `${formatTitle()}
ATENCIÓN

Has sido automáticamente shadowbaneado por intentar shadowbanear al creador.
Duración: 5 minutos (temporal)
Estado: INMUTABLE — no puede retirarse manualmente.`
}

function msgShadowbanTemp(minutes, targetShort) {
  return `${formatTitle()}
✨ SHADOWBAN TEMPORAL

Usuario: @${targetShort}
Duración: ${minutes} minuto(s)

Te avisaré cuando termine.`
}

function msgShadowbanPerm(targetShort) {
  return `${formatTitle()}
🔒 SHADOWBAN PERMANENTE

Usuario: @${targetShort}
Hasta que se ejecute unshadowban.`
}

function msgShadowbanExpired(targetShort) {
  return `${formatTitle()}
🎉 SHADOWBAN TERMINADO

El shadowban temporal de @${targetShort} ha finalizado.`
}

function msgUsage() {
  return `${formatTitle()}
USO

1) Shadowban indefinido — Responde y escribe: *shadowban*
2) Shadowban temporal — Responde y escribe: *shadowban <minutos>* (ej. *shadowban 30*)

Comandos: unshadowban, mute, unmute`
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

const handler = async (m, { conn, usedPrefix, command }) => {
  const ctxErr = global.rcanalx || {}
  const ctxWarn = global.rcanalw || {}
  const ctxOk = global.rcanalr || {}

  // 1) Permisos por roles: si no tiene permiso, se deniega
  try {
    requireCommandAccess(m.sender, 'moderation-plugin', 'shadowban')
  } catch (err) {
    return conn.reply(m.chat, `${formatTitle()}\n❌ No tienes permiso para usar este comando.`, m, ctxErr)
  }

  // 2) Mostrar uso (opcional)
  try {
    await conn.reply(m.chat, msgUsage(), m, ctxWarn)
  } catch (e) {
    // ignore
  }

  // 3) Debe responder a un mensaje objetivo
  if (!m.quoted) {
    return conn.reply(m.chat, `${formatTitle()}\n‼️ Responde al mensaje del usuario que quieres shadowbanear/unshadowbanear.`, m, ctxWarn)
  }
  const rawTarget = m.quoted.sender
  const target = normalizeJid(rawTarget)

  // 4) Construir lista de creators normalizados
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

  // 5) Lista de bots del sistema normalizada
  const allBots = Array.isArray(global.allBots) ? global.allBots.slice() : (Array.isArray(global.botNumbers) ? global.botNumbers.slice() : [])
  const normalizedAllBots = allBots.map(normalizeJid).filter(Boolean)

  // 6) Si intentan shadowbanear al creador -> castigo automático
  if (normalizedCreators.includes(target)) {
    try { await conn.reply(m.chat, msgCreatorAttemptPublic(), m, ctxErr) } catch {}
    const punisher = normalizeJid(m.sender)
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

  // 7) No permitir shadowban a bots del sistema
  const botJidRaw = conn.user?.id || conn.user?.jid || null
  const botJid = botJidRaw ? normalizeJid(botJidRaw) : null
  const isSystemBot = (target === botJid) || normalizedAllBots.includes(target)
  if (isSystemBot) {
    return conn.reply(m.chat, `${formatTitle()}\n🤖 No puedes shadowbanear a los bots del sistema. Contacta al creador si hay un problema.`, m, ctxErr)
  }

  // 8) Intento de evitar shadowbanear administradores: comprobación con metadata usando JIDs normalizados
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
  } catch (e) {
    // ignoramos errores de metadata
  }

  // 9) Parsear duración
  const text = (m.text || '').trim()
  const parts = text.split(/\s+/).filter(Boolean)
  const durationArg = parts[1] || ''
  const minutes = parseInt(durationArg, 10)
  const isDuration = !isNaN(minutes) && minutes > 0

  // 10) Ejecutar acción
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

    // Si el bot no es admin, avisar que el borrado automático no funcionará
    let botIsAdmin = false
    try {
      const meta = typeof conn.groupMetadata === 'function' ? await conn.groupMetadata(m.chat) : null
      if (meta && Array.isArray(meta.participants)) {
        const me = meta.participants.find(x => normalizeJid(x.id || x.jid || x.participant) === botJid)
        botIsAdmin = !!(me && (me.admin || me.isAdmin || me.role === 'admin'))
      }
    } catch (e) {
      // ignore
    }

    if (!botIsAdmin) {
      // advertencia visible pero no bloqueante
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
      return conn.reply(m.chat, `${formatTitle()}\n❌ No puedes quitar este shadowban manualmente. Es un castigo temporal inmutable.`, m, ctxErr)
    }
    if (entry && entry.timeoutId) clearTimeout(entry.timeoutId)
    shadowMap.delete(target)
    saveShadowbansToDisk()
    return conn.reply(m.chat, `${formatTitle()}\n✅ Usuario des-shadowbaneado: @${target.split('@')[0]}`, m, { mentions: [target] }, ctxOk)
  }
}

// before: eliminar mensajes de shadowbaneados (si el bot es admin lo intentará; si no, no falla)
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

    // Intentar borrar el mensaje; si falla (no admin), lo ignoramos
    try {
      if (typeof conn.sendMessage === 'function') {
        await conn.sendMessage(m.chat, { delete: m.key })
      }
    } catch (e) {
      // ignorar fallo de borrado
    }
  } catch (e) {
    console.error('shadowban before error', e)
  }
}

handler.help = ['shadowban']
handler.tags = ['modmenu']
handler.command = ['shadowban', 'unshadowban', 'mute', 'unmute']
handler.group = true
// No forzamos que el bot sea admin; permitimos ejecución basada en roles
handler.botAdmin = false

export default handler
