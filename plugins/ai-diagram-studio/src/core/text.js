/** Text normalization, escaping, and deterministic wrapping helpers. */

export const MAX_TEXT = 500
export const MAX_LABEL = 180

export function clean(value, max = MAX_TEXT) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/\r\n?/g, '\n')
    .trim()
    .slice(0, max)
}

export function oneLine(value, max = MAX_LABEL) {
  return clean(value, max).replace(/\s+/g, ' ').trim()
}

export function slug(value, fallback = 'diagram', max = 42) {
  const normalized = String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '')
  return normalized || fallback
}

export function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Approximate width of a string in px for the bundled UI sans-serif stack. */
export function textWidth(value, fontSize = 14, weight = 400) {
  const factor = weight >= 600 ? 0.60 : 0.545
  const text = String(value ?? '')
  let units = 0
  for (const ch of text) {
    if (/[\u3000-\u9fff\uff00-\uffef]/.test(ch)) units += 1.55
    else if (/[MW@#%&]/.test(ch)) units += 1.35
    else if (/[ilI.,'`|!;:]/.test(ch)) units += 0.55
    else if (/\s/.test(ch)) units += 0.55
    else units += 1
  }
  return units * fontSize * factor
}

export function wrapText(value, maxWidth, fontSize = 14, maxLines = 12, weight = 400) {
  const text = oneLine(value, 800)
  if (!text) return ['']
  const words = text.split(' ')
  const lines = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (textWidth(candidate, fontSize, weight) <= maxWidth || current === '') {
      current = candidate
    } else {
      lines.push(current)
      current = word
      if (lines.length >= maxLines) break
    }
  }
  if (lines.length < maxLines && current) lines.push(current)
  if (lines.length === maxLines) {
    const consumed = lines.join(' ')
    if (consumed.length < text.length) {
      let last = lines[maxLines - 1]
      while (textWidth(`${last}…`, maxWidth, fontSize, weight) > maxWidth && last.length > 1) {
        last = last.slice(0, -1)
      }
      lines[maxLines - 1] = `${last}…`
    }
  }
  return lines.length ? lines : ['']
}

export function uniqueName(base, used) {
  let name = base
  let index = 2
  while (used.has(name.toLowerCase())) {
    name = `${base} ${index}`
    index += 1
  }
  used.add(name.toLowerCase())
  return name
}

export function titleCase(value) {
  return oneLine(value, 120)
    .split(/\s+/)
    .map(word => (/^[A-Z0-9_]{2,}$/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ')
}
