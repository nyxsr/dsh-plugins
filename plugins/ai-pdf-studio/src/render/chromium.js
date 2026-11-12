/**
 * Minimal Chromium DevTools Protocol driver.
 *
 * Chrome is already installed in the harness environment. Driving it over CDP
 * avoids adding a browser-automation dependency to the plugin bundle.
 */
import { spawn } from 'node:child_process'
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const CHROME_CANDIDATES = [
  process.env.AI_PDF_CHROMIUM,
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  `${process.env.HOME ?? ''}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`,
].filter(Boolean)

async function exists(file) {
  try { await access(file, constants.X_OK); return true } catch { return false }
}

/** Find a runnable Chromium/Chrome executable. */
export async function findChromium() {
  for (const candidate of CHROME_CANDIDATES) {
    if (await exists(candidate)) return candidate
  }
  // Playwright's cache can contain a newer revision.
  const { readdir } = await import('node:fs/promises')
  const cache = path.join(process.env.HOME ?? '', '.cache', 'ms-playwright')
  try {
    const dirs = (await readdir(cache)).filter(d => d.startsWith('chromium-')).sort().reverse()
    for (const dir of dirs) {
      for (const rel of ['chrome-linux64/chrome', 'chrome-linux/chrome']) {
        const candidate = path.join(cache, dir, rel)
        if (await exists(candidate)) return candidate
      }
    }
  } catch { /* no cache */ }
  throw new Error('Chromium tidak ditemukan. Isi AI_PDF_CHROMIUM dengan path eksekutabelnya.')
}

class CDP {
  constructor(url) {
    this.url = url
    this.nextId = 1
    this.pending = new Map()
    this.events = new Map()
    this.eventLog = []
  }

