/** WCAG contrast and small color utilities. */

export function normalizeHex(value, fallback = '#000000') {
  const raw = String(value ?? '').trim()
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toUpperCase()
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toUpperCase()
  }
  return fallback
}

export function hexToRgb(value) {
  const hex = normalizeHex(value).slice(1)
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  }
}

export function rgbToHex({ r, g, b }) {
  const channel = value => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')
  return `#${channel(r)}${channel(g)}${channel(b)}`.toUpperCase()
}

export function relativeLuminance(value) {
  const { r, g, b } = hexToRgb(value)
  const convert = channel => {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * convert(r) + 0.7152 * convert(g) + 0.0722 * convert(b)
}

export function contrastRatio(foreground, background) {
  const a = relativeLuminance(foreground)
  const b = relativeLuminance(background)
  const lighter = Math.max(a, b)
  const darker = Math.min(a, b)
  return (lighter + 0.05) / (darker + 0.05)
}

export function mixHex(a, b, ratio = 0.5) {
  const left = hexToRgb(a)
  const right = hexToRgb(b)
  const t = Math.max(0, Math.min(1, Number(ratio) || 0))
  return rgbToHex({
    r: left.r + (right.r - left.r) * t,
    g: left.g + (right.g - left.g) * t,
    b: left.b + (right.b - left.b) * t,
  })
}

export function withAlpha(hex, alpha) {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`
}

/** Pick black or white for a filled surface, whichever has more contrast. */
export function readableOn(background) {
  return contrastRatio('#FFFFFF', background) >= contrastRatio('#111111', background) ? '#FFFFFF' : '#111111'
}

/** Ensure a body-text pair reaches WCAG AA; adjust the foreground toward black/white. */
export function ensureContrast(foreground, background, minimum = 4.5) {
  let current = normalizeHex(foreground)
  if (contrastRatio(current, background) >= minimum) return { color: current, adjusted: false, ratio: contrastRatio(current, background) }
  const target = relativeLuminance(background) > 0.4 ? '#111111' : '#FFFFFF'
  for (let step = 1; step <= 20; step += 1) {
    current = mixHex(foreground, target, step / 20)
    if (contrastRatio(current, background) >= minimum) {
      return { color: current, adjusted: true, ratio: contrastRatio(current, background) }
    }
  }
  return { color: target, adjusted: true, ratio: contrastRatio(target, background) }
}
