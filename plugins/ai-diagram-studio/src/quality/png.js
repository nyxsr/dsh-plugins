/** Small dependency-free PNG decoder for Chromium screenshots (8-bit, non-interlaced). */
import zlib from 'node:zlib'
import { DiagramError } from '../core/errors.js'

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

export function decodePng(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 33 || !buffer.subarray(0, 8).equals(SIGNATURE)) {
    throw new DiagramError('png_invalid', 'File is not a PNG image.')
  }
  let offset = 8
  let ihdr = null
  const idat = []
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    const data = buffer.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      ihdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        compression: data[10],
        filter: data[11],
        interlace: data[12],
      }
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') {
      break
    }
    offset += 12 + length
  }
  if (!ihdr) throw new DiagramError('png_invalid', 'PNG has no IHDR chunk.')
  if (ihdr.bitDepth !== 8 || ihdr.interlace !== 0 || ihdr.compression !== 0 || ihdr.filter !== 0) {
    throw new DiagramError('png_unsupported', 'PNG decoder supports 8-bit non-interlaced images only.', { details: ihdr })
  }
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[ihdr.colorType]
  if (!channels) throw new DiagramError('png_unsupported', `Unsupported PNG color type ${ihdr.colorType}.`)
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const stride = ihdr.width * channels
  const expected = (stride + 1) * ihdr.height
  if (raw.length < expected) throw new DiagramError('png_invalid', 'PNG pixel data is truncated.')
  const pixels = new Uint8Array(stride * ihdr.height)
  let input = 0
  for (let y = 0; y < ihdr.height; y += 1) {
    const filter = raw[input]
    input += 1
    const rowStart = y * stride
    const previous = rowStart - stride
    for (let x = 0; x < stride; x += 1) {
      const value = raw[input + x]
      const left = x >= channels ? pixels[rowStart + x - channels] : 0
      const up = y > 0 ? pixels[previous + x] : 0
      const upperLeft = y > 0 && x >= channels ? pixels[previous + x - channels] : 0
      let reconstructed
      switch (filter) {
        case 0: reconstructed = value; break
        case 1: reconstructed = value + left; break
        case 2: reconstructed = value + up; break
        case 3: reconstructed = value + Math.floor((left + up) / 2); break
        case 4: reconstructed = value + paeth(left, up, upperLeft); break
        default: throw new DiagramError('png_invalid', `Unsupported PNG row filter ${filter}.`)
      }
      pixels[rowStart + x] = reconstructed & 0xff
    }
    input += stride
  }
  return { ...ihdr, channels, pixels, stride }
}

function pixel(image, x, y) {
  const offset = y * image.stride + x * image.channels
  const p = image.pixels
  if (image.channels === 1 || image.channels === 2) return { r: p[offset], g: p[offset], b: p[offset], a: image.channels === 2 ? p[offset + 1] : 255 }
  return { r: p[offset], g: p[offset + 1], b: p[offset + 2], a: image.channels === 4 ? p[offset + 3] : 255 }
}

function quantized(color) {
  return ((color.r >> 3) << 10) | ((color.g >> 3) << 5) | (color.b >> 3)
}

export function analyzePng(buffer, options = {}) {
  const image = decodePng(buffer)
  const topInset = Math.max(0, Math.min(image.height, options.topInset ?? 0))
  const counts = new Map()
  const step = Math.max(1, Math.floor(Math.sqrt((image.width * image.height) / 40000)))
  for (let y = 0; y < image.height; y += step) {
    for (let x = 0; x < image.width; x += step) {
      const key = quantized(pixel(image, x, y))
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  let backgroundKey = 0
  let backgroundCount = -1
  for (const [key, count] of counts) if (count > backgroundCount) { backgroundCount = count; backgroundKey = key }
  const bgR = ((backgroundKey >> 10) & 31) << 3
  const bgG = ((backgroundKey >> 5) & 31) << 3
  const bgB = (backgroundKey & 31) << 3

  let minX = image.width
  let minY = image.height
  let maxX = -1
  let maxY = -1
  let ink = 0
  let sampled = 0
  const blankRows = new Set()
  const rowInk = new Uint32Array(image.height)
  const columnInk = new Uint32Array(image.width)
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const color = pixel(image, x, y)
      const isBackground = Math.abs(color.r - bgR) <= 10 && Math.abs(color.g - bgG) <= 10 && Math.abs(color.b - bgB) <= 10
      sampled += 1
      if (!isBackground) {
        ink += 1
        rowInk[y] += 1
        columnInk[x] += 1
        if (y >= topInset) {
          minX = Math.min(minX, x)
          minY = Math.min(minY, y)
          maxX = Math.max(maxX, x)
          maxY = Math.max(maxY, y)
        }
      }
    }
    if (rowInk[y] === 0) blankRows.add(y)
  }
  for (let x = 0; x < image.width; x += 1) if (columnInk[x] === 0) blankRows.add(-1)
  const bbox = maxX >= 0 ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 } : null
  const margins = bbox ? {
    left: bbox.x, right: image.width - (bbox.x + bbox.width),
    top: bbox.y, bottom: image.height - (bbox.y + bbox.height),
  } : null
  const blankRowRuns = []
  let run = 0
  for (let y = 0; y < image.height; y += 1) {
    if (rowInk[y] === 0) run += 1
    else { if (run > 0) blankRowRuns.push(run); run = 0 }
  }
  if (run > 0) blankRowRuns.push(run)
  return {
    width: image.width,
    height: image.height,
    channels: image.channels,
    background: { r: bgR, g: bgG, b: bgB },
    inkRatio: sampled ? ink / sampled : 0,
    bbox,
    margins,
    blankRows: blankRows.has(-1) ? 0 : blankRows.size,
    blankRowRuns,
    distinctColors: counts.size,
    clipped: Boolean(bbox && (bbox.x <= 1 || bbox.y <= 1 || bbox.x + bbox.width >= image.width - 1 || bbox.y + bbox.height >= image.height - 1)),
  }
}
