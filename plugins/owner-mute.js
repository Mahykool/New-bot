import fs from 'fs'
import path from 'path'
import { requireCommandAccess } from '../lib/permissions-middleware.js'

/**
 * Shadowban plugin (nuevo sistema de permisos)
 * - Comandos: shadowban, unshadowban, mute, unmute
 * - Uso: responder al mensaje del usuario objetivo
 *   - shadowban 30   -> shadowban por 30 minutos
 *   - shadowban      -> shadowban permanente
 *   - unshadowban    -> quitar shadowban (si no es immutable)
 * - Persiste en data/shadowbans.json
 *
 * Reglas adicionales:
 * - No se puede shadowbanear al creador; quien lo intente será shadowbaneado automáticamente por 5 minutos
 *   y ese castigo no podrá retirarse manualmente durante su duración.
 *
 * Nota: Ajusta las miniaturas GTA_THUMB_1 / GTA_THUMB_2 por tus URLs reales.
 */

const DATA_DIR = path.join(process.cwd(), 'data')
const FILE = path.join(DATA_DIR, 'shadowbans.json')

// Título decorado solicitado
const PLUGIN_TITLE = 'ㅤׄㅤׅㅤׄ _*SHADOWBAN*_ ㅤ֢ㅤׄㅤׅ'

// Miniaturas estilo GTA SA por defecto (reemplaza por tus URLs)
const GTA_THUMB_1 = process.env.GTA_THUMB_1 || 'https://i.imgur.com/ejemploGTA1.jpg'
const GTA_THUMB_2 = process.env.GTA_THUMB_2 || 'https://i.imgur.com/ejemploGTA2.jpg'
const DEFAULT_GTA_THUMB = GTA_THUMB_1

function ensureDataDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }) } catch {}
}

/**
 * Estructura en memoria:
 * Map<jid, { expiresAt: number|null, timeoutId: Timeout|null, actor?: string, createdAt?: number, chat?: string, immutable?: boolean }>
 */
let shadowMap = new Map()

function loadShadowbansFromDisk() {
  try {
    if (!fs.existsSync(FILE)) return
    const raw = fs.readFileSync(FILE, 'utf8')
    const arr = JSON.parse(raw || '[]')
    if (!Array.isArray(arr)) return
    const now = Date.now()
    for (const item of arr) {
      const jid = item.jid
      const expiresAt = item.expiresAt || null
      const actor = item.actor || null
      const createdAt = item.createdAt || null
      const chat = item.chat || null
      const immutable = !!item.immutable
      if (!jid) continue
      if (expiresAt && expiresAt <= now) continue
      shadowMap.set(jid, { expiresAt, timeoutId: null, actor, createdAt, chat, immutable })
    }
  } catch (e) {
    console.warn('loadShadowbansFromDisk error', e)
  }
}

function saveShadowbansToDisk() {
  try {
    ensureDataDir()
    const arr = Array.from(shadowMap.entries()).map(([jid, v]) => ({
      jid,
      expiresAt: v.expiresAt || null,
      actor: v.actor || null,
      createdAt: v.createdAt || null,
      chat: v.chat || null,
      immutable: !!v.immutable
    }))
    fs.writeFileSync(FILE, JSON.stringify(arr, null, 2), 'utf8')
  } catch (e) {
    console.error('saveShadowbansToDisk error', e)
  }
}

// Mensajes con estilo (usamos PLUGIN_TITLE)
const MSG_CREATOR_ATTEMPT_PUBLIC = `🔥╔═━ ${PLUGIN_TITLE} ═━═╗🔥
*En serio intentaste Shadowbanear al creador?* 💀
╚═━ 𝗡𝗼 𝗶𝗻𝘁𝗲𝗻𝘁𝗲 𝗲𝘀𝗼 𝗱𝗲 𝗻𝘂𝗲𝘃𝗼 ━═╝`

