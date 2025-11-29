// plugins/wm.js
import { addExif } from '../lib/sticker.js'

const handler = async (m, { conn, text }) => {
  const ctxErr = global.rcanalx || {}
  const ctxOk = global.rcanalr || {}

  // Validar que haya mensaje citado
  if (!m.quoted) {
    return conn.reply(m.chat, '> Responde a un *Sticker*.', m, ctxErr)
  }

  // Validar mimetype
  const mime = (m.quoted && (m.quoted.mimetype || m.quoted.mediaType)) || ''
  if (!/webp/i.test(mime)) {
    return conn.reply(m.chat, '> Responde a un *Sticker* (formato webp).', m, ctxErr)
  }

  // Parsear packname|author (texto opcional)
  let packname = ''
  let author = ''
  if (text && text.trim()) {
    const parts = text.split('|').map(p => p.trim())
    packname = parts[0] || ''
    author = parts.slice(1).join('|') || ''
  }

  let stickerBuffer = false

  try {
    // Descargar el sticker (compatibilidad con distintas APIs)
    let imgBuffer = null
    if (typeof m.quoted.download === 'function') {
      imgBuffer = await m.quoted.download()
    } else if (typeof conn.downloadM === 'function') {
      imgBuffer = await conn.downloadM(m.quoted)
    } else if (typeof conn.download === 'function') {
      imgBuffer = await conn.download(m.quoted)
    } else {
      throw new Error('No hay método de descarga disponible en esta versión del cliente')
    }

    if (!imgBuffer || !Buffer.isBuffer(imgBuffer)) {
      throw new Error('No se pudo descargar el sticker')
    }

    // Añadir EXIF (packname, author)
    stickerBuffer = await addExif(imgBuffer, packname || '', author || '')
  } catch (e) {
    console.error('Error en wm handler:', e)
    // Si addExif devolvió un buffer como error, usarlo
    if (Buffer.isBuffer(e)) stickerBuffer = e
  }

  // Enviar resultado o mensaje de error
  if (stickerBuffer && Buffer.isBuffer(stickerBuffer)) {
    try {
      // Intentar enviar como sticker (forma moderna)
      await conn.sendMessage(m.chat, { sticker: stickerBuffer }, { quoted: m })
    } catch (err) {
      // Fallback a sendFile si la API lo requiere
      try {
        await conn.sendFile(m.chat, stickerBuffer, 'sticker.webp', '', m)
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

handler.help = ['wm']
handler.tags = ['tools']
handler.command = ['take', 'robar', 'wm']
handler.group = false

export default handler
