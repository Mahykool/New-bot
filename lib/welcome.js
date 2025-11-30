// welcome.js
/*
███████╗██╗    ██╗██╗██╗     ██╗     
██╔════╝██║    ██║██║██║     ██║     
███████╗██║ █╗ ██║██║██║     ██║     
╚════██║██║███╗██║██║██║     ██║     
███████║╚███╔███╔╝██║███████╗███████╗
╚══════╝ ╚══╝╚══╝ ╚═╝╚══════╝╚══════╝
✦ SW SYSTEM — GTA SA EDITION
✦ DESARROLLADO POR: Mahykol
✦ VERSIÓN: 3.8.0
*/

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { jidNormalizedUser } from '@whiskeysockets/baileys'
import fetch from 'node-fetch'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const TEMP_DIR = path.join(__dirname, '../temp')
const WELCOME_STATE_FILE = path.join(TEMP_DIR, 'welcome_state.json')

// Asegurar existencia de temp al cargar el módulo
try { fs.mkdirSync(TEMP_DIR, { recursive: true }) } catch (e) { /* ignore */ }

// -------------------------------
// Helpers JSON
// -------------------------------
function loadWelcomeState() {
  try {
    if (fs.existsSync(WELCOME_STATE_FILE)) {
      return JSON.parse(fs.readFileSync(WELCOME_STATE_FILE, 'utf8'))
    }
  } catch (error) {
    console.error('Error loading welcome state:', error)
  }
  return {}
}

function saveWelcomeState(state) {
  try {
    fs.mkdirSync(path.dirname(WELCOME_STATE_FILE), { recursive: true })
    fs.writeFileSync(WELCOME_STATE_FILE, JSON.stringify(state, null, 2))
  } catch (error) {
    console.error('Error saving welcome state:', error)
  }
}

export function isWelcomeEnabled(jid) {
  const state = loadWelcomeState()
  return state[jid] !== false
}

export function setWelcomeState(jid, enabled) {
  const state = loadWelcomeState()
  state[jid] = enabled
  saveWelcomeState(state)
  return enabled
}

function ensureDir(p) { try { fs.mkdirSync(p, { recursive: true }) } catch {} }

// -------------------------------
// Fetch con timeout
// -------------------------------
async function fetchWithTimeout(url, ms = 5000) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), ms)
  try {
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(id)
    return res
  } catch (e) {
    clearTimeout(id)
    throw e
  }
}

// -------------------------------
// Limpieza de temporales antiguos
// -------------------------------
function cleanupTempOlderThan(minutes = 30) {
  try {
    const files = fs.readdirSync(TEMP_DIR)
    const cutoff = Date.now() - minutes * 60 * 1000
    for (const f of files) {
      try {
        const fp = path.join(TEMP_DIR, f)
        const stat = fs.statSync(fp)
        if (stat.mtimeMs < cutoff) {
          fs.unlinkSync(fp)
        }
      } catch {}
    }
  } catch {}
}
// Ejecutar limpieza periódica en background (no bloqueante)
setInterval(() => { try { cleanupTempOlderThan(60) } catch {} }, 1000 * 60 * 30)

// -------------------------------
// Carga de imágenes con timeout y soporte remoto/local
// -------------------------------
async function loadImageSmart(src) {
  if (!src) return null
  try {
    if (/^https?:\/\//i.test(src)) {
      const res = await fetchWithTimeout(src, 6000)
      if (!res.ok) throw new Error('fetch fail')
      const buf = Buffer.from(await res.arrayBuffer())
      return await loadImage(buf)
    }
    return await loadImage(src)
  } catch {
    return null
  }
}

