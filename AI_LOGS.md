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

### Prompt

Add error codes, fix the issues you raised, and commit as sole author.

### Work Completed

- Added SQLSTATE codes `SP001`–`SP012` to every refusal raised by the workflow
  functions, so the API can map failures to HTTP status codes without matching
  on English message text. Applied both as a migration and in the schema files.
- Fixed a defect found while testing: `approval_action_items` allowed a decision
  recorded against one request to point at a line item belonging to another.
  Composite foreign keys now force the two to agree.
- Added `db/migrations/` with the rule that schema files are edited freely until
  the first real deployment, and every change after that is a migration.

### Notes

- Class `SP` was chosen after an earlier draft proposed `AP`: the SQL standard
  reserves classes beginning `A`–`H`, leaving `I`–`Z` for applications.
- Ten of the twelve codes are covered by tests. `SP009` and `SP012` guard
  against workflow misconfiguration and cannot occur in normal operation.

## 2026-09-11

### Prompt

Do the backend.

### Work Completed

- Built the REST API under `server/` — Node, Express 5, the `pg` driver, no ORM.
  44 endpoints covering requests and line items, submission and decisions,
  timeline, carry-forward, comments, attachments, non-financial issues,
  inventory, purchase bills, dashboards, CSV export, notifications and audit.
- Wrote 73 tests that drive the real API over HTTP as the seeded users, against
  a database rebuilt from `db/schema` and `db/seed` before each test file.
- **Fixed six Row-Level Security defects in the database.** All earlier testing
  had run as `postgres`, which bypasses those rules entirely, so none of them
  were visible until the workflow was run as the role the API actually uses:
  1. Views leaked every row — a view reads with its owner's privileges, and the
     owner is the superuser. A Head could see another user's private draft.
  2. `fn_record_action` checked the actor *parameter* rather than the signed-in
     session, so a requester could pass an approver's id and approve their own
     request.
  3. Escalation always failed, so nothing could reach the Chairman: the approver
     policy had no `WITH CHECK`, and Postgres reused `USING` for the new row.
  4. No notification could ever be created, since the rules let a user insert
     only their own.
  5. The Principal could see faculty issues but never review or resolve them.
  6. The Principal could not see requests of ₹5 lakh or more, which skip the
     Principal stage entirely.
- Added `db/tests/rls_app_user.sql`: 45 checks that run as `app_user` and assert
  what each role can and cannot do. It rolls back, so it is safe to run anywhere.
- Read `Email_Workflow_Master_Document_College_Procurement_Approval.docx` and
  wrote `docs/ApprovalHub_Mail_Plan.html`, mapping all 29 email templates onto
  the system as built.

### Design Decisions

- **No ORM.** The workflow rules live in the database, and an ORM cannot model
  the decision function, the triggers, the security policies or the views — it
  would be bypassed for everything that matters, while its migrations fought the
  hand-written schema.
- **The API refuses to start** unless its database role is subject to Row-Level
  Security, so it can never be deployed in a way that silently enforces nothing.
- **No money arithmetic in JavaScript.** Line and request totals are computed in
  SQL, where `NUMERIC` is exact.
- **Requests the caller may not see answer 404, not 403** — a 403 would confirm
  the record exists.
- Approval seals are an HMAC over each decision's exact content. They detect a
  decision being edited directly in the database. They are **not** legal digital
  signatures: the key belongs to the server, not the approver.

### Notes

Where the email specification and the built system disagree — stage approvals
being final rather than forwarded, requests that skip the Purchase Committee,
academic year, duplicate escalation emails, and the Head of Department copy the
data model cannot resolve — the differences are listed in §3 of the mail plan
rather than resolved silently.

## 2026-09-12

### Prompt

Connect the frontend, update the docs, and generate a PR summary.

### Work Completed

- Replaced the mock data throughout the interface with the API. Deleted
  `src/data/`, the role switcher, and the screens the API cannot serve.
- Added real sign-in. What each person sees now follows their roles and the
  approval stages they staff, so the Purchase Committee — who previously had no
  screens at all — gets a review queue.
- Built the two screens that needed designing rather than rewiring: the request
  form, where a request is assembled line by line with a live total and a
  preview of which stage it will reach; and the approval panel, where an
  approver sets an approved quantity per line and sees the sanctioned total
  before confirming.
- Replaced invented figures with real ones: reports now chart spending by budget
  head and compute the approval rate from actual decisions rather than a
  hard-coded percentage; exports download real CSV files; the settings page
  shows the approval route as configured instead of fields that saved nothing.
- Moved navigation into the address bar as hash routes, so a request can be
  linked to, bookmarked and reopened after a refresh — needed by the planned
  notification emails, and requiring no rewrite rules on IIS.
- Added `/api/users` (to assign an issue to someone) and
  `/api/reports/by-budget-head`; replaced a dashboard count that read a status
  the workflow never sets.
- Added `fn_inr` so amounts read as ₹6,50,000.50 rather than 650000.50, and used
  it in notification text. The email templates will need the same function.
- Fixed issue history events written in one transaction tying on timestamp and
  sorting randomly; they now use `clock_timestamp()`.

### Notes

- Verified in a browser as each role: a two-item request raised and submitted,
  escalated by CDC, partially approved by the Chairman at ₹3,00,000 of
  ₹6,50,000, with a restricted CDC comment the requester cannot see and both
  decisions reported as sealed; an issue raised, assigned and moved to review.
- The login page lists development accounts for convenience. That list and the
  seed password are compiled out of production builds — verified by searching
  the built bundle.
- Not built: email delivery, returning a request for correction, the fulfilment
  and closing steps, and deployment.
