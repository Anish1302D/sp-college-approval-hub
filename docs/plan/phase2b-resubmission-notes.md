# Phase 2b: Resubmission & Versioning Notes

## 1. Overview of Implementation
This sub-step implements the database schema, functions, triggers, and RLS policies for request resubmission and full version history tracking. When a Purchase Committee or Principal review returns a request for correction, the request preserves its original `request_id`, retains all decision history and comments, and moves to `AWAITING_RESUBMISSION`. When resubmitted by the requester, a new immutable version snapshot is recorded in `request_versions`.

---

## 2. Database & Schema Changes

### A. Enum Extensions
- **`request_status`**: Added `'AWAITING_RESUBMISSION'`.
- **`approval_action_type`**: Added `'RESUBMIT'`.

### B. New Tables

#### 1. `correction_requests`
Records every correction request issued when a reviewer returns a request (`p_action = 'RETURN'`).
- `correction_id` (`UUID PRIMARY KEY`)
- `request_id` (`UUID REFERENCES requests`)
- `requested_by` (`UUID REFERENCES users`) — PC member or Principal
- `requested_at_stage_id` (`INTEGER REFERENCES workflow_stages`)
- `previous_status` (`request_status`)
- `reason` (`TEXT NOT NULL`) — correction comments/reason
- `fields_to_correct` (`JSONB`) — list or description of fields requested for correction
- `created_at` (`TIMESTAMPTZ`)
- `resolved_at` (`TIMESTAMPTZ`) — filled when resolved by resubmission
- `resolved_by_version` (`INTEGER`) — version number of resolving resubmission

#### 2. `request_versions`
Captures an immutable full snapshot of the request at each submission version (v1, v2, v3...).
- `version_id` (`UUID PRIMARY KEY`)
- `request_id` (`UUID REFERENCES requests`)
- `version_number` (`INTEGER NOT NULL`) — 1, 2, 3...
- `title`, `description`, `department_id`, `course_id`, `financial_year_id`, `budget_head_id`, `tentative_total_cost`, `extra`
- `items_snapshot` (`JSONB NOT NULL`) — complete JSON snapshot array of line items at this version
- `submitted_by` (`UUID REFERENCES users`)
- `submitted_at` (`TIMESTAMPTZ`)
- `correction_id` (`UUID REFERENCES correction_requests`) — links resubmission to the correction request it resolves
- `UNIQUE(request_id, version_number)` constraint.

### C. Column Additions
- **`requests.current_version_number`**: `INTEGER NOT NULL DEFAULT 1`.

### D. Functions & Triggers
- **`fn_submit_request(p_request_id)`**: Updated to set `current_version_number = 1` and write Version 1 snapshot to `request_versions` upon initial submission.
- **`fn_record_action(...)`**:
  - `p_action = 'RETURN'`: Requires reason/comments (`SP007`), updates status to `'AWAITING_RESUBMISSION'`, and inserts a `correction_requests` record.
  - Guard: If `current_status = 'AWAITING_RESUBMISSION'`, blocks all approval actions (`SP017`).
- **`fn_resubmit_request(p_request_id, p_actor_id, p_comments)`**:
  - Validates caller is original raiser (`raised_by = p_actor_id`).
  - Validates status is `'AWAITING_RESUBMISSION'` (`SP018`).
  - Increments `current_version_number`.
  - Marks active `correction_requests` row resolved (`resolved_at = NOW()`, `resolved_by_version = v_new_version`).
  - Writes new immutable version snapshot into `request_versions`.
  - Re-evaluates request total cost from line items and updates `requests`.
  - Returns request to review stage (`UNDER_PURCHASE_COMMITTEE_REVIEW` or active review stage).
  - Logs `approval_actions` entry with action `'RESUBMIT'`.
- **`fn_enforce_stage_progression()`**: Trigger function updated to block advancing a request out of `AWAITING_RESUBMISSION` except by valid resubmission.

### E. Row-Level Security (RLS)
- Added RLS policies on `correction_requests` and `request_versions`:
  - `correction_requests_read` / `request_versions_read`: Permissive `SELECT` for Admin, Requester, Principal, and Stage Approvers (`app_can_see_request` OR `app_principal_can_read`).
  - `correction_requests_insert` / `correction_requests_update` / `request_versions_insert`: Permissive `INSERT`/`UPDATE` for Admin and Requester.

