import { listRoles } from '../lib/lib-roles.js'

const handler = async (m) => {
  let txt = `ㅤׄㅤׅㅤׄ *_ROLES DISPONIBLES_* ㅤ֢ㅤׄㅤׅ\n\n`
  for (const r of listRoles()) {
    txt += `> ⚘ *${r.role}* (Nivel ${r.level})\n`
    txt += `> _${r.description}_\n\n`
  }
  txt += `Mahykol — SWILL`
  return m.reply(txt)
}

handler.help = ['rolesdisponibles']
handler.tags = []
handler.command = ['rolesdisponibles']
handler.group = true
handler.description = 'Lista todos los roles actuales'

export default handler