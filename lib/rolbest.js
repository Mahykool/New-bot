const handler = async (m) => {
  let txt = `ㅤׄㅤׅㅤׄ *_CÓMO MEJORAR DE ROL_* ㅤ֢ㅤׄㅤׅ\n\n`
  txt += `> 💬 _Los roles se asignan según tu participación y nivel._\n`
  txt += `> 📈 _Mientras más activo seas en el grupo, más rápido subirás de nivel._\n`
  txt += `> 🎭 _Al alcanzar ciertos niveles, podrás obtener nuevos roles._\n`
  txt += `> 👑 _Solo el *CREADOR* puede asignar o modificar roles._\n\n`
  txt += `Mahykol — SWILL`
  return m.reply(txt)
}

handler.help = ['rolbest']
handler.tags = []
handler.command = ['rolbest']
handler.group = true
handler.description = 'Información para ascender de rol'

export default handler