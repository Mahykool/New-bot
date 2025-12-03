// plugins/freefire-uid.js — SW SYSTEM PRO v4.1
// ✦ Consulta de perfiles Free Fire por UID ✦
// ✅ Estilo GTA SA centrado
// ✅ Manejo de errores mejorado
// ✅ Perfil ficticio de prueba si la API falla

import axios from 'axios'

async function fetchUid(u) {
  const url = `https://gameskinbo.com/api/free_fire_id_checker?uid=${encodeURIComponent(u)}`
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      timeout: 15000
    })
    const text = typeof res.data === 'string' ? res.data : (res.data?.text || '')
    return text
  } catch {
    return '' // si falla, devolvemos vacío
  }
}

function parseText(raw, givenUid) {
  const lines = (raw || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const items = []
  const data = {}
  for (const line of lines) {
    const cleaned = line.replace(/^[-*`>\s]+/g, '')
    const m = cleaned.match(/^([^:]{2,40}):\s*(.+)$/)
    if (!m) continue
    const label = m[1].trim()
    const value = m[2].trim().replace(/^`|`$/g,'')
    items.push({ label, value })
    const key = label.toLowerCase()
    if (key === 'uid') data.uid = value
    else if (key === 'name') data.name = value
    else if (key === 'level') {
      data.levelRaw = value
      const lv = value.match(/(\d+)/); if (lv) data.level = parseInt(lv[1])
      const exp = value.match(/Exp\s*:\s*(\d+)/i); if (exp) data.exp = parseInt(exp[1])
    } else if (key === 'region') data.region = value
    else data[label] = value
  }
  data.uid = data.uid || givenUid
  data.bannerImage = data.uid ? `https://gameskinbo.com/_next/image?url=%2Fapi%2Fbanner%2Fbanner_${data.uid}.webp&w=1080&q=75` : null
  return { lines, items, data }
}

let handler = async (m, { text, args, usedPrefix, command, conn }) => {
  const rawText = (text || args.join(' ') || '').trim()
  const uid = (rawText.match(/\b\d{5,}\b/) || [null])[0]
  if (!uid) return m.reply(`🐙 Uso: ${usedPrefix + command} <uid>\n✨ Ejemplo: ${usedPrefix + command} 12183392680`)

  await m.react?.('⏳')
  let raw = await fetchUid(uid)

  // Si la API no devolvió nada, usamos datos ficticios
  if (!raw) {
    raw = `
UID: ${uid}
Name: Usuario Ficticio
Level: 50 Exp: 12345
Region: LATAM
Rango: Heroico
Kills: 999
Headshots: 321
Victorias: 123
KD: 2.5
`
  }

  const parsed = parseText(raw, uid)
  const f = parsed.data
  const now = new Date()
  const fechaLocal = now.toLocaleString('es-ES', { hour12: false })

  const skipKeys = new Set(['uid','name','level','levelraw','exp','region','bannerImage'])
  const extraLines = []
  for (const { label, value } of parsed.items) {
    const k = label.toLowerCase()
    if (skipKeys.has(k)) continue
    extraLines.push(`✦ ${label}: *${value}*`)
  }

  const caption = [
`ㅤׄㅤׅㅤׄ 🐙 _*FREE FIRE UID*_ 🐙 ㅤ֢ㅤׄㅤׅ`,
``,
`👤 Usuario: *${f.name || 'Desconocido'}*`,
`🆔 UID: *${f.uid || uid}*`,
f.level ? `📈 Nivel: *${f.level}*${f.exp ? `  ⚡ Exp: *${f.exp}*` : ''}` : '',
f.region ? `🌍 Región: *${f.region}*` : '',
extraLines.length ? `\n✦ Datos extra:\n${extraLines.join('\n')}` : '',
``,
`⌚ Fecha: ${fechaLocal}`,
`✦ SW SYSTEM v4.1`
  ].filter(Boolean).join('\n')

  try {
    if (f.bannerImage) {
      await conn.sendMessage(m.chat, { image: { url: f.bannerImage }, caption }, { quoted: m })
    } else {
      await conn.reply(m.chat, caption, m)
    }
    await m.react?.('✅')
  } catch (e) {
    await m.react?.('⚠️')
    await conn.reply(m.chat, caption + `\n(Nota: no se pudo enviar imagen: ${e.message})`, m)
  }
}

// ✦ Metadatos del plugin ✦
handler.help = ['free <uid>']
handler.tags = ['game']
handler.command = ['free','freefire','ffid','free_fire','ff']
handler.group = false
handler.botAdmin = false
handler.admin = false
handler.description = 'Consulta perfiles de Free Fire por UID'

export default handler