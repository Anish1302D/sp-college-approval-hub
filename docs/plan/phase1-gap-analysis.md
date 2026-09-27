# Phase 1: Gap Analysis & Implementation Plan

## 1. REUSE
The following existing components can be kept as-is or lightly adapted:
- **Database Schema**: Core tables including `workflow_stages`, `roles`, `users`, `requests`, `request_items`, `approval_actions`, `approval_action_items`, `digital_signatures`, and `departments` / `courses` / `budget_heads`.
- **Existing Role Codes**: Reuse `CDC_GRANT_MEMBER` and `CDC_NON_GRANT_MEMBER` from `db/seed/01_roles_and_stages.sql` for the two distinct CDC roles.
- **API Endpoints**: 
  - `server/src/routes/master.js` (for fetching dropdown data)
  - `server/src/routes/auth.js` (for authentication and role resolution)
  - `server/src/routes/attachments.js` (attachment uploads, with versioning support added)
  - `server/src/routes/users.js` and `inventory.js`.
- **Frontend**: Generic layout, auth context, existing UI for item-level partial approvals, and reusable components like `RequestDetailModal.jsx`.

## 2. CONFLICTS
Everywhere the current code assumes the OLD workflow must be changed:
- **Routing Rules**: `db/seed/01_roles_and_stages.sql` inserts amount-based entry points into `stage_routing_rules` (`<50k -> PC`, `50k-5L -> Principal`, `>5L -> CDC`), bypassing PC entirely for larger amounts and giving PC final approval authority for smaller ones. This conflicts with the updated workflow where PC is a validity check for ALL requests, Principal is the mandatory gate, and post-Principal routing uses ₹50k and ₹5L thresholds.
- **API Endpoints**: `server/src/routes/requests.js` currently allows the Purchase Committee to use the `APPROVE` action which sets a terminal `APPROVED` status if they are the designated stage. This violates the rule that PC is validity/completeness review only.

## 3. DATABASE CHANGES
- **Workflow State Machine**: 
  - Modify `stage_routing_rules` so all requests enter at Purchase Committee for validity review, move to Principal as a mandatory gate, and then route based on amount:
    - `₹0 – ₹50,000`: Principal decides directly (terminal stage).
    - `₹50,000 – ₹5,00,000`: Routes to CDC (decided by `CDC_GRANT_MEMBER` + `CDC_NON_GRANT_MEMBER`).
    - `> ₹5,00,000`: Routes to Chairman + Vice Chairman (decided jointly).
  - Add constraints/triggers to ensure `current_stage` cannot jump to CDC or Chairman+VC without a Principal review in the history.
- **Resubmission / Versioning**: 
  - Add a `request_versions` table (or similar mechanism) to store full snapshots of a request (fields, decisions, previous status) prior to resubmission.
  - Add columns to track correction reason, resubmitted status, and who requested the correction (PC, Principal, etc.).
- **Budget Provision**: 
  - Create new tables e.g. `department_budgets` (`department_id`, `academic_year`, `annual_provision`, `budget_head_id`, `document_id`) to track annual budget per department.
- **CDC Two-Approver Model**: 
  - Schema must support recording two distinct `approval_actions` rows for `CDC_GRANT_MEMBER` and `CDC_NON_GRANT_MEMBER` acting independently in either order. Flag generic `CDC_MEMBER` role code as legacy/unused for confirmation before removal.
- **Chairman + Vice Chairman Joint Decision**:
  - Schema must support joint decision-making where both Chairman and Vice Chairman act as active decision-makers for requests `> ₹5,00,000` (default assumption: per-user both-required approval pattern, same as CDC).
- **Document Versioning**: 
  - Modify `attachments` table to add `version_number` and `superseded_by` or `request_version_id` to support retaining document history without deletion.

## 4. API CHANGES
- **Purchase Committee**: Replace the `approve` action endpoint with `pass-to-principal` (validity confirmed) and `send-back-for-resubmission` (if documents/quotation are insufficient). Enforce that PC cannot set a final `APPROVED` status.
- **Principal**: 
  - For `₹0 – ₹50,000`: Full decision authority (`approve`, `reject`, `send-back-for-resubmission`).
  - For `₹50,00,000`: Review and forward to CDC (`forward-to-cdc`, `reject`, `send-back-for-resubmission`).
  - For `> ₹5,00,000`: Review and forward to Chairman + Vice Chairman (`forward-to-board`, `reject`, `send-back-for-resubmission`).
