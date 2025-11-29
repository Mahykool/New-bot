// lib/db-respect.js
// Módulo compartido para manejar la DB de RESPECT de forma atómica y segura.
// Exporta: loadRespectDB, saveRespectDB, ensureUserEntry, auditLog, getDBPath

import fs from 'fs'
import path from 'path'

const DB_DIR = path.join(process.cwd(), 'database')
const PATH_RESPECT = path.join(DB_DIR, 'respect.json')
const AUDIT_LOG = path.join(DB_DIR, 'respect-audit.log')

// Asegurar carpeta y archivos
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true })
if (!fs.existsSync(PATH_RESPECT)) fs.writeFileSync(PATH_RESPECT, JSON.stringify({}, null, 2), 'utf8')
if (!fs.existsSync(AUDIT_LOG)) fs.writeFileSync(AUDIT_LOG, '', 'utf8')

// Cargar DB (sin lanzar)
function loadRespectDB() {
  try {
    const raw = fs.readFileSync(PATH_RESPECT, 'utf8')
    return raw.trim() ? JSON.parse(raw) : {}
  } catch (e) {
    console.warn('db-respect: fallo leyendo respect.json', e?.message || e)
    try { fs.writeFileSync(PATH_RESPECT, JSON.stringify({}, null, 2), 'utf8') } catch {}
    return {}
  }
}

// Escritura atómica con lock en memoria
let saving = false
async function saveRespectDB(db) {
  while (saving) await new Promise(r => setTimeout(r, 10))
  try {
    saving = true
    const tmp = PATH_RESPECT + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8')
    fs.renameSync(tmp, PATH_RESPECT)
  } catch (e) {
    console.error('db-respect: fallo guardando respect.json', e)
    throw e
  } finally {
    saving = false
  }
}

// Asegurar estructura de usuario
function ensureUserEntry(db, jid) {
  if (!jid) return
  if (!db[jid]) {
    db[jid] = {
      respect: 0,
      robCount: 0,
      windowStart: 0,
      totalRobs: 0,
      punishLevel: 0
    }
  }
}

// Auditoría simple (append)
function auditLog(line) {
  try {
    const entry = `[${new Date().toISOString()}] ${line}\n`
    fs.appendFileSync(AUDIT_LOG, entry, 'utf8')
  } catch (e) {
    console.warn('db-respect: fallo escribiendo audit log', e?.message || e)
  }
}

export {
  PATH_RESPECT as getDBPath,
  loadRespectDB,
  saveRespectDB,
  ensureUserEntry,
  auditLog
}
