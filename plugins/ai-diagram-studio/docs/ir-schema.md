# Diagram IR v1

Every diagram is stored as `diagram.ir.json`. `schema_version` is `"1.0"`.

## Top level

```json
{
  "schema_version": "1.0",
  "diagram_id": "dg-erd-library-...",
  "diagram_type": "erd",
  "title": "Library ERD",
  "description": "",
  "language": "id",
  "source": { "mode": "natural_language", "requirement": "...", "parser": "erd" },
  "notation": { "erd": "crowfoot", "uml": "uml2", "sequence": "uml2" },
  "style": { "theme": "professional", "orientation": "auto", "layout_density": "comfortable", "scale": 2 },
  "nodes": [],
  "edges": [],
  "groups": [],
  "frames": [],
  "assumptions": [],
  "constraints": { "no_additional_entities": false, "no_additional_relationships": false, "preserve": [], "notes": [] },
  "layout": {},
  "revision": 1,
  "parent_revision": null,
  "revision_changes": [],
  "created_at": "...",
  "updated_at": "..."
}
```

`diagram_type` is one of `erd`, `flowchart`, `uml_class`, `uml_usecase`, `uml_activity`, `uml_state`, `sequence`, `architecture`.

## Node

```json
{
  "id": "n-orders",
  "kind": "entity",
  "name": "orders",
  "label": "orders",
  "description": "",
  "stereotype": "",
  "technology": "",
  "attributes": [
    {
      "id": "a-orders-id",
      "name": "id",
      "type": "INTEGER",
      "primary_key": true,
      "foreign_key": false,
      "unique": false,
      "nullable": false,
      "default": null,
      "references": null,
      "notes": ""
    }
  ],
  "methods": [],
  "group_id": null,
  "boundary": false,
  "notes": "",
  "locked": false
}
```

Methods use `{id,name,returns,visibility,parameters,abstract,static}`. Group membership is also represented in `group.node_ids`.

## Edge

```json
{
  "id": "e-orders-users",
  "kind": "relationship",
  "source": "n-orders",
  "target": "n-users",
  "label": "",
  "source_cardinality": "many",
  "target_cardinality": "one",
  "source_optional": false,
  "target_optional": false,
  "source_role": "",
  "target_role": "",
  "guard": "",
  "action": "",
  "order": null,
  "text": "",
  "dashed": false,
  "notes": "",
  "locked": false
}
```

For ERD, the edge source is the FK-holding child and the target is the referenced parent. Thus `source_cardinality` is how many child rows can reference one parent (`many` for a non-unique FK), and `target_cardinality` is `one`.

## Groups and frames

`groups[] = {id,label,kind,node_ids,description}` draws architecture boundaries, a use-case system boundary, or logical clusters.

`frames[] = {id,kind,label,message_ids}` is sequence-only; kinds are `alt`, `opt`, `loop`, `par`, `break`, `critical`.

## Layout

`layout` is generated, never authored:

```json
{
  "version": 1,
  "direction": "TB",
  "density": "comfortable",
  "width": 880,
  "height": 620,
  "header": { "height": 89, "titleLines": ["..."] },
  "nodes": [{ "id": "...", "x": 0, "y": 0, "w": 190, "h": 90 }],
  "edges": [{ "id": "...", "kind": "composition", "points": [{ "x": 0, "y": 0 }], "cardinality": {} }],
  "groups": [],
  "frames": [],
  "lifelines": [],
  "activations": []
}
```

Limits: 220 nodes, 480 edges, 48 attributes per node, 40 methods per node, 40 groups. Structural violations throw `DiagramError` before rendering.

## Stable IDs

`normalizeIR` assigns deterministic IDs when a parser or structured spec omits them. Revisions use those IDs to preserve unrelated elements and report changed/added IDs. `semanticFingerprint` ignores `style` and `layout` so a bounded refinement cannot silently alter meaning.
