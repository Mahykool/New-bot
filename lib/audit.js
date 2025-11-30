// lib/audit.js
import fs from 'fs'
import path from 'path'

const LOG_DIR = path.join(process.cwd(), 'logs')
const LOG_FILE = path.join(LOG_DIR, 'audit.log')

export function auditLog(entry = {}) {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true })
    const line = JSON.stringify({ ts: Date.now(), ...entry }) + '\n'
    fs.appendFileSync(LOG_FILE, line, 'utf8')
  } catch (e) {
    // No bloquear la ejecución por fallo de logging
    try { console.warn('auditLog error', e?.message || e) } catch {}
  }
}
