# Phase 2d: Budget Provision Notes

## 1. Overview of Implementation
This sub-step implements the annual departmental budget provision schema, reporting views, PDF document attachment integration, and RLS policies. It allows Heads of Department (HODs) to submit and update annual budget allocations for their respective departments at the beginning of an academic / financial year, attach supporting PDF documentation, and allow reviewers (Principal, Purchase Committee, CDC, Chairman/VC) to view real-time computed budget utilization and remaining balances during request reviews.

---

## 2. Database & Schema Changes

### A. Column Additions & FK Wiring
- **`users.department_id`**: Added `department_id INTEGER REFERENCES departments(department_id)` to associate HODs and users with their home departments.
- **`attachments.budget_provision_id`**: Added `budget_provision_id UUID REFERENCES budget_provisions(budget_provision_id) ON DELETE CASCADE` to allow uploading and versioning supporting PDF documents tied directly to budget provisions.

### B. New Table: `budget_provisions`
Tracks annual budget allocations per department, financial year, and optional budget head.
- `budget_provision_id` (`UUID PRIMARY KEY DEFAULT gen_random_uuid()`)
- `department_id` (`INTEGER NOT NULL REFERENCES departments(department_id) ON DELETE RESTRICT`)
- `financial_year_id` (`INTEGER NOT NULL REFERENCES financial_years(financial_year_id) ON DELETE RESTRICT`)
- `budget_head_id` (`INTEGER REFERENCES budget_heads(budget_head_id) ON DELETE RESTRICT`) — NULL for department-wide overall provision, or specific budget head
- `allocated_amount` (`NUMERIC(14,2) NOT NULL CHECK (allocated_amount >= 0)`)
- `remarks` (`TEXT`)
- `created_by` (`UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT`)
- `created_at` (`TIMESTAMPTZ NOT NULL DEFAULT NOW()`)
- `updated_at` (`TIMESTAMPTZ NOT NULL DEFAULT NOW()`)
- **Uniqueness Constraint**: Unique index `budget_provisions_dept_fy_head_uq` on `(department_id, financial_year_id, COALESCE(budget_head_id, -1))` preventing duplicate allocations for the same department/FY/head tuple.

### C. Computed Reporting View: `v_department_budget_summary`
Per section 12 of requirements, budget utilization figures are **dynamically computed** from actual request and approval records rather than stored as mutable/editable totals.
```sql
CREATE OR REPLACE VIEW v_department_budget_summary
    WITH (security_invoker = true) AS
SELECT
    bp.budget_provision_id,
    bp.department_id,
    d.code AS department_code,
    d.name AS department_name,
    bp.financial_year_id,
    fy.label AS financial_year,
    bp.budget_head_id,
    bh.code AS budget_head_code,
    bh.name AS budget_head_name,
    bp.allocated_amount,
    COALESCE(req_stats.utilized_amount, 0)   AS utilized_amount,
    COALESCE(req_stats.committed_amount, 0)  AS committed_amount,
    (bp.allocated_amount - (COALESCE(req_stats.utilized_amount, 0) + COALESCE(req_stats.committed_amount, 0))) AS remaining_amount,
    (bp.allocated_amount - COALESCE(req_stats.utilized_amount, 0)) AS available_amount,
    bp.remarks,
    bp.created_by,
    bp.created_at,
    bp.updated_at
FROM budget_provisions bp
JOIN departments d ON d.department_id = bp.department_id
JOIN financial_years fy ON fy.financial_year_id = bp.financial_year_id
LEFT JOIN budget_heads bh ON bh.budget_head_id = bp.budget_head_id
LEFT JOIN LATERAL (
    SELECT
        SUM(CASE WHEN r.current_status IN ('APPROVED', 'PARTIALLY_APPROVED', 'FULFILMENT_PENDING', 'FULFILLED')
                 THEN COALESCE(r.sanctioned_amount, r.tentative_total_cost) ELSE 0 END) AS utilized_amount,
        SUM(CASE WHEN r.current_status IN ('SUBMITTED', 'UNDER_PURCHASE_COMMITTEE_REVIEW', 'UNDER_PRINCIPAL_REVIEW', 'UNDER_CDC_REVIEW', 'UNDER_FINAL_AUTHORITY_REVIEW', 'AWAITING_RESUBMISSION')
                 THEN r.tentative_total_cost ELSE 0 END) AS committed_amount
    FROM requests r
    WHERE r.department_id = bp.department_id
      AND r.financial_year_id = bp.financial_year_id
      AND (bp.budget_head_id IS NULL OR r.budget_head_id = bp.budget_head_id)
) req_stats ON true;
```