const MSG_CREATOR_PUNISH_PUBLIC = (punisherShort) => `✅╔═━ 𝗖𝗔𝗦𝗧𝗜𝗚𝗢 𝗔𝗣𝗟𝗜𝗖𝗔𝗗𝗢 ━═╗✅
*Has sido shadowbaneado por intentar shadowbanear al creador*
⏱️ *Duración:* 5 minutos — *INMUTABLE*
@${punisherShort}
╚═━ 𝗘𝘀𝗽𝗲𝗿𝗮 𝗮 𝗾𝘂𝗲 𝘁𝗲𝗿𝗺𝗶𝗻𝗲 ━═╝`

const MSG_CREATOR_PUNISH_DM = `💬╔═━ 𝗔𝗧𝗘𝗡𝗖𝗜𝗢́𝗡 ━═╗💬
Has sido automáticamente *shadowbaneado* por intentar shadowbanear al creador. 💀

⏳ *Duración:* 5 minutos (temporal)
🔒 *Estado:* INMUTABLE — no puede retirarse manualmente

Recomendación: espera a que termine el castigo y evita acciones contra el creador.
╚═━ 𝗖𝗼𝗺𝗽𝗼𝗿𝘁𝗮𝗺𝗶𝗲𝗻𝘁𝗼 𝗿𝗲𝗰𝗼𝗺𝗲𝗻𝗱𝗮𝗱𝗼 ━═╝`

const MSG_SHADOWBAN_TEMP = (minutes, targetShort) => `✨╔═━ 𝗦𝗛𝗔𝗗𝗢𝗪𝗕𝗔𝗡 ━═╗✨
*Usuario shadowbaneado por ${minutes} minutos:* @${targetShort}
⏳ ${minutes}m — te avisaré cuando termine
╚═━ 𝗠𝗼𝗱𝗲𝗿𝗮𝗰𝗶𝗼́𝗻 ━═╝`

const MSG_SHADOWBAN_PERM = (targetShort) => `✨╔═━ 𝗦𝗛𝗔𝗗𝗢𝗪𝗕𝗔𝗡 ━═╗✨
*Usuario shadowbaneado permanentemente:* @${targetShort}
🔒 Hasta que se ejecute *unshadowban*
╚═━ 𝗠𝗼𝗱𝗲𝗿𝗮𝗰𝗶𝗼́𝗻 ━═╝`

const MSG_SHADOWBAN_EXPIRED = (targetShort) => `🎉╔═━ 𝗦𝗛𝗔𝗗𝗢𝗪𝗕𝗔𝗡 𝗧𝗘𝗥𝗠𝗜𝗡𝗔𝗗𝗢 ━═╗🎉
* > ✅ El shadowban temporal ha terminado:* @${targetShort}
╚═━ 𝗩𝘂𝗲𝗹𝘃𝗲 𝗮 𝗽𝗼𝗿 𝗹𝗮 𝗰𝗼𝗺𝘂𝗻𝗶𝗱𝗮𝗱 ━═╝`

const MSG_USAGE = `📚╔═━ 𝗨𝗦𝗢 𝗦𝗛𝗔𝗗𝗢𝗪𝗕𝗔𝗡 ━═╗📚
*1) Shadowban indefinido* — Responde y escribe: *shadowban*
*2) Shadowban temporal* — Responde y escribe: *shadowban <minutos>* (ej. *shadowban 30*)
Al expirar, el bot notificará automáticamente en el chat.
╚═━ 𝗖𝗼𝗺𝗮𝗻𝗱𝗼𝘀: unshadowban, mute, unmute ━═╝`

// scheduleUnshadow ahora acepta conn opcional; si no se pasa, intentará usar global.conn
function scheduleUnshadow(jid, ms, conn = null) {
  const entry = shadowMap.get(jid)
  if (entry && entry.timeoutId) {
    clearTimeout(entry.timeoutId)
  }
  if (!ms || ms <= 0) return
  const timeoutId = setTimeout(async () => {
    try {
      const current = shadowMap.get(jid)
      if (!current) return
      // eliminar del mapa y persistir
      shadowMap.delete(jid)
      saveShadowbansToDisk()

      // intentar notificar en el chat donde se aplicó el shadowban
      const chatId = current.chat || null
      const connToUse = conn || global.conn || null
      if (chatId && connToUse && typeof connToUse.sendMessage === 'function') {
        try {
          await connToUse.sendMessage(chatId, { text: MSG_SHADOWBAN_EXPIRED(jid.split('@')[0]) }, { mentions: [jid] })
        } catch (e) {
          console.warn('scheduleUnshadow: fallo al notificar finalización', e)
        }
      }
    } catch (e) {
      console.error('scheduleUnshadow error', e)
    }
  }, ms)
  const current = shadowMap.get(jid) || {}
  current.timeoutId = timeoutId
  shadowMap.set(jid, current)
}

