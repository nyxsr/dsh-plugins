# Example requests

`requests.json` is the source of the reproducible sample build. Each item has an `id`, a human label, and a `request` object accepted by `generate_diagram` (or the CLI with `--spec`).

| id | Family | What it demonstrates |
| --- | --- | --- |
| `erd-library` | ERD | Indonesian natural language, entities, PK/FK, inferred cardinalities |
| `flow-approval` | Flowchart | decisions, labelled branches, rejection |
| `uml-class` | UML class | abstract class, interface, inheritance, realization, composition, multiplicities |
| `uml-usecase` | UML use case | actors, system boundary, association, include |
| `uml-activity` | UML activity | initial/final, fork/join, actions |
| `uml-state` | UML state | initial/final, guards, actions |
| `sequence-checkout` | Sequence | participants, sync/async/return, alt frame |
| `architecture-groups` | Architecture | grouped frontend/backend/data, protocols, queue→worker |

Rebuild:

```bash
node scripts/build-samples.js
```

The script writes `outputs/samples/<id>.{svg,png,pdf}` and `outputs/samples/manifest.json`. It resets the sample store first so repeated runs are reproducible. Every artifact path in the manifest was produced by the verified export pipeline.
