# Known limitations and unverified assumptions

- **Native SVG is the only active renderer.** Graphviz, Mermaid CLI, and PlantUML are discovered when installed but are not used for production output. Their absence is not a failure.
- **Chromium requirement.** PNG and vector PDF need a local Chromium. The plugin does not download one and does not use a cloud rendering API.
- **Programmatic visual QA, not human vision.** The plugin measures geometry, PNG ink/margins, SVG markup, and PDF pages. It does not claim aesthetic review by a person.
- **Natural-language parsing is heuristic.** It covers common Indonesian/English phrasings and explicit structured specifications. Unusual prose may produce `NEEDS_CLARIFICATION` rather than a guessed model.
- **No OCR and no image-to-diagram.** Inputs are text or structured JSON.
- **ERD notation is crow's-foot, not Chen.** Conceptual Chen notation is not implemented; logical/physical entity notation is.
- **PDF strategy is one page per diagram.** Oversized diagrams expand the page instead of paginating into multiple pages. Hierarchical/grouped views are preferred; multipage splitting is not implemented.
- **Dark theme** is validated for contrast, but PDF printing uses the same dark background as the screen. Check printer/paper expectations before embedding in light documents.
- **Sequence frames are flat.** Nested frames are parsed into a flat list with message ranges; nested `par`/`alt` combinations are not visually nested.
- **UML coverage is pragmatic, not a full metamodel.** Class, use-case, activity, and state constructs listed in the README are supported; advanced UML elements (profiles, timing, interaction overview, component internal ports) are not.
- **Layout optimizer is bounded and deterministic.** It tries spacing/orientation, not arbitrary graph rearrangement. Some dense fan-in/out edges carry a disclosed warning.
- **Large diagrams scale the canvas.** Readability is preferred over forcing standard paper dimensions.
- **No external SVG references or scripts are accepted.** Inline styles and the generated marker defs are used; arbitrary user SVG is not rendered.
- **DSH live integration is profile-specific.** The bundle was installed and exercised in the `web` DSH profile in this workspace; another profile needs its own install. Reloading the Host after source edits requires toggling the plugin row or restarting DSH.
