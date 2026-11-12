# Test execution report

Command:

```bash
cd ai-diagram-studio
node --test tests/*.test.js
```

Result on 2026-11-11 (Asia/Jakarta):

```text
tests 24
pass 24
fail 0
cancelled 0
skipped 0
duration_ms ~1560
```

## Scenario mapping

| # | Scenario | Result |
| --- | --- | --- |
| 1 | ERD from Indonesian natural language | PASS |
| 2 | ERD from strict table definitions | PASS |
| 3 | Invalid FK target detected | PASS |
| 4 | Cardinality consistency (child→parent) | PASS |
| 5 | Flowchart decisions, labels, loop | PASS |
| 6 | UML class inheritance/realization/composition | PASS |
| 7 | UML state machine pseudostates | PASS |
| 8 | Sequence alt frame + ordered messages | PASS |
| 9 | Architecture grouped components | PASS |
| 10 | Indonesian language detection | PASS |
| 11 | English language detection | PASS |
| 12 | PNG generation | PASS |
| 13 | SVG generation | PASS |
| 14 | PDF generation | PASS |
| 15 | Revision preserves unrelated elements | PASS |
| 16 | Missing Chromium is bounded | PASS |
| 17 | Malicious SVG / invalid renderer syntax | PASS |
| 18 | Large diagram remains bounded | PASS |
| 19 | Automatic refinement bounded and semantic-preserving | PASS |
| 20 | File format integrity | PASS |
| 21 | Path traversal and malicious input | PASS |
| 22 | Semantic IR preserved during refinement | PASS |
| 23 | Unavailable visual inspection disclosed | PASS |
| 24 | Recovery from bounded rendering error | PASS |

PDF verification in tests uses header/EOF/page checks and, when available, `pdfinfo`/`pdftoppm`. PNG checks use the in-house decoder (dimensions, nonblank ink, header inset). No test fabricates a human visual review.

## Sample build

```bash
node scripts/build-samples.js
```

Eight examples × SVG/PNG/PDF were generated under `outputs/samples/`. See `outputs/samples/manifest.json` for the exact status, warnings, artifact sizes, and SHA-256 values. Two examples intentionally remain `SUCCESS_WITH_WARNINGS`:

- `erd-library`: inferred synthetic column types and referenced primary keys are disclosed as assumptions; no blocking semantic error.
- `sequence-checkout`: vertical content fill is low (8%), a layout observation rather than a correctness failure.

The other six samples report `SUCCESS`.
