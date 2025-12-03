// plugins/respect-menu.js
// ✦ Menú de comandos RESPECT ✦ Swill v3.8.0
// Diseñado por Mahykol ✦ Estilo GTA SA

import { normalizeJid } from '../lib/lib-roles.js'

const handler = async (m, { usedPrefix: _p = '/' }) => {
  const senderNorm = normalizeJid(m.sender)

  let txt = `ㅤׄㅤׅㅤׄ *_MENÚ DE COMANDOS RESPECT_* ㅤ֢ㅤׄㅤׅ\n\n`

  txt += `👤 Usuario: @${senderNorm.split('@')[0]}\n\n`

  txt += `ㅤׄㅤׅㅤׄ *_COMANDOS BÁSICOS_* ㅤ֢ㅤׄㅤׅ\n`
  txt += `> ⚘ *_${_p}mirespect_*\n`
  txt += `> Consulta tu nivel actual de RESPECT y robos disponibles.\n\n`

  txt += `> ⚘ *_${_p}respectrango_*\n`
  txt += `> Muestra tu rango según tus puntos de RESPECT.\n\n`

  txt += `> ⚘ *_${_p}respectinfo_*\n`
  txt += `> Explica cómo funciona el sistema RESPECT.\n\n`

  txt += `ㅤׄㅤׅㅤׄ *_COMANDOS ADMINISTRATIVOS_* ㅤ֢ㅤׄㅤׅ\n`
  txt += `> ⚘ *_${_p}respectreset @usuario/all_*\n`
  txt += `> Reinicia el RESPECT de un usuario o de todos.\n\n`

  txt += `> ⚘ *_${_p}respectgive @usuario cantidad_*\n`
  txt += `> Suma puntos de RESPECT a un usuario.\n\n`

  txt += `> ⚘ *_${_p}respecttake @usuario cantidad_*\n`
  txt += `> Resta puntos de RESPECT a un usuario.\n\n`

  txt += `> ⚘ *_${_p}respectset @usuario cantidad_*\n`
  txt += `> Establece un valor fijo de RESPECT para un usuario.\n\n`

  txt += `> ⚘ *_${_p}respecttop_*\n`
  txt += `> Muestra el TOP 10 de RESPECT en el sistema.\n\n`

  txt += `Mahykol — SWILL`

  return m.reply(txt, null, { mentions: [senderNorm] })
}

handler.help = ['respectmenu']
handler.tags = ['tools']
handler.command = ['respectmenu']
handler.group = true
handler.description = '_Respect_*+*'

export default handler