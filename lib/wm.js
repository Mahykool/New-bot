// plugins/wm.js
// Robo de stickers con sistema RESPECT (integrado con permisos y roles)

import { fileURLToPath } from 'url'
import path from 'path'
import { addExif } from '../lib/sticker.js'
import {
  loadRespectDB,
  saveRespectDB,
  ensureUserEntry,
  auditLog
} from '../lib/db-respect.js'
import { requireCommandAccess } from '../lib/permissions-middleware.js'
import { normalizeJid, getUserRoles } from '../lib/lib-roles.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const WINDOW_MS = 5 * 60 * 1000
const MAX_ROBOS_WINDOW = 3
const RESPECT_PER_ROB = 5

function sanitizeMeta(s = '') {
  return String(s || '').slice(0, 64).replace(/[\u0000-\u001F\u007F<>:"/\\|?*]/g, '').trim()
}

async function downloadQuoted(quoted, conn) {
  if (!quoted) throw new Error('No hay mensaje citado')
  const methods = [
    async q => (typeof q.download === 'function') ? await q.download() : null,
    async q => (typeof conn.downloadM === 'function') ? await conn.downloadM(q) : null,
    async q => (typeof conn.download === 'function') ? await conn.download(q) : null
  ]
  for (const fn of methods) {
    try {
      const buf = await fn(quoted)
      if (buf && Buffer.isBuffer(buf)) return buf
    } catch (e) {
      console.warn('wm: método de descarga falló', e?.message || e)
    }
  }
  throw new Error('No se pudo descargar el sticker con los métodos disponibles')
}

const userLocks = new Set()

const handler = async (m, { conn, text }) => {
  const ctxErr = global.rcanalx || {}
  const ctxOk = global.rcanalr || {}

  // Validación de permisos para usar WM (opcional, si quieres restringir)
  try {
    const chatCfg = global.db?.data?.chats?.[m.chat] || {}
    requireCommandAccess(m, 'wm', 'wm', chatCfg)
  } catch (e) {
    try { const fail = global.dfail; if (fail) fail('access', m, conn) } catch {}
    return
  }

  if (!m.quoted) {
    return conn.reply
      ? conn.reply(m.chat,
        `✦ Comando WM — SW SYSTEM\n\nResponde a un sticker y usa: *.wm pack|autor*\nEjemplo: *.wm SW SYSTEM|Mahykol*\n\nSi no pones pack/autor, el sticker se roba igual.\nEstilo GTA SA: +5 RESPECT`,
        m, ctxErr)
      : null
  }

  const mime = (m.quoted && (m.quoted.mimetype || m.quoted.mediaType)) || ''
  if (!/webp/i.test(mime)) {
    return conn.reply ? conn.reply(m.chat, '> Responde a un *Sticker* (formato webp).', m, ctxErr) : null
  }

  let packname = ''
  let author = ''
  if (text && text.trim()) {
    const parts = text.split('|').map(p => p.trim())
    packname = sanitizeMeta(parts[0] || '')
    author = sanitizeMeta(parts.slice(1).join('|') || '')
  }

  const userRaw = m.sender
  const user = normalizeJid(userRaw)
  if (!user) return conn.reply ? conn.reply(m.chat, '> No se pudo identificar al usuario.', m, ctxErr) : null

  if (userLocks.has(user)) {
    return conn.reply ? conn.reply(m.chat, 'Espera un momento antes de robar otro sticker.', m, ctxErr) : null
  }
  userLocks.add(user)

  try {
    let imgBuffer = null
    try {
      imgBuffer = await downloadQuoted(m.quoted, conn)
    } catch (e) {
      console.error('wm: descarga fallida', e)
      return conn.reply ? conn.reply(m.chat, '> No pude descargar el sticker citado.', m, ctxErr) : null
    }

    if (!imgBuffer || !Buffer.isBuffer(imgBuffer)) {
      return conn.reply ? conn.reply(m.chat, '> El sticker descargado no es válido.', m, ctxErr) : null
    }

    let stickerBuffer = null
    try {
      stickerBuffer = await addExif(imgBuffer, packname || '', author || '')
      if (!stickerBuffer || !Buffer.isBuffer(stickerBuffer)) {
        throw new Error('addExif no devolvió Buffer válido')
      }
    } catch (e) {
      console.error('wm: addExif falló', e)
      return conn.reply ? conn.reply(m.chat, '> Error al procesar el sticker.', m, ctxErr) : null
    }

    const db = loadRespectDB()
    ensureUserEntry(db, user)
    const now = Date.now()
    const data = db[user]

    if (data.robCount === 0 || (data.robCount >= MAX_ROBOS_WINDOW && now - data.windowStart >= WINDOW_MS)) {
      data.robCount = 0
      data.windowStart = now
      data.punishLevel = 0
    }

    data.robCount = (data.robCount || 0) + 1
    data.totalRobs = (data.totalRobs || 0) + 1

    if (data.robCount <= MAX_ROBOS_WINDOW) {
      data.respect = (data.respect || 0) + RESPECT_PER_ROB
    } else {
      data.punishLevel = (data.punishLevel || 0) + 1
      const penalty = 5 * Math.pow(2, data.punishLevel - 1)
      data.respect = Math.max(0, (data.respect || 0) - penalty)
    }

    await saveRespectDB(db)
    auditLog(`user=${user} pack="${packname}" author="${author}" robCount=${data.robCount} totalRobs=${data.totalRobs} respect=${data.respect}`)

    const robosDisponibles = Math.max(0, MAX_ROBOS_WINDOW - data.robCount)

    try {
      await conn.sendMessage(m.chat, { sticker: stickerBuffer }, { quoted: m })
    } catch (err) {
      console.warn('wm: envío sticker falló, intentando fallback', err?.message || err)
      try {
        if (typeof conn.sendFile === 'function') {
          await conn.sendFile(m.chat, stickerBuffer, 'sticker.webp', '', m)
        } else {
          await conn.sendMessage(m.chat, { image: stickerBuffer, caption: 'Sticker' }, { quoted: m })
        }
      } catch (err2) {
        console.error('wm: fallback envío falló', err2)
        return conn.reply ? conn.reply(m.chat, '> Ocurrió un error al enviar el sticker.', m, ctxErr) : null
      }
    }

    try {
      await conn.reply(
        m.chat,
        `✦ Sticker robado exitosamente\n✦ RESPECT: *${data.respect}*\n✦ Robos disponibles: *${robosDisponibles}*\n✦ Robos realizados: *${data.totalRobs}*`,
        m,
        ctxOk
      )
    } catch (e) {
      console.warn('wm: reply final falló', e?.message || e)
    }

    return
  } finally {
    userLocks.delete(user)
  }
}

handler.help = ['robar']
handler.tags = ['tools']
handler.command = ['take', 'robar', 'wm', 'sticker']
handler.group = true
handler.description = 'Vuelvete un gangstar *robando* stickers y gana + RESPECT'


export default handler
