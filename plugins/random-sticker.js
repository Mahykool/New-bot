// plugins/random-sticker.js
// Envía stickers aleatorios desde ./stickers (webp) o desde una lista de URLs en config.json

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import fetch from 'node-fetch' // si no está disponible, reemplaza por global fetch en Node 18+

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const STICKERS_DIR = path.join(process.cwd(), 'stickers')
const CONFIG_PATH = path.join(process.cwd(), 'config.json')

// Helper: leer lista de stickers locales
function listLocalStickers() {
  try {
    if (!fs.existsSync(STICKERS_DIR)) return []
    return fs.readdirSync(STICKERS_DIR)
      .filter(f => /\.(webp|png|jpg|jpeg)$/i.test(f))
      .map(f => path.join(STICKERS_DIR, f))
  } catch (e) {
    console.warn('random-sticker: error listing stickers', e?.message || e)
    return []
  }
}

// Helper: leer stickerUrls desde config.json (opcional)
function loadStickerUrls() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return []
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8') || '{}'
    const cfg = JSON.parse(raw)
    return Array.isArray(cfg.stickerUrls) ? cfg.stickerUrls.slice() : []
  } catch (e) {
    console.warn('random-sticker: error reading config.json', e?.message || e)
    return []
  }
}

// Helper: elegir elemento aleatorio
function pickRandom(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null
  return arr[Math.floor(Math.random() * arr.length)]
}

// Helper: descargar URL a Buffer
async function fetchToBuffer(url) {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buf = await res.arrayBuffer()
    return Buffer.from(buf)
  } catch (e) {
    throw new Error(`fetchToBuffer failed: ${e?.message || e}`)
  }
}

const handler = async (m, { conn, command, usedPrefix = '/' }) => {
  try {
    // 1) Recolectar fuentes
    const local = listLocalStickers()
    const remote = loadStickerUrls()
    if (local.length === 0 && remote.length === 0) {
      return conn.reply
        ? conn.reply(m.chat, `⚠️ No hay stickers disponibles. Coloca archivos .webp en la carpeta "stickers" o añade "stickerUrls" en config.json.`, m)
        : null
    }

    // 2) Elegir fuente (prioriza local)
    let chosenBuffer = null
    const useLocal = Math.random() < 0.8 && local.length > 0 // 80% local si hay
    if (useLocal && local.length > 0) {
      const file = pickRandom(local)
      try {
        chosenBuffer = fs.readFileSync(file)
      } catch (e) {
        console.warn('random-sticker: failed read local file', file, e?.message || e)
        chosenBuffer = null
      }
    }

    // 3) Si no hay buffer local, intentar remoto
    if (!chosenBuffer && remote.length > 0) {
      const url = pickRandom(remote)
      try {
        chosenBuffer = await fetchToBuffer(url)
      } catch (e) {
        console.warn('random-sticker: failed fetch remote', e?.message || e)
        chosenBuffer = null
      }
    }

    // 4) Si aún no hay sticker, fallback
    if (!chosenBuffer) {
      return conn.reply
        ? conn.reply(m.chat, `⚠️ No pude obtener un sticker en este momento. Intenta de nuevo más tarde.`, m)
        : null
    }

    // 5) Enviar sticker
    // Si tienes utils/queue y retry, reemplaza la llamada por enqueueSend(() => sendWithRetry(conn, m.chat, { sticker: chosenBuffer }, { quoted: m }))
    try {
      await conn.sendMessage(m.chat, { sticker: chosenBuffer }, { quoted: m })
    } catch (e) {
      console.error('random-sticker: sendMessage failed', e)
      // fallback: intentar enviar como imagen si el cliente no acepta sticker buffer
      try {
        await conn.sendMessage(m.chat, { image: chosenBuffer, caption: 'Sticker' }, { quoted: m })
      } catch (e2) {
        console.error('random-sticker: fallback send failed', e2)
        return conn.reply ? conn.reply(m.chat, `❌ Error al enviar sticker: ${e2?.message || e2}`, m) : null
      }
    }
  } catch (err) {
    console.error('random-sticker handler error', err)
    return conn.reply ? conn.reply(m.chat, `❌ Error interno: ${err?.message || err}`, m) : null
  }
}

handler.help = ['randomsticker']
handler.tags = ['multimedia']
handler.command = ['rsticker', 'randsticker', 'randomsticker']
handler.group = false
handler.private = true

export default handler