### D. Request Review Context Helper: `fn_get_department_budget_context`
Provides a simple function interface for the backend/API to query budget status when displaying a request review screen in Phase 3:
```sql
CREATE OR REPLACE FUNCTION fn_get_department_budget_context(
    p_department_id     INTEGER,
    p_financial_year_id INTEGER,
    p_budget_head_id    INTEGER DEFAULT NULL
) RETURNS TABLE (
    budget_provision_id UUID,
    allocated_amount    NUMERIC(14,2),
    utilized_amount     NUMERIC(14,2),
    committed_amount    NUMERIC(14,2),
    remaining_amount    NUMERIC(14,2),
    available_amount    NUMERIC(14,2)
) ...
```

---

## 3. Row-Level Security (RLS) Model

1. **Write Access (`budget_provisions_write`)**:
   - `ADMIN` role can write/update budget provisions for any department.
   - `HEAD` (HOD) role can write/update budget provisions **ONLY for their assigned department** (`department_id = (SELECT department_id FROM users WHERE user_id = app_current_user_id())`). Attempting to insert a provision for another department is rejected by RLS (`42501`).
2. **Read Access (`budget_provisions_read`)**:
   - `ADMIN`, `PRINCIPAL`, `PURCHASE_COMMITTEE`, `CDC_GRANT_MEMBER`, `CDC_NON_GRANT_MEMBER`, `CHAIRMAN`, `VICE_PRESIDENT` roles have full read access to all departmental budget provisions.
   - Department heads and requesters can read budget provisions for their own assigned department.
3. **Attachments Integration (`attachments_read` / `attachments_insert`)**:
   - Supporting PDF documents attached to a budget provision inherit access from `budget_provisions`.
   - File replacement uses the sub-step C document versioning model (`fn_supersede_attachment`).

---

## 4. Identified Friction Points & Design Decisions

1. **Department Assignment on User Model**:
   - `users` table did not previously have a explicit `department_id` column. Adding `users.department_id` allowed RLS to enforce departmental boundaries cleanly for HOD write policies without relying on email string parsing or hardcoded mappings.
2. **Nullable `budget_head_id`**:
   - Departments can allocate budget provisions overall (when `budget_head_id IS NULL`) or per budget head (e.g. `IT`, `LAB`, `INFRA`). The computed view handles both granular head-level utilization and overall departmental totals seamlessly.

---

## 5. Test Verification Results
Database RLS test suite (`db/tests/rls_app_user.sql`) was extended with 10 assertions covering Phase 2d across two distinct HOD accounts (`head.cs@spcollege.edu` for CS and `head.chem@spcollege.edu` for Chemistry):
- `HOD can insert budget provision for their own department`: PASS
- `supporting PDF document attached to budget provision`: PASS
- `budget provision PDF attachment uses document versioning model`: PASS
- `HOD cannot insert budget provision for another department` (`head` attempting `CHEM` insert): PASS (raises RLS `42501`)
- `Second HOD cannot insert budget provision for CS department` (`head_chem` attempting `CS` insert): PASS (raises RLS `42501`)
- `Second HOD can insert budget provision for their own department` (`head_chem` inserting `CHEM` provision): PASS
- `Principal can read any department budget provision via summary view`: PASS
- `computed utilized_amount dynamically reflects real approved request amount`: PASS
- `computed remaining_amount dynamically reflects allocated minus utilized amount`: PASS
- `fn_get_department_budget_context returns computed budget context for review screen`: PASS
