// plugins/wm.js
import fs from 'fs'
import { addExif } from '../lib/sticker.js'

// ✅ Ruta del archivo donde se guardará el RESPECT
const pathRespect = './database/respect.json'

// ✅ Crear archivo si no existe
if (!fs.existsSync(pathRespect)) {
  fs.writeFileSync(pathRespect, JSON.stringify({}))
}

// ✅ Cargar base de datos
let respectDB = JSON.parse(fs.readFileSync(pathRespect))

// ✅ Guardar cambios
function saveRespectDB() {
  fs.writeFileSync(pathRespect, JSON.stringify(respectDB, null, 2))
}

const handler = async (m, { conn, text }) => {
  const ctxErr = global.rcanalx || {}
  const ctxOk = global.rcanalr || {}

  // ✅ SI NO RESPONDE A UN STICKER → EXPLICACIÓN
  if (!m.quoted) {
    return conn.reply(
      m.chat,
      `✦ *Comando WM — SW SYSTEM*\n\n` +
      `Este comando sirve para *robar* un sticker y ponerle tu propio *packname* y *autor*.\n\n` +
      `✅ *Cómo usarlo:*\n` +
      `1. Responde a un sticker\n` +
      `2. Escribe: *.wm pack|autor*\n\n` +
      `✅ *Ejemplo:*\n` +
      `*.wm SW SYSTEM|Mahykol*\n\n` +
      `✦ Si no pones pack/autor, el sticker se roba igual.\n` +
      `✦ Estilo GTA SA: +5 RESPECT`,
      m,
      ctxErr
    )
  }

  // ✅ Validar mimetype
  const mime = (m.quoted && (m.quoted.mimetype || m.quoted.mediaType)) || ''
  if (!/webp/i.test(mime)) {
    return conn.reply(m.chat, '> Responde a un *Sticker* (formato webp).', m, ctxErr)
  }

  // ✅ Parsear packname|author
  let packname = ''
  let author = ''
  if (text && text.trim()) {
    const parts = text.split('|').map(p => p.trim())
    packname = parts[0] || ''
    author = parts.slice(1).join('|') || ''
  }

  // ✅ DESCARGAR STICKER Y APLICAR EXIF
  let stickerBuffer = false

  try {
    let imgBuffer = null

    if (typeof m.quoted.download === 'function') {
      imgBuffer = await m.quoted.download()
    } else if (typeof conn.downloadM === 'function') {
      imgBuffer = await conn.downloadM(m.quoted)
    } else if (typeof conn.download === 'function') {
      imgBuffer = await conn.download(m.quoted)
    } else {
      throw new Error('No hay método de descarga disponible')
    }

    if (!imgBuffer || !Buffer.isBuffer(imgBuffer)) {
      throw new Error('No se pudo descargar el sticker')
    }

    stickerBuffer = await addExif(imgBuffer, packname || '', author || '')

  } catch (e) {
    console.error('Error en wm handler:', e)
    if (Buffer.isBuffer(e)) stickerBuffer = e
  }

  // ✅ Enviar sticker modificado
  if (stickerBuffer && Buffer.isBuffer(stickerBuffer)) {

    // ✅ SISTEMA DE RESPECT — SW SYSTEM + GTA SA
    const user = m.sender
    const now = Date.now()
    const FIVE_MIN = 5 * 60 * 1000 // 5 minutos

    // Crear registro si no existe
    if (!respectDB[user]) {
      respectDB[user] = {
        respect: 0,
        robCount: 0,
        windowStart: 0,
        totalRobs: 0,
        punishLevel: 0
      }
    }

    const data = respectDB[user]

    // ✅ Reiniciar ventana si:
    // - es el primer robo
    // - ya pasaron 5 minutos desde el 3er robo
    if (data.robCount === 0 || (data.robCount >= 3 && now - data.windowStart >= FIVE_MIN)) {
      data.robCount = 0
      data.windowStart = now
      data.punishLevel = 0 // ✅ reiniciar castigo progresivo
    }

    // ✅ Aumentar contador de robos en ventana
    data.robCount++

    // ✅ Aumentar contador total de robos
    data.totalRobs++

    // ✅ Lógica de RESPECT
    if (data.robCount <= 3) {
      data.respect += 5
    } else {
      // ❌ Excedió el límite → castigo progresivo
      data.punishLevel++

      // 1° exceso → 5
      // 2° exceso → 10
      // 3° exceso → 20
      // 4° exceso → 40
      const penalty = 5 * Math.pow(2, data.punishLevel - 1)

      data.respect -= penalty
      if (data.respect < 0) data.respect = 0
    }

    // ✅ Guardar cambios
    saveRespectDB()

    // ✅ Calcular robos disponibles
    const robosDisponibles = Math.max(0, 3 - data.robCount)

    try {
      await conn.sendMessage(m.chat, { sticker: stickerBuffer }, { quoted: m })

      // ✅ MENSAJE GTA SA FINAL
      await conn.reply(
        m.chat,
        `✦ *Sticker robado exitosamente*\n` +
        `✦ RESPECT: *${data.respect}*\n` +
        `✦ Robos disponibles: *${robosDisponibles}*\n` +
        `✦ Robos realizados: *${data.totalRobs}*`,
        m,
        ctxOk
      )

    } catch (err) {
      try {
        await conn.sendFile(m.chat, stickerBuffer, 'sticker.webp', '', m)

        await conn.reply(
          m.chat,
          `✦ *Sticker robado exitosamente*\n` +
          `✦ RESPECT: *${data.respect}*\n` +
          `✦ Robos disponibles: *${robosDisponibles}*\n` +
          `✦ Robos realizados: *${data.totalRobs}*`,
          m,
          ctxOk
        )

      } catch (err2) {
        console.error('Error enviando sticker (fallback):', err2)
        return conn.reply(m.chat, '> Ocurrió un error al enviar el sticker.', m, ctxErr)
      }
    }

    return
  } else {
    return conn.reply(m.chat, '> Responde a un *Sticker* válido.', m, ctxErr)
  }
}

handler.help = ['sticker']
handler.tags = ['tools']
handler.command = ['take', 'robar', 'wm', 'sticker']
handler.group = true

export default handler