- **Resubmission**: Add endpoints allowing requesters to edit permitted fields, upload revised docs, and resubmit under the same `request_id`, preserving history.
- **Documents**: Update file upload/fetch endpoints to support versioning and retrieving document history for a request.
- **Budget Provision**: Endpoints for HODs to submit/update annual department budgets (with PDF upload) and for Principals to review them.
- **Budget-in-review**: Read endpoint that computes utilized, committed, and remaining budget dynamically for a department + academic year.
- **CDC Endpoints**: Endpoints allowing `CDC_GRANT_MEMBER` and `CDC_NON_GRANT_MEMBER` to independently record approval in either order.
- **Chairman / Vice Chairman Endpoints**: Endpoints supporting joint decision recording for requests `> ₹5,00,000`.
- **Notifications**: Add notifications for budget provision submissions and stage movements.

## 5. FRONTEND CHANGES
- **Purchase Committee Portal**: Remove "Approve" (final) button. Replace with "Pass to Principal" (valid) and "Send Back for Resubmission" (insufficient/incomplete). Integrate Budget Provision Context panel.
- **Principal Portal**: 
  - Display "Approve / Reject" decision controls for requests `≤ ₹50,000`.
  - Display "Forward to CDC" controls for `₹50k – ₹5L`.
  - Display "Forward to Chairman & Vice Chairman" controls for `> ₹5L`.
  - Display "Send Back for Resubmission" across all bands.
- **Resubmission Flow**: Faculty/Requester portal screen displaying correction reasons and enabling document/field edits while preserving history.
- **Documents Section**: Request detail view with document version history timeline.
- **Budget Module UI**: Screen for HODs to submit annual budget and review view for Principal; integrate compact budget context panel on all request review screens.
- **CDC Portal**: UI showing dual approval status for `CDC_GRANT_MEMBER` and `CDC_NON_GRANT_MEMBER` (indicating either can approve in any order, and both are required).
- **Chairman & Vice Chairman Portal**: Joint decision screen for both active decision-makers for requests `> ₹5,00,000`.
- **Dropdowns & Courses**: Add "Other" option to dropdowns with free-text reveal. Add Grant / Non-Grant classification to courses.

## 6. WORKFLOW/STATE-MACHINE CHANGES
- **Current (Legacy)**: Requests enter based on amount (`<50k -> PC`, `50k-5L -> Principal`, `>5L -> CDC`).
- **Target Workflow State Machine** (matching `decisions.md`):
  - **Stage 1 — Purchase Committee (Validity Review Only)**: Reviews every request regardless of amount to confirm required documents (e.g., quotation) are present and properly filled out. Does NOT approve or decide requests. If invalid/insufficient, sends back for resubmission. Once valid, passes to Principal.
  - **Stage 2 — Principal (Mandatory Gate)**: ALWAYS sees every request, regardless of amount (never skipped).
    - **Band 1 (`₹0 – ₹50,000`)**: Principal is the FINAL decision authority (`APPROVED` / `REJECTED`).
    - **Band 2 (`₹50,000 – ₹5,00,000`)**: Decision authority belongs to CDC. Principal reviews and passes the request to CDC.
    - **Band 3 (`> ₹5,00,000`)**: Decision authority belongs to Chairman + Vice Chairman jointly. Principal reviews and passes the request to Chairman + VC.
  - **Stage 3 — CDC Stage (`₹50,000 – ₹5,00,000`)**: Decided by two distinct roles: `CDC_GRANT_MEMBER` and `CDC_NON_GRANT_MEMBER`. BOTH approvals are required before the request advances. Both roles act independently in either order ("done together", non-sequential).
  - **Stage 4 — Chairman + Vice Chairman Joint Stage (`> ₹5,00,000`)**: Decided JOINTLY by the Chairman and Vice Chairman ("together", both active decision-makers; default assumption: both-required pattern).
  - **Sequence Flow**:
    `Requester -> Purchase Committee (Validity Review Only) -> Principal (Mandatory Gate) -> [≤ ₹50k: Principal Final Decision | ₹50k–₹5L: CDC (CDC Grant + CDC Non-Grant in either order) | > ₹5L: Chairman + Vice Chairman Joint Decision]`

