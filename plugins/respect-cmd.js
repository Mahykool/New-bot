// plugins/respect-cmd.js
import fs from 'fs'

const pathRespect = './database/respect.json'

// Crear archivo si no existe (por si wm.js aún no lo creó)
if (!fs.existsSync(pathRespect)) {
  fs.writeFileSync(pathRespect, JSON.stringify({}))
}

let respectDB = JSON.parse(fs.readFileSync(pathRespect))

function saveRespectDB() {
  fs.writeFileSync(pathRespect, JSON.stringify(respectDB, null, 2))
}

// Obtener rango según RESPECT
function getRespectRank(points = 0) {
  if (points >= 2000) return 'Big Smoke Tier'
  if (points >= 800) return 'Grove Street Legend'
  if (points >= 300) return 'OG'
  if (points >= 100) return 'Gangsta'
  return 'Busta'
}

// Verificar si es creador (ajusta esto según tu bot)
function isOwner(m) {
  // Si tu bot ya tiene global.owner, úsalo
  if (global.owner) {
    const owners = Array.isArray(global.owner) ? global.owner : [global.owner]
    return owners.some(v => {
      if (!v) return false
      const id = typeof v === 'string' ? v : v[0]
      return id && m.sender && m.sender.includes(id.replace(/[^0-9]/g, ''))
    })
  }
  // Fallback: solo este número es dueño (cambia esto por tu número)
  return m.sender && m.sender.startsWith('56')
}

