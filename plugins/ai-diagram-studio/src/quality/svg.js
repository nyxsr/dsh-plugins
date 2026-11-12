/** Structural and security checks for generated SVG markup. */
export function parseSvgSize(svg) {
  const root = String(svg).match(/<svg\b[^>]*>/i)?.[0] ?? ''
  const width = Number(root.match(/\bwidth="([\d.]+)"/)?.[1])
  const height = Number(root.match(/\bheight="([\d.]+)"/)?.[1])
  const viewBox = root.match(/\bviewBox="([^"]+)"/)?.[1] ?? ''
  return { width, height, viewBox, root }
}

export function validateSvgMarkup(svg) {
  const errors = []
  const warnings = []
  const source = String(svg)
  if (!/^\s*<svg\b/i.test(source)) errors.push({ code: 'svg_root_missing', message: 'SVG root element is missing.' })
  if (!/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(source)) errors.push({ code: 'svg_namespace_missing', message: 'SVG namespace is missing.' })
  if (/<script\b/i.test(source)) errors.push({ code: 'svg_script_forbidden', message: 'SVG must not contain scripts.' })
  if (/<foreignObject\b/i.test(source)) errors.push({ code: 'svg_foreignobject_forbidden', message: 'SVG must not contain foreignObject.' })
  if (/\son[a-z]+\s*=/i.test(source)) errors.push({ code: 'svg_event_handler', message: 'SVG must not contain event handler attributes.' })
  if (/(?:xlink:)?href\s*=\s*"(?!#)/i.test(source)) errors.push({ code: 'svg_external_reference', message: 'SVG must not reference external resources.' })
  if (/<image\b/i.test(source)) warnings.push({ code: 'svg_embedded_image', message: 'SVG embeds an image; verify it is local.' })

  const clean = source
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '')
  const stack = []
  let roots = 0
  let cursor = 0
  const tagPattern = /<(\/?)([A-Za-z][\w:.-]*)((?:"[^"]*"|'[^']*'|[^'">])*?)(\/?)>/g
  let match
  while ((match = tagPattern.exec(clean))) {
    if (clean.slice(cursor, match.index).includes('<')) {
      errors.push({ code: 'svg_malformed', message: `Malformed markup near offset ${match.index}.` })
      break
    }
    cursor = match.index + match[0].length
    const closing = match[1] === '/'
    const name = match[2]
    const selfClosing = match[4] === '/'
    if (!stack.length && !closing) roots += 1
    if (closing) {
      if (!stack.length || stack.at(-1) !== name) {
        errors.push({ code: 'svg_malformed', message: `Unexpected closing tag </${name}>.` })
        break
      }
      stack.pop()
    } else if (!selfClosing) {
      stack.push(name)
    }
  }
  if (clean.slice(cursor).includes('<')) errors.push({ code: 'svg_malformed', message: 'Malformed markup at the end of the document.' })
  if (roots !== 1) errors.push({ code: 'svg_root_count', message: `Expected one SVG root, found ${roots}.` })
  if (stack.length) errors.push({ code: 'svg_unclosed', message: `Unclosed SVG element(s): ${stack.slice(-5).join(', ')}.` })
  const size = parseSvgSize(source)
  if (!(size.width > 0) || !(size.height > 0)) errors.push({ code: 'svg_dimensions', message: 'SVG width/height are missing or invalid.' })
  if (size.width * size.height > 80_000_000) warnings.push({ code: 'svg_very_large', message: 'SVG canvas is very large and may be slow to rasterize.' })
  return { status: errors.length ? 'FAILED' : 'PASSED', errors, warnings, width: size.width, height: size.height, viewBox: size.viewBox, bytes: Buffer.byteLength(source) }
}
