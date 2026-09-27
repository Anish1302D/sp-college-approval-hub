# Phase 1: Gap Analysis & Implementation Plan

## 1. REUSE
The following existing components can be kept as-is or lightly adapted:
- **Database Schema**: Core tables including `workflow_stages`, `roles`, `users`, `requests`, `request_items`, `approval_actions`, `approval_action_items`, `digital_signatures`, and `departments` / `courses` / `budget_heads`.
- **API Endpoints**: 
  - `server/src/routes/master.js` (for fetching dropdown data)
  - `server/src/routes/auth.js` (for authentication and role resolution)
  - `server/src/routes/attachments.js` (attachment uploads, though it will need versioning support)
  - `server/src/routes/users.js` and `inventory.js`.
- **Frontend**: The generic layout, auth context, existing UI for item-level partial approvals, and reusable components like `RequestDetailModal.jsx` or similar modals.

## 2. CONFLICTS
Everywhere the current code assumes the OLD workflow must be changed:
- **Routing Rules**: `db/seed/01_roles_and_stages.sql` inserts amount-based entry points into `stage_routing_rules` (`<50k -> PC`, `50k-5L -> Principal`, `>5L -> CDC`), bypassing PC entirely for larger amounts and giving PC final approval authority for smaller ones.
- **API Endpoints**: `server/src/routes/requests.js` currently allows the Purchase Committee to use the `APPROVE` action which sets a terminal `APPROVED` status if they are the designated stage. This violates the new rule that PC is review/recommendation only.

## 3. DATABASE CHANGES
- **Workflow State Machine**: 
  - Modify `stage_routing_rules` (or how routing is computed) so that all requests route through the Purchase Committee, then to the Principal. 
  - Add constraints/triggers to ensure `current_stage` cannot jump from PC directly to CDC or Chairman without a Principal approval in the history.
- **Resubmission / Versioning**: 
  - Add a `request_versions` table (or similar mechanism) to store full snapshots of a request (fields, decisions, previous status) prior to resubmission. 
  - Add columns to track correction reason, resubmitted status, and who requested the correction.
- **Budget Provision**: 
  - Create new tables e.g. `department_budgets` (`department_id`, `academic_year`, `annual_provision`, `budget_head_id`, `document_id`) to track annual budget per department.
- **CDC Two-Approver Model**: 
  - Schema must support recording two distinct `approval_actions` rows for CDC (rather than collapsing it), depending on the resolution of Ambiguity B.
- **Document Versioning**: 
  - Modify the `attachments` (or related file) table to add a `version_number` and `superseded_by` or `request_version_id` column to support keeping prior document versions without deleting them.

## 4. API CHANGES
- **Purchase Committee**: Replace the `approve` action endpoint with `forward`, `escalate`, `partial-recommend`, and `resubmit`. Add enforcement to prevent them from setting a final `APPROVED` status.
- **Principal**: Update endpoints to include `review`, `reject`, `escalate`/`forward`, and `send-back-for-resubmission`. Ensure this is the only action that can advance a request out of PC.
- **Resubmission**: Add endpoints allowing requesters to edit permitted fields, upload revised docs, and resubmit under the same `request_id`, preserving history.
- **Documents**: Update file upload/fetch endpoints to support versioning and retrieving the complete document history for a request.
- **Budget Provision**: Add an endpoint for HODs to submit/update annual department budgets (with PDF upload) and an endpoint for Principals to review them.
- **Budget-in-review**: Add a read endpoint that computes utilized, committed, and remaining budget dynamically for a department + academic year.
- **CDC**: Endpoints reflecting the two-approver model.
- **Notifications**: Add notifications for budget provision submissions.
- **Principal Feedback**: Add an endpoint to record clarification/observation messages from the Principal to the PC.

## 5. FRONTEND CHANGES
- **Purchase Committee Portal**: Remove the "Approve" (final) action. Replace with Forward, Escalate, Partial Recommend, and Resubmit. Add the Budget Provision Context panel to the review screen.
- **Principal Portal**: Add a "Send back for resubmission" action alongside Review/Reject/Escalate. Clarify that PC "forward" is a recommendation, not a final move.
- **Resubmission Flow**: Create a new screen (Faculty/Requester portal) showing correction reasons and allowing edits to fields/documents while retaining history.
- **Documents Section**: Update the request detail view to show a version history list for documents.
- **Budget Module UI**: Create a screen for HODs to submit the annual budget and a review view for the Principal. Integrate a compact budget context panel into all request review screens.
- **CDC Portal**: Update the UI to clearly represent the two-approver model (sequential or parallel).
- **Chairman/VP Portal**: Ensure this is a read-only review view of the full case unless explicit approval buttons are confirmed.
- **Dropdowns & Courses**: Add an "Other" option to all relevant dropdowns (Budget Head, Department, Course, Urgency) with a free-text input reveal. Add a Grant/Non-Grant classification to courses.

## 6. WORKFLOW/STATE-MACHINE CHANGES
- **Current**: Requests enter the workflow based on their amount (e.g., `<50k` starts and ends at PC, `50k-5L` starts and ends at Principal, `>5L` starts at CDC).
- **Target**: `REQUESTER -> PURCHASE COMMITTEE (Review Only) -> PRINCIPAL (Mandatory Decision) -> AMOUNT-BASED ROUTING`. If `<= 50k` (or `1.5L` - see ambiguities), Principal is final. If `> 50k to <= 5L` (or `15L`), routes to CDC. If `> 5L` (or `15L`), routes to Chairman.

## 7. REPORTING CHANGES
- Implement a formal reporting module generating college-branded PDFs and DOCX files.
- Add specific endpoints for: Purchase Committee Review Report, Principal Review Report, Resubmission Report, Rejection Report, Partial Approval Report, CDC Report, Chairman Approval Report, and Complete Final Request Report.
- Reports must dynamically compute the actual workflow path taken, audit trail, resubmission history, and budget remaining from the source of truth, not static text.

## 8. SECURITY/RLS CHANGES
- Enforce that a request's `current_stage` cannot jump to CDC or Chairman without a completed Principal-stage `approval_actions` record.
- Purchase Committee role must have no UPDATE path that sets a request to a final-approved status.
- Ensure document access respects the same RLS policies as request access, especially for older versions.

## 9. TESTS
- `db/tests/rls_app_user.sql`: Needs updating to reflect the new workflow restrictions (e.g., PC not being able to final-approve).
- `server/tests/`: Update existing API tests that assume the old workflow. Add new tests for resubmission endpoints, document versioning, budget endpoints, and CDC two-approver logic.
- Add specific security tests proving that bypasses (e.g. jumping stages) are rejected at the server level.

## 10. AMBIGUITIES
1. **Ambiguity A**: Routing for requests under ₹50,000. Does it go to PC first or straight to Principal? (Proposed reading A1: Every request goes PC -> Principal. **NEEDS CONFIRMATION**)
2. **Ambiguity B**: What "CDC has two approvals" means. Sequential? Parallel? Any one? (Proposed reading B1: Sequential. **NEEDS CONFIRMATION**)
3. **Additional Ambiguity - Amount Boundaries**: The revised requirements list boundaries for final authorities. Are the boundaries ₹50,000 and ₹5,00,000, OR ₹1,50,000 and ₹15,00,000? (The document mentions 1,50,000 and 15,00,000 in one section). **NEEDS CONFIRMATION**.
4. **Additional Ambiguity - Vice Chairman Role**: What is the exact action/role required by the Vice Chairman in the workflow? **NEEDS CONFIRMATION**.

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
