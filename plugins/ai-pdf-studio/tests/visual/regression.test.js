import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { access } from 'node:fs/promises'
import { generatePdf } from '../../src/core/pipeline.js'
import { freshDir, miniDocument, PACKAGE_ROOT } from '../helpers.js'

const execFileP = promisify(execFile)
const BASELINE = path.join(PACKAGE_ROOT, 'tests', 'visual', 'baseline', 'page-01.png')

test('cover rendering matches the stored visual baseline within tolerance', async () => {
  await access(BASELINE)
  const dir = await freshDir('visual-regression')
  const result = await generatePdf({
    document: miniDocument({ document_id: 'visual-regression-baseline' }),
    output_dir: dir,
  }, { workspaceRoot: PACKAGE_ROOT })
  const comparison = await execFileP('python3', [
    path.join(PACKAGE_ROOT, 'scripts', 'compare_images.py'),
    BASELINE,
    result.preview_paths[0],
  ], { maxBuffer: 4 * 1024 * 1024 })
  const metrics = JSON.parse(comparison.stdout)
  assert.equal(metrics.same_size, true)
  assert.ok(metrics.rmse <= 0.5, `RMSE ${metrics.rmse} exceeds tolerance`)
  assert.ok(metrics.changed_pixels_ratio <= 0.005, `changed pixels ${metrics.changed_pixels_ratio} exceeds tolerance`)
  assert.equal(result.page_count, 4)
  assert.deepEqual(result.failed_gates, [])
})
