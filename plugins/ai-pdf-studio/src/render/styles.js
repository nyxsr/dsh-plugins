/**
 * Print CSS for the studio. The base sheet is shared; each family layers
 * structural overrides from `themes.js` on top.
 */

const CSS = (document, theme, design) => {
  const c = theme.colors
  const t = theme.type
  const s = theme.spacing
  const page = document.page
  const isPresentation = document.category === 'presentation'
  const headingWeight = theme.key === 'minimalist_clean' ? 450 : theme.key === 'luxury_elegant' ? 400 : 700
  return `
@page {
  size: ${page.width_pt}pt ${page.height_pt}pt;
  margin: ${page.margins.top}pt ${page.margins.right}pt ${page.margins.bottom}pt ${page.margins.left}pt;
  background: ${c.bg};
}
:root {
  --page-w: ${page.width_pt}pt;
  --page-h: ${page.height_pt}pt;
  --margin-top: ${page.margins.top}pt;
  --margin-bottom: ${page.margins.bottom}pt;
  --margin-left: ${page.margins.left}pt;
  --margin-right: ${page.margins.right}pt;
  --ink: ${c.ink};
  --muted: ${c.muted};
  --faint: ${c.faint};
  --accent: ${c.accent};
  --accent-2: ${c.accent2};
  --accent-ink: ${c.accentInk};
  --bg: ${c.bg};
  --surface: ${c.surface};
  --surface-2: ${c.surface2};
  --line: ${c.line};
  --cover-bg: ${c.coverBg};
  --cover-ink: ${c.coverInk};
  --cover-muted: ${c.coverMuted};
  --cover-accent: ${c.coverAccent};
  --cover-accent-ink: ${c.coverAccentInk};
  --success: ${c.success};
  --warning: ${c.warning};
  --danger: ${c.danger};
  --font-display: ${theme.fonts.display};
  --font-heading: ${theme.fonts.heading};
  --font-body: ${theme.fonts.body};
  --font-mono: ${theme.fonts.mono};
  --fs-body: ${t.body}pt;
  --lh-body: ${t.line};
  --fs-h1: ${t.h1}pt;
  --fs-h2: ${t.h2}pt;
  --fs-h3: ${t.h3}pt;
  --fs-small: ${t.small}pt;
  --fs-micro: ${t.micro}pt;
  --fs-kpi: ${t.kpi}pt;
  --fs-cover-title: ${t.coverTitle}pt;
  --fs-cover-subtitle: ${t.coverSubtitle}pt;
  --fs-section-number: ${t.sectionNumber}pt;
  --space-block: ${s.block}pt;
  --space-section: ${s.section}pt;
  --space-card: ${s.card}pt;
  --cover-pad: ${s.coverPad}pt;
  --radius: ${s.radius}pt;
  --heading-weight: ${headingWeight};
  --body-width: ${theme.layout.bodyWidth === 'narrow' ? '86%' : theme.layout.bodyWidth === 'wide' ? '100%' : '94%'};
}
* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0;
  background: ${c.bg};
  color: ${c.ink};
  font-family: var(--font-body);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
  text-rendering: geometricPrecision;
  font-kerning: normal;
  font-variant-ligatures: common-ligatures;
}
body { min-height: 100%; }
p, h1, h2, h3, h4, h5, h6, figure, blockquote, table, ul, ol { margin: 0; }
a { color: var(--accent); text-decoration: none; overflow-wrap: anywhere; }
strong { font-weight: 700; }
em { font-style: italic; }
small { font-size: var(--fs-small); }
ul, ol { padding-left: 15pt; }
li { margin: 0 0 4pt; }
img { max-width: 100%; display: block; }
hr { border: 0; border-top: .7pt solid var(--line); }

/* ---------- Cover ---------- */
.cover {
  position: relative;
  width: var(--page-w);
  height: calc(var(--page-h) - 1pt);
  overflow: hidden;
  background: var(--cover-bg);
  color: var(--cover-ink);
  padding: var(--cover-pad);
  page-break-after: always;
  break-after: page;
}
.cover-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12pt; }
.cover-brand { display: flex; align-items: center; gap: 8pt; font-family: var(--font-mono); font-size: 7pt; letter-spacing: .12em; text-transform: uppercase; }
.cover-brand img { max-height: 28pt; max-width: 92pt; object-fit: contain; }
.cover-brand-mark { width: 20pt; height: 20pt; border: .8pt solid currentColor; display: inline-flex; align-items: center; justify-content: center; font-size: 7pt; }
.cover-eyebrow { font-family: var(--font-mono); font-size: 6.6pt; letter-spacing: .18em; text-transform: uppercase; color: var(--cover-muted); text-align: right; max-width: 44%; }
.cover-main { position: relative; z-index: 3; }
.cover-kicker {
  font-family: var(--font-mono); font-size: 7pt; letter-spacing: .22em; text-transform: uppercase;
  color: var(--cover-accent); margin-bottom: 13pt; display: flex; align-items: center; gap: 8pt;
}
.cover-kicker::before { content: ""; width: 18pt; height: 1pt; background: var(--cover-accent); display: inline-block; }
.cover-title {
  font-family: var(--font-display);
  font-size: var(--fs-cover-title);
  line-height: .98;
  letter-spacing: -.035em;
  font-weight: var(--heading-weight);
  margin: 0 0 15pt;
  text-wrap: balance;
}
.cover-subtitle {
  font-family: var(--font-body); font-size: var(--fs-cover-subtitle); line-height: 1.5;
  color: var(--cover-muted); max-width: 86%; margin: 0 0 18pt;
}
.cover-stats { display: flex; gap: 16pt; flex-wrap: wrap; margin-top: 18pt; }
.cover-stat { min-width: 62pt; border-top: .7pt solid currentColor; padding-top: 6pt; }
.cover-stat-value { font-family: var(--font-display); font-size: 18pt; line-height: 1; font-weight: 600; letter-spacing: -.03em; }
.cover-stat-label { font-family: var(--font-mono); font-size: 6pt; letter-spacing: .08em; text-transform: uppercase; color: var(--cover-muted); margin-top: 4pt; }
.cover-meta {
  position: absolute; left: var(--cover-pad); right: var(--cover-pad); bottom: var(--cover-pad);
  display: grid; grid-template-columns: 1.2fr 1fr auto; gap: 14pt; align-items: end;
  font-family: var(--font-mono); font-size: 6.4pt; letter-spacing: .08em; text-transform: uppercase;
  color: var(--cover-muted); z-index: 4;
}
.cover-meta strong { display: block; color: var(--cover-ink); font-weight: 500; font-size: 7.4pt; letter-spacing: .04em; margin-top: 3pt; text-transform: none; }
.cover-art { position: absolute; z-index: 1; pointer-events: none; }
.cover-art-label { font-family: var(--font-mono); font-size: 7pt; letter-spacing: .2em; text-transform: uppercase; }
.cover-index { font-family: var(--font-display); font-weight: 700; line-height: .8; letter-spacing: -.06em; }
.cover-monogram { display: none; font-family: var(--font-display); font-weight: 700; line-height: .8; letter-spacing: -.06em; }
.cover-grid, .cover-orbit, .cover-rule, .cover-dot, .cover-band { position: absolute; }

/* Cover variant: split */
.cover--split .cover-art {
  right: 0; top: 0; width: 38%; height: 100%;
  background: var(--cover-accent);
  color: var(--cover-accent-ink);
}
.cover--split .cover-art::before { content: ""; position: absolute; width: 240pt; height: 240pt; border: 1pt solid currentColor; border-radius: 50%; right: -90pt; top: -70pt; opacity: .35; }
.cover--split .cover-art::after { content: ""; position: absolute; width: 140pt; height: 140pt; border: 1pt solid currentColor; border-radius: 50%; right: -20pt; bottom: 80pt; opacity: .22; }
.cover--split .cover-main { position: absolute; top: 24%; left: var(--cover-pad); width: 55%; }
.cover--split .cover-top { position: absolute; top: var(--cover-pad); left: var(--cover-pad); right: var(--cover-pad); }
.cover--split .cover-meta { width: 53%; right: auto; grid-template-columns: 1fr 1fr; }
.cover--split .cover-index { position: absolute; right: 12pt; bottom: 20pt; font-size: 92pt; color: var(--cover-accent-ink); opacity: .9; }
.cover--split .cover-art-label { position: absolute; right: 16pt; top: 24pt; writing-mode: vertical-rl; }
.cover--split .cover-title { font-size: calc(var(--fs-cover-title) + 4pt); }

/* Cover variant: editorial */
.cover--editorial { padding: calc(var(--cover-pad) + 10pt) var(--cover-pad); }
.cover--editorial::before { content: ""; position: absolute; left: var(--cover-pad); right: var(--cover-pad); top: calc(var(--cover-pad) - 4pt); height: 2.4pt; background: var(--cover-ink); }
.cover--editorial .cover-art { right: var(--cover-pad); bottom: 74pt; color: transparent; -webkit-text-stroke: .8pt var(--cover-accent); opacity: .55; }
.cover--editorial .cover-index { font-family: var(--font-display); font-size: 146pt; font-weight: 500; letter-spacing: -.08em; }
.cover--editorial .cover-main { position: absolute; top: 25%; left: var(--cover-pad); width: 86%; }
.cover--editorial .cover-title { font-weight: 500; font-size: var(--fs-cover-title); letter-spacing: -.045em; }
.cover--editorial .cover-subtitle { font-family: var(--font-display); font-style: italic; font-size: calc(var(--fs-cover-subtitle) + 1pt); max-width: 68%; }
.cover--editorial .cover-kicker { color: var(--cover-ink); }
.cover--editorial .cover-kicker::before { background: var(--cover-accent); width: 28pt; height: 1.4pt; }
.cover--editorial .cover-stats { border-top: 1pt solid var(--cover-ink); padding-top: 10pt; max-width: 78%; }
.cover--editorial .cover-stat { border-top: 0; padding-top: 0; }
.cover--editorial .cover-meta { border-top: .7pt solid var(--line); padding-top: 9pt; }
.cover--editorial .cover-top { position: absolute; top: calc(var(--cover-pad) + 12pt); left: var(--cover-pad); right: var(--cover-pad); }

/* Cover variant: minimal */
.cover--minimal { background: var(--cover-bg); color: var(--cover-ink); }
.cover--minimal .cover-art { right: 16%; top: 14%; width: 12pt; height: 12pt; background: var(--cover-accent); }
.cover--minimal .cover-index { display: none; }
.cover--minimal .cover-art-label { display: none; }
.cover--minimal .cover-main { position: absolute; top: 31%; left: var(--cover-pad); width: 74%; }
.cover--minimal .cover-title { font-size: calc(var(--fs-cover-title) + 4pt); line-height: .95; font-weight: 250; letter-spacing: -.06em; }
.cover--minimal .cover-subtitle { font-size: 10.5pt; max-width: 58%; color: var(--muted); }
.cover--minimal .cover-kicker { color: var(--muted); }
.cover--minimal .cover-kicker::before { display: none; }
.cover--minimal .cover-stats { margin-top: 28pt; }
.cover--minimal .cover-stat { border-top: .5pt solid var(--ink); min-width: 74pt; }
.cover--minimal .cover-stat-value { font-weight: 300; }
.cover--minimal .cover-meta { border-top: .5pt solid var(--line); padding-top: 10pt; }
.cover--minimal .cover-meta strong { color: var(--ink); }
.cover--minimal .cover-eyebrow, .cover--minimal .cover-brand { color: var(--muted); }

/* Cover variant: poster */
.cover--poster { background: var(--cover-bg); color: var(--cover-ink); padding: var(--cover-pad); }
.cover--poster .cover-main { position: absolute; top: 18%; left: var(--cover-pad); width: 79%; }
.cover--poster .cover-title { font-size: calc(var(--fs-cover-title) + 8pt); line-height: .84; letter-spacing: -.07em; text-transform: uppercase; font-weight: 700; }
.cover--poster .cover-kicker { background: var(--cover-accent); color: var(--cover-accent-ink); padding: 4pt 7pt; display: inline-flex; }
.cover--poster .cover-kicker::before { display: none; }
.cover--poster .cover-subtitle { color: var(--cover-muted); max-width: 60%; font-size: 12pt; }
.cover--poster .cover-art { right: -58pt; top: 14%; width: 250pt; height: 250pt; border-radius: 50%; background: var(--accent-2); opacity: .92; }
.cover--poster .cover-art::before { content: ""; position: absolute; inset: 44pt; border: 1.2pt solid #fff; border-radius: 50%; opacity: .5; }
.cover--poster .cover-index { position: absolute; right: 74pt; bottom: 8pt; font-size: 108pt; color: var(--cover-accent); -webkit-text-stroke: 0; line-height: .74; }
.cover--poster .cover-top { position: absolute; top: var(--cover-pad); left: var(--cover-pad); right: var(--cover-pad); }
.cover--poster .cover-meta { grid-template-columns: 1fr 1fr auto; }
.cover--poster .cover-meta strong { color: var(--cover-accent); }
.cover--poster .cover-stats { margin-top: 20pt; border-top: 1pt solid var(--cover-accent); padding-top: 10pt; max-width: 62%; }
.cover--poster .cover-stat { border-top: 0; padding-top: 0; }
.cover--poster .cover-stat-value { color: var(--cover-accent); }

/* Cover variant: tech */
.cover--tech {
  background: var(--cover-bg);
  background-image: linear-gradient(rgba(39,225,210,.08) .5pt, transparent .5pt), linear-gradient(90deg, rgba(39,225,210,.08) .5pt, transparent .5pt);
  background-size: 28pt 28pt;
}
.cover--tech .cover-art { right: 6%; top: 18%; width: 190pt; height: 190pt; border: .7pt solid var(--cover-accent); border-radius: 50%; opacity: .55; }
.cover--tech .cover-art::before { content: ""; position: absolute; inset: 26pt; border: .7pt dashed var(--cover-accent); border-radius: 50%; }
.cover--tech .cover-art::after { content: ""; position: absolute; inset: 58pt; border: .7pt solid var(--accent-2); border-radius: 50%; }
.cover--tech .cover-main { position: absolute; top: 26%; left: var(--cover-pad); width: 70%; }
.cover--tech .cover-title { font-size: calc(var(--fs-cover-title) + 2pt); letter-spacing: -.04em; }
.cover--tech .cover-kicker { color: var(--cover-accent); font-family: var(--font-mono); }
.cover--tech .cover-subtitle { color: var(--cover-muted); max-width: 58%; }
.cover--tech .cover-top { position: absolute; top: var(--cover-pad); left: var(--cover-pad); right: var(--cover-pad); }
.cover--tech .cover-stats { border-top: .7pt solid var(--cover-accent); padding-top: 8pt; max-width: 58%; }
.cover--tech .cover-stat { border-top: 0; padding-top: 0; }
.cover--tech .cover-stat-value { font-family: var(--font-mono); color: var(--cover-accent); }
.cover--tech .cover-index { position: absolute; right: var(--cover-pad); bottom: 66pt; font-family: var(--font-mono); font-size: 32pt; color: var(--accent-2); font-weight: 400; }
.cover--tech .cover-art-label { position: absolute; left: 12pt; top: 160pt; color: var(--cover-accent); }

/* Cover variant: luxury */
.cover--luxury { background: var(--cover-bg); color: var(--cover-ink); }
.cover--luxury .cover-art { inset: 0; }
.cover--luxury .cover-art-label { display: none; }
.cover--luxury::before { content: ""; position: absolute; inset: 17pt; border: .7pt solid var(--cover-accent); pointer-events: none; }
.cover--luxury::after { content: ""; position: absolute; inset: 21pt; border: .35pt solid var(--cover-accent); opacity: .65; pointer-events: none; }
.cover--luxury .cover-main { position: absolute; top: 27%; left: 12%; width: 76%; text-align: center; }
.cover--luxury .cover-title { font-weight: 400; letter-spacing: .01em; line-height: 1.05; }
.cover--luxury .cover-subtitle { margin: 0 auto 18pt; max-width: 72%; color: var(--cover-muted); font-family: var(--font-display); font-style: italic; }
.cover--luxury .cover-kicker { justify-content: center; color: var(--cover-accent); }
.cover--luxury .cover-kicker::before { width: 32pt; }
.cover--luxury .cover-kicker::after { content: ""; width: 32pt; height: 1pt; background: var(--cover-accent); }
.cover--luxury .cover-monogram { display: none; margin: 0 auto 14pt; font-size: 34pt; color: var(--cover-accent); font-weight: 400; letter-spacing: .08em; border: .7pt solid var(--cover-accent); width: 48pt; height: 48pt; line-height: 46pt; border-radius: 50%; }
.cover--luxury .cover-top { position: absolute; top: 38pt; left: 42pt; right: 42pt; justify-content: center; }
.cover--luxury .cover-eyebrow { display: none; }
.cover--luxury .cover-stats { justify-content: center; border-top: .5pt solid var(--cover-accent); padding-top: 10pt; max-width: 68%; margin: 18pt auto 0; }
.cover--luxury .cover-stat { border-top: 0; padding-top: 0; }
.cover--luxury .cover-stat-value { color: var(--cover-accent); font-weight: 400; }
.cover--luxury .cover-meta { text-align: center; grid-template-columns: 1fr; gap: 5pt; }
.cover--luxury .cover-meta strong { color: var(--cover-ink); }
.cover--luxury .cover-index { position: absolute; right: 42pt; bottom: 38pt; font-size: 18pt; color: var(--cover-accent); font-weight: 400; }

/* Cover variant: academic */
.cover--academic { background: var(--cover-bg); color: var(--cover-ink); padding: var(--cover-pad); }
.cover--academic::before { content: ""; position: absolute; left: var(--cover-pad); right: var(--cover-pad); top: 30pt; height: 3pt; background: var(--cover-accent); }
.cover--academic::after { content: ""; position: absolute; left: var(--cover-pad); right: var(--cover-pad); top: 35pt; height: .6pt; background: var(--cover-ink); }
.cover--academic .cover-main { position: absolute; top: 30%; left: var(--cover-pad); width: 86%; }
.cover--academic .cover-title { font-family: var(--font-heading); font-size: var(--fs-cover-title); line-height: 1.14; letter-spacing: -.01em; font-weight: 700; }
.cover--academic .cover-subtitle { font-family: var(--font-body); font-size: 11pt; font-style: italic; max-width: 76%; color: var(--muted); }
.cover--academic .cover-kicker { color: var(--cover-accent); font-family: var(--font-body); font-variant: small-caps; letter-spacing: .12em; }
.cover--academic .cover-kicker::before { background: var(--cover-accent); width: 22pt; }
.cover--academic .cover-stats { border-top: .6pt solid var(--line); border-bottom: .6pt solid var(--line); padding: 8pt 0; max-width: 72%; margin-top: 22pt; }
.cover--academic .cover-stat { border-top: 0; padding-top: 0; }
.cover--academic .cover-stat-value { font-family: var(--font-heading); font-size: 16pt; font-weight: 700; }
.cover--academic .cover-meta { border-top: .6pt solid var(--line); padding-top: 8pt; }
.cover--academic .cover-top { position: absolute; top: 48pt; left: var(--cover-pad); right: var(--cover-pad); }
.cover--academic .cover-index { position: absolute; right: var(--cover-pad); bottom: 62pt; font-family: var(--font-body); font-size: 14pt; color: var(--cover-accent); font-weight: 400; }
.cover--academic .cover-art { right: var(--cover-pad); top: 15%; width: 84pt; height: 56pt; border-top: .7pt solid var(--cover-accent); border-bottom: .7pt solid var(--cover-accent); }
.cover--academic .cover-art::before { content: ""; position: absolute; left: 50%; top: 0; bottom: 0; width: .5pt; background: var(--cover-accent); }

/* Cover variant: infographic */
.cover--infographic { background: var(--cover-bg); color: var(--cover-ink); padding: var(--cover-pad); }
.cover--infographic .cover-main { position: absolute; top: 17%; left: var(--cover-pad); width: 72%; }
.cover--infographic .cover-title { font-weight: 700; letter-spacing: -.05em; font-size: calc(var(--fs-cover-title) + 2pt); }
.cover--infographic .cover-subtitle { color: var(--cover-muted); max-width: 70%; }
.cover--infographic .cover-kicker { background: var(--cover-accent); color: var(--cover-accent-ink); padding: 4pt 7pt; display: inline-flex; }
.cover--infographic .cover-kicker::before { display: none; }
.cover--infographic .cover-art { right: 0; bottom: 0; width: 46%; height: 34%; background: var(--cover-accent); }
.cover--infographic .cover-art::before { content: ""; position: absolute; left: -34pt; top: -20pt; width: 90pt; height: 90pt; border-radius: 50%; background: var(--accent-2); }
.cover--infographic .cover-art::after { content: ""; position: absolute; left: 18pt; top: 18pt; right: 18pt; bottom: 18pt; border: 1pt solid rgba(255,255,255,.48); }
.cover--infographic .cover-index { position: absolute; left: 28pt; top: 18pt; font-size: 44pt; color: var(--cover-accent-ink); font-weight: 700; }
.cover--infographic .cover-art-label { position: absolute; right: 26pt; bottom: 22pt; color: var(--cover-accent-ink); }
.cover--infographic .cover-top { position: absolute; top: var(--cover-pad); left: var(--cover-pad); right: var(--cover-pad); }
.cover--infographic .cover-stats { max-width: 58%; margin-top: 20pt; border-top: .8pt solid var(--cover-accent); padding-top: 9pt; }
.cover--infographic .cover-stat { border-top: 0; padding-top: 0; }
.cover--infographic .cover-stat-value { color: var(--cover-accent); }
.cover--infographic .cover-meta { grid-template-columns: 1fr 1fr auto; }

/* ---------- Body ---------- */
.body-shell { width: 100%; }
.section {
  break-before: page;
  page-break-before: always;
  width: var(--body-width);
  margin: 0 auto;
  padding: 0;
}
.section:first-child, .divider:first-child, .sectionbreak:first-child { break-before: auto; page-break-before: auto; }
.section--flow { break-before: auto; page-break-before: auto; }
.section-head { margin: 0 0 var(--space-section); break-inside: avoid; page-break-inside: avoid; break-after: avoid; page-break-after: avoid; }
.section-number {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: calc(var(--fs-section-number) * .3);
  letter-spacing: .14em;
  color: var(--accent);
  text-transform: uppercase;
  margin-right: 8pt;
  vertical-align: middle;
}
.section-kicker {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: var(--fs-micro);
  letter-spacing: .18em;
  text-transform: uppercase;
  color: var(--muted);
  margin: 0;
  vertical-align: middle;
}
.section-title {
  font-family: var(--font-heading);
  font-size: var(--fs-h2);
  line-height: 1.04;
  letter-spacing: -.025em;
  font-weight: var(--heading-weight);
  color: var(--ink);
  text-wrap: balance;
  margin-top: 5pt;
}
.section-subtitle {
  font-size: calc(var(--fs-body) * 1.03);
  line-height: 1.55;
  color: var(--muted);
  max-width: 88%;
  margin-top: 9pt;
}

.block { margin: 0 0 var(--space-block); }
.block:last-child { margin-bottom: 0; }
.blocks--two_column { column-count: 2; column-gap: 20pt; }
.blocks--two_column .block { break-inside: avoid; }
.blocks--sidebar { display: grid; grid-template-columns: minmax(0, 1.75fr) minmax(0, 1fr); gap: 18pt; align-items: start; }
.blocks--sidebar > .block:nth-child(3n) { grid-column: 1; }
.blocks--sidebar > .block:nth-child(3n+1) { grid-column: 2; }
.blocks--wide { width: 100%; }

.paragraph { color: var(--ink); overflow-wrap: anywhere; }
.paragraph--lead { font-size: calc(var(--fs-body) * 1.18); line-height: 1.62; color: var(--ink); }
.paragraph--dropcap::first-letter { float: left; font-family: var(--font-display); font-size: 3.6em; line-height: .82; padding: 4pt 7pt 0 0; color: var(--accent); }
.paragraph + .paragraph { margin-top: calc(var(--space-block) * .72); }
.paragraph a { color: var(--accent); border-bottom: .5pt solid var(--accent); }

.heading { font-family: var(--font-heading); color: var(--ink); break-after: avoid; page-break-after: avoid; }
.heading--1 { font-size: var(--fs-h1); line-height: 1.02; letter-spacing: -.035em; margin: 0 0 calc(var(--space-block) * .8); }
.heading--2 { font-size: var(--fs-h2); line-height: 1.08; letter-spacing: -.02em; margin: 0 0 calc(var(--space-block) * .6); }
.heading--3 { font-size: var(--fs-h3); line-height: 1.2; margin: 0 0 calc(var(--space-block) * .4); }
.heading--4 { font-family: var(--font-mono); font-size: var(--fs-small); letter-spacing: .08em; text-transform: uppercase; margin: 0 0 6pt; }
.heading-kicker { display: block; font-family: var(--font-mono); font-size: var(--fs-micro); letter-spacing: .15em; text-transform: uppercase; color: var(--accent); margin-bottom: 5pt; }

.list { color: var(--ink); }
.list li { padding-left: 3pt; }
.list li::marker { color: var(--accent); font-family: var(--font-mono); }
.list-item-title { font-weight: 700; }
.list-item-text { color: var(--muted); }

.figure { margin: 0; }
.figure--keep { break-inside: avoid; page-break-inside: avoid; }
.figure img { width: 100%; height: auto; object-fit: contain; }
.figure--full img, .figure--wide img { max-height: 440pt; width: auto; max-width: 100%; margin: 0 auto; }
.figure--portrait img { max-height: 470pt; width: auto; margin: 0 auto; }
.figure--logo img { max-height: 44pt; width: auto; }
.figure figcaption { font-size: var(--fs-small); line-height: 1.45; color: var(--muted); margin-top: 7pt; }
.figure--image { break-inside: avoid; }
.figure--image img { border-radius: var(--radius); }

.chart-figure { break-inside: avoid; page-break-inside: avoid; background: transparent; }
.chart-svg { display: block; width: 100%; height: auto; overflow: visible; }
.chart-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12pt; margin-bottom: 6pt; }
.chart-title { font-family: var(--font-heading); font-size: calc(var(--fs-body) * 1.08); font-weight: 700; color: var(--ink); }
.chart-subtitle { font-family: var(--font-mono); font-size: var(--fs-micro); color: var(--muted); text-align: right; }
.chart-caption { font-size: var(--fs-small); color: var(--muted); margin-top: 5pt; }

.kpi-band { display: grid; grid-template-columns: repeat(auto-fit, minmax(110pt, 1fr)); gap: 8pt; break-inside: avoid; page-break-inside: avoid; }
.kpi-card { min-width: 0; }
.kpi-label { font-family: var(--font-mono); font-size: var(--fs-micro); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.kpi-value { font-family: var(--font-display); font-size: var(--fs-kpi); line-height: 1; letter-spacing: -.04em; color: var(--ink); margin: 6pt 0 4pt; font-variant-numeric: tabular-nums; }
.kpi-unit { font-size: .48em; letter-spacing: 0; margin-left: 2pt; }
.kpi-delta { font-family: var(--font-mono); font-size: var(--fs-micro); display: inline-block; }
.kpi-delta--positive { color: var(--success); }
.kpi-delta--negative { color: var(--danger); }
.kpi-delta--neutral, .kpi-delta--accent { color: var(--muted); }
.kpi-note { font-size: var(--fs-micro); color: var(--muted); line-height: 1.4; margin-top: 5pt; }
.kpi-title { font-family: var(--font-heading); font-size: calc(var(--fs-body) * 1.05); font-weight: 700; margin-bottom: 8pt; }

.quote { break-inside: avoid; page-break-inside: avoid; border-left: 2pt solid var(--accent); padding: 10pt 0 10pt 16pt; }
.quote-text { font-family: var(--font-display); font-size: calc(var(--fs-body) * 1.55); line-height: 1.38; color: var(--ink); }
.quote-attribution { font-family: var(--font-mono); font-size: var(--fs-small); color: var(--ink); margin-top: 9pt; }
.quote-role { font-family: var(--font-mono); font-size: var(--fs-micro); color: var(--muted); }

.callout { break-inside: avoid; page-break-inside: avoid; padding: 12pt 14pt; border-radius: var(--radius); background: var(--surface); border-left: 4pt solid var(--accent); }
.callout--warning { border-left-color: var(--warning); background: color-mix(in srgb, var(--warning) 8%, var(--bg)); }
.callout--success { border-left-color: var(--success); background: color-mix(in srgb, var(--success) 8%, var(--bg)); }
.callout--accent { border-left-color: var(--accent-2); }
.callout-title { font-family: var(--font-heading); font-weight: 700; font-size: calc(var(--fs-body) * 1.04); margin-bottom: 4pt; color: var(--ink); }
.callout-text { color: var(--ink); font-size: calc(var(--fs-body) * .96); }

.timeline { border-left: 1.2pt solid var(--line); padding-left: 16pt; margin: 2pt 0 0; }
.timeline-item { position: relative; padding-bottom: 12pt; break-inside: avoid; }
.timeline-item:last-child { padding-bottom: 0; }
.timeline-item::before { content: ""; position: absolute; left: -20.5pt; top: 3pt; width: 7pt; height: 7pt; border-radius: 50%; background: var(--bg); border: 1.4pt solid var(--accent); }
.timeline-date { font-family: var(--font-mono); font-size: var(--fs-micro); letter-spacing: .08em; text-transform: uppercase; color: var(--accent); }
.timeline-title { font-family: var(--font-heading); font-size: calc(var(--fs-body) * 1.02); font-weight: 700; margin: 3pt 0 2pt; }
.timeline-text { font-size: calc(var(--fs-body) * .94); color: var(--muted); line-height: 1.48; }
.timeline-title-row { display: flex; align-items: baseline; justify-content: space-between; gap: 10pt; }

.equation { font-family: var(--font-heading); font-size: calc(var(--fs-body) * 1.24); text-align: center; padding: 12pt; margin: 0 0 var(--space-block); }
.equation-caption { font-size: var(--fs-small); color: var(--muted); text-align: center; margin-top: 5pt; }
.equation code { font-family: var(--font-mono); font-size: .82em; color: var(--muted); }

.citation { font-size: calc(var(--fs-body) * .87); line-height: 1.5; padding-left: 18pt; text-indent: -18pt; margin-bottom: 8pt; color: var(--ink); }
.citation-url { font-family: var(--font-mono); font-size: .88em; color: var(--accent); }

.footnote { font-size: calc(var(--fs-body) * .82); line-height: 1.45; color: var(--muted); border-top: .5pt solid var(--line); padding-top: 6pt; margin-top: 8pt; }
.footnote-marker { font-family: var(--font-mono); color: var(--accent); margin-right: 4pt; }

.table-figure { break-inside: auto; }
.table-title { font-family: var(--font-heading); font-size: calc(var(--fs-body) * 1.06); font-weight: 700; margin-bottom: 7pt; }
.table-scroll { width: 100%; }
.table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: calc(var(--fs-body) * .84); line-height: 1.4; font-variant-numeric: tabular-nums; }
.table thead { display: table-header-group; }
.table tr { break-inside: avoid; page-break-inside: avoid; }
.table th, .table td { padding: 6pt 7pt; vertical-align: top; text-align: left; overflow-wrap: anywhere; word-break: normal; hyphens: auto; }
.table th { font-family: var(--font-mono); font-size: calc(var(--fs-body) * .68); letter-spacing: .07em; text-transform: uppercase; font-weight: 600; color: var(--muted); border-bottom: .8pt solid var(--line); }
.table td { color: var(--ink); border-bottom: .4pt solid var(--line); }
.table .num { text-align: right; font-variant-numeric: tabular-nums; }
.table .center { text-align: center; }
.table--compact th, .table--compact td { padding: 3.6pt 5pt; font-size: calc(var(--fs-body) * .78); }
.table-caption { font-size: var(--fs-small); color: var(--muted); margin-top: 6pt; line-height: 1.45; }

.divider {
  break-before: page; page-break-before: always;
  height: calc(var(--page-h) - var(--margin-top) - var(--margin-bottom) - 2pt);
  display: flex; flex-direction: column; justify-content: space-between;
  padding-top: 8pt;
}
.divider-top { display: flex; justify-content: space-between; gap: 12pt; font-family: var(--font-mono); font-size: var(--fs-micro); letter-spacing: .14em; text-transform: uppercase; color: var(--muted); }
.divider-main { margin-top: auto; margin-bottom: auto; max-width: 88%; }
.divider-number { font-family: var(--font-display); font-size: calc(var(--fs-section-number) * 2.6); line-height: .8; color: var(--accent); margin-bottom: 12pt; }
.divider-title { font-family: var(--font-heading); font-size: calc(var(--fs-h1) * 1.12); line-height: 1.02; letter-spacing: -.045em; }
.divider-subtitle { font-size: calc(var(--fs-body) * 1.05); color: var(--muted); max-width: 72%; margin-top: 10pt; }
.divider-bottom { border-top: .7pt solid var(--line); padding-top: 8pt; font-family: var(--font-mono); font-size: var(--fs-micro); color: var(--muted); display: flex; justify-content: space-between; }

.pagebreak { height: 0; break-after: page; page-break-after: always; }
.sectionbreak { break-before: page; page-break-before: always; break-after: page; page-break-after: always; display: flex; flex-direction: column; justify-content: center; height: calc(var(--page-h) - var(--margin-top) - var(--margin-bottom) - 2pt); }
.sectionbreak-title { font-family: var(--font-heading); font-size: calc(var(--fs-h1) * 1.05); line-height: 1.05; letter-spacing: -.04em; max-width: 80%; }
.sectionbreak-subtitle { color: var(--muted); margin-top: 10pt; max-width: 68%; }

.synthetic-note {
  font-family: var(--font-mono); font-size: 6.2pt; letter-spacing: .06em; text-transform: uppercase;
  color: var(--muted); border-top: .5pt solid var(--line); padding-top: 5pt; margin-top: 12pt;
}

/* Presentation-specific vertical rhythm. */
${isPresentation ? `
  .section { width: 100%; }
  .section-head { margin-bottom: 10pt; }
  .section-title { font-size: calc(var(--fs-h2) * .96); max-width: 88%; }
  .section-subtitle { max-width: 70%; }
  .paragraph--lead { max-width: 82%; }
  .section-number { font-size: 56pt; }
  .kpi-card { padding: 10pt; }
  .kpi-value { font-size: calc(var(--fs-kpi) * .86); }
  .chart-svg { max-height: 212pt; }
  .chart-title { font-size: calc(var(--fs-body) * .96); }
  .chart-caption { font-size: 7pt; }
  .figure img { max-height: 230pt; }
  .timeline-item { padding-bottom: 7pt; }
  .timeline-date { font-size: 6.2pt; }
  .timeline-title { font-size: 9.2pt; }
  .timeline-text { font-size: 8.4pt; line-height: 1.35; }
  .callout { padding: 8pt 10pt; }
  .callout-title { font-size: 9.2pt; }
  .callout-text { font-size: 8.4pt; line-height: 1.38; }
  .blocks--two_column { column-count: 2; }
` : ''}

${theme.css}
${page.height_pt < 700 ? `
  /* Small-format covers need a shorter vertical composition. */
  .cover { --cover-pad: 34pt; }
  .cover-eyebrow { display: none; }
  .cover-main { top: 23%; }
  .cover-title { font-size: 44pt; line-height: .96; }
  .cover-subtitle { font-size: 10pt; max-width: 76%; margin-bottom: 12pt; }
  .cover-stats { gap: 12pt; margin-top: 14pt; }
  .cover-stat-value { font-size: 16pt; }
  .cover-stat-label { font-size: 5.6pt; }
  .cover-meta { grid-template-columns: 1fr; gap: 4pt; font-size: 5.7pt; bottom: 30pt; }
  .cover-meta strong { font-size: 6.4pt; }
  .cover-index { font-size: 100pt; }
  .cover--minimal .cover-main { top: 21%; }
  .cover--minimal .cover-title { font-size: 43pt; }
  .cover--minimal .cover-art { top: 7%; right: 8%; }
  .cover--minimal .cover-subtitle { max-width: 70%; }
  .cover--minimal .cover-stats { margin-top: 17pt; }
` : ''}
`
}

export function buildStyles(document, theme, design) {
  return CSS(document, theme, design)
}