  async open() {
    this.ws = new WebSocket(this.url)
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Chromium CDP WebSocket timed out')), 15000)
      this.ws.addEventListener('open', () => { clearTimeout(timer); resolve() }, { once: true })
      this.ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error('WebSocket CDP Chromium gagal')) }, { once: true })
    })
    this.ws.addEventListener('message', event => this.#onMessage(String(event.data)))
  }

  #onMessage(raw) {
    let message
    try { message = JSON.parse(raw) } catch { return }
    if (message.id !== undefined) {
      const pending = this.pending.get(message.id)
      if (!pending) return
      this.pending.delete(message.id)
      if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`))
      else pending.resolve(message.result)
      return
    }
    const key = `${message.sessionId ?? 'browser'}|${message.method}`
    const waiters = this.events.get(key)
    if (waiters?.length) {
      const waiter = waiters.shift()
      clearTimeout(waiter.timer)
      waiter.resolve(message.params)
    }
    this.eventLog.push({ key, params: message.params, at: Date.now() })
    if (this.eventLog.length > 200) this.eventLog.shift()
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++
    const payload = sessionId === undefined
      ? { id, method, params }
      : { id, method, params, sessionId }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`${method} timed out`))
      }, 30000)
      this.pending.set(id, {
        method,
        resolve: value => { clearTimeout(timer); resolve(value) },
        reject: error => { clearTimeout(timer); reject(error) },
      })
      this.ws.send(JSON.stringify(payload))
    })
  }

  waitEvent(method, sessionId, timeoutMs = 30000) {
    const key = `${sessionId ?? 'browser'}|${method}`
    return new Promise((resolve, reject) => {
      const waiter = { resolve, reject, timer: undefined }
      waiter.timer = setTimeout(() => {
        const list = this.events.get(key) ?? []
        const index = list.indexOf(waiter)
        if (index >= 0) list.splice(index, 1)
        reject(new Error(`Timed out waiting for ${method}`))
      }, timeoutMs)
      const list = this.events.get(key) ?? []
      list.push(waiter)
      this.events.set(key, list)
    })
  }

  close() {
    try { this.ws?.close() } catch { /* ignore */ }
  }
}

async function waitForEndpoint(child, timeoutMs = 20000) {
  return await new Promise((resolve, reject) => {
    let buffer = ''
    const timer = setTimeout(() => reject(new Error('Chromium tidak membuka endpoint DevTools')), timeoutMs)
    const onData = chunk => {
      buffer += String(chunk)
      const match = buffer.match(/DevTools listening on (ws:\/\/[^\s]+)/)
      if (match) {
        clearTimeout(timer)
        child.stderr.off('data', onData)
        resolve(match[1])
      }
      if (buffer.length > 200_000) buffer = buffer.slice(-100_000)
    }
    child.stderr.on('data', onData)
    child.on('exit', code => {
      clearTimeout(timer)
      reject(new Error(`Chromium exited before DevTools was ready (code ${code})`))
    })
  })
}

/**
 * Render an HTML file to PDF.
 *
 * @param {object} options
 * @param {string} options.htmlPath absolute HTML path
 * @param {string} options.pdfPath absolute PDF path
 * @param {{widthPt:number,heightPt:number}} options.pageSize page size in points
 * @param {{top:number,bottom:number,left:number,right:number}} [options.marginsIn] margins in inches
 * @param {string} [options.headerTemplate]
 * @param {string} [options.footerTemplate]
 * @param {boolean} [options.printBackground=true]
 * @param {boolean} [options.displayHeaderFooter=true]
 * @returns {Promise<{pdfBytes:number,layout:object}>}
 */
export async function renderHtmlToPdf(options) {
  const {
    htmlPath, pdfPath, pageSize, marginsIn = { top: 0, bottom: 0, left: 0, right: 0 },
    headerTemplate = '<div></div>', footerTemplate = '<div></div>', printBackground = true,
    displayHeaderFooter = true,
  } = options
  const chromium = await findChromium()
  const profileDir = await mkdtemp(path.join(tmpdir(), 'ai-pdf-chrome-'))
  const args = [
    '--headless=new', '--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu',
    '--disable-dev-shm-usage', '--allow-file-access-from-files', '--no-first-run',
    '--no-default-browser-check', '--disable-background-networking',
    '--disable-component-update', '--disable-sync', '--font-render-hinting=none',
    '--remote-debugging-port=0', `--user-data-dir=${profileDir}`,
  ]
  const child = spawn(chromium, args, { stdio: ['ignore', 'ignore', 'pipe'] })
  let cdp
  try {
    const endpoint = await waitForEndpoint(child)
    cdp = new CDP(endpoint)
    await cdp.open()
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' })
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true })
    await cdp.send('Page.enable', {}, sessionId)
    await cdp.send('Runtime.enable', {}, sessionId)
    const loaded = cdp.waitEvent('Page.loadEventFired', sessionId)
    const url = pathToFileURL(path.resolve(htmlPath)).href
    await cdp.send('Page.navigate', { url }, sessionId)
    await loaded
    await cdp.send('Runtime.evaluate', {
      expression: `(async () => { if (document.fonts?.ready) await document.fonts.ready; await new Promise(r => setTimeout(r, 350)); return true })()`,
      awaitPromise: true, returnByValue: true,
    }, sessionId)
    const layout = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const els = [...document.querySelectorAll('[data-component-id]')]
        return {
          viewportWidth: innerWidth,
          viewportHeight: innerHeight,
          scrollWidth: document.documentElement.scrollWidth,
          scrollHeight: document.documentElement.scrollHeight,
          blockCount: els.length,
          overflowing: els.filter(el => el.scrollWidth > el.clientWidth + 2).map(el => ({
            id: el.dataset.componentId,
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
            tag: el.tagName.toLowerCase(),
          })),
          emptyImages: [...document.images].filter(img => !img.complete || img.naturalWidth === 0).map(img => img.src),
        }
      })()`,
      returnByValue: true,
    }, sessionId)
    const result = await cdp.send('Page.printToPDF', {
      printBackground,
      displayHeaderFooter,
      headerTemplate,
      footerTemplate,
      paperWidth: pageSize.widthPt / 72,
      paperHeight: pageSize.heightPt / 72,
      marginTop: marginsIn.top,
      marginBottom: marginsIn.bottom,
      marginLeft: marginsIn.left,
      marginRight: marginsIn.right,
      preferCSSPageSize: false,
      scale: 1,
      generateTaggedPDF: true,
      generateDocumentOutline: true,
    }, sessionId)
    const bytes = Buffer.from(result.data, 'base64')
    await writeFile(pdfPath, bytes)
    return { pdfBytes: bytes.length, layout: layout.result.value }
  } finally {
    cdp?.close()
    child.kill('SIGKILL')
    await rm(profileDir, { recursive: true, force: true }).catch(() => {})
  }
}
