# AI Diagram Studio

A DeepSeek Harness (DSH) plugin that turns Indonesian or English requirements into validated **ERD**, **flowchart**, **UML class/use-case/activity/state**, **sequence**, and **software architecture** diagrams.

It does not stop at emitting diagram text. Every request runs:

**GENERATE → VALIDATE → RENDER → INSPECT → REFINE → EXPORT → VERIFY**

The canonical model is a versioned JSON IR. SVG is rendered locally, without a cloud service. PNG and vector PDF are produced with an installed Chromium, then checked before they are reported as artifacts.

## What works

| Family | Support |
| --- | --- |
| ERD | entities, attributes, types, PK/FK/UQ, composite keys, one-to-one/one-to-many/many-to-many, optional participation, associative entities, crow's-foot notation |
| Flowchart | start/end, process, input/output, decision, labelled branches, rejection, retry/loops, subprocess, notes |
| UML class | classes, abstract classes, interfaces, enums, attributes, methods, inheritance, realization, association, dependency, aggregation, composition, multiplicities |
| UML use case | actors, use cases, system boundary, association, include, extend, generalization |
| UML activity | initial/final, actions, decisions, merge, fork/join, guards |
| UML state machine | initial/final, states, choices, guarded transitions, actions |
| Sequence | actors/participants, lifelines, ordered sync/async/return/self messages, activations, alt/opt/loop/par/break/critical frames |
| Architecture | clients, frontends, gateways, APIs, services, databases, caches, queues, workers, storage, external and infra components, boundaries/groups |

Exports: **SVG**, **PNG**, and **PDF**. PDFs preserve the vector SVG through Chromium printing.

## Requirements

- Node.js **20 or newer** (tested on Node 26).
- Chromium/Chrome for PNG and PDF export. Resolution order:
  1. `DIAGRAM_CHROMIUM` / `CHROMIUM_PATH`
  2. Playwright's `chromium-*/chrome-linux64/chrome`
  3. `/usr/bin/chromium`, `/usr/bin/chromium-browser`, `/usr/bin/google-chrome`
- Optional: Poppler `pdfinfo` and `pdftoppm` for deeper PDF verification. If absent, PDF structural checks still run and the missing optional tool is disclosed.

SVG generation and all semantic validation work without Chromium. PNG/PDF requests fail with the bounded error code `renderer_unavailable` when no browser is found.

## Install in DSH

From the DSH workspace:

```text
plugin_manager action:"install_bundle" target:"/absolute/path/to/ai-diagram-studio"
```

The package carries `dsh.bundle.patch` (`cordis.patch.yml` inserts `ai-diagram-studio`). Installing copies it into the profile and activates the six host tools. A DSH restart is not normally required.

Manual fallback: add the same row to the profile composition through the normal plugin manager; do not hand-edit a running profile's generated files.

## Host tools

| Tool | Purpose |
| --- | --- |
| `generate_diagram` | Create a diagram from a requirement or `structured_specification`. Passing `existing_diagram_id` revises instead. |
| `revise_diagram` | Apply a natural-language or structured patch to a stored diagram. |
| `validate_diagram` | Re-run semantic and IR checks without rendering. |
| `export_diagram` | Re-export a stored diagram in one or more formats. |
| `list_supported_diagrams` | Types, formats, themes, renderer availability, and stored diagrams. |
| `list_diagram_revisions` | Revision history and change summaries. |

Example:

```json
{
  "requirement": "Buatkan ERD untuk sistem perpustakaan yang memiliki anggota, buku, peminjaman, pengembalian, dan denda. Tampilkan PK dan FK, lalu ekspor ke PDF.",
  "diagram_type": "auto",
  "output_formats": ["svg", "png", "pdf"],
  "theme": "professional",
  "language": "auto"
}
```

Revision:

```json
{
  "diagram_id": "dg-erd-...",
  "instruction": "Tambahkan tabel payments dan hubungkan dengan orders. Jangan ubah relasi lainnya. Ekspor PNG dan PDF."
}
```

The `revise_diagram` tool also accepts `structured_patch` operations: `add_node`, `add_edge`, `remove_node`, `rename_node`, `update_node`, `update_edge`, `set_cardinality`, `set_style`, `set_title`.

## CLI

```bash
node src/cli.js generate "Flowchart approval cuti: mulai, ajukan cuti, periksa berkas, jika lengkap setujui, jika tidak tolak, selesai" \
  --formats svg,png,pdf --theme professional --title "Approval Cuti"

node src/cli.js revise <diagram-id> "Ganti tema menjadi dark dan gunakan landscape" --formats svg,png

node src/cli.js validate <diagram-id>
node src/cli.js export <diagram-id> --formats svg,pdf
node src/cli.js list
node src/cli.js revisions <diagram-id>
```

Useful flags: `--type`, `--formats`, `--theme`, `--orientation`, `--density`, `--language`, `--scale`, `--spec`, `--store`, `--workspace`, `--json`.

## Storage

By default a workspace gets:

```text
.diagram-studio/
  registry.json
  diagrams/<diagram-id>/
    diagram.ir.json
    history/revision-000N.json
    exports/<diagram-id>-r<revision>-<stamp>-<nonce>.<ext>
```

Every artifact path is normalized and checked to stay inside the workspace. Re-export never overwrites an earlier file. The IR, not an SVG, is the source of truth for revisions.

## Status model

- `SUCCESS` — all applicable mandatory checks passed.
- `SUCCESS_WITH_WARNINGS` — blocking correctness/render/export checks passed; nonblocking assumptions, limits, or unavailable optional checks are disclosed.
- `NEEDS_CLARIFICATION` — a material ambiguity or contradiction prevents faithful generation.
- `FAILED` — a blocking semantic, rendering, security, or export check failed.

The quality report lists semantic, rendering, layout, refinement, and export checks. Visual review is **programmatic** (geometry, PNG pixels, SVG/PDF validity); the plugin never claims a human visual inspection.

## Tests and samples

```bash
npm test                 # 24 automated scenarios
npm run smoke            # one end-to-end flowchart
npm run build:samples    # regenerate outputs/samples + manifest
```

`examples/requests.json` contains eight reproducible requests covering every family. `outputs/samples/manifest.json` records the exact status, warnings, sizes, checks, and SHA-256 of each generated SVG/PNG/PDF.

## Documentation

- [Architecture](docs/architecture.md)
- [IR schema](docs/ir-schema.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Test report](docs/test-report.md)
- [Known limitations](docs/limitations.md)
- [Live DSH verification](docs/live-verification.md)
