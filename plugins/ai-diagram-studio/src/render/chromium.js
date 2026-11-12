/**
 * Minimal Chromium CDP driver used only for raster/PDF export.
 * SVG remains the canonical rendering; Chromium adds no diagram semantics.
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { DiagramError } from '../core/errors.js'
import { renderSVGDocument } from './svg.js'

const DEFAULT_CANDIDATES = [
  process.env.DIAGRAM_CHROMIUM,
  process.env.CHROMIUM_PATH,
  '/home/nyxsr/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
]

async function exists(file) {
  try {
    await fs.access(file)
    return true
  } catch {
    return false
  }
}

export async function findChromium(explicit) {
  if (explicit) {
    if (await exists(explicit)) return explicit
    throw new DiagramError('renderer_unavailable', `Chromium was not found at ${explicit}.`, { status: 'FAILED' })
  }
  for (const candidate of DEFAULT_CANDIDATES) {
    if (candidate && await exists(candidate)) return candidate
  }
  throw new DiagramError('renderer_unavailable', 'Chromium was not found. Set DIAGRAM_CHROMIUM to a Chromium/Chrome executable.', { status: 'FAILED' })
}

class Cdp {
  constructor(socket) {
    this.socket = socket
    this.nextId = 1
    this.pending = new Map()
    this.waiters = new Map()
    socket.addEventListener('message', event => this.handle(String(event.data)))
  }

  handle(raw) {
    let message
    try { message = JSON.parse(raw) } catch { return }
    if (message.id && this.pending.has(message.id)) {
      const { resolve, reject, timer } = this.pending.get(message.id)
      clearTimeout(timer)
      this.pending.delete(message.id)
      if (message.error) reject(new DiagramError('renderer_error', message.error.message ?? 'Chromium command failed.', { details: message.error }))
      else resolve(message.result)
      return
    }
    if (message.method) {
      const key = `${message.method}:${message.sessionId ?? ''}`
      const list = this.waiters.get(key)
      if (list?.length) {
        const waiter = list.shift()
        clearTimeout(waiter.timer)
        waiter.resolve(message.params)
      }
    }
  }

  send(method, params = {}, sessionId, timeoutMs = 20000) {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new DiagramError('renderer_timeout', `Chromium command ${method} timed out.`))
      }, timeoutMs)
      this.pending.set(id, { resolve, reject, timer })
      this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }))
    })
  }

  waitFor(method, sessionId, timeoutMs = 20000) {
    return new Promise((resolve, reject) => {
      const key = `${method}:${sessionId ?? ''}`
      const list = this.waiters.get(key) ?? []
      const waiter = {
        resolve,
        reject,
        timer: setTimeout(() => {
          const current = this.waiters.get(key) ?? []
          this.waiters.set(key, current.filter(item => item !== waiter))
          reject(new DiagramError('renderer_timeout', `Chromium event ${method} timed out.`))
        }, timeoutMs),
      }
      list.push(waiter)
      this.waiters.set(key, list)
    })
  }
}

async function launch(executable) {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'diagram-chromium-'))
  const args = [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--disable-extensions',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
  ]
  const child = spawn(executable, args, { stdio: ['ignore', 'ignore', 'pipe'] })
  let stderr = ''
  const wsUrl = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new DiagramError('renderer_timeout', 'Chromium did not expose a DevTools endpoint in time.')), 15000)
    child.stderr.on('data', chunk => {
      stderr += String(chunk)
      const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/)
      if (match) {
        clearTimeout(timer)
        resolve(match[1])
      }
    })
    child.on('error', error => {
      clearTimeout(timer)
      reject(new DiagramError('renderer_unavailable', `Could not start Chromium: ${error.message}`))
    })
    child.on('exit', code => {
      clearTimeout(timer)
      reject(new DiagramError('renderer_error', `Chromium exited with code ${code}. ${stderr.slice(-400)}`))
    })
  })
  return { child, profile, wsUrl }
}

async function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url)
    const timer = setTimeout(() => {
      socket.close()
      reject(new DiagramError('renderer_timeout', 'Could not connect to the Chromium DevTools endpoint.'))
    }, 15000)
    socket.addEventListener('open', () => {
      clearTimeout(timer)
      resolve(new Cdp(socket))
    }, { once: true })
    socket.addEventListener('error', () => {
      clearTimeout(timer)
      reject(new DiagramError('renderer_error', 'Chromium DevTools WebSocket failed.'))
    }, { once: true })
  })
}

async function closeBrowser(browser, launched) {
  try { await browser.socket.close() } catch {}
  try { launched.child.kill('SIGKILL') } catch {}
  await new Promise(resolve => setTimeout(resolve, 120))
  await fs.rm(launched.profile, { recursive: true, force: true }).catch(() => {})
}

/**
 * Export one SVG-backed document to PNG and/or PDF in a single browser session.
 * Returns { png?: Buffer, pdf?: Buffer, width, height, scale }.
 */
export async function exportWithChromium(svg, { width, height, formats = ['png', 'pdf'], scale = 2, chromiumPath, htmlTitle = 'Diagram' } = {}) {
  if (!formats.length) return { width, height, scale }
  const executable = await findChromium(chromiumPath)
  const launched = await launch(executable)
  const browser = await connect(launched.wsUrl)
  const result = { width: Math.ceil(width), height: Math.ceil(height), scale }
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'diagram-export-'))
  const htmlPath = path.join(tempDir, 'diagram.html')
  try {
    await fs.writeFile(htmlPath, renderSVGDocument(htmlTitle, svg), 'utf8')
    const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' })
    const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true })
    await browser.send('Page.enable', {}, sessionId)
    const loaded = browser.waitFor('Page.loadEventFired', sessionId, 15000)
    await browser.send('Page.navigate', { url: pathToFileURL(htmlPath).href }, sessionId)
    await loaded.catch(() => {})
    await new Promise(resolve => setTimeout(resolve, 80)) // fonts + SVG paint

    const w = Math.max(1, Math.ceil(width))
    const h = Math.max(1, Math.ceil(height))
    if (formats.includes('png')) {
      const safeScale = Math.min(3, Math.max(1, Number(scale) || 1))
      if (w * safeScale > 12000 || h * safeScale > 12000) {
        throw new DiagramError('export_too_large', `Requested PNG would be ${w * safeScale}x${h * safeScale}; maximum is 12000 px per side.`)
      }
      await browser.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: safeScale, mobile: false }, sessionId)
      const shot = await browser.send('Page.captureScreenshot', {
        format: 'png', fromSurface: true, captureBeyondViewport: true,
        clip: { x: 0, y: 0, width: w, height: h, scale: 1 },
      }, sessionId)
      result.png = Buffer.from(shot.data, 'base64')
      result.scale = safeScale
    }
    if (formats.includes('pdf')) {
      const pdf = await browser.send('Page.printToPDF', {
        printBackground: true,
        paperWidth: w / 96,
        paperHeight: h / 96,
        marginTop: 0,
        marginBottom: 0,
        marginLeft: 0,
        marginRight: 0,
        preferCSSPageSize: false,
        transferMode: 'ReturnAsBase64',
      }, sessionId)
      result.pdf = Buffer.from(pdf.data, 'base64')
    }
    await browser.send('Target.closeTarget', { targetId }).catch(() => {})
    return result
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
    await closeBrowser(browser, launched)
  }
}
