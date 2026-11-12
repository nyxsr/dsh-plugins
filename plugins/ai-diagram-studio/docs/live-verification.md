# Live DSH verification

Date: 2026-11-11 (Asia/Jakarta)
Workspace: `/home/nyxsr/Documents/deepseek-harness/default-workspace`
Profile: `web` (`http://127.0.0.1:3080`)

## Install

Command:

```text
plugin_manager action="install_bundle" target="/home/nyxsr/Documents/deepseek-harness/default-workspace/ai-diagram-studio"
```

Observed result:

```json
{
  "stage": "enable",
  "target": "@local/ai-diagram-studio",
  "enabled": true,
  "changed": true,
  "application": "applied",
  "version": "1.0.0",
  "warnings": []
}
```

The profile row is `include:ai-diagram-studio` (`@local/ai-diagram-studio`), active. After the final source edits the row was toggled off/on through `plugin_manager` so the running Host loaded the current ESM source rather than the earlier module instance.

## Tools exercised in the live Host

| Tool | Call | Result |
| --- | --- | --- |
| `list_supported_diagrams` | no arguments | `SUCCESS`; 8 types, native-svg plus discovered unavailable engines, 1 stored diagram |
| `generate_diagram` | library ERD, SVG+PNG+PDF, `id` | `SUCCESS_WITH_WARNINGS`, 3/3 artifacts `VERIFIED` |
| `revise_diagram` | dark theme + landscape, SVG+PNG | `SUCCESS_WITH_WARNINGS`, revision 1→2, style-only changes |
| `validate_diagram` | stored diagram | `SUCCESS_WITH_WARNINGS`, semantic PASSED, rendering/export NOT_RUN (as designed) |
| `export_diagram` | stored diagram, SVG+PNG+PDF, scale 1 | `SUCCESS_WITH_WARNINGS`, 3/3 artifacts `VERIFIED` |
| `export_diagram` | stored diagram, PNG+PDF, scale 2 | `SUCCESS_WITH_WARNINGS`, 2/2 artifacts `VERIFIED` |
| `list_diagram_revisions` | stored diagram | `SUCCESS`, r1 + r2 current, style change summaries |

Live diagram:

```text
diagram_id: dg-erd-perpustakaan-live-20261111101647-cf2c2c
title:      Perpustakaan Live
type:       erd
revision:   2
renderer:   native-svg
validation: semantic=PASSED rendering=PASSED visual=PASSED export=PASSED
```

Final scale-2 artifacts:

```text
.diagram-studio/diagrams/dg-erd-perpustakaan-live-20261111101647-cf2c2c/exports/
  dg-erd-perpustakaan-live-...-r2-20261111102045-f71a03.png   1668x866, 80107 bytes
  dg-erd-perpustakaan-live-...-r2-20261111102045-f71a03.pdf   1 page, 37974 bytes
```

Independent check:

```text
pdfinfo: Pages 1; Page size 625.92 x 324.96 pts; Encrypted no; PDF 1.4
file:    PNG image data, 1668 x 866, 8-bit/color RGB, non-interlaced
file:    PDF document, version 1.4, 1 page(s)
```

The PNG was also opened and inspected: dark theme, all 5 entities and 4 relationships visible, PK/FK badges readable, revision 2 in both header and footer. The 13 warnings are nonblocking: inferred synthetic data types and inferred referenced primary-key columns are disclosed in the quality report and assumptions.

## Limits of this evidence

- "Visual" validation is programmatic geometry plus PNG pixel metrics and a final manual screenshot review by the implementing agent. The product does not claim a human visual review at runtime.
- Graphviz/Mermaid/PlantUML were absent and are reported as unavailable; native SVG is the selected renderer for all types.
- PNG/PDF verification depends on Chromium and optional Poppler; both were present for this run.
