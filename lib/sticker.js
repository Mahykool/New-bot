// lib/sticker.js
// Parcheado: limpieza de temporales, nombres únicos, detección robusta y export de isWebpBuffer

import { dirname } from 'path'
import { fileURLToPath } from 'url'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import fluent_ffmpeg from 'fluent-ffmpeg'
import { fileTypeFromBuffer } from 'file-type'
import webp from 'node-webpmux'
import fetch from 'node-fetch'

const __dirname = dirname(fileURLToPath(import.meta.url))

/* ---------- utilidades ---------- */
function tmpName(ext = 'tmp') {
  return `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`
}

async function safeUnlink(filePath) {
  try {
    if (!filePath) return
    await fs.promises.unlink(filePath).catch(() => {})
  } catch {}
}

export async function isWebpBuffer(buf) {
  try {
    if (!buf || !Buffer.isBuffer(buf)) return false
    const ft = await fileTypeFromBuffer(buf).catch(() => null)
    return !!(ft && ft.ext === 'webp')
  } catch {
    return false
  }
}

/* ---------- sticker6 (ffmpeg -> webp) ---------- */
function sticker6(img, url) {
  return new Promise(async (resolve, reject) => {
    let tmp = null
    let out = null
    try {
      if (url) {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        img = await res.buffer()
      }
      const type = (await fileTypeFromBuffer(img)) || { mime: 'application/octet-stream', ext: 'bin' }
      if (type.ext === 'bin') throw new Error('Tipo de archivo no soportado')
      tmp = path.join(__dirname, `../tmp/${tmpName(type.ext)}`)
      out = tmp + '.webp'
      await fs.promises.writeFile(tmp, img)

      const Fffmpeg = /video/i.test(type.mime) ? fluent_ffmpeg(tmp).inputFormat(type.ext) : fluent_ffmpeg(tmp).input(tmp)

      Fffmpeg
        .on('error', async function (err) {
          console.error('ffmpeg error:', err)
          await safeUnlink(tmp)
          await safeUnlink(out)
          reject(err)
        })
        .on('end', async function () {
          try {
            await safeUnlink(tmp)
            let resultSticker = await fs.promises.readFile(out)

            // Si el sticker pesa más de 1MB, comprimir
            if (resultSticker.length > 1000000) {
              try {
                resultSticker = await sticker6_compress(img, null)
              } catch (e) {
                // si la compresión falla, seguimos con el original
                console.warn('sticker6: compresión falló', e?.message || e)
              }
            }

            resolve(resultSticker)
          } catch (e) {
            await safeUnlink(tmp)
            await safeUnlink(out)
            reject(e)
          } finally {
            await safeUnlink(out)
          }
        })
        .addOutputOptions([
          '-vcodec',
          'libwebp',
          '-vf',
          `scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15, pad=320:320:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse`
        ])
        .toFormat('webp')
        .save(out)
    } catch (err) {
      await safeUnlink(tmp)
      await safeUnlink(out)
      reject(err)
    }
  })
}

/* ---------- sticker6_compress (ffmpeg con resolución menor) ---------- */
function sticker6_compress(img, url) {
  return new Promise(async (resolve, reject) => {
    let tmp = null
    let out = null
    try {
      if (url) {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        img = await res.buffer()
      }
      const type = (await fileTypeFromBuffer(img)) || { mime: 'application/octet-stream', ext: 'bin' }
      if (type.ext === 'bin') throw new Error('Tipo de archivo no soportado')
      tmp = path.join(__dirname, `../tmp/${tmpName(type.ext)}`)
      out = tmp + '.webp'
      await fs.promises.writeFile(tmp, img)

      const Fffmpeg = /video/i.test(type.mime) ? fluent_ffmpeg(tmp).inputFormat(type.ext) : fluent_ffmpeg(tmp).input(tmp)

      Fffmpeg
        .on('error', async function (err) {
          console.error('ffmpeg compress error:', err)
          await safeUnlink(tmp)
          await safeUnlink(out)
          reject(err)
        })
        .on('end', async function () {
          try {
            await safeUnlink(tmp)
            const buf = await fs.promises.readFile(out)
            resolve(buf)
          } catch (e) {
            await safeUnlink(tmp)
            await safeUnlink(out)
            reject(e)
          } finally {
            await safeUnlink(out)
          }
        })
        .addOutputOptions([
          '-vcodec',
          'libwebp',
          '-vf',
          `scale='min(224,iw)':min'(224,ih)':force_original_aspect_ratio=decrease,fps=15, pad=224:224:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse`
        ])
        .toFormat('webp')
        .save(out)
    } catch (err) {
      await safeUnlink(tmp)
      await safeUnlink(out)
      reject(err)
    }
  })
}

