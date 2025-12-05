// validate-commands.js — Auditor automático de comandos SW
// Recorre global.plugins y compara con plugin-permissions.json
// Genera sugerencias de actualización para mantener sincronía

import fs from 'fs'
import path from 'path'

// Ruta a tu archivo de permisos
const PERMISSIONS_FILE = path.join(process.cwd(), 'database', 'plugin-permissions.json')

// Cargar permisos
const permissions = JSON.parse(fs.readFileSync(PERMISSIONS_FILE, 'utf8'))

export function validateCommands(globalPlugins) {
  const report = []

  for (const [pluginId, plugin] of Object.entries(globalPlugins)) {
    if (!plugin?.command) continue
    const cmds = Array.isArray(plugin.command) ? plugin.command : [plugin.command]

    // Buscar sección en JSON
    const section = permissions[pluginId]
    if (!section) {
      report.push(`⚠️ Plugin "${pluginId}" no tiene sección en plugin-permissions.json`)
      // Sugerencia: crear bloque nuevo
      const suggestion = {}
      cmds.forEach(c => { suggestion[c] = 'basic' })
      report.push(`👉 Sugerencia para "${pluginId}":\n${JSON.stringify({ [pluginId]: suggestion }, null, 2)}`)
      continue
    }

    // Comandos en JSON
    const jsonCmds = Object.keys(section)

    // Faltantes
    const missing = cmds.filter(c => !jsonCmds.includes(c))
    if (missing.length) {
      report.push(`⚠️ En "${pluginId}" faltan en plugin-permissions.json: ${missing.join(', ')}`)
      const suggestion = { ...section }
      missing.forEach(c => { suggestion[c] = 'basic' })
      report.push(`👉 Sugerencia para "${pluginId}":\n${JSON.stringify({ [pluginId]: suggestion }, null, 2)}`)
    }

    // Sobrantes
    const extra = jsonCmds.filter(c => !cmds.includes(c))
    if (extra.length) {
      report.push(`ℹ️ En "${pluginId}" hay comandos extra en plugin-permissions.json: ${extra.join(', ')}`)
    }
  }

  // Resultado
  if (report.length === 0) {
    console.log('✅ Todos los comandos están sincronizados con plugin-permissions.json')
  } else {
    console.log('🔎 Reporte de validación:')
    report.forEach(r => console.log(r))
  }
}
