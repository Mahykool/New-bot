// plugins/_roles-confirm.js
// SW SYSTEM — Confirmación de roles (botones interactivos)
// Este plugin detecta botones de confirmación y ejecuta cambios de rol

import {
  setUserRole,
  addUserRole,
  removeUserRole,
  reloadUserRoles
} from '../lib/lib-roles.js'

const format = txt => `*ROLES* — ${txt}`

const handler = async (m, { conn }) => {
  // Detectar botón
  const btn =
    m?.message?.templateButtonReplyMessage?.selectedId ||
    m?.message?.buttonsResponseMessage?.selectedButtonId

  if (!btn) return

  const actor = m.sender
  const ctxOk = global.rcanalr || {}
  const ctxWarn = global.rcanalw || {}

  // ------------------------------
  // CONFIRMAR SETROLE
  // ------------------------------
  if (btn.startsWith('confirm:setrole:')) {
    const [, , target, roleId] = btn.split(':')

    const updated = setUserRole(target, roleId, actor)
    try { global.userRoles = reloadUserRoles() } catch {}

    const rolesStr = updated.length ? updated.join(', ') : 'none'
    const name = await conn.getName(target)
    const tag = `@${name || target.split('@')[0]}`

    return conn.reply(
      m.chat,
      format(`✅ Rol principal actualizado.\nUsuario: ${tag}\nRoles: ${rolesStr}`),
      m,
      { mentions: [target], ...ctxOk }
    )
  }

  if (btn.startsWith('deny:setrole:')) {
    return conn.reply(m.chat, format('❌ Acción denegada.'), m, ctxWarn)
  }

  // ------------------------------
  // CONFIRMAR ADDROLE
  // ------------------------------
  if (btn.startsWith('confirm:addrole:')) {
    const [, , target, roleId] = btn.split(':')

    const updated = addUserRole(target, roleId, actor)
    try { global.userRoles = reloadUserRoles() } catch {}

    const rolesStr = updated.length ? updated.join(', ') : 'none'
    const name = await conn.getName(target)
    const tag = `@${name || target.split('@')[0]}`

    return conn.reply(
      m.chat,
      format(`✅ Rol agregado.\nUsuario: ${tag}\nRoles: ${rolesStr}`),
      m,
      { mentions: [target], ...ctxOk }
    )
  }

  if (btn.startsWith('deny:addrole:')) {
    return conn.reply(m.chat, format('❌ Acción denegada.'), m, ctxWarn)
  }

  // ------------------------------
  // CONFIRMAR REMOVEROLE
  // ------------------------------
  if (btn.startsWith('confirm:removerole:')) {
    const [, , target, roleId] = btn.split(':')

    const updated = removeUserRole(target, roleId, actor)
    try { global.userRoles = reloadUserRoles() } catch {}

    const rolesStr = updated.length ? updated.join(', ') : 'none'
    const name = await conn.getName(target)
    const tag = `@${name || target.split('@')[0]}`

    return conn.reply(
      m.chat,
      format(`✅ Rol removido.\nUsuario: ${tag}\nRoles: ${rolesStr}`),
      m,
      { mentions: [target], ...ctxOk }
    )
  }

  if (btn.startsWith('deny:removerole:')) {
    return conn.reply(m.chat, format('❌ Acción denegada.'), m, ctxWarn)
  }
}

export default handler
