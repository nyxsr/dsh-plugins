/**
 * Stable, JSON-serializable errors shared by the CLI, tests, service, and
 * Harness adapter. The tool layer converts these into structured statuses
 * instead of throwing raw stack traces at the model.
 */
export class DiagramError extends Error {
  /**
   * @param {string} code stable machine code
   * @param {string} message human-readable explanation
   * @param {{details?: unknown, cause?: unknown, status?: string}} [options]
   */
  constructor(code, message, options = {}) {
    super(message, { cause: options.cause })
    this.name = 'DiagramError'
    this.code = code
    this.status = options.status ?? 'FAILED'
    this.details = options.details ?? null
  }

  toJSON() {
    return {
      status: this.status,
      error: { code: this.code, message: this.message, details: this.details },
    }
  }
}

export function asDiagramError(error, code = 'internal_error') {
  if (error instanceof DiagramError) return error
  return new DiagramError(code, error instanceof Error ? error.message : String(error), {
    cause: error instanceof Error ? error : undefined,
  })
}

export function invariant(condition, code, message, details) {
  if (!condition) throw new DiagramError(code, message, { details })
}