// -------------------------------
// TARJETAS ESTILO GTA SA
// -------------------------------
export async function makeCard({ title = 'SW — WELCOME', subtitle = '', avatarUrl = '', bgUrl = '' }) {
  const width = 900, height = 380
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')

  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, '#0a0a0a')
  gradient.addColorStop(1, '#1b1b1b')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  ctx.lineWidth = 12
  ctx.strokeStyle = '#00aaff'
  ctx.strokeRect(6, 6, width - 12, height - 12)

  if (bgUrl) {
    try {
      const bg = await loadImageSmart(bgUrl)
      const pad = 18
      ctx.globalAlpha = 0.85
      if (bg) ctx.drawImage(bg, pad, pad, width - pad * 2, height - pad * 2)
      ctx.globalAlpha = 1
      ctx.fillStyle = 'rgba(0,0,0,0.45)'
      ctx.fillRect(pad, pad, width - pad * 2, height - pad * 2)
    } catch {}
  }

  let centerR = 80
  let centerCX = Math.round(width / 2)
  let centerCY = 160

  try {
    const badge = await loadImageSmart(avatarUrl)
    ctx.save()
    ctx.beginPath(); ctx.arc(centerCX, centerCY, centerR, 0, Math.PI * 2); ctx.closePath(); ctx.clip()
    if (badge) ctx.drawImage(badge, centerCX - centerR, centerCY - centerR, centerR * 2, centerR * 2)
    ctx.restore()
    ctx.lineWidth = 6
    ctx.strokeStyle = '#00aaff'
    ctx.beginPath(); ctx.arc(centerCX, centerCY, centerR + 4, 0, Math.PI * 2); ctx.stroke()
  } catch {}

  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = '#000000'
  ctx.shadowBlur = 8
  ctx.font = 'bold 52px Sans'
  ctx.fillText(title, width / 2, 70)
  ctx.shadowBlur = 0

  ctx.fillStyle = '#d8e1e8'
  ctx.font = '28px Sans'
  const lines = Array.isArray(subtitle) ? subtitle : [subtitle]
  const subBaseY = centerCY + centerR + 40
  lines.forEach((t, i) => ctx.fillText(String(t || ''), width / 2, subBaseY + i * 34))

  return canvas.toBuffer('image/png')
}

// -------------------------------
// Textos y listas
// -------------------------------
const WELCOME_TITLES = [
  'SW — BIENVENIDO',
  'SW — NUEVO MIEMBRO',
  'SW — ENTRANDO AL BARRIO',
  'SW — NUEVO SOLDADO',
  'SW — WELCOME',
  'SW — NEW MEMBER',
  'SW — ENTERING THE HOOD',
  'SW — JOINED THE GANG',
  'SW — PLAYER CONNECTED'
]

const BYE_TITLES = [
  'SW — ADIÓS',
  'SW — SALIENDO DEL BARRIO',
  'SW — JUGADOR DESCONECTADO',
  'SW — MISIÓN FALLIDA',
  'SW — GOODBYE',
  'SW — PLAYER LEFT',
  'SW — EXITING THE HOOD',
  'SW — MISSION FAILED',
  'SW — PLAYER DISCONNECTED'
]

const WELCOME_SUBS = [
  'Bienvenido al territorio SW',
  'Respeta las reglas del barrio',
  'El barrio te recibe',
  'Prepárate para la acción',
  'Disfruta tu estadía',
  'Welcome to the SW hood',
  'Stay sharp, stay active',
  'The gang is watching',
  'Llegaste… ahora no te quejes',
  'Bienvenido, no hacemos reembolsos',
  'Otro valiente entra al barrio',
  'Ojalá no seas tóxico… o sí',
  'Pasa, pero deja los problemas afuera',
  'Entraste… ahora te aguantamos',
  'Welcome, try not to die',
  'New player joined… suerte con eso'
]

const BYE_SUBS = [
  'El jugador ha abandonado la zona',
  'Otro miembro deja el barrio',
  'Nos vemos en otra misión',
  'Suerte en tu camino',
  'Player disconnected from the hood',
  'Mission failed, we’ll get ‘em next time',
  'Se fue… nadie lloró',
  'Otro que abandona la misión',
  'Adiós, no olvides cerrar la puerta',
  'Se fue sin pagar la mensualidad',
  'Menos carga para el grupo',
  'Chao, vuelve cuando seas pro',
  'Player left… finally',
  'Mission failed, bro just rage quit'
]

