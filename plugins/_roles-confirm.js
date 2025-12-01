// plugins/_roles-confirm.js
import { setUserRole, addUserRole, removeUserRole } from '../lib/lib-roles.js'

const handler = async (m, { conn }) => {
  const btn =
    m?.message?.templateButtonReplyMessage?.selectedId ||
    m?.message?.buttonsResponseMessage?.selectedButtonId

  if (!btn) return

  const [action, type, target, role] = btn.split(':')

  if (action !== 'confirm') return

  if (type === 'setrole') setUserRole(target, role, m.sender)
  if (type === 'addrole') addUserRole(target, role, m.sender)
  if (type === 'removerole') removeUserRole(target, role, m.sender)

  conn.reply(m.chat, `✅ Acción confirmada.\nRol: ${role}\nUsuario: @${target.split('@')[0]}`, m, {
    mentions: [target]
  })
}

export default handler
