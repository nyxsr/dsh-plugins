/** Bounded subprocess helper. */
import { spawn } from 'node:child_process'

/**
 * @param {string} command
 * @param {string[]} args
 * @param {{cwd?:string, timeoutMs?:number, env?:Record<string,string>, maxBytes?:number}} [options]
 * @returns {Promise<{stdout:string, stderr:string, code:number}>}
 */
export function run(command, args, options = {}) {
  const timeoutMs = options.timeoutMs ?? 60000
  const maxBytes = options.maxBytes ?? 16 * 1024 * 1024
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...(options.env ?? {}) },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    let bytes = 0
    let settled = false
    const finish = (error, value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (error) reject(error)
      else resolve(value)
    }
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      finish(new Error(`${command} timed out after ${timeoutMs}ms`))
    }, timeoutMs)
    child.stdout.on('data', chunk => {
      bytes += chunk.length
      if (bytes > maxBytes) {
        child.kill('SIGKILL')
        finish(new Error(`${command} produced more than ${maxBytes} bytes`))
        return
      }
      stdout += chunk
    })
    child.stderr.on('data', chunk => {
      bytes += chunk.length
      if (bytes <= maxBytes) stderr += chunk
    })
    if (options.input !== undefined) child.stdin.end(options.input)
    else child.stdin.end()
    child.on('error', error => finish(error))
    child.on('close', code => finish(null, { stdout, stderr, code: code ?? -1 }))
  })
}

export async function runChecked(command, args, options = {}) {
  const result = await run(command, args, options)
  if (result.code !== 0) {
    const error = new Error(`${command} exited with code ${result.code}: ${result.stderr.trim().slice(0, 400)}`)
    error.code = 'command_failed'
    error.details = { command, args, code: result.code, stderr: result.stderr.slice(0, 2000) }
    throw error
  }
  return result
}
