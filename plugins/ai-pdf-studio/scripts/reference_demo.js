#!/usr/bin/env node
/**
 * Demonstrate reference analysis and adaptation using an original
 * AI PDF Studio cover as the reference. No third-party artwork is used.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createStudio } from '../src/api/service.js'

const workspaceRoot = path.resolve('.')
const studio = createStudio({ workspaceRoot })
const referencePath = 'outputs/01-business-performance-report/demo-business-performance-report.pdf'
const analysisDir = 'outputs/reference-guided/analysis'

const analysis = await studio.analyze_design_reference({
  reference_path: referencePath,
  output_dir: analysisDir,
  fidelity: 'inspired',
})
const profile = JSON.parse(await readFile(analysis.profile_path, 'utf8'))

const document = {
  document_id: 'demo-reference-guided-design',
  title: 'Measured Influence',
  subtitle: 'Applying visual principles from an original reference to a new document — without copying its pages',
  eyebrow: 'Reference-guided design study',
  category: 'report',
  language: 'en',
  audience: 'Design and editorial leads',
  purpose: 'Demonstrate reference analysis, palette adaptation, and original composition',
  content_mode: 'preserve',
  synthetic: true,
  page: { size: 'A4' },
  theme: { family: profile.visual_style },
  reference: { fidelity: 'inspired', profile, source: referencePath },
  metadata: {
    author: 'AI PDF Studio (synthetic)',
    organization: 'AI PDF Studio',
    created_at: '2026-11-10T08:00:00Z',
    keywords: ['reference-guided design', 'synthetic'],
  },
  sections: [
    {
      title: 'What was measured', kicker: '01 · Method',
      blocks: [
        { type: 'paragraph', lead: true, dropcap: true, text: 'The reference engine measured the cover of an original Northstar Analytics report: dominant surface colours, text contrast, ink coverage, edge density, and estimated margins from the text layer. It did not reproduce the cover, its artwork, or its exact measurements. The output below applies a palette and density profile to a new composition with different content and a different cover treatment.' },
        { type: 'kpi', items: [
          { label: 'Sampled primary', value: profile.colors.primary, note: 'Reference estimate' },
          { label: 'Sampled background', value: profile.colors.background, note: 'Reference estimate' },
          { label: 'Detected style', value: `${(profile.confidence * 100).toFixed(0)}%`, note: profile.visual_style.replace(/_/g, ' ') },
        ] },
        { type: 'callout', tone: 'info', title: 'Evidence boundary', text: 'The reference was an AI-generated original cover, not a copyrighted third-party design. Typography and exact grid values remain estimates; the profile is a design specification, not a copy instruction.' },
      ],
    },
    {
      title: 'What changed', kicker: '02 · Adaptation',
      blocks: [
        { type: 'paragraph', text: 'The new document inherits a cool navy field, a teal accent, and a measured information rhythm. It does not inherit the reference cover’s split composition: the cover uses a different editorial layout and a different hierarchy. The body uses the same palette discipline to keep charts, tables, and callouts coherent without pretending that the source and the target are the same document.' },
        { type: 'chart', chart_type: 'bar', title: 'Adaptation decisions', subtitle: 'Qualitative scoring of the transfer', data: { categories: ['Palette', 'Contrast', 'Density', 'Composition', 'Originality'], series: [{ name: 'Retained', values: [92, 88, 61, 18, 100] }] }, caption: 'Scores are a synthetic illustration of the adaptation strategy, not a measured design score.' },
        { type: 'table', title: 'Reference profile fields and use', columns: [
          { key: 'field', label: 'Profile field', width: 30 }, { key: 'use', label: 'Use in new document', width: 50 }, { key: 'confidence', label: 'Confidence', align: 'right', width: 20 },
        ], rows: [
          { field: 'colors.primary', use: 'Accent for rules and chart series', confidence: 'high' },
          { field: 'colors.accent', use: 'Secondary data emphasis', confidence: 'medium' },
          { field: 'layout.whitespace', use: 'Body block rhythm', confidence: 'medium' },
          { field: 'typography.heading_style', use: 'Recorded but not copied exactly', confidence: 'low' },
        ], caption: 'Synthetic adaptation record.' },
      ],
    },
    {
      title: 'Why originality matters', kicker: '03 · Constraint',
      blocks: [
        { type: 'paragraph', text: 'Reference-guided design is useful because it turns vague taste into explicit constraints. It is dangerous when it turns a source page into a template to be traced. The engine therefore records confidence, labels estimates, preserves a contrast floor, and requires original composition. The target document can be recognisably related in tone without being a derivative copy.' },
        { type: 'callout', tone: 'warning', title: 'Demonstration only', text: 'This document is synthetic. The reference was an original AI PDF Studio cover. The profile values are estimates from a rendered page, not extracted brand tokens.' },
      ],
    },
  ],
}

const result = await studio.generate_pdf({
  document,
  output_dir: 'outputs/reference-guided/document',
})
await mkdir(path.join(workspaceRoot, 'outputs/reference-guided'), { recursive: true })
const summary = `# Reference-guided design demonstration

- Reference PDF: \`${referencePath}\` (original AI PDF Studio cover)
- Fidelity mode: **inspired**
- Analysis method: \`${analysis.method}\`
- Profile: \`${analysis.profile_path}\`
- Generated PDF: \`${result.pdf_path}\`
- Quality score: **${result.quality_score}**
- Release status: **${result.release_status}**
- Pages: ${result.page_count}

## Extracted profile (summary)

\`\`\`json
${JSON.stringify({
  visual_style: profile.visual_style,
  colors: profile.colors,
  layout: profile.layout,
  typography: profile.typography,
  confidence: profile.confidence,
  warnings: profile.warnings,
}, null, 2)}
\`\`\`

## Limitations

- Palette values are sampled from a rendered page, not exact source tokens.
- Typography and grid values are estimates; the profile is not a source-file extraction.
- The generated document uses an original composition. No reference artwork or page layout is copied.
- No third-party copyrighted reference was used in this demonstration.
`
await writeFile(path.join(workspaceRoot, 'outputs/reference-guided/README.md'), summary, 'utf8')
process.stdout.write(JSON.stringify({
  analysis: { method: analysis.method, profile_path: analysis.profile_path, confidence: profile.confidence, visual_style: profile.visual_style },
  generation: { pdf_path: result.pdf_path, quality_score: result.quality_score, release_status: result.release_status, page_count: result.page_count },
  summary_path: path.join(workspaceRoot, 'outputs/reference-guided/README.md'),
}, null, 2))
