# Architecture

The plugin separates **semantics** from **layout** and **rendering**. A revision therefore edits the JSON IR, never an SVG or PNG.

```text
requirement / structured spec
        │
   parse/ (detect, erd, flow, class, usecase, state, sequence, architecture)
        │
   ir/index.js  → canonical Diagram IR v1
        │
   validate/semantic.js  → blocking errors + warnings + assumptions
        │
   layout/index.js + metrics.js → deterministic geometry
        │
   quality/layout.js → overlap/bounds/crossing checks
        │
   quality/refine.js → ≤3 bounded density/orientation attempts
        │
   render/svg.js + themes.js → standalone SVG
        │
   render/export.js + chromium.js → SVG/PNG/PDF
        │
   quality/artifacts.js → format, markup, raster, PDF page verification
```

## Modules

| Path | Responsibility |
| --- | --- |
| `index.js` | DSH Host adapter. Registers the six tools and per-workspace studios. |
| `src/api/studio.js` | Orchestrates generate/revise/validate/export/list and the quality gate. |
| `src/api/revision.js` | Natural-language and structured IR patches with preservation checks. |
| `src/parse/detect.js` | Language, diagram type, and short title inference. |
| `src/parse/*.js` | Family-specific parsers plus a structured-spec parser. |
| `src/ir/index.js` | Versioned IR, normalization, limits, stable IDs, semantic fingerprint helpers. |
| `src/validate/semantic.js` | Diagram-family semantic rules. Never mutates the IR. |
| `src/layout/*` | Deterministic layered/cluster/sequence layout and orthogonal routing. |
| `src/render/select.js` | Renderer discovery; native SVG is selected and verified. |
| `src/render/svg.js` | All SVG shapes, markers, labels, themes, and document wrapper. |
| `src/render/chromium.js` | Bounded CDP browser for PNG screenshots and vector PDF printing. |
| `src/render/export.js` | Verifies before writing, unique filenames, artifact hashes. |
| `src/quality/layout.js` | Node overlap, bounds, short edges, label bounds, groups, crossings, edge overlaps. |
| `src/quality/png.js` | In-house PNG decoder + ink/margin/blank-run analysis. |
| `src/quality/artifacts.js` | SVG security/markup, PNG dimensions/blankness, PDF page/raster checks. |
| `src/core/store.js` | Atomic JSON persistence, locks, revision archives, path-safe artifact storage. |

## Renderer policy

`discoverRenderers()` checks native SVG, Graphviz, Mermaid CLI, PlantUML, and Chromium. The current release deliberately selects **native SVG** for every family: it is the only renderer verified here for crow's-foot ERD, UML markers, architecture clusters, and sequence frames. External engines are reported as unavailable candidates, not silently used.

Chromium is a **projection backend**, not the semantic renderer. It screenshots/prints the same verified SVG. A missing Chromium is a bounded export error, not a crash.

## Quality gate

Rendering is blocked when semantic validation returns `FAILED`. Layout refinement changes only spacing and orientation; a semantic fingerprint verifies nodes, edges, groups, frames, constraints, and assumptions are unchanged. `SUCCESS` is only returned after artifact verification. Optional missing tools or an unavailable pixel review are disclosed as warnings.
