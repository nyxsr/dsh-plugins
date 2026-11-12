/**
 * Structured errors used across the studio.
 *
 * Codes are stable so a Harness tool, CLI caller, or test can branch without
 * parsing prose. `details` is always JSON-serializable.
 */
export class StudioError extends Error {
  /**
   * @param {string} code stable machine code
   * @param {string} message human-readable explanation
   * @param {object} [options]
   * @param {string} [options.status] success-adjacent status category
   * @param {unknown} [options.details]
   * @param {Error} [options.cause]
   */
  constructor(code, message, options = {}) {
    super(message, { cause: options.cause })
    this.name = 'StudioError'
    this.code = code
    this.status = options.status ?? 'error'
    this.details = options.details ?? null
  }

  toJSON() {
    return {
      status: this.status,
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
    }
  }
}

export function asStudioError(error, code = 'internal_error') {
  if (error instanceof StudioError) return error
  return new StudioError(code, error instanceof Error ? error.message : String(error), {
    cause: error instanceof Error ? error : undefined,
  })
}

export function invariant(condition, code, message, details) {
  if (!condition) throw new StudioError(code, message, { details })
}
