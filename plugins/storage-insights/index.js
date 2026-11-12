/**
 * Host half of the Storage insights plugin.
 *
 * It owns one authenticated HTTP route. The browser half posts a folder and
 * receives the top files and folders by size. Scanning stays on the Host
 * because the page cannot read the local filesystem.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { scanDirectory } from './scanner.js'

const SCAN_PATH = '/storage-insights/scan'
const MAX_RESULTS = 10
const MAX_BODY_BYTES = 8 * 1024

export const inject = ['webServer', 'connection']

/**
 * Resolve the requested folder, falling back to the profile's default
 * workspace when the browser does not name one.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @param {unknown} payload - JSON request body.
 * @returns {Promise<string>} absolute folder path.
 */
async function resolveRoot(ctx, payload) {
  const requested = payload !== null && typeof payload === 'object'
    && typeof payload.root === 'string' ? payload.root.trim() : ''
  const defaultRoot = ctx.get('workingDirectory')?.defaultDirectory ?? process.cwd()
  const candidate = requested === '' ? defaultRoot : requested
  const absolute = path.resolve(path.isAbsolute(candidate) ? candidate : path.join(defaultRoot, candidate))

  let stat
  try {
    stat = await fs.stat(absolute)
  } catch {
    throw new Error(`Folder does not exist: ${absolute}`)
  }
  if (!stat.isDirectory()) throw new Error(`Not a folder: ${absolute}`)
  return absolute
}

/**
 * Read one bounded JSON body.
 *
 * @param {import('node:http').IncomingMessage} req - request owning the body.
 * @returns {Promise<unknown>} parsed body.
 */
async function readJsonBody(req) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    total += chunk.length
    if (total > MAX_BODY_BYTES) throw new Error('Request body is too large.')
    chunks.push(chunk)
  }
  if (total === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

/**
 * Write one JSON response.
 *
 * @param {import('node:http').ServerResponse} res - response to complete.
 * @param {number} status - HTTP status.
 * @param {unknown} payload - JSON payload.
 */
function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(payload))
}

/**
 * Apply the connection trust and browser-authentication fence.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @param {import('node:http').IncomingMessage} req - request to admit.
 * @param {import('node:http').ServerResponse} res - rejection response owner.
 * @returns {boolean} true when the request was rejected.
 */
function rejected(ctx, req, res) {
  const rejection = ctx.connection.requestRejection(req)
  if (rejection === undefined) return false
  res.statusCode = rejection
  res.end()
  return true
}

export function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: SCAN_PATH,
    handler: async (req, res) => {
      if (rejected(ctx, req, res)) return
      if (req.method !== 'POST') {
        res.statusCode = 405
        res.setHeader('allow', 'POST')
        res.end()
        return
      }

      try {
        const payload = await readJsonBody(req)
        const root = await resolveRoot(ctx, payload)
        const value = await scanDirectory(root, { limit: MAX_RESULTS })
        sendJson(res, 200, { ok: true, value })
      } catch (error) {
        sendJson(res, 400, {
          ok: false,
          error: {
            code: 'storage-insights/scan-failed',
            message: error instanceof Error ? error.message : String(error),
          },
        })
      }
    },
  }), 'storage-insights: scan route')
}
