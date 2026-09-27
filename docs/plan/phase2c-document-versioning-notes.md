# Phase 2c: Document Versioning Notes

## 1. Overview of Implementation
This sub-step implements document versioning schema changes on the `attachments` model. Documents attached to financial requests (or non-financial issues) can now be superseded by newer versions without deleting historical files. Each document version tracks its version number, superseded pointer, parent request version number, and optional replacement reason.

---

## 2. Database & Schema Changes

### A. Column Additions on `attachments`
- **`version_number`**: `INTEGER NOT NULL DEFAULT 1` — Tracks document version (1, 2, 3...).
- **`superseded_by_id`**: `UUID REFERENCES attachments(attachment_id) ON DELETE SET NULL` — Pointer to the newer attachment record that replaced this file (NULL for active/latest version).
- **`request_version_number`**: `INTEGER DEFAULT 1` — Associates the attachment with the specific `request_versions` iteration (from Phase 2b resubmission schema).
- **`replacement_reason`**: `TEXT` — Optional text description/reason provided when uploading a replacement version.

### B. Indexes
- **`attachments_superseded_idx`**: Index on `attachments(superseded_by_id)` to optimize queries filtering active vs. superseded documents.

### C. Helper Function
- **`fn_supersede_attachment(p_old_attachment_id, p_file_name, p_mime_type, p_size_bytes, p_storage_path, p_storage_backend, p_uploaded_by, p_replacement_reason)`**:
  - Atomically fetches and locks `p_old_attachment_id`.
  - Determines current `request_version_number` from `requests`.
  - Inserts a new row into `attachments` with `version_number = old.version_number + 1`, `request_version_number`, and `replacement_reason`.
  - Updates `old.superseded_by_id = new_attachment_id`.
  - Returns the new `attachment_id`.

---

## 3. Key Model Design Decisions & Storage Backend Alignment

1. **Non-Destructive File Versioning**: Old document records in `attachments` are never deleted or overwritten when replaced. They remain fully queryable in the DB.
2. **Association with `request_versions`**: Documents uploaded during initial submission carry `request_version_number = 1`. When a request is sent back for resubmission and resubmitted as version 2, new or replacement documents take `request_version_number = 2`, associating them with the resubmission iteration while prior documents preserve `request_version_number = 1`.
3. **Storage Backend Agnosticism**: Document versioning operates identically regardless of whether files are stored locally, on MinIO, or on Google Drive. The `storage_backend` column (`local` vs `drive`) is preserved per attachment row, allowing version 1 to live on local storage and version 2 to live on Drive (or vice-versa).

---

## 4. Row-Level Security (RLS) Alignment
Document versioning inherits RLS rules directly from parent entities (`requests` and `issues`):
- `attachments_read` policy evaluates `app_can_see_request(request_id) OR app_principal_can_read(request_id)`.
- Consequently, all versions of a document (v1, v2, active, or superseded) inherit identical RLS visibility. Roles permitted to view a request (Requester, PC, Principal, CDC, Chairman/VC, Admin) can view full document version history, while unauthorized roles see zero records.

---

## 5. Identified Friction Points & Complications

### `action_id` Foreign Key Constraints
Attachments uploaded during approval actions (e.g. PC review notes) link to `approval_actions(action_id)` via `ON DELETE SET NULL`.

- **Complication**: Superseding a document creates a new `attachments` record.
- **Resolution**: The historical attachment row retains its original `action_id` link to the decision action where it was first introduced, while the new superseded version links to the current resubmission/action context.

---

## 6. Verification & Test Results
Database RLS test suite (`db/tests/rls_app_user.sql`) was extended with tests for both Phase 2b verification items and Phase 2c document versioning.

All **42 database assertions passed cleanly (100% pass rate)**:
1. **Unauthorized RETURN Blocked**: Attempting `RETURN` action from CDC stage or non-approver role is rejected (`SP005`).
2. **Unauthorized Resubmission Blocked**: Attempting `fn_resubmit_request` on another user's request is rejected (`SP004`).
3. **RESUBMIT Digital Signature / Seal**: Calling `fn_resubmit_request` with a digital signature hash logs a `digital_signatures` record and links `signature_id` on `approval_actions`.
4. **Non-Destructive Versioning**: Uploading a replacement attachment via `fn_supersede_attachment` increments `version_number` to 2, sets `superseded_by_id`, and retains the original v1 record.
5. **Cross-Storage Backend Linking (local <-> drive)**: Verified that `fn_supersede_attachment` links a local attachment (`storage_backend = 'local'`) to a Drive attachment (`storage_backend = 'drive'`), and subsequently links a Drive attachment to a local attachment, maintaining complete DB-level superseding chain without backend dependence.
6. **Full RLS Queryability**: All v1, v2, and v3 attachments remain fully queryable by Principal and PC under RLS policies, while unrelated users see 0 document versions.
7. **Resubmission Iteration Binding**: Document uploaded during resubmission carries `request_version_number = 2` while original document retains `request_version_number = 1`.
