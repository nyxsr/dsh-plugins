/**
 * Eight design families with real structural differences, not recolors.
 *
 * Every family defines color, typography, spacing, cover composition,
 * body-page rhythm, tables, charts, callouts, and header/footer treatments.
 */
import { ensureContrast, contrastRatio, mixHex, normalizeHex } from './contrast.js'

const FONT = {
  inter: '"Inter", "Noto Sans", "DejaVu Sans", sans-serif',
  gelasio: '"Gelasio", "Noto Serif", "DejaVu Serif", serif',
  charter: '"Bitstream Charter", "Nimbus Roman", "Noto Serif", serif',
  space: '"Space Grotesk", "Inter", "Noto Sans", sans-serif',
  michroma: '"Michroma", "Space Grotesk", sans-serif',
  mono: '"JetBrains Mono", "Noto Mono", monospace',
  nimbus: '"Nimbus Roman", "Noto Serif", "DejaVu Serif", serif',
}

/** @type {Record<string, object>} */
export const THEMES = {
  modern_corporate: {
    key: 'modern_corporate',
    name: 'Modern Corporate',
    description: 'Sistem korporat yang tegas dan berbasis data, dengan sampul terbelah, garis teal, dan pita KPI terstruktur.',
    mood: 'clear, credible, operational',
    colors: {
      ink: '#10233D', muted: '#53627A', faint: '#7C8A9E', accent: '#0B6E6E', accent2: '#D98E2B',
      accentInk: '#FFFFFF', bg: '#FFFFFF', surface: '#F3F7F9', surface2: '#E8F0F3', line: '#D5E0E6',
      coverBg: '#0B1F33', coverInk: '#FFFFFF', coverMuted: '#AFC4D2', coverAccent: '#5ED1C8',
      coverAccentInk: '#062B2B', success: '#237A57', warning: '#A15C00', danger: '#A83232',
    },
    fonts: { display: FONT.inter, heading: FONT.inter, body: FONT.inter, mono: FONT.mono },
    type: { body: 10.4, line: 1.56, h1: 29, h2: 19, h3: 12.5, small: 8.4, micro: 7.2, kpi: 31, coverTitle: 48, coverSubtitle: 13.5, sectionNumber: 36 },
    spacing: { block: 13, section: 24, card: 12, coverPad: 54, radius: 0 },
    layout: {
      cover: 'split', section: 'bar', density: 'comfortable', bodyWidth: 'full', table: 'striped',
      headingCase: 'none', dropcap: false, chartPalette: ['#0B6E6E', '#D98E2B', '#2F6E9E', '#8A5A9E', '#4E8A6A', '#9E5A5A'],
    },
    css: `
      .section-head { border-left: 6pt solid var(--accent); padding-left: 14pt; }
      .section-number { font-family: var(--font-mono); font-size: 9pt; letter-spacing: .12em; color: var(--accent); }
      .kpi-band { display: grid; grid-template-columns: repeat(auto-fit, minmax(0, 1fr)); gap: 8pt; }
      .kpi-card { border-top: 3pt solid var(--accent); background: var(--surface); padding: 12pt; }
      .kpi-value { font-size: 26pt; letter-spacing: -.03em; }
      .table thead th { background: var(--ink); color: #fff; }
      .table tbody tr:nth-child(even) { background: var(--surface); }
      .callout { border-left: 4pt solid var(--accent); background: var(--surface); }
      .quote { border-top: 2pt solid var(--accent); border-bottom: 1pt solid var(--line); }
      .section--flow .section-head { margin-top: 18pt; }
      .figure figcaption, .table-caption { color: var(--muted); }
      .cover--split .cover-art { background: var(--accent); }
      .cover--split .cover-main { width: 61%; }
      .cover--split .cover-title { font-size: 50pt; letter-spacing: -.045em; }
      .cover--split .cover-art-label { color: var(--coverAccentInk); }
    `,
  },

  premium_editorial: {
    key: 'premium_editorial',
    name: 'Premium Editorial',
    description: 'Editorial majalah asimetris dengan kertas krem, garis oxblood, huruf display Gelasio, dan folio besar.',
    mood: 'considered, authoritative, human',
    colors: {
      ink: '#1B1814', muted: '#665D52', faint: '#8F8476', accent: '#9C2C2C', accent2: '#B89457',
      accentInk: '#FFFFFF', bg: '#FBF8F1', surface: '#F3EDE2', surface2: '#EAE1D2', line: '#D8CEC0',
      coverBg: '#F4EDE0', coverInk: '#1B1814', coverMuted: '#665D52', coverAccent: '#9C2C2C',
      coverAccentInk: '#FFFFFF', success: '#3D6B4F', warning: '#9A641E', danger: '#9C2C2C',
    },
    fonts: { display: FONT.gelasio, heading: FONT.gelasio, body: FONT.inter, mono: FONT.mono },
    type: { body: 10.1, line: 1.62, h1: 32, h2: 21, h3: 12.5, small: 8.2, micro: 7, kpi: 28, coverTitle: 52, coverSubtitle: 14, sectionNumber: 58 },
    spacing: { block: 14, section: 28, card: 12, coverPad: 50, radius: 0 },
    layout: {
      cover: 'editorial', section: 'editorial', density: 'generous', bodyWidth: 'wide', table: 'lined',
      headingCase: 'none', dropcap: true, chartPalette: ['#9C2C2C', '#B89457', '#3D5A63', '#6A4C3A', '#7A7F52', '#4E4E4E'],
    },
    css: `
      .section-head { display: grid; grid-template-columns: 74pt 1fr; gap: 16pt; align-items: start; border-top: 1.2pt solid var(--ink); padding-top: 10pt; }
      .section-number { grid-column: 1; grid-row: 1 / span 3; align-self: start; margin: 0; font-family: var(--font-display); font-size: 46pt; line-height: .78; color: var(--accent); font-style: italic; }
      .section-kicker { grid-column: 2; grid-row: 1; display: block; margin: 0 0 6pt; font-family: var(--font-mono); font-size: 7.4pt; letter-spacing: .2em; text-transform: uppercase; color: var(--accent); }
      .section-title { grid-column: 2; grid-row: 2; font-weight: 500; letter-spacing: -.02em; margin: 0; }
      .section-subtitle { grid-column: 2; grid-row: 3; margin-top: 6pt; }
      .paragraph--lead { font-family: var(--font-display); font-size: 13pt; line-height: 1.5; color: var(--ink); }
      .paragraph--dropcap::first-letter { float: left; font-family: var(--font-display); font-size: 52pt; line-height: .78; padding: 5pt 6pt 0 0; color: var(--accent); }
      .quote { text-align: center; border: 0; padding: 18pt 28pt; }
      .quote-text { font-family: var(--font-display); font-style: italic; font-size: 20pt; }
      .quote::before { content: "“"; display: block; font-family: var(--font-display); font-size: 40pt; color: var(--accent-2); line-height: .5; }
      .table thead th { border-top: 1.4pt solid var(--ink); border-bottom: .7pt solid var(--ink); background: transparent; }
      .table tbody tr { border-bottom: .5pt solid var(--line); }
      .callout { border-top: 1pt solid var(--ink); border-bottom: 1pt solid var(--ink); background: transparent; padding: 14pt 0; }
      .callout-title { font-family: var(--font-display); font-style: italic; font-size: 13pt; }
      .cover--editorial .cover-title { font-weight: 500; letter-spacing: -.035em; }
      .cover--editorial .cover-art { color: var(--accent); }
    `,
  },

  minimalist_clean: {
    key: 'minimalist_clean',
    name: 'Minimalist Clean',
    description: 'Kemewahan yang tenang lewat pengurangan: ukuran kolom sempit, garis rambut, aksen merah yang ditahan, dan ruang kosong yang lapang.',
    mood: 'calm, precise, contemporary',
    colors: {
      ink: '#111111', muted: '#666666', faint: '#999999', accent: '#E23B2E', accent2: '#111111',
      accentInk: '#FFFFFF', bg: '#FFFFFF', surface: '#F7F7F7', surface2: '#EFEFEF', line: '#DEDEDE',
      coverBg: '#FFFFFF', coverInk: '#111111', coverMuted: '#666666', coverAccent: '#E23B2E',
      coverAccentInk: '#FFFFFF', success: '#2E6B4F', warning: '#8A5A13', danger: '#B3261E',
    },
    fonts: { display: FONT.inter, heading: FONT.inter, body: FONT.inter, mono: FONT.mono },
    type: { body: 9.6, line: 1.7, h1: 25, h2: 12, h3: 10.5, small: 7.8, micro: 6.8, kpi: 34, coverTitle: 56, coverSubtitle: 12, sectionNumber: 10 },
    spacing: { block: 16, section: 28, card: 18, coverPad: 58, radius: 0 },
    layout: {
      cover: 'minimal', section: 'minimal', density: 'generous', bodyWidth: 'narrow', table: 'minimal',
      headingCase: 'upper', dropcap: false, chartPalette: ['#111111', '#E23B2E', '#777777', '#B9B9B9', '#444444', '#D6D6D6'],
    },
    css: `
      .section { max-width: 372pt; margin: 0 auto; }
      .section-head { display: block; margin-bottom: 24pt; }
      .section-number { display: block; font-family: var(--font-mono); font-size: 7pt; letter-spacing: .18em; color: var(--accent); margin: 0 0 9pt; }
      .section-title { font-size: 15pt; font-weight: 450; letter-spacing: .02em; text-transform: uppercase; margin-top: 0; }
      .section-kicker { display: block; font-size: 6.8pt; letter-spacing: .28em; color: var(--muted); margin: 0 0 6pt; }
      .section-subtitle { font-size: 9.2pt; color: var(--muted); max-width: 300pt; margin-top: 8pt; line-height: 1.7; }
      .paragraph { color: var(--ink); }
      .paragraph--lead { font-size: 12.2pt; line-height: 1.65; color: var(--ink); }
      .list { padding-left: 0; list-style: none; }
      .list li { border-top: .5pt solid var(--line); padding: 8pt 0 8pt 18pt; position: relative; }
      .list li::before { content: "•"; position: absolute; left: 0; color: var(--accent); }
      .kpi-card { border-left: 1.5pt solid var(--accent); padding: 3pt 0 3pt 12pt; }
      .kpi-value { font-weight: 300; font-size: 32pt; letter-spacing: -.05em; }
      .table { font-size: 8.4pt; }
      .table thead th { border-bottom: .8pt solid var(--ink); background: transparent; font-weight: 500; }
      .table tbody td { border-bottom: .4pt solid var(--line); }
      .callout { border-top: .8pt solid var(--ink); border-bottom: .8pt solid var(--ink); background: transparent; }
      .quote { border-left: 2pt solid var(--accent); padding-left: 16pt; }
      .quote-text { font-size: 15pt; font-weight: 300; line-height: 1.6; }
      .figure figcaption, .table-caption { font-size: 7.2pt; letter-spacing: .04em; }
      .cover--minimal .cover-title { font-weight: 250; letter-spacing: -.06em; }
      .cover--minimal .cover-main { max-width: 74%; }
    `,
  },

  creative_bold: {
    key: 'creative_bold',
    name: 'Creative Bold',
    description: 'Tipografi seukuran poster, blok asam dan kobalt, nomor indeks asimetris, dan irama slide yang energik.',
    mood: 'bold, energetic, memorable',
    colors: {
      ink: '#121212', muted: '#57544B', faint: '#8C877A', accent: '#D8FF3E', accent2: '#2B4CFF',
      accentInk: '#111111', bg: '#F2EFE5', surface: '#E9E4D6', surface2: '#141414', line: '#C9C2B1',
      coverBg: '#111111', coverInk: '#F7F4E8', coverMuted: '#B9B3A3', coverAccent: '#D8FF3E',
      coverAccentInk: '#111111', success: '#1D6B43', warning: '#9A5A00', danger: '#B52A20',
    },
    fonts: { display: FONT.space, heading: FONT.space, body: FONT.inter, mono: FONT.michroma },
    type: { body: 10.2, line: 1.55, h1: 38, h2: 25, h3: 13, small: 8.3, micro: 7, kpi: 44, coverTitle: 64, coverSubtitle: 14, sectionNumber: 86 },
    spacing: { block: 14, section: 26, card: 12, coverPad: 48, radius: 0 },
    layout: {
      cover: 'poster', section: 'index', density: 'compact', bodyWidth: 'wide', table: 'boxed',
      headingCase: 'none', dropcap: false, chartPalette: ['#2B4CFF', '#111111', '#D8FF3E', '#FF6B35', '#7A5CFF', '#0F8B8D'],
    },
    css: `
      .section-head { display: grid; grid-template-columns: 1fr 88pt; gap: 16pt; align-items: end; margin-bottom: 18pt; }
      .section-number { font-family: var(--font-display); font-size: 74pt; line-height: .7; font-weight: 700; color: transparent; -webkit-text-stroke: 1.4pt var(--ink); text-align: right; grid-column: 2; grid-row: 1 / span 3; margin: 0; }
      .section-kicker { grid-column: 1; grid-row: 1; display: inline-block; background: var(--accent); color: var(--accentInk); padding: 3pt 6pt; font-family: var(--font-mono); font-size: 6.5pt; letter-spacing: .12em; text-transform: uppercase; margin: 0 0 8pt; }
      .section-title { grid-column: 1; grid-row: 2; font-size: 32pt; line-height: .98; letter-spacing: -.05em; font-weight: 700; text-transform: uppercase; margin: 0; }
      .section-subtitle { grid-column: 1; grid-row: 3; font-size: 11pt; font-weight: 500; max-width: 360pt; margin-top: 8pt; }
      .paragraph--lead { font-size: 14pt; line-height: 1.42; font-weight: 500; }
      .paragraph--lead::first-line { background: linear-gradient(transparent 62%, var(--accent) 62%); }
      .kpi-band { gap: 0; border: 1.5pt solid var(--ink); }
      .kpi-card { padding: 14pt; border-right: 1pt solid var(--ink); background: transparent; }
      .kpi-card:last-child { border-right: 0; }
      .kpi-card:nth-child(even) { background: var(--accent); }
      .kpi-value { font-family: var(--font-display); font-size: 38pt; font-weight: 700; letter-spacing: -.05em; }
      .kpi-label { font-family: var(--font-mono); font-size: 6.2pt; letter-spacing: .08em; text-transform: uppercase; }
      .table thead th { background: var(--ink); color: var(--bg); text-transform: uppercase; font-family: var(--font-mono); font-size: 6.6pt; letter-spacing: .08em; }
      .table tbody td { border-bottom: 1pt solid var(--ink); }
      .callout { background: var(--accent-2); color: #fff; border: 0; padding: 15pt 16pt; }
      .callout .callout-title, .callout .callout-text { color: #fff; }
      .quote { background: var(--ink); color: var(--bg); padding: 22pt 28pt; border: 0; }
      .quote-text { font-family: var(--font-display); font-size: 26pt; line-height: 1.06; letter-spacing: -.03em; color: var(--bg); }
      .quote-role, .quote-attribution { color: var(--accent); }
      .cover--poster .cover-title { font-size: 68pt; font-weight: 700; letter-spacing: -.07em; text-transform: uppercase; line-height: .84; }
      .cover--poster .cover-art { background: var(--accent-2); }
      .cover--poster .cover-index { color: var(--accent); -webkit-text-stroke: 0; }
    `,
  },

  technology_futuristic: {
    key: 'technology_futuristic',
    name: 'Technology Futuristic',
    description: 'Estetika panel instrumen: halaman nyaris hitam, garis sinyal sian, label telemetri mono, dan diagnostik magenta.',
    mood: 'precise, forward-looking, technical',
    colors: {
      ink: '#E8F4F5', muted: '#8EA9B2', faint: '#5E7680', accent: '#27E1D2', accent2: '#FF4FD8',
      accentInk: '#031316', bg: '#071019', surface: '#0D1B25', surface2: '#122530', line: '#1E3A46',
      coverBg: '#050B11', coverInk: '#EAF8F8', coverMuted: '#8EA9B2', coverAccent: '#27E1D2',
      coverAccentInk: '#031316', success: '#45D68A', warning: '#F3B44A', danger: '#FF6B6B',
    },
    fonts: { display: FONT.space, heading: FONT.space, body: FONT.inter, mono: FONT.mono },
    type: { body: 9.9, line: 1.56, h1: 31, h2: 20, h3: 12, small: 8, micro: 6.8, kpi: 34, coverTitle: 50, coverSubtitle: 13, sectionNumber: 34 },
    spacing: { block: 13, section: 26, card: 11, coverPad: 50, radius: 2 },
    layout: {
      cover: 'tech', section: 'tech', density: 'comfortable', bodyWidth: 'full', table: 'boxed',
      headingCase: 'none', dropcap: false, chartPalette: ['#27E1D2', '#FF4FD8', '#7A8CFF', '#45D68A', '#F3B44A', '#8EA9B2'],
    },
    css: `
      html, body { background: var(--bg); color: var(--ink); }
      .section { background-image: linear-gradient(var(--line) .5pt, transparent .5pt), linear-gradient(90deg, var(--line) .5pt, transparent .5pt); background-size: 28pt 28pt; background-position: 0 0; }
      .section-head { border-bottom: .8pt solid var(--accent); padding-bottom: 10pt; }
      .section-number { font-family: var(--font-mono); font-size: 8pt; color: var(--accent); letter-spacing: .16em; }
      .section-kicker { font-family: var(--font-mono); font-size: 6.7pt; letter-spacing: .2em; text-transform: uppercase; color: var(--accent-2); }
      .section-title { letter-spacing: -.025em; }
      .section-subtitle { color: var(--muted); }
      .paragraph { color: var(--ink); }
      .paragraph--lead { font-size: 12.8pt; color: var(--ink); border-left: 2pt solid var(--accent-2); padding-left: 12pt; }
      hr, .rule { border-color: var(--line); }
      .kpi-band { gap: 8pt; }
      .kpi-card { background: var(--surface); border: .6pt solid var(--line); padding: 12pt; position: relative; }
      .kpi-card::before { content: ""; position: absolute; top: 0; left: 0; width: 22pt; height: 2pt; background: var(--accent); }
      .kpi-value { font-family: var(--font-mono); font-size: 28pt; color: var(--accent); }
      .kpi-label, .kpi-note { color: var(--muted); }
      .table thead th { background: var(--surface2); color: var(--accent); font-family: var(--font-mono); font-size: 6.8pt; letter-spacing: .08em; text-transform: uppercase; border-bottom: .8pt solid var(--accent); }
      .table tbody td { border-bottom: .5pt solid var(--line); color: var(--ink); }
      .callout { background: rgba(39,225,210,.06); border: .7pt solid var(--accent); }
      .callout-title { color: var(--accent); font-family: var(--font-mono); font-size: 8pt; letter-spacing: .08em; text-transform: uppercase; }
      .quote { border-left: 2pt solid var(--accent-2); background: var(--surface); }
      .quote-text { font-family: var(--font-mono); font-size: 13pt; color: var(--accent); }
      .figure figcaption, .table-caption { color: var(--muted); }
      .cover--tech .cover-title { font-family: var(--font-display); }
    `,
  },

  luxury_elegant: {
    key: 'luxury_elegant',
    name: 'Luxury Elegant',
    description: 'Komposisi gading dan tinta yang simetris, garis emas, margin lebar, huruf serif yang ditahan, dan bingkai sampul berukir.',
    mood: 'exclusive, tactile, composed',
    colors: {
      ink: '#1B1814', muted: '#6A6154', faint: '#938878', accent: '#B08A47', accent2: '#6E1F2B',
      accentInk: '#FFFFFF', bg: '#F7F3EB', surface: '#F0E9DC', surface2: '#E7DDCB', line: '#D4C7B2',
      coverBg: '#151311', coverInk: '#F7F3EB', coverMuted: '#C8BCA4', coverAccent: '#C6A15B',
      coverAccentInk: '#1B1814', success: '#456B50', warning: '#96631C', danger: '#7A2933',
    },
    fonts: { display: FONT.gelasio, heading: FONT.gelasio, body: FONT.inter, mono: FONT.mono },
    type: { body: 9.8, line: 1.72, h1: 27, h2: 18, h3: 11.5, small: 8, micro: 6.8, kpi: 28, coverTitle: 47, coverSubtitle: 12.5, sectionNumber: 22 },
    spacing: { block: 16, section: 32, card: 13, coverPad: 62, radius: 0 },
    layout: {
      cover: 'luxury', section: 'luxury', density: 'generous', bodyWidth: 'narrow', table: 'lined',
      headingCase: 'none', dropcap: false, chartPalette: ['#B08A47', '#6E1F2B', '#3C4A45', '#8A7250', '#5E5A50', '#C9B48A'],
    },
    css: `
      .section { max-width: 410pt; margin: 0 auto; }
      .section-head { text-align: center; margin-bottom: 22pt; }
      .section-number { display: block; font-family: var(--font-mono); font-size: 6.8pt; letter-spacing: .3em; color: var(--accent); margin: 0 0 8pt; }
      .section-kicker { display: block; font-family: var(--font-mono); font-size: 6.4pt; letter-spacing: .26em; text-transform: uppercase; color: var(--muted); margin: 0 0 7pt; }
      .section-title { font-weight: 400; letter-spacing: .01em; }
      .section-subtitle { font-family: var(--font-display); font-style: italic; font-size: 10pt; color: var(--muted); max-width: 300pt; margin: 8pt auto 0; }
      .section-head::after { content: ""; display: block; width: 28pt; height: .8pt; background: var(--accent); margin: 12pt auto 0; }
      .paragraph { color: var(--ink); }
      .paragraph--lead { font-family: var(--font-display); font-size: 12pt; line-height: 1.6; text-align: center; }
      .kpi-band { gap: 0; border-top: 1pt solid var(--line); border-bottom: 1pt solid var(--line); }
      .kpi-card { text-align: center; padding: 14pt 10pt; border-right: .5pt solid var(--line); }
      .kpi-card:last-child { border-right: 0; }
      .kpi-value { font-family: var(--font-display); font-size: 30pt; font-weight: 400; color: var(--accent-2); }
      .kpi-label { font-family: var(--font-mono); font-size: 6.4pt; letter-spacing: .12em; text-transform: uppercase; }
      .table thead th { background: transparent; border-top: 1pt solid var(--ink); border-bottom: .6pt solid var(--ink); font-family: var(--font-mono); font-size: 6.8pt; letter-spacing: .08em; text-transform: uppercase; }
      .table tbody td { border-bottom: .4pt solid var(--line); }
      .callout { text-align: center; border-top: .8pt solid var(--accent); border-bottom: .8pt solid var(--accent); background: transparent; padding: 16pt 20pt; }
      .callout-title { font-family: var(--font-display); font-style: italic; color: var(--accent-2); }
      .quote { text-align: center; border: 0; padding: 18pt 22pt; }
      .quote-text { font-family: var(--font-display); font-size: 19pt; font-style: italic; line-height: 1.45; }
      .quote-attribution { color: var(--accent); }
      .figure { text-align: center; }
      .cover--luxury .cover-title { font-weight: 400; letter-spacing: .01em; }
    `,
  },

  academic_professional: {
    key: 'academic_professional',
    name: 'Academic Professional',
    description: 'Tata letak riset formal dengan teks isi charter-serif, bagian bernomor, pita abstrak, tabel ringkas, dan perangkat referensi.',
    mood: 'rigorous, sober, legible',
    colors: {
      ink: '#1A1A1A', muted: '#55524E', faint: '#807B74', accent: '#6B1D2A', accent2: '#2B4A6F',
      accentInk: '#FFFFFF', bg: '#FFFFFF', surface: '#F5F5F2', surface2: '#ECECE7', line: '#D6D4CE',
      coverBg: '#FFFFFF', coverInk: '#1A1A1A', coverMuted: '#55524E', coverAccent: '#6B1D2A',
      coverAccentInk: '#FFFFFF', success: '#3F644C', warning: '#8A5C1E', danger: '#8A2430',
    },
    fonts: { display: FONT.charter, heading: FONT.nimbus, body: FONT.charter, mono: FONT.mono },
    type: { body: 9.6, line: 1.52, h1: 24, h2: 16.5, h3: 11, small: 7.8, micro: 6.8, kpi: 25, coverTitle: 35, coverSubtitle: 11.5, sectionNumber: 14 },
    spacing: { block: 11, section: 22, card: 10, coverPad: 58, radius: 0 },
    layout: {
      cover: 'academic', section: 'academic', density: 'compact', bodyWidth: 'full', table: 'lined',
      headingCase: 'none', dropcap: false, chartPalette: ['#6B1D2A', '#2B4A6F', '#5B6658', '#8A7250', '#55524E', '#A33B45'],
    },
    css: `
      .section-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4pt 7pt; border-bottom: .8pt solid var(--ink); padding-bottom: 7pt; margin-bottom: 15pt; }
      .section-number { display: inline-block; margin: 0; font-family: var(--font-body); font-size: 10pt; font-weight: 700; color: var(--accent); }
      .section-kicker { font-family: var(--font-body); font-size: 7.2pt; font-variant: small-caps; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); margin: 0; }
      .section-title { flex: 1 1 100%; font-family: var(--font-heading); font-weight: 700; margin: 0; }
      .section-subtitle { flex-basis: 100%; margin-top: 3pt; }
      .paragraph { text-align: justify; hyphens: auto; }
      .paragraph--lead { font-size: 10.4pt; font-style: italic; text-align: left; border-left: 2pt solid var(--accent); padding-left: 10pt; }
      .list li { margin-bottom: 4pt; }
      .kpi-card { border: .5pt solid var(--line); padding: 9pt; background: var(--surface); }
      .kpi-value { font-family: var(--font-heading); font-size: 22pt; color: var(--accent-2); }
      .kpi-label { font-variant: small-caps; letter-spacing: .05em; }
      .table { font-size: 7.9pt; }
      .table thead th { background: var(--surface2); border-top: 1pt solid var(--ink); border-bottom: .7pt solid var(--ink); font-variant: small-caps; }
      .table tbody td { border-bottom: .4pt solid var(--line); }
      .callout { border: .6pt solid var(--line); background: var(--surface); }
      .callout-title { font-family: var(--font-heading); }
      .quote { border-left: 2pt solid var(--accent); background: var(--surface); }
      .quote-text { font-family: var(--font-body); font-style: italic; font-size: 13pt; }
      .equation { font-family: var(--font-heading); text-align: center; background: var(--surface); border-top: .5pt solid var(--line); border-bottom: .5pt solid var(--line); }
      .citation { font-size: 7.8pt; padding-left: 16pt; text-indent: -16pt; }
      .figure figcaption, .table-caption { font-size: 7.4pt; }
      .cover--academic .cover-title { font-family: var(--font-heading); font-weight: 700; }
    `,
  },

  infographic_visual: {
    key: 'infographic_visual',
    name: 'Infographic Visual',
    description: 'Sistem infografis editorial dengan kanvas krem, struktur navy, aksen data oranye, dan kartu fakta modular.',
    mood: 'vivid, explanatory, scannable',
    colors: {
      ink: '#14213D', muted: '#5A6477', faint: '#8992A1', accent: '#F26430', accent2: '#2A9D8F',
      accentInk: '#FFFFFF', bg: '#FFF8EC', surface: '#FFFFFF', surface2: '#F4E8D3', line: '#E6D6BD',
      coverBg: '#14213D', coverInk: '#FFF8EC', coverMuted: '#B9C3D3', coverAccent: '#F26430',
      coverAccentInk: '#FFFFFF', success: '#2A9D8F', warning: '#D98E2B', danger: '#C9463D',
    },
    fonts: { display: FONT.space, heading: FONT.space, body: FONT.inter, mono: FONT.mono },
    type: { body: 10.2, line: 1.55, h1: 31, h2: 21, h3: 12.5, small: 8.2, micro: 7, kpi: 36, coverTitle: 48, coverSubtitle: 13.5, sectionNumber: 28 },
    spacing: { block: 13, section: 24, card: 11, coverPad: 48, radius: 3 },
    layout: {
      cover: 'infographic', section: 'infographic', density: 'compact', bodyWidth: 'wide', table: 'boxed',
      headingCase: 'none', dropcap: false, chartPalette: ['#F26430', '#2A9D8F', '#14213D', '#E9C46A', '#E76F51', '#6D597A'],
    },
    css: `
      .section-head { display: grid; grid-template-columns: 1fr auto; align-items: end; border-bottom: 2pt solid var(--ink); padding-bottom: 8pt; margin-bottom: 17pt; }
      .section-number { font-family: var(--font-display); font-size: 12pt; font-weight: 700; color: var(--accent); grid-column: 2; grid-row: 1 / span 3; margin: 0; }
      .section-kicker { grid-column: 1; grid-row: 1; display: inline-block; font-family: var(--font-mono); font-size: 6.6pt; letter-spacing: .12em; text-transform: uppercase; background: var(--ink); color: var(--bg); padding: 3pt 6pt; margin: 0 0 7pt; }
      .section-title { grid-column: 1; grid-row: 2; font-weight: 700; letter-spacing: -.035em; margin: 0; }
      .section-subtitle { grid-column: 1; grid-row: 3; margin-top: 7pt; }
      .paragraph--lead { font-size: 13pt; line-height: 1.45; font-weight: 500; }
      .kpi-band { gap: 8pt; }
      .kpi-card { background: var(--surface); border: .8pt solid var(--line); padding: 12pt; border-radius: var(--radius); box-shadow: 2pt 2pt 0 var(--line); }
      .kpi-card:nth-child(3n+1) { border-top: 4pt solid var(--accent); }
      .kpi-card:nth-child(3n+2) { border-top: 4pt solid var(--accent-2); }
      .kpi-card:nth-child(3n+3) { border-top: 4pt solid var(--ink); }
      .kpi-value { font-family: var(--font-display); font-size: 34pt; font-weight: 700; letter-spacing: -.05em; }
      .table thead th { background: var(--ink); color: var(--bg); }
      .table tbody tr:nth-child(even) { background: var(--surface); }
      .callout { background: var(--surface); border: .8pt solid var(--line); border-left: 5pt solid var(--accent); border-radius: var(--radius); }
      .quote { background: var(--accent-2); color: #fff; border: 0; border-radius: var(--radius); }
      .quote .quote-text, .quote .quote-attribution, .quote .quote-role { color: #fff; }
      .figure { background: var(--surface); border: .6pt solid var(--line); padding: 10pt; border-radius: var(--radius); }
      .cover--infographic .cover-title { font-weight: 700; letter-spacing: -.05em; }
      .cover--infographic .cover-art { background: var(--accent); }
    `,
  },
}

