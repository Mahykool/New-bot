
import { smsg } from './lib/simple.js'
import { format } from 'util'
import { fileURLToPath } from 'url'
import path, { join } from 'path'
import { unwatchFile, watchFile } from 'fs'
import chalk from 'chalk'
import fetch from 'node-fetch'

if (typeof global.__filename !== 'function') global.__filename = u => fileURLToPath(u)
if (typeof global.__dirname !== 'function') global.__dirname = u => path.dirname(fileURLToPath(u))

const { proto } = (await import('@whiskeysockets/baileys')).default
const isNumber = x => typeof x === 'number' && !isNaN(x)
const delay = ms => isNumber(ms) && new Promise(resolve => setTimeout(function () { clearTimeout(this); resolve() }, ms))

const toNum = v => (v + '').replace(/[^0-9]/g, '')
const localPart = v => (v + '').split('@')[0].split(':')[0].split('/')[0].split(',')[0]
const normalizeCore = v => toNum(localPart(v))
const prettyNum = v => { const n = normalizeCore(v); if (!n) return ''; return `+${n}` }

const normalizeJid = v => {
    if (!v) return ''
    if (typeof v === 'number') v = String(v)
    v = (v + '').trim()
    if (v.startsWith('@')) v = v.slice(1)
    if (v.endsWith('@g.us')) return v
    if (v.includes('@s.whatsapp.net')) {
        const n = toNum(v.split('@')[0])
        return n ? n + '@s.whatsapp.net' : v
    }
    const n = toNum(v)
    return n ? n + '@s.whatsapp.net' : v
}

const cleanJid = jid => jid?.split(':')[0] || ''
function decodeJidCompat(jid = '') { if (!jid) return jid; if (/:[0-9A-Fa-f]+@/.test(jid)) { const [user, server] = jid.split('@'); return user.split(':')[0] + '@' + server } return jid }

if (!global.db) global.db = { data: { users: {}, chats: {}, settings: {}, stats: {} } }
if (!global.db.data) global.db.data = { users: {}, chats: {}, settings: {}, stats: {} }
if (typeof global.loadDatabase !== 'function') global.loadDatabase = async () => {}



function pickOwners() {
  const arr = Array.isArray(global.owner) ? global.owner : []
  const flat = []
  for (const v of arr) {
    if (Array.isArray(v)) flat.push({ num: normalizeCore(v[0]), root: !!v[2] })
    else flat.push({ num: normalizeCore(v), root: false })
  }
  return flat
}

function isOwnerJid(jid) {
  const num = normalizeCore(jid)
  return pickOwners().some(o => o.num === num)
}

function isRootOwnerJid(jid) {
  const num = normalizeCore(jid)
  return pickOwners().some(o => o.num === num && o.root)
}

function isPremiumJid(jid) {
  const num = normalizeCore(jid)
  const prems = Array.isArray(global.prems) ? global.prems.map(normalizeCore) : []
  if (prems.includes(num)) return true
  const u = global.db?.data?.users?.[`${num}@s.whatsapp.net`]
  return !!u?.premium
}

// roleFor corregido
const roleFor = async (jid) => {
  const num = normalizeCore(jid)
  const base = { 
    isOwner: isOwnerJid(num), 
    isROwner: isRootOwnerJid(num), 
    isPrems: isPremiumJid(num), 
    isMods: Array.isArray(global.mods) && global.mods.includes(num), 
    isAdmin: false, 
    isBotAdmin: false 
  }

  if (m.isGroup) {
    const p = participantsNormalized.find(x => x.widNum === num)
    base.isAdmin = !!p?.isAdmin

    const b = participantsNormalized.find(x => botNums.includes(x.widNum))
    base.isBotAdmin = !!b?.isAdmin
  }

  return base
}

// badgeFor corregido
const badgeFor = async (jid) => {
  const r = await roleFor(jid)
  const b = []
  if (r.isROwner) b.push('CREATOR')
  else if (r.isOwner) b.push('OWNER')
  if (r.isMods) b.push('MOD')
  if (r.isAdmin) b.push('ADMIN')
  if (r.isPrems) b.push('PREMIUM')
  if (Array.isArray(global.botNums) && global.botNums.includes(normalizeCore(jid))) b.push('BOT')
  return b
}

export async function handler(chatUpdate) {
  this.msgqueque = this.msgqueque || []
  if (!chatUpdate) return
  this.__waCache = this.__waCache || new Map()
  this._groupCache = this._groupCache || {}

  try {
    const botIdKey = this.user?.jid || (this.user?.id ? this.decodeJid(this.user.id) : 'bot')
    global.db.data.settings[botIdKey] = global.db.data.settings[botIdKey] || {}
    if (typeof global.db.data.settings[botIdKey].autotypeDotOnly !== 'boolean') {
      global.db.data.settings[botIdKey].autotypeDotOnly = false
    }
  } catch {}

  // presencia corregida
  if (!this._presenceWrapped) {
    const origPresence = typeof this.sendPresenceUpdate === 'function' ? this.sendPresenceUpdate.bind(this) : null
    this._presenceGates = this._presenceGates || new Map()
    this.sendPresenceUpdate = async (state, jid) => {
      try {
        const allowed = this._presenceGates?.get(jid)
        if (!allowed) return
      } catch {}
      if (typeof origPresence === 'function') return origPresence(state, jid)
    }
    this._presenceWrapped = true
  }

  this.pushMessage(chatUpdate.messages).catch(console.error)
  let m = chatUpdate.messages[chatUpdate.messages.length - 1]
  if (!m) return

  if (!global.db) global.db = { data: { users: {}, chats: {}, settings: {}, stats: {} } }
  if (!global.db.data) global.db.data = { users: {}, chats: {}, settings: {}, stats: {} }
  if (global.db.data == null) await global.loadDatabase()
  if (!global.db.data.users) global.db.data.users = {}
  if (!global.db.data.chats) global.db.data.chats = {}
  if (!global.db.data.settings) global.db.data.settings = {}
  if (!global.db.data.stats) global.db.data.stats = {}

  try {
    m = smsg(this, m) || m
    if (!m) return

    if (!m.isGroup) return
    m.exp = 0
    m.limit = false

    // inicialización de usuario
    const numKey = String(m.sender).split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
    let user = global.db.data.users[m.sender]
    if (!user) global.db.data.users[m.sender] = { exp: 0, limit: 10, registered: false, name: m.name, age: null, regTime: -1, afk: -1, afkReason: '', banned: false, bank: 0, level: 0 }
    user = global.db.data.users[m.sender]

    // inicialización de chat
    let chat = global.db.data.chats[m.chat]
    if (typeof chat !== 'object') global.db.data.chats[m.chat] = {}
    const cfgDefaults = (global.chatDefaults && typeof global.chatDefaults === 'object') ? global.chatDefaults : {}
    for (const [k, v] of Object.entries(cfgDefaults)) { if (!(k in chat)) chat[k] = v }

    m.displayTag = await displayTag(m.sender)
    m.badges = await badgeFor(m.sender)
    m.role = await roleFor(m.sender)
  } catch (e) { console.error(e) }

    const ___dirname = path.join(path.dirname(fileURLToPath(import.meta.url)), './plugins')
    for (let name in global.plugins) {
      let plugin = global.plugins[name]
      if (!plugin) continue
      if (plugin.disabled) continue
      const __filename = join(___dirname, name)

      let _prefix = plugin.customPrefix ? plugin.customPrefix : /^[./!#]/
      let match = (_prefix instanceof RegExp ?
        [[_prefix

