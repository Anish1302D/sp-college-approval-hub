# Documentation

## Schema Plates

`ApprovalHub_Schema_Plates.html` — the design reference for the database. Six diagrams
(use case, approval workflow, ERD, class model, request lifecycle, escalation sequence),
the rules the schema enforces, a module-by-module file reference, and setup steps.

Open it directly in a browser. It needs an internet connection on first load to fetch
Mermaid and the IBM Plex fonts from CDN; everything else is self-contained.

## Diagram sources

`diagrams/*.mmd` are the standalone Mermaid sources, one per diagram:

| File | Diagram |
|---|---|
| `01_use_case.mmd`  | Use case — six actors, twenty use cases |
| `02_erd.mmd`       | Entity relationships — full relational model |
| `03_class.mmd`     | Class model — domain objects plus WorkflowEngine and NotificationService |
| `04_state.mmd`     | Request lifecycle — all fourteen states |
| `05_sequence.mmd`  | Escalation sequence — a ₹6,00,000 request reaching Chairman + VP |
| `06_workflow.mmd`  | Approval workflow — amount-based routing and escalation |

Render them anywhere Mermaid is supported (GitHub markdown, mermaid.live, VS Code
Mermaid extensions), or regenerate the HTML page after editing.

Both the `.mmd` sources and the copies embedded in the HTML page have been validated
against the Mermaid parser.
