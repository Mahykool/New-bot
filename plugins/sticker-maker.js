// plugins/sticker-maker.js
// ✦ Creador de stickers con imágenes y videos ✦
// Diseñado por Mahykol ✦ Estilo GTA SA

import { sticker } from '../lib/sticker.js' // asegúrate de tener tu función sticker

const handler = async (m, { conn }) => {
  if (!m.isGroup) return

  // Solo actúa si el mensaje es imagen o video
  const mime = (m.msg || m).mimetype || ''
  if (!mime) return

  try {
    if (/image/.test(mime)) {
      // Imagen → convertir a sticker
      let media = await m.download()
      let stiker = await sticker(media, false, 'Bot', 'Sticker')
      if (stiker) await conn.sendFile(m.chat, stiker, 'sticker.webp', '', m, true, { asSticker: true })
    } else if (/video/.test(mime)) {
      // Video corto → convertir a sticker animado
      let media = await m.download()
      let stiker = await sticker(media, false, 'Bot', 'Sticker')
      if (stiker) await conn.sendFile(m.chat, stiker, 'sticker.webp', '', m, true, { asSticker: true })
    } else {
      return m.reply('⚠️ Solo imágenes o videos pueden convertirse en stickers.')
    }
  } catch (e) {
    return m.reply(`⚠️ Error al crear sticker: ${e.message}`)
  }
}

handler.help = ['sticker']
handler.tags = ['fun']
handler.command = ['sticker', 'stickers', 's']
handler.group = true
handler.botAdmin = false
handler.admin = false
handler.description = 'Creador de stickers con imágenes y videos'

export default handler