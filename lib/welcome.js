// welcome.js — SW SYSTEM PRO
/*
███████╗██╗    ██╗██╗██╗     ██╗     
██╔════╝██║    ██║██║██║     ██║     
███████╗██║ █╗ ██║██║██║     ██║     
╚════██║██║███╗██║██║██║     ██║     
███████║╚███╔███╔╝██║███████╗███████╗
╚══════╝ ╚══╝╚══╝ ╚═╝╚══════╝╚══════╝
✦ SW SYSTEM — GTA SA EDITION
✦ DESARROLLADO POR: Mahykol
✦ VERSIÓN: 3.9.0 PRO
*/

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { jidNormalizedUser } from '@whiskeysockets/baileys'
import fetch from 'node-fetch'

/* ============================
   RUTAS Y DIRECTORIOS
============================ */
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const TEMP_DIR = path.join(__dirname, '../temp')
const WELCOME_STATE_FILE = path.join(TEMP_DIR, 'welcome_state.json')

try { fs.mkdirSync(TEMP_DIR, { recursive: true }) } catch {}

/* ============================
   CACHE EN MEMORIA
============================ */
let welcomeStateCache = null

function loadWelcomeState() {
  if (welcomeStateCache) return welcomeStateCache
  try {
    if (fs.existsSync(WELCOME_STATE_FILE)) {
      welcomeStateCache = JSON.parse(fs.readFileSync(WELCOME_STATE_FILE, 'utf8'))
      return welcomeStateCache
    }
  } catch (e) {
    console.error('Error loading welcome state:', e)
  }
  welcomeStateCache = {}
  return welcomeStateCache
}

function saveWelcomeState(state) {
  try {
    fs.mkdirSync(path.dirname(WELCOME_STATE_FILE), { recursive: true })
    fs.writeFileSync(WELCOME_STATE_FILE, JSON.stringify(state, null, 2))
    welcomeStateCache = state
  } catch (e) {
    console.error('Error saving welcome state:', e)
  }
}

/* ============================
   API PRINCIPAL
============================ */
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

function ensureDir(p) {
  try { fs.mkdirSync(p, { recursive: true }) } catch {}
}

/* ============================
   FETCH CON TIMEOUT
============================ */
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

/* ============================
   LIMPIEZA DE TEMPORALES
============================ */
function cleanupTempOlderThan(minutes = 60) {
  try {
    const files = fs.readdirSync(TEMP_DIR)
    const cutoff = Date.now() - minutes * 60 * 1000
    for (const f of files) {
      try {
        const fp = path.join(TEMP_DIR, f)
        const stat = fs.statSync(fp)
        if (stat.mtimeMs < cutoff) fs.unlinkSync(fp)
      } catch {}
    }
  } catch {}
}

setInterval(() => cleanupTempOlderThan(60), 1000 * 60 * 30)

/* ============================
   CARGA DE IMÁGENES
============================ */
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

/* ============================
   TARJETAS GTA SA
============================ */
export async function makeCard({ title = 'SW — WELCOME', subtitle = '', avatarUrl = '', bgUrl = '' }) {
  const width = 900, height = 380
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')

  // Fondo
  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, '#0a0a0a')
  gradient.addColorStop(1, '#1b1b1b')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  // Borde
  ctx.lineWidth = 12
  ctx.strokeStyle = '#00aaff'
  ctx.strokeRect(6, 6, width - 12, height - 12)

  // Fondo con imagen
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

  // Avatar circular
  try {
    const badge = await loadImageSmart(avatarUrl)
    const r = 80
    const cx = width / 2
    const cy = 160

    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.closePath()
    ctx.clip()

    if (badge) ctx.drawImage(badge, cx - r, cy - r, r * 2, r * 2)
    ctx.restore()

    ctx.lineWidth = 6
    ctx.strokeStyle = '#00aaff'
    ctx.beginPath()
    ctx.arc(cx, cy, r + 4, 0, Math.PI * 2)
    ctx.stroke()
  } catch {}

  // Título
  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = '#000'
  ctx.shadowBlur = 8
  ctx.font = 'bold 52px Sans'
  ctx.fillText(title, width / 2, 70)
  ctx.shadowBlur = 0

  // Subtítulos
  ctx.fillStyle = '#d8e1e8'
  ctx.font = '28px Sans'
  const lines = Array.isArray(subtitle) ? subtitle : [subtitle]
  const baseY = 160 + 80 + 40
  lines.forEach((t, i) => ctx.fillText(String(t || ''), width / 2, baseY + i * 34))

  return canvas.toBuffer('image/png')
}