// Handler principal
const handler = async (m, { conn, command, args, usedPrefix }) => {
  const cmd = command.toLowerCase()
  const user = m.sender
  const db = respectDB

  // Asegurar entrada en DB
  if (!db[user]) {
    db[user] = {
      respect: 0,
      robCount: 0,
      windowStart: 0,
      totalRobs: 0,
      punishLevel: 0
    }
  }

  const data = db[user]

  // =============== mirespect ===============
  if (cmd === 'mirespect') {
    const robosDisponibles = Math.max(0, 3 - (data.robCount || 0))

    return m.reply(
      `✦ *Tu RESPECT — SW SYSTEM*\n\n` +
      `✦ RESPECT: *${data.respect}*\n` +
      `✦ Robos disponibles: *${robosDisponibles}*\n` +
      `✦ Robos realizados: *${data.totalRobs || 0}*`
    )
  }

  // =============== respectrango ===============
  if (cmd === 'respectrango') {
    const rango = getRespectRank(data.respect)

    return m.reply(
      `✦ *Tu Rango — SW SYSTEM*\n\n` +
      `✦ RESPECT: *${data.respect}*\n` +
      `✦ Rango actual: *${rango}*\n\n` +
      `▸ 0–99 → Busta\n` +
      `▸ 100–299 → Gangsta\n` +
      `▸ 300–799 → OG\n` +
      `▸ 800–1999 → Grove Street Legend\n` +
      `▸ 2000+ → Big Smoke Tier`
    )
  }

  // =============== respectinfo ===============
  if (cmd === 'respectinfo') {
    return m.reply(
      `✦ *Sistema RESPECT — SW SYSTEM*\n\n` +
      `✦ Cada robo de sticker dentro del límite suma *+5 RESPECT*.\n` +
      `✦ Máximo *3 robos* por ventana de *5 minutos*.\n` +
      `✦ Después del 3° robo, cada robo extra aplica un *castigo progresivo*:\n` +
      `   • 1° exceso: -5 RESPECT\n` +
      `   • 2° exceso: -10 RESPECT\n` +
      `   • 3° exceso: -20 RESPECT\n` +
      `   • 4° exceso: -40 RESPECT\n` +
      `   • etc. (se va duplicando)\n\n` +
      `✦ Pasados 5 minutos desde el 3er robo, la ventana se reinicia.\n` +
      `✦ Tus puntos se guardan y no se pierden al reiniciar el bot.\n\n` +
      `✦ Rangos:\n` +
      `   • 0–99 → Busta\n` +
      `   • 100–299 → Gangsta\n` +
      `   • 300–799 → OG\n` +
      `   • 800–1999 → Grove Street Legend\n` +
      `   • 2000+ → Big Smoke Tier`
    )
  }

  // A partir de aquí: SOLO CREADOR
  if (['respectreset', 'respectgive', 'respecttake', 'respectset', 'respecttop'].includes(cmd)) {
    if (!isOwner(m)) {
      return m.reply('> Este comando solo puede usarlo el *Creador del bot*.')
    }
  }

  // =============== respectreset ===============
  if (cmd === 'respectreset') {
    const target = m.mentionedJid && m.mentionedJid[0]
    const arg = (args[0] || '').toLowerCase()

    if (arg === 'all') {
      Object.keys(db).forEach(jid => {
        db[jid].respect = 0
        db[jid].totalRobs = 0
        db[jid].robCount = 0
        db[jid].punishLevel = 0
      })
      saveRespectDB()
      return m.reply('✦ Todos los registros de RESPECT han sido *reiniciados*.')
    }

    if (!target) {
      return m.reply(
        `✦ Usa:\n` +
        `• *${usedPrefix}respectreset @usuario* → resetear 1 usuario\n` +
        `• *${usedPrefix}respectreset all* → resetear todos`
      )
    }

    if (!db[target]) {
      db[target] = {
        respect: 0,
        robCount: 0,
        windowStart: 0,
        totalRobs: 0,
        punishLevel: 0
      }
    }

    db[target].respect = 0
    db[target].totalRobs = 0
    db[target].robCount = 0
    db[target].punishLevel = 0
    saveRespectDB()

    return m.reply(`✦ RESPECT de *@${target.split('@')[0]}* ha sido *reiniciado*.`, { mentions: [target] })
  }

  // =============== respectgive / respecttake / respectset ===============
  if (['respectgive', 'respecttake', 'respectset'].includes(cmd)) {
    const target = m.mentionedJid && m.mentionedJid[0]
    const amount = parseInt(args[1])

    if (!target || isNaN(amount)) {
      return m.reply(
        `✦ Uso correcto:\n` +
        `• *${usedPrefix}respectgive @usuario 50*\n` +
        `• *${usedPrefix}respecttake @usuario 20*\n` +
        `• *${usedPrefix}respectset @usuario 150*`
      )
    }

    if (!db[target]) {
      db[target] = {
        respect: 0,
        robCount: 0,
        windowStart: 0,
        totalRobs: 0,
        punishLevel: 0
      }
    }

    if (cmd === 'respectgive') {
      db[target].respect += amount
    } else if (cmd === 'respecttake') {
      db[target].respect -= amount
      if (db[target].respect < 0) db[target].respect = 0
    } else if (cmd === 'respectset') {
      db[target].respect = amount
    }

    saveRespectDB()

    const rango = getRespectRank(db[target].respect)

    return m.reply(
      `✦ RESPECT actualizado para *@${target.split('@')[0]}*\n\n` +
      `✦ RESPECT: *${db[target].respect}*\n` +
      `✦ Rango: *${rango}*`,
      { mentions: [target] }
    )
  }

  // =============== respecttop ===============
  if (cmd === 'respecttop') {
    const entries = Object.entries(db)
      .filter(([jid, info]) => typeof info.respect === 'number')
      .sort((a, b) => b[1].respect - a[1].respect)
      .slice(0, 10)

    if (!entries.length) {
      return m.reply('✦ No hay datos de RESPECT aún.')
    }

    let texto = '✦ *TOP 10 RESPECT — SW SYSTEM*\n\n'

    let pos = 1
    for (const [jid, info] of entries) {
      const rango = getRespectRank(info.respect)
      const tag = '@' + jid.split('@')[0]
      texto += `${pos}) ${tag} — *${info.respect}* RESPECT (${rango})\n`
      pos++
    }

    return m.reply(texto, {
      mentions: entries.map(([jid]) => jid)
    })
  }
}

handler.help = [
  'mirespect',
  'respecttop',
  'respectreset',
  'respectinfo',
  'respectgive',
  'respecttake',
  'respectset',
  'respectrango'
]

handler.tags = ['respect', 'tools']

handler.command = [
  'mirespect',
  'respecttop',
  'respectreset',
  'respectinfo',
  'respectgive',
  'respecttake',
  'respectset',
  'respectrango'
]

export default handler