/* ---------- sticker5 (wa-sticker-formatter fallback) ---------- */
async function sticker5(img, url, packname, author, categories = [''], extra = {}) {
  try {
    const { Sticker } = await import('wa-sticker-formatter')
    const buffer = await new Sticker(img ? img : url)
      .setPack(packname || '')
      .setAuthor(author || '')
      .setQuality(10)
      .toBuffer()
    return buffer
  } catch (e) {
    throw e
  }
}

/* ---------- addExif (node-webpmux) ---------- */
async function addExif(webpSticker, packname, author, categories = [''], extra = {}) {
  const img = new webp.Image()
  const stickerPackId = crypto.randomBytes(32).toString('hex')
  const json = {
    'sticker-pack-id': stickerPackId,
    'sticker-pack-name': packname || '',
    'sticker-pack-publisher': author || '',
    emojis: categories || [''],
    ...extra
  }
  const exifAttr = Buffer.from([
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57,
    0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00
  ])
  const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8')
  const exif = Buffer.concat([exifAttr, jsonBuffer])
  exif.writeUIntLE(jsonBuffer.length, 14, 4)
  await img.load(webpSticker)
  img.exif = exif
  return await img.save(null)
}

/* ---------- wrapper principal: intenta métodos y devuelve Buffer con EXIF ---------- */
async function sticker(img, url, ...args) {
  let lastError = null
  const methods = [
    (global.support && global.support.ffmpeg) ? sticker6 : null,
    sticker5
  ].filter(Boolean)

  for (const func of methods) {
    try {
      console.log(`En sticker.js metodo en ejecucion: ${func.name}`)
      const result = await func(img, url, ...args)

      // Si es Buffer, comprobar tipo
      if (Buffer.isBuffer(result)) {
        const ft = await fileTypeFromBuffer(result).catch(() => null)
        if (ft && ft.ext === 'webp') {
          try {
            return await addExif(result, ...args)
          } catch (e) {
            console.warn('addExif falló, devolviendo buffer webp sin exif', e?.message || e)
            return result
          }
        } else {
          // Si no es webp, intentar convertir con addExif si posible
          try {
            return await addExif(result, ...args)
          } catch (e) {
            // no es webp ni convertible
            throw new Error('Resultado no es webp válido')
          }
        }
      }

      // Si la función devolvió string con error, lanzar
      if (typeof result === 'string') {
        throw new Error(result)
      }

      throw new Error('Método no devolvió buffer válido')
    } catch (err) {
      lastError = err
      console.warn(`Método ${func.name} falló:`, err?.message || err)
      continue
    }
  }

  // Si llegamos aquí, todos los métodos fallaron
  console.error('Todos los métodos de sticker fallaron:', lastError)
  throw lastError || new Error('No se pudo generar sticker')
}

/* ---------- soporte detectado (puede ajustarse dinámicamente) ---------- */
const support = {
  ffmpeg: true,
  ffprobe: true,
  ffmpegWebp: true,
  convert: true,
  magick: false,
  gm: false,
  find: false
}

export { sticker, sticker6, addExif, support, sticker6_compress, sticker5 }