/* ============================
   TEXTOS ALEATORIOS
============================ */
const WELCOME_TITLES = [
  'SW — BIENVENIDO',
  'SW — NUEVO MIEMBRO',
  'SW — ENTRANDO AL BARRIO',
  'SW — WELCOME',
  'SW — PLAYER CONNECTED'
]

const BYE_TITLES = [
  'SW — ADIÓS',
  'SW — SALIENDO DEL BARRIO',
  'SW — PLAYER LEFT',
  'SW — MISSION FAILED'
]

const WELCOME_SUBS = [
  'Bienvenido al territorio SW',
  'Respeta las reglas del barrio',
  'El barrio te recibe',
  'Disfruta tu estadía'
]

const BYE_SUBS = [
  'El jugador ha abandonado la zona',
  'Nos vemos en otra misión',
  'Player disconnected'
]

/* ============================
   ENVÍO DE WELCOME / BYE
============================ */
export async function sendWelcomeOrBye(conn, { jid, userName = 'Usuario', type = 'welcome', groupName = '', participant }) {
  try {
    if (!jid) return null
    if (!isWelcomeEnabled(jid)) return null

    let participantJid = ''
    if (typeof participant === 'string') participantJid = participant
    else if (participant?.id) participantJid = participant.id

    if (!participantJid) return null
    participantJid = jidNormalizedUser(participantJid)

    ensureDir(TEMP_DIR)

    const pick = arr => arr[Math.floor(Math.random() * arr.length)]

    const title = type === 'welcome' ? pick(WELCOME_TITLES) : pick(BYE_TITLES)
    const subtitle = type === 'welcome' ? [pick(WELCOME_SUBS)] : [pick(BYE_SUBS)]

    const BG_IMAGES = [
      'https://iili.io/KIShsKx.md.jpg',
      'https://iili.io/KIShLcQ.md.jpg',
      'https://iili.io/KISwzI1.md.jpg'
    ]

    // Avatar
    let avatarUrl = ''
    try {
      avatarUrl = await conn.profilePictureUrl(participantJid, 'image')
    } catch {
      avatarUrl = 'https://files.catbox.moe/xr2m6u.jpg'
    }

    const buff = await makeCard({ title, subtitle, avatarUrl, bgUrl: pick(BG_IMAGES) })
    const file = path.join(TEMP_DIR, `${type}-${Date.now()}-${Math.random().toString(36).slice(2,8)}.png`)

    try {
      await fs.promises.writeFile(file, buff)
    } catch {
      fs.writeFileSync(file, buff)
    }

    // Metadata del grupo
    let meta = null
    try { meta = await conn.groupMetadata(jid) } catch {}

    const totalMembers = meta?.participants?.length || 'N/A'
    const groupSubject = meta?.subject || groupName || 'Grupo'

    const tag = `@${participantJid.split('@')[0]}`
    const date = new Date().toLocaleString('es-PE', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour12: false, hour: '2-digit', minute: '2-digit'
    })

    const caption = [
      '╭─ SW SYSTEM ─╮',
      `│ Usuario: ${tag}`,
      `│ Grupo: ${groupSubject}`,
      `│ Miembros: ${totalMembers}`,
      `│ Fecha: ${date}`,
      '╰────────────────╯'
    ].join('\n')

    const mentions = [participantJid]

    try {
      await conn.sendMessage(jid, { image: buff, caption, mentions })
    } catch (e) {
      console.error('Error enviando welcome/bye:', e)
    }

    return file
  } catch (err) {
    console.error('sendWelcomeOrBye fallo inesperado:', err)
    return null
  }
}

export default { makeCard, sendWelcomeOrBye, isWelcomeEnabled, setWelcomeState }
