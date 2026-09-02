# AI Work Log

This file records prompts received and the work completed with AI assistance.

## 2026-08-21

### Prompt

Run the project in the browser.

### Work Completed

- Started the Vite development server with `npm run dev -- --host 127.0.0.1`.
- Opened the application at `http://127.0.0.1:3000/` and verified that the page loaded.

### Prompt

Create a GitHub repository, push the project, add `requirement.md`, `readme.md`, and an AI log file, and remove the unused ZIP file.

### Work Completed

- Added `requirement.md` with functional and non-functional project requirements.
- Added `readme.md` with setup, scripts, and project structure information.
- Added this `AI_LOGS.md` file to track prompts and completed work.
- Removed the unused ZIP archive from the project.
- Added Git ignore rules for dependencies, build output, and local environment files.
- Initialized Git and prepared the project for its first commit.

### Notes

The GitHub CLI is not installed in the current environment, so the remote repository and push require an authenticated GitHub URL or GitHub CLI setup.

## 2026-09-02

### Prompt

Read both requirement documents, design the PostgreSQL database, and generate use case, UML, and class diagrams. Database should be ready to run.

### Work Completed

- Extracted and reviewed `SPCollege_ApprovalSystem_Requirements.docx` and `Procurement_Workflow_Database_Documentation_2.docx`.
- Designed and wrote the PostgreSQL schema under `db/schema/` — 24 tables, 5 views, 3 functions across 13 numbered files.
- Added seed data under `db/seed/` for roles, workflow stages, amount-based routing rules, and sample master data.
- Added `db/docker-compose.yml` and `db/docker/init.sh` so the schema can also run in Docker (Postgres on 5433, pgAdmin on 5050) alongside a local install on 5432.
- Verified the full schema loads without error against PostgreSQL 16 in Docker, and smoke-tested the routing function, the quantity constraint, the submit function, and the dashboard views.
- Wrote six Mermaid diagrams to `docs/diagrams/` — use case, ERD, class, state, sequence, and approval workflow — and validated all of them parse.
- Published a diagram reference page as an Artifact.

### Design Decisions

- Academic year was dropped from the model at the user's instruction; requests are scoped to financial year only, and carry-forward moves a request between financial years.
- `budget_heads.head_type` (`REVENUE` / `CAPITAL`) added per Madhuri Mam, kept separate from the finer `budget_items.item_type`.
- `request_items.requested_quantity > 0` enforced as a database CHECK constraint per Madhuri Mam.
