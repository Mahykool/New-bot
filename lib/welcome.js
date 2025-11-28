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

const WELCOME_STATE_FILE = path.join(__dirname, '../temp/welcome_state.json')

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
    const tempDir = path.dirname(WELCOME_STATE_FILE)
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }
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

async function loadImageSmart(src) {
  if (!src) return null
  try {
    if (/^https?:\/\//i.test(src)) {
      const res = await fetch(src)
      if (!res.ok) throw new Error('fetch fail')
      const buf = Buffer.from(await res.arrayBuffer())
      return await loadImage(buf)
    }
    return await loadImage(src)
  } catch { return null }
}

// ✅ TARJETAS ESTILO GTA SA
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

// ✅ LISTAS COMPLETAS SW — GTA SA EDITION
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

// ✅ ENVÍO DEL WELCOME / BYE
export async function sendWelcomeOrBye(conn, { jid, userName = 'Usuario', type = 'welcome', groupName = '', participant }) {
  if (!isWelcomeEnabled(jid)) return null

  const tmp = path.join(__dirname, '../temp')
  ensureDir(tmp)

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

  const title = type === 'welcome' ? pick(WELCOME_TITLES) : pick(BYE_TITLES)
  const subtitle = type === 'welcome' ? [pick(WELCOME_SUBS)] : [pick(BYE_SUBS)]

  const BG_IMAGES = [
    'https://iili.io/KIShsKx.md.jpg',
    'https://iili.io/KIShLcQ.md.jpg',
    'https://iili.io/KISwzI1.md.jpg'
  ]

  let avatarUrl = ''
  try { avatarUrl = await conn.profilePictureUrl(participant, 'image') } catch {}
  if (!avatarUrl) avatarUrl = 'https://files.catbox.moe/xr2m6u.jpg'

  const buff = await makeCard({ title, subtitle, avatarUrl, bgUrl: pick(BG_IMAGES) })
  const file = path.join(tmp, `${type}-${Date.now()}.png`)
  fs.writeFileSync(file, buff)

  const meta = await conn.groupMetadata(jid)
  const totalMembers = meta.participants.length
  const groupSubject = meta.subject

  const number = participant.split('@')[0]
  const taguser = `@${number}`

  const date = new Date().toLocaleString('es-PE', { year: 'numeric', month: '2-digit', day: '2-digit', hour12: false, hour: '2-digit', minute: '2-digit' })

  const productMessage = {
    product: {
      productImage: { url: file },
      productId: '0001',
      title: `${title} — SW SYSTEM`,
      description: '',
      currencyCode: 'USD',
      priceAmount1000: '100000',
      retailerId: 1677,
      url: `https://wa.me/${number}`,
      productImageCount: 1
    },
    businessOwnerJid: participant,
    caption: `╭─ SW SYSTEM ─╮
│ Usuario: ${taguser}
│ Grupo: ${groupSubject}
│ Miembros: ${totalMembers}
│ Fecha: ${date}
╰────────────────╯`,
    footer: 'SW SYSTEM — GTA SA EDITION',
    interactiveButtons: [
      {
        name: 'quick_reply',
        buttonParamsJson: JSON.stringify({
          display_text: '✘ MENU',
          id: '.menu'
        })
      }
    ],
    mentions: [participant]
  }

  await conn.sendMessage(jid, productMessage)
  return file
}

export default { makeCard, sendWelcomeOrBye, isWelcomeEnabled, setWelcomeState }
