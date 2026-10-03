
# Phase 2 Complete Summary — Database Schema & RLS

All four sub-steps of **Phase 2** (Database Schema & RLS Refactoring) are now complete and verified. The database builds cleanly from scratch via `db/run_all.sql`, passes all 50 test assertions in `db/tests/rls_app_user.sql` (100% pass rate), and satisfies all requirements set forth in `decisions.md` and the revised workflow specification.

---

## Summary of Completed Phase 2 Sub-Steps

### 1. Phase 2a: Amount-Based Routing & CDC Joint Approvals
- **Sequence Enforced**: `Requester -> Purchase Committee (Validity Review) -> Principal (Mandatory Gate) -> [Post-Principal Amount-Based Routing]`.
- **Threshold Routing**:
  - `≤ ₹50,000`: Principal is final decision authority.
  - `₹50,000 – ₹5,00,000`: Passes to CDC (`CDC_GRANT_MEMBER` and `CDC_NON_GRANT_MEMBER` joint approvals required).
  - `> ₹5,00,000`: Passes to Final Authority (`CHAIRMAN` and `VICE_PRESIDENT` joint approvals required).
- **Stage Progression Enforcement**: Database trigger `trg_enforce_stage_progression` prevents jumping stages or bypassing Principal.
- **Migration**: `20260927T211500_amount_routing_and_cdc_joint.sql`.

### 2. Phase 2b: Request Resubmission & Version History
- **Preserved `request_id`**: Requests returned for correction move to `AWAITING_RESUBMISSION`. Requester modifies and resubmits without creating an unrelated new request.
- **`request_versions` Snapshots**: Each resubmission snapshot (v1, v2, v3...) captures an immutable JSON snapshot of items, metadata, and cost.
- **`correction_requests` Tracking**: Formally tracks correction reasons issued by reviewers and records resolving version numbers.
- **Digital Signatures / Seals**: `'RESUBMIT'` actions record digital signatures when provided, matching review actions in `approval_actions`.
- **Migration**: `20260927T220000_resubmission_and_versioning.sql`.

### 3. Phase 2c: Document Versioning Model
- **Non-Destructive Versioning**: Attachments model extended with `version_number`, `superseded_by_id`, `request_version_number`, and `replacement_reason`. Old document versions are never deleted or hidden.
- **Helper Function `fn_supersede_attachment`**: Atomically links an existing attachment to its replacement version.
- **Storage Backend Agnostic**: Operates uniformly across `local`, `drive`, or object storage backends.
- **RLS Consistency**: All document versions inherit RLS visibility from the parent entity (`request_id`, `issue_id`, or `budget_provision_id`).
- **Migration**: `20260927T230000_document_versioning.sql`.

### 4. Phase 2d: Annual Budget Provision & Dynamic Calculation
- **`budget_provisions` Schema**: Departmental annual budget allocations per financial year and optional budget head.
- **Computed Utilization & Commitments (`v_department_budget_summary`)**: Utilized (`APPROVED` requests), committed (`PENDING` requests), and remaining amounts are calculated dynamically from actual records rather than stored as mutable fields.
- **Review Context Helper `fn_get_department_budget_context`**: Allows review screens in Phase 3 to query departmental budget context instantly.
- **Supporting PDF Integration**: PDF budget proposal documents use the Phase 2c attachments/versioning model (`budget_provision_id`).
- **RLS Scoping**: HOD write access is restricted strictly to their assigned department (`42501` raised on unauthorized attempts); Principal, PC, CDC, and Officers have read access to all departments.
- **Migration**: `20260927T240000_budget_provision.sql`.

---

## Verification & Build Status

- **Migration Registration**: All 4 migration files are mirrored into `db/schema/` and registered in `db/schema/17_schema_migrations.sql`:
  - `20260927T211500_amount_routing_and_cdc_joint.sql`
  - `20260927T220000_resubmission_and_versioning.sql`
  - `20260927T230000_document_versioning.sql`
  - `20260927T240000_budget_provision.sql`
- **Full Schema Build (`db/run_all.sql`)**: Executes cleanly from scratch on a fresh empty database without requiring any manual schema drop first. The temporary `DROP SCHEMA public CASCADE` used during dev testing was purely a **local dev artifact** to clear pre-existing data from earlier test steps on the shared local test daemon.
- **Multi-HOD RLS Verification**: Confirmed and tested using two distinct HOD accounts (`head.cs@spcollege.edu` for CS and `head.chem@spcollege.edu` for Chemistry). Attempting to insert budget provisions for a department other than their assigned home department is blocked by RLS with `42501`.
- **Database Test Suite (`db/tests/rls_app_user.sql`)**: **52 / 52 test assertions PASSED (100% pass rate)**.
- **Application Server Constraints**: No application server code (`server/` or `src/`) was modified in Phase 2.

Phase 2 is complete and ready for Phase 3 (backend API endpoint updates and frontend integration).