## 7. REPORTING CHANGES
- Formal reporting module generating college-branded PDFs and DOCX files.
- Endpoints for: Purchase Committee Review Report, Principal Review Report, Resubmission Report, Rejection Report, Partial Approval Report, CDC Report, Chairman/VC Joint Approval Report, and Complete Final Request Report.
- Reports dynamically compute workflow path taken, audit trail, resubmission history, CDC dual sign-offs, and budget remaining from source of truth.

## 8. SECURITY/RLS CHANGES
- Enforce stage flow integrity: RLS policies and triggers prevent jumping to CDC or Chairman+VC without a completed Principal stage record.
- Purchase Committee role has no UPDATE path that sets a request to terminal `APPROVED` status.
- Ensure document access respects RLS policies across all document versions.

## 9. TESTS
- `db/tests/rls_app_user.sql`: Update to verify PC cannot final-approve, Principal is mandatory gate, and post-Principal RLS rules for CDC dual roles (`CDC_GRANT_MEMBER` & `CDC_NON_GRANT_MEMBER`) and Chairman + Vice Chairman joint stage.
- `server/tests/`: Add/update unit and integration tests covering:
  - PC validity pass-through and resubmission triggers.
  - Mandatory Principal gate across all amount bands (`₹0-50k`, `₹50k-5L`, `>5L`).
  - CDC dual-role independent approvals in either order.
  - Chairman + Vice Chairman joint decision execution.
  - Resubmission flow, document versioning, and budget provision endpoints.

## 10. AMBIGUITIES & CONFIRMATIONS

### Resolved Decisions (per `decisions.md`):
1. **Amount-based Routing & Authoritative Thresholds**: **RESOLVED**. Authoritative thresholds are **₹50,000** and **₹5,00,000** (₹1.5L / ₹15L figures are disregarded documentation errors). PC performs validity review for ALL requests; Principal is mandatory gate for ALL requests; Principal decides `≤ ₹50k`, CDC decides `₹50k – ₹5L`, Chairman + VC decide `> ₹5L`.
2. **CDC Two-Approver Model**: **RESOLVED**. CDC consists of two distinct roles: `CDC_GRANT_MEMBER` and `CDC_NON_GRANT_MEMBER` (reusing existing seed role codes). BOTH approvals are required, with NO required order between them (can act independently in either order).
3. **Vice Chairman Role**: **RESOLVED**. For requests `> ₹5,00,000`, the Chairman and Vice Chairman decide **JOINTLY** ("together", both active decision-makers).

### Minor Implementation Details to Confirm during Phase 2/3:
1. **Single-Rejection Handling at Dual/Joint Stages**: Whether a single rejection by one CDC member (or Chairman/VC) terminates the request outright or sends it back for resubmission.
2. **Generic `CDC_MEMBER` Role Code**: Flagged as legacy/unused in seed data; confirm before removing.
3. **Chairman + VC Joint Approval Recording**: Confirm whether joint decision uses per-user independent approval action rows (same both-required pattern as CDC) or a single combined decision record (default assumption: per-user both-required pattern).

---

## Implementation Plan

- **Phase 2: Database Schema & Migrations**
  - Files touched: `db/migrations/*.sql`, `docs/plan/phase2-schema-notes.md`
- **Phase 3: Backend / API Changes**
  - Files touched: `server/src/routes/requests.js`, `server/src/routes/budget.js` (new), `server/src/routes/attachments.js`, `server/tests/*`, `docs/plan/phase3-api-notes.md`, `docs/plan/phase3-security-review.md`
- **Phase 4: Frontend / Dashboard Changes**
  - Files touched: `src/pages/*`, `src/components/*`, `docs/plan/phase4-frontend-notes.md`, `docs/plan/phase4-mechanical-notes.md`
- **Phase 5: Reporting Module (PDF / DOCX)**
  - Files touched: `server/src/routes/reports.js`, `server/src/services/reporting/*`, `docs/plan/phase5-reporting-notes.md`, `docs/plan/phase5-verification-notes.md`
- **Phase 6: Security Hardening & Full Regression**
  - Files touched: `server/tests/security/*`, `db/tests/rls_app_user.sql`, `docs/plan/phase6-security-report.md`
- **Phase 7: Documentation & Wrap-up**
  - Files touched: `requirement.md`, `readme.md`, `AI_LOGS.md`