export const THEME_KEYS = Object.freeze(Object.keys(THEMES))
export const THEME_LIST = Object.freeze(Object.values(THEMES))

/**
 * Resolve a theme from a document, brand kit, and optional reference profile.
 * Returns a cloned theme so a repair iteration cannot mutate global state.
 *
 * @param {object} document normalized Document IR
 * @param {{baseTheme?: string, reference?: object}} [options]
 */
export function resolveTheme(document, options = {}) {
  const family = document.theme?.family || options.baseTheme || 'modern_corporate'
  const base = THEMES[family] ?? THEMES.modern_corporate
  const theme = structuredClone(base)
  const warnings = []
  theme.tokens = {
    ...(document.theme?.tokens ?? {}),
    ...(theme.tokens ?? {}),
  }
  if (document.brand?.colors) {
    const brand = document.brand.colors
    const mapping = [
      ['primary', 'accent'], ['accent', 'accent2'], ['background', 'bg'], ['text', 'ink'],
    ]
    for (const [source, target] of mapping) {
      if (brand[source]) theme.colors[target] = normalizeHex(brand[source], theme.colors[target])
    }
    if (brand.primary) {
      const button = ensureContrast('#FFFFFF', theme.colors.accent, 4.5)
      if (button.adjusted) warnings.push(`Brand primary ${brand.primary} has insufficient white-text contrast; the theme accent was adjusted for legibility.`)
      theme.colors.accentInk = button.color
    }
  }
  if (document.brand?.fonts?.heading) theme.fonts.heading = `"${document.brand.fonts.heading}", ${theme.fonts.heading}`
  if (document.brand?.fonts?.body) theme.fonts.body = `"${document.brand.fonts.body}", ${theme.fonts.body}`
  if (document.brand?.colors?.primary) {
    theme.colors.coverAccent = theme.colors.accent
    theme.colors.coverAccentInk = theme.colors.accentInk
  }
  let profile = options.reference ?? document.reference?.profile
  if (profile && document.reference?.fidelity === 'layout_guided') {
    profile = { ...profile, colors: undefined }
  }
  if (profile && document.reference?.fidelity !== 'brand_matched') {
    const applied = applyReferenceProfile(theme, profile)
    warnings.push(...applied.warnings)
  }
  // Guarantee readable body and muted text even if a custom brand or reference
  // supplied a low-contrast pair.
  const body = ensureContrast(theme.colors.ink, theme.colors.bg, 4.5)
  if (body.adjusted) {
    warnings.push(`Theme body text was adjusted to meet 4.5:1 contrast (${body.ratio.toFixed(2)}:1).`)
    theme.colors.ink = body.color
  }
  const muted = ensureContrast(theme.colors.muted, theme.colors.bg, 4.5)
  if (muted.adjusted) {
    warnings.push(`Theme muted text was adjusted to meet 4.5:1 contrast (${muted.ratio.toFixed(2)}:1).`)
    theme.colors.muted = muted.color
  }
  theme.contrast = {
    body: contrastRatio(theme.colors.ink, theme.colors.bg),
    muted: contrastRatio(theme.colors.muted, theme.colors.bg),
    accentOnBackground: contrastRatio(theme.colors.accent, theme.colors.bg),
    cover: contrastRatio(theme.colors.coverInk, theme.colors.coverBg),
  }
  theme.applied_tokens = structuredClone(document.theme?.tokens ?? {})
  theme.brand_applied = Boolean(document.brand)
  theme.reference_applied = Boolean(profile)
  return { theme, warnings }
}

