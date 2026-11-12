/** Compose Document IR into standalone cover and body HTML files. */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { buildStyles } from './styles.js'
import { renderCover, renderBody, headerFooterTemplates } from './components.js'

export async function buildHtml(document, theme, design, workDir, options = {}) {
  await mkdir(workDir, { recursive: true })
  const styles = buildStyles(document, theme, design)
  const htmlOptions = { ...options, styles }
  const coverHtml = await renderCover(document, theme, design, htmlOptions)
  const bodyHtml = await renderBody(document, theme, design, htmlOptions)
  const coverPath = path.join(workDir, 'cover.html')
  const bodyPath = path.join(workDir, 'body.html')
  await Promise.all([
    writeFile(coverPath, coverHtml, 'utf8'),
    writeFile(bodyPath, bodyHtml, 'utf8'),
  ])
  return {
    coverPath,
    bodyPath,
    styles,
    assets: {},
    templates: headerFooterTemplates(document, theme, design),
  }
}