function scheduleAllTimeouts() {
  const now = Date.now()
  for (const [jid, v] of shadowMap.entries()) {
    if (v.expiresAt) {
      const ms = v.expiresAt - now
      if (ms <= 0) {
        shadowMap.delete(jid)
      } else {
        scheduleUnshadow(jid, ms, null)
      }
    }
  }
  saveShadowbansToDisk()
}

// Cargar al iniciar
loadShadowbansFromDisk()

const handler = async (m, { conn, usedPrefix, command /* isAdmin eliminado intencionalmente */ }) => {
  const ctxErr = global.rcanalx || {
    contextInfo: {
      externalAdReply: {
        title: PLUGIN_TITLE,
        body: '❌ Error',
        thumbnailUrl: DEFAULT_GTA_THUMB,
        sourceUrl: global.canalOficial || ''
      }
    }
  }
  const ctxWarn = global.rcanalw || {
    contextInfo: {
      externalAdReply: {
        title: PLUGIN_TITLE,
        body: '⚠️ Advertencia',
        thumbnailUrl: DEFAULT_GTA_THUMB,
        sourceUrl: global.canalOficial || ''
      }
    }
  }
  const ctxOk = global.rcanalr || {
    contextInfo: {
      externalAdReply: {
        title: PLUGIN_TITLE,
        body: '✅ Acción',
        thumbnailUrl: GTA_THUMB_2,
        sourceUrl: global.canalOficial || ''
      }
    }
  }

  // Verificar permisos con el sistema nuevo
  try {
    // Ajusta 'moderation-plugin' si tu plugin-permissions.json usa otro pluginId
    requireCommandAccess(m.sender, 'moderation-plugin', 'shadowban')
  } catch (err) {
    return conn.reply(m.chat, '❌ No tienes permiso para usar este comando.', m, ctxErr)
  }

  // Explicación de uso: siempre mostrar las dos opciones (indefinido vs temporal)
  try {
    await conn.reply(m.chat, MSG_USAGE, m, ctxWarn)
  } catch (e) {
    console.warn('shadowban: fallo al enviar explicación de uso', e)
  }

  // Debe responder a un mensaje objetivo
  let target
  if (m.quoted) {
    target = m.quoted.sender
  } else {
    return conn.reply(m.chat, '> *‼️ Responde al mensaje del usuario que quieres shadowbanear/unshadowbanear.*', m, ctxWarn)
  }

  // Detectar creador(es) del bot
  const creators = []
  if (Array.isArray(global.owner)) creators.push(...global.owner)
  else if (global.owner) creators.push(global.owner)
  if (Array.isArray(global.ownerJid)) creators.push(...global.ownerJid)
  else if (global.ownerJid) creators.push(global.ownerJid)
  if (Array.isArray(global.ownerNumber)) creators.push(...global.ownerNumber)
  else if (global.ownerNumber) creators.push(global.ownerNumber)

  // Normalizar JIDs (si vienen sin @s.whatsapp.net)
  const normalize = jid => {
    if (!jid) return jid
    if (jid.includes('@')) return jid
    return `${jid}@s.whatsapp.net`
  }
  const normalizedCreators = creators.map(normalize).filter(Boolean)

  // Detectar "all bots" o lista de bots del sistema si existe
  const allBots = Array.isArray(global.allBots) ? global.allBots.slice() : (Array.isArray(global.botNumbers) ? global.botNumbers.slice() : [])
  const normalizedAllBots = allBots.map(normalize).filter(Boolean)

  // No permitir shadowban al creador: si alguien lo intenta, se le aplica un castigo automático
  if (normalizedCreators.includes(target)) {
    // Mensaje especial para el creador intento (en el chat)
    try {
      await conn.reply(m.chat, MSG_CREATOR_ATTEMPT_PUBLIC, m, ctxErr)
    } catch (e) {
      // ignorar fallo al enviar
    }

    // Aplicar castigo automático al ejecutor (m.sender)
    const punisher = m.sender
    // Si ya está shadowbaneado, no duplicar; si ya tiene immutable, informar
    if (shadowMap.has(punisher)) {
      const existing = shadowMap.get(punisher)
      if (existing.immutable) {
        return conn.reply(m.chat, `> ⚠️ Ya estás bajo un castigo inmutable. Espera a que termine.`, m, ctxErr)
      } else {
        // actualizar a castigo inmutable por 5 minutos
        const expiresAt = Date.now() + 5 * 60 * 1000
        shadowMap.set(punisher, { expiresAt, timeoutId: null, actor: 'system', createdAt: Date.now(), chat: m.chat, immutable: true })
        saveShadowbansToDisk()
        scheduleUnshadow(punisher, expiresAt - Date.now(), conn)

        // Notificar en el chat donde ocurrió el intento
        try {
          await conn.reply(m.chat, MSG_CREATOR_PUNISH_PUBLIC(punisher.split('@')[0]), m, { mentions: [punisher] }, ctxOk)
        } catch (e) {}

        // Notificar directamente al ejecutor (DM) que el castigo es temporal e inmutable
        try {
          if (typeof conn.sendMessage === 'function') {
            await conn.sendMessage(punisher, { text: MSG_CREATOR_PUNISH_DM }, { mentions: [punisher] })
          }
        } catch (e) {
          // ignorar fallo al enviar DM
        }

        return
      }
    } else {
      // Nuevo castigo inmutable por 5 minutos
      const expiresAt = Date.now() + 5 * 60 * 1000
      shadowMap.set(punisher, { expiresAt, timeoutId: null, actor: 'system', createdAt: Date.now(), chat: m.chat, immutable: true })
      saveShadowbansToDisk()
      scheduleUnshadow(punisher, expiresAt - Date.now(), conn)

      // Notificar en el chat donde ocurrió el intento
      try {
        await conn.reply(m.chat, MSG_CREATOR_PUNISH_PUBLIC(punisher.split('@')[0]), m, { mentions: [punisher] }, ctxOk)
      } catch (e) {}

      // Notificar directamente al ejecutor (DM) que el castigo es temporal e inmutable
      try {
        if (typeof conn.sendMessage === 'function') {
          await conn.sendMessage(punisher, { text: MSG_CREATOR_PUNISH_DM }, { mentions: [punisher] })
        }
      } catch (e) {
        // ignorar fallo al enviar DM
      }

      return
    }
  }

  // No permitir shadowban a bots del sistema (incluye al propio bot)
  const botJid = conn.user?.id || conn.user?.jid || null
  const isSystemBot = (target === botJid) || normalizedAllBots.includes(target)
  if (isSystemBot) {
    // Mensaje creativo para intentos sobre bots
    return conn.reply(m.chat, '> 🤖 No puedes shadowbanear a los bots del sistema. Si hay un problema con un bot, contacta al creador o usa los comandos de administración.', m, ctxErr)
  }

  // Intento de evitar shadowbanear administradores: comprobación tentativa (si falla, no bloquea)
  try {
    const meta = typeof conn.groupMetadata === 'function' ? await conn.groupMetadata(m.chat) : null
    if (meta && Array.isArray(meta.participants)) {
      const p = meta.participants.find(x => (x.id || x.jid || x.participant) === target)
      if (p && (p.admin || p.isAdmin || p.role === 'admin')) {
        return conn.reply(m.chat, '> ❌ No puedes shadowbanear a un administrador.', m, ctxErr)
      }
    }
  } catch (e) {
    // ignoramos errores de metadata
  }

  // Parsear argumento de duración en minutos
  const text = (m.text || '').trim()
  const parts = text.split(/\s+/).filter(Boolean)
  // parts[0] es el comando, parts[1] puede ser la duración
  const durationArg = parts[1] || ''
  const minutes = parseInt(durationArg, 10)
  const isDuration = !isNaN(minutes) && minutes > 0

  if (command === 'shadowban' || command === 'mute') {
    if (shadowMap.has(target)) {
      return conn.reply(m.chat, `> ⚠️ El usuario ya está shadowbaneado: @${target.split('@')[0]}`, m, { mentions: [target] }, ctxWarn)
    }

    let expiresAt = null
    if (isDuration) {
      expiresAt = Date.now() + minutes * 60 * 1000
    }

    const actor = m.sender || null
    const createdAt = Date.now()
    // Guardamos también el chat donde se aplicó para poder notificar al expirar
    shadowMap.set(target, { expiresAt, timeoutId: null, actor, createdAt, chat: m.chat, immutable: false })
    saveShadowbansToDisk()

    if (isDuration) {
      // pasamos conn para que la notificación pueda enviarse cuando expire
      scheduleUnshadow(target, expiresAt - Date.now(), conn)
      try {
        await conn.reply(m.chat, MSG_SHADOWBAN_TEMP(minutes, target.split('@')[0]), m, { mentions: [target] }, ctxOk)
      } catch (e) {
        // fallback simple
        await conn.reply(m.chat, `> ✅ Usuario shadowbaneado por ${minutes} minutos: @${target.split('@')[0]}`, m, { mentions: [target] }, ctxOk)
      }
      return
    } else {
      try {
        await conn.reply(m.chat, MSG_SHADOWBAN_PERM(target.split('@')[0]), m, { mentions: [target] }, ctxOk)
      } catch (e) {
        await conn.reply(m.chat, `> ✅ Usuario shadowbaneado permanentemente: @${target.split('@')[0]}`, m, { mentions: [target] }, ctxOk)
      }
      return
    }
  } else if (command === 'unshadowban' || command === 'unmute') {
    if (!shadowMap.has(target)) {
      return conn.reply(m.chat, `> ⚠️ El usuario no está shadowbaneado: @${target.split('@')[0]}`, m, { mentions: [target] }, ctxWarn)
    }
    const entry = shadowMap.get(target)
    // Si la entrada es inmutable (castigo), no permitir quitarla manualmente
    if (entry && entry.immutable) {
      return conn.reply(m.chat, `> ❌ No puedes quitar este shadowban manualmente. Es un castigo temporal inmutable.`, m, ctxErr)
    }
    if (entry && entry.timeoutId) clearTimeout(entry.timeoutId)
    shadowMap.delete(target)
    saveShadowbansToDisk()
    return conn.reply(m.chat, `> ✅ *Usuario des-shadowbaneado:* @${target.split('@')[0]}`, m, { mentions: [target] }, ctxOk)
  }
}

// Antes de procesar otros handlers: eliminar mensajes de shadowbaneados (excepto stickers)
// Nota: el plugin NO exige que el bot sea admin; borrado es tentativa y silenciosa
handler.before = async (m, { conn }) => {
  try {
    if (!m || !m.sender) return
    // Programar timeouts la primera vez que se usa el handler
    if (!handler._scheduled) {
      scheduleAllTimeouts()
      handler._scheduled = true
    }
    if (!shadowMap.has(m.sender)) return
    // Permitir stickers
    if (m.mtype === 'stickerMessage') return
    // Intentar borrar el mensaje; si falla (no admin), lo ignoramos
    try {
      if (typeof conn.sendMessage === 'function') {
        await conn.sendMessage(m.chat, { delete: m.key })
      }
    } catch (e) {
      // No hacemos nada si no se puede borrar (posible falta de permisos)
    }
  } catch (e) {
    console.error('shadowban before error', e)
  }
}

handler.help = ['shadowban', 'unshadowban', 'mute', 'unmute']
handler.tags = ['modmenu']
handler.command = ['shadowban', 'unshadowban', 'mute', 'unmute']
handler.group = true
// No forzamos que el bot sea admin; borrado es tentativa y silenciosa
handler.botAdmin = false

export default handler
