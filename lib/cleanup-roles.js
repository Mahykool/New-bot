// lib/cleanup-roles.js
import fs from 'fs'
import path from 'path'

const USER_ROLES_FILE = path.join('./database', 'user-roles.json')

function loadJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return {}
  }
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2))
}

export function cleanupUserRoles() {
  let userRolesDB = loadJSON(USER_ROLES_FILE)
  const cleaned = {}
  let changed = false

  for (const jid of Object.keys(userRolesDB)) {
    // descartar claves inválidas
    if (!jid || jid === 'null' || jid === 'undefined' || jid === 'null@s.whatsapp.net') {
      changed = true
      continue
    }
    cleaned[jid] = userRolesDB[jid]
  }

  if (changed) {
    saveJSON(USER_ROLES_FILE, cleaned)
    console.log('[CLEANUP] user-roles.json limpiado de entradas inválidas.')
  }
}