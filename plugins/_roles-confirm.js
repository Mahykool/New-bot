// plugins/_roles-confirm.js
import { setUserRole, addUserRole, removeUserRole } from '../lib/lib-roles.js'

const handler = async (m, { conn }) => {
  const btn =
    m?.message?.templateButtonReplyMessage?.selectedId ||
    m?.message?.buttonsResponseMessage?.selectedButtonId

  if (!btn) return

  const [action, type, target, role] = btn.split(':')
  if (action !== 'confirm') return

  if (!target || !/^\d+(@s\.whatsapp\.net)?$/.test(target) || !role) {
    return conn.reply(m.chat, '⚠️ Error: botón sin datos válidos de usuario o rol.', m)
  }

  if (type === 'setrole') setUserRole(target, role)
  if (type === 'addrole') addUserRole(target, role)
  if (type === 'removerole') removeUserRole(target, role)

  conn.reply(
    m.chat,
    `✅ Acción confirmada.\nRol: ${role}\nUsuario: @${target.split('@')[0]}`,
    m,
    { mentions: [target] }
  )
}

export default handler