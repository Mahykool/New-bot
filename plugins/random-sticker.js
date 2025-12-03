// plugins/random-sticker.js
// Envía stickers aleatorios desde ./stickers (webp|png|jpg|jpeg) o desde una lista de URLs en config.json
// Reparado: evita conflicto de flags (group/private) y mejora mensajes/fallbacks

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

let fetchFn = globalThis.fetch || null
if (!fetchFn) {
  try {
    fetchFn = (await import('node-fetch')).default
  } catch (e) {
    fetchFn = null
  }
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const STICKERS_DIR = path.join(process.cwd(), 'stickers')
const CONFIG_PATH = path.join(process.cwd(), 'config.json')

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

function pickRandom(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null
  return arr[Math.floor(Math.random() * arr.length)]
}

async function fetchToBuffer(url) {
  if (!fetchFn) throw new Error('No hay fetch disponible en este entorno')
  try {
    const res = await fetchFn(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buf = await res.arrayBuffer()
    return Buffer.from(buf)
  } catch (e) {
    throw new Error(`fetchToBuffer failed: ${e?.message || e}`)
  }
}

function isWebpBuffer(buf) {
  if (!buf || !Buffer.isBuffer(buf)) return false
  return buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP'
}

const handler = async (m, { conn }) => {
  try {
    const local = listLocalStickers()
    const remote = loadStickerUrls()

    if ((local.length === 0) && (remote.length === 0)) {
      const msg = `⚠️ No hay stickers disponibles.\n\nColoca archivos .webp/.png/.jpg/.jpeg en la carpeta:\n${STICKERS_DIR}\n\nO añade un arreglo "stickerUrls" en config.json (raíz del proyecto).`
      return conn.reply ? conn.reply(m.chat, msg, m) : null
    }

    let chosenBuffer = null
    let chosenFilePath = null
    const useLocal = Math.random() < 0.8 && local.length > 0
    if (useLocal && local.length > 0) {
      const file = pickRandom(local)
      try {
        chosenBuffer = fs.readFileSync(file)
        chosenFilePath = file
      } catch (e) {
        console.warn('random-sticker: failed read local file', file, e?.message || e)
        chosenBuffer = null
        chosenFilePath = null
      }
    }

    if (!chosenBuffer && remote.length > 0) {
      const url = pickRandom(remote)
      try {
        chosenBuffer = await fetchToBuffer(url)
        chosenFilePath = null
      } catch (e) {
        console.warn('random-sticker: failed fetch remote', e?.message || e)
        chosenBuffer = null
        chosenFilePath = null
      }
    }

    if (!chosenBuffer && local.length > 0) {
      for (const file of local) {
        try {
          const buf = fs.readFileSync(file)
          if (buf && buf.length) {
            chosenBuffer = buf
            chosenFilePath = file
            break
          }
        } catch (e) {
          console.warn('random-sticker: fallback read failed', file, e?.message || e)
        }
      }
    }

    if (!chosenBuffer) {
      return conn.reply
        ? conn.reply(m.chat, `⚠️ No pude obtener un sticker en este momento. Revisa la carpeta ${STICKERS_DIR} o las URLs en config.json.`, m)
        : null
    }

    // Intentar enviar como sticker; si falla, enviar como imagen con caption
    try {
      // Si es webp, enviar como sticker es lo ideal
      if (isWebpBuffer(chosenBuffer)) {
        await conn.sendMessage(m.chat, { sticker: chosenBuffer }, { quoted: m })
        return null
      }

      // Intentar enviar como sticker aunque no sea webp (algunas libs convierten)
      try {
        await conn.sendMessage(m.chat, { sticker: chosenBuffer }, { quoted: m })
        return null
      } catch (e) {
        // Fallback: enviar como imagen con caption
        try {
          await conn.sendMessage(m.chat, { image: chosenBuffer, caption: 'Sticker' }, { quoted: m })
          return null
        } catch (e2) {
          console.error('random-sticker: fallback send failed', e2)
          return conn.reply ? conn.reply(m.chat, `❌ Error al enviar sticker: ${e2?.message || e2}`, m) : null
        }
      }
    } catch (e) {
      console.warn('random-sticker: sendMessage sticker failed, intentando fallback', e?.message || e)
      try {
        await conn.sendMessage(m.chat, { image: chosenBuffer, caption: 'Sticker' }, { quoted: m })
        return null
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
handler.description = 'Un stickers randoms entre los miles'


export default handler
