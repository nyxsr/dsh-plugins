# Troubleshooting

## `renderer_unavailable`

No Chromium/Chrome was found for PNG/PDF. Set one explicitly:

```bash
export DIAGRAM_CHROMIUM=/path/to/chrome
# or
export CHROMIUM_PATH=/path/to/chrome
```

SVG-only generation still works. Verify with `node src/cli.js generate "..." --formats svg`.

## PNG/PDF produced but verification failed

The plugin checks signatures, dimensions, PDF page geometry, and first-page raster ink **before** reporting success. Common causes:

- A browser that exits before `Page.loadEventFired`; inspect the bounded error message.
- A page larger than 12000 px at the requested scale; reduce `scale` (1–3) or use landscape.
- Missing `pdfinfo`/`pdftoppm`: deep PDF checks are skipped with a disclosed warning, not a false success.

## `NEEDS_CLARIFICATION`

The parser found a material ambiguity, for example a relationship sentence with no resolvable second entity, or a sequence message with no participant. Read `clarifications[]` and supply an explicit name or a `structured_specification`. The plugin does not invent unstated tables, constraints, or endpoints.

## ERD foreign key is rejected

The validator requires a referenced column that is a primary key or unique. Point the FK at an existing key, or mark the target column `UNIQUE`. If only the table is named, the primary key is inferred and disclosed as an assumption. Cardinality direction is child→parent: a non-unique FK is `many` at the child and `one` at the parent.

## A revision says `constraint_violation`

The original request had `"Jangan tambahkan tabel lain"` (or the structured equivalent). Explicit `add_node`/`add_edge` revisions clear that earlier no-addition constraint and record an assumption; unrelated preservation constraints remain enforced. If the revision tries to modify preserved elements, split it into an explicit structured patch.

## Layout looks dense or labels collide

- Inspect `quality_report.layout.warnings`; look for `layout_edge_overlap`, `layout_coincident_endpoints`, `layout_label_out_of_bounds`.
- Ask for `layout_density: "spacious"` or `orientation: "landscape"`.
- Revision can request `"Rapikan layout dan gunakan landscape"`.
- Refinement is capped at three attempts and never changes semantics. If a warning persists, it is reported rather than hidden.

## Diagram is too large

The IR caps diagram size. Prefer a hierarchical/grouped view, split the requirement into subdiagrams, or use `layout_density: "compact"`. Do not shrink text to illegibility; the plugin keeps a minimum readable font and expands the canvas.

## Where are my files?

The tool result lists `artifacts[].relative_path`. Default workspace storage is `.diagram-studio/diagrams/<diagram-id>/exports/`. The CLI defaults to the same. `--store` changes the root for experiments.

## DSH install succeeded but tools are absent

Call `list_supported_diagrams`. If the tool is absent, check that the installed bundle is enabled for this profile and restart the Host if the profile was changed outside the plugin manager. Do not edit generated profile `package.json` or patch files by hand.

## Tests fail only for PNG/PDF

Those tests need Chromium and Poppler. Run `npm test` and read the exact failed scenario; semantic, SVG, parser, revision, and security tests do not need a browser.