/** Apply a Reference Design Profile without copying artwork or exact layouts. */
export function applyReferenceProfile(theme, profile) {
  const warnings = []
  const colors = profile?.colors ?? {}
  const mappings = [
    ['primary', 'accent'], ['accent', 'accent2'], ['background', 'bg'], ['text', 'ink'],
  ]
  const before = structuredClone(theme.colors)
  for (const [source, target] of mappings) {
    if (typeof colors[source] === 'string' && /^#[0-9a-fA-F]{6}$/.test(colors[source])) {
      theme.colors[target] = colors[source].toUpperCase()
    }
  }
  if (profile?.layout?.whitespace === 'generous') {
    theme.spacing.block = Math.round(theme.spacing.block * 1.18)
    theme.spacing.section = Math.round(theme.spacing.section * 1.18)
    theme.layout.density = 'generous'
  }
  if (profile?.layout?.whitespace === 'tight') {
    theme.spacing.block = Math.max(8, Math.round(theme.spacing.block * 0.86))
    theme.spacing.section = Math.max(14, Math.round(theme.spacing.section * 0.86))
    theme.layout.density = 'compact'
  }
  if (profile?.typography?.hierarchy === 'high_contrast') {
    theme.type.h1 = Math.round(theme.type.h1 * 1.08)
    theme.type.h2 = Math.round(theme.type.h2 * 1.06)
  }
  if (profile?.typography?.heading_style === 'editorial_serif' && !theme.fonts.heading.includes('Gelasio')) {
    theme.fonts.heading = FONT.gelasio
    theme.fonts.display = FONT.gelasio
  }
  if (profile?.typography?.body_style === 'clean_sans') theme.fonts.body = FONT.inter
  if (profile?.layout?.columns === 2) theme.layout.bodyWidth = 'wide'
  const bg = theme.colors.bg
  const repairedInk = ensureContrast(theme.colors.ink, bg, 4.5)
  if (repairedInk.adjusted) {
    theme.colors.ink = repairedInk.color
    warnings.push('Palet referensi disesuaikan agar kontras teks isi tetap 4.5:1.')
  }
  const repairedAccent = ensureContrast(theme.colors.accent, bg, 4.5)
  if (repairedAccent.adjusted) {
    theme.colors.accent = repairedAccent.color
    warnings.push('Aksen utama referensi disesuaikan gelap-terang untuk kontras teks 4.5:1.')
  }
  const repairedAccent2 = ensureContrast(theme.colors.accent2, bg, 3.0)
  if (repairedAccent2.adjusted) {
    theme.colors.accent2 = repairedAccent2.color
    warnings.push('Aksen sekunder referensi disesuaikan gelap-terang untuk kontras teks besar 3:1.')
  }
  if (before.coverBg === theme.colors.coverBg) theme.colors.coverBg = mixHex(theme.colors.coverBg, theme.colors.ink, 0.12)
  theme.reference_mode = profile?.visual_style ?? 'inspired'
  return { theme, warnings }
}

export function themePreviewMeta() {
  return THEME_LIST.map(theme => ({
    family: theme.key,
    name: theme.name,
    description: theme.description,
    mood: theme.mood,
    cover: theme.layout.cover,
    section: theme.layout.section,
    density: theme.layout.density,
    palette: [theme.colors.ink, theme.colors.accent, theme.colors.accent2, theme.colors.bg],
  }))
}
