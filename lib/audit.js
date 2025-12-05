import { formatUserTag } from '../lib/utils.js'

export async function auditLog(entry = {}, conn) {
  try {
    const ts = new Date().toLocaleString('es-CL', { hour12: false })
    const actorName = entry.actor ? await formatUserTag(conn, entry.actor) : '-'
    const targetName = entry.target ? await formatUserTag(conn, entry.target) : '-'

    let line = `[${ts}] `
    switch (entry.action) {
      case 'SHADOW':
        line += `👤 SHADOW → actor: ${actorName} → target: ${targetName} (${entry.extra || 'sin duración'})`
        break
      case 'UNSHADOW':
        line += `✅ UNSHADOW → actor: ${actorName} → target: ${targetName}`
        break
      case 'AUTO-UNSHADOW':
        line += `⏱️ AUTO-UNSHADOW → target: ${targetName} (expiró automáticamente)`
        break
      case 'TEMP-SHADOW':
        line += `⚠️ TEMP-SHADOW → ${actorName} fue castigado 15m (intentó shadowbanear al creador)`
        break
      case 'KICK':
        line += `👢 KICK → actor: ${actorName} → target: ${targetName}`
        break
      case 'KICK-ATTEMPT':
        line += `💀 KICK-ATTEMPT → actor: ${actorName} intentó expulsar al creador (${targetName})`
        break
      default:
        line += `${entry.action} → actor: ${actorName} → target: ${targetName}`
    }

    // Guardar en archivo
    const LOG_DIR = path.join(process.cwd(), 'logs')
    const LOG_FILE = path.join(LOG_DIR, 'audit.log')
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true })
    fs.appendFileSync(LOG_FILE, line + '\n', 'utf8')
  } catch (e) {
    console.warn('auditLog error', e?.message || e)
  }
}