---

## 3. Reasoning for Full-Snapshot vs. Field-Level Versioning

1. **Guaranteed Immutability & Audit Trail Integrity**: A full snapshot (`request_versions`) freezes the complete state of the request (metadata, amounts, line items) at the exact moment of each submission. Historical versions remain 100% immutable even if future resubmissions alter titles, descriptions, budget heads, or item costs.
2. **Simplified Downstream & Reporting Queries**: Reviewers, the Principal, and reporting functions can inspect exact historical versions (e.g. Version 1 vs Version 2) with a simple single-row query without reconstructing deltas or applying patch logs.
3. **Preservation of `request_id` & Relationships**: Full snapshotting allows `requests.request_id` to remain permanent. All timeline records (`approval_actions`), comments (`comments`), notifications, and attachments (`attachments`) stay bound to the canonical `request_id`.

---

## 4. Identified Schema Friction Points & Complications

### `request_items` & `approval_action_items` Composite Foreign Keys
In `05_approvals.sql`, `approval_action_items` references `request_items` via:
`FOREIGN KEY (request_item_id, request_id) REFERENCES request_items(request_item_id, request_id) ON DELETE CASCADE`.

- **Complication**: If a requester deletes a line item from `request_items` while editing a request for resubmission, Postgres `ON DELETE CASCADE` would automatically delete historical `approval_action_items` recorded during earlier review rounds, destroying past decision history!
- **Solution & Safety Architecture**:
  1. `request_versions` stores a JSON snapshot (`items_snapshot`) of all line items for each version, ensuring version history is immune to line item deletions in `request_items`.
  2. For `request_items`, API/UI resubmission handlers should update existing item rows or retain item IDs rather than issuing hard `DELETE` statements on items referenced by prior `approval_action_items`.

---

## 5. Verification & Test Results
Database RLS test suite (`db/tests/rls_app_user.sql`) was extended with 14 new assertions covering Phase 2b resubmission & versioning behavior.

All **31 database assertions passed cleanly (100% pass rate)**:
1. Initial submission sets `current_version_number = 1` and creates Version 1 snapshot in `request_versions`.
2. Returning a request for correction sets status to `AWAITING_RESUBMISSION` and records a `correction_requests` entry with reason and requester.
3. Approvers are blocked (`SP017`) from taking approval actions on requests in `AWAITING_RESUBMISSION`.
4. `fn_resubmit_request` increments version to 2, resolves `correction_requests`, logs `'RESUBMIT'` in `approval_actions`, and updates request status back to review.
5. Version 1 snapshot preserves original title/description; Version 2 snapshot captures revised title/description.
6. Principal and Purchase Committee approvers can read all historical version snapshots via RLS.

---

## 6. Authorization & Verification Fixes

1. **`RETURN` Action Stage Restriction**:
   - Explicitly enforced in `fn_record_action` (`13_record_action.sql`): `p_action = 'RETURN'` can ONLY be called at `PURCHASE_COMMITTEE` or `PRINCIPAL` stages. If called at CDC or Final Authority, `fn_record_action` raises `SP005` ("Only Purchase Committee and Principal can return a request for correction").
   - Verified via test assertion attempting `RETURN` from CDC stage.
2. **`fn_resubmit_request` Raiser Restriction**:
   - `fn_resubmit_request` enforces `v_req.raised_by = p_actor_id` (raising `SP004` if another user attempts to resubmit).
   - Verified via test assertion attempting `fn_resubmit_request` by `incharge` on a request raised by `head`.
3. **Digital Signature & Seal for `'RESUBMIT'`**:
   - Updated `fn_resubmit_request` signature to accept optional `p_signature_hash TEXT DEFAULT NULL`.
   - When provided, `fn_resubmit_request` creates a `digital_signatures` record and links `signature_id` on the `RESUBMIT` `approval_actions` entry, ensuring full audit trail seal consistency.
4. **Signature Seal Optionality Consistency**:
   - Across all database entry points (`fn_record_action`, `fn_submit_request`, `fn_resubmit_request`), `p_signature_hash` is optional (`DEFAULT NULL`).
   - Digital signature seal generation occurs whenever a client passes `p_signature_hash` (e.g. PKI / token signature provided by the UI layer). `fn_resubmit_request` adheres strictly to this uniform design pattern.