// -------------------------------
// ENVÍO DEL WELCOME / BYE
// -------------------------------
export async function sendWelcomeOrBye(conn, { jid, userName = 'Usuario', type = 'welcome', groupName = '', participant }) {
  try {
    if (!jid) return null
    if (!isWelcomeEnabled(jid)) return null

    // Normalizar participant y validar
    let participantJid = ''
    if (typeof participant === 'string') participantJid = participant
    else if (participant && typeof participant === 'object') participantJid = participant.id || participant.jid || ''
    if (!participantJid) {
      console.warn('sendWelcomeOrBye: participant inválido', participant)
      return null
    }
    participantJid = jidNormalizedUser(participantJid)

    ensureDir(TEMP_DIR)

    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

    const title = type === 'welcome' ? pick(WELCOME_TITLES) : pick(BYE_TITLES)
    const subtitle = type === 'welcome' ? [pick(WELCOME_SUBS)] : [pick(BYE_SUBS)]

    const BG_IMAGES = [
      'https://iili.io/KIShsKx.md.jpg',
      'https://iili.io/KIShLcQ.md.jpg',
      'https://iili.io/KISwzI1.md.jpg'
    ]

    // Obtener avatar con timeout
    let avatarUrl = ''
    try {
      if (typeof conn.profilePictureUrl === 'function') {
        try {
          avatarUrl = await conn.profilePictureUrl(participantJid, 'image')
        } catch {
          avatarUrl = ''
        }
      }
    } catch {
      avatarUrl = ''
    }
    if (!avatarUrl) avatarUrl = 'https://files.catbox.moe/xr2m6u.jpg'

    const buff = await makeCard({ title, subtitle, avatarUrl, bgUrl: pick(BG_IMAGES) })
    const file = path.join(TEMP_DIR, `${type}-${Date.now()}-${Math.random().toString(36).slice(2,8)}.png`)
    try {
      await fs.promises.writeFile(file, buff)
    } catch (e) {
      // fallback a escritura síncrona si falla (muy raro)
      try { fs.writeFileSync(file, buff) } catch (err) { console.error('Error escribiendo archivo welcome:', err) }
    }

    // Obtener metadata del grupo con protección
    let meta = null
    try {
      if (typeof conn.groupMetadata === 'function') {
        meta = await conn.groupMetadata(jid)
      }
    } catch (err) {
      console.warn('No se pudo obtener groupMetadata:', err)
      meta = null
    }

    const totalMembers = (meta && Array.isArray(meta.participants)) ? meta.participants.length : 'N/A'
    const groupSubject = (meta && meta.subject) ? meta.subject : groupName || 'Grupo'

    const number = (participantJid || '').split('@')[0]
    const taguser = `@${number}`

    const date = new Date().toLocaleString('es-PE', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour12: false, hour: '2-digit', minute: '2-digit'
    })

    const caption = [
      '╭─ SW SYSTEM ─╮',
      `│ Usuario: ${taguser}`,
      `│ Grupo: ${groupSubject}`,
      `│ Miembros: ${totalMembers}`,
      `│ Fecha: ${date}`,
      '╰────────────────╯'
    ].join('\n')

    const mentions = [participantJid]

    // Intentar enviar con sendMessage; fallback a sendFile si existe
    try {
      if (typeof conn.sendMessage === 'function') {
        await conn.sendMessage(jid, { image: await fs.promises.readFile(file), caption, mentions }, { quoted: null })
      } else if (typeof conn.sendFile === 'function') {
        await conn.sendFile(jid, file, path.basename(file), caption, { mentions })
      } else {
        // Si no hay métodos estándar, devolver la ruta del archivo para que el caller lo maneje
        return file
      }
    } catch (sendErr) {
      console.error('Error enviando welcome/bye:', sendErr)
      return file
    }

    return file
  } catch (err) {
    console.error('sendWelcomeOrBye fallo inesperado:', err)
    return null
  }
}

export default { makeCard, sendWelcomeOrBye, isWelcomeEnabled, setWelcomeState }
