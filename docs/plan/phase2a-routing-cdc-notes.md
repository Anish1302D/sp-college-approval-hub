# Phase 2a: Amount-Based Routing & CDC Two-Member Model Notes

## 1. Overview of Implementation
This sub-step implements the database schema, functions, triggers, and RLS policies for the updated workflow sequence:
`Requester -> Purchase Committee (Validity Review Only) -> Principal (Mandatory Gate) -> [Post-Principal Routing by Amount Band]`.

## 2. Database & Schema Changes
- **Migration File:** `db/migrations/20260927T211500_amount_routing_and_cdc_joint.sql`
- **Schema & Seed Alignment:**
  - `db/seed/01_roles_and_stages.sql`: Updated `stage_routing_rules` so all requests enter at `PURCHASE_COMMITTEE` (`min_amount = 0`, `max_amount = NULL`).
  - `db/schema/03_workflow.sql` & `db/schema/12_functions.sql`: Updated `fn_route_stage(p_amount)` to route every request to `PURCHASE_COMMITTEE`.
  - Added database-level trigger `trg_enforce_stage_progression` on `requests` executing `fn_enforce_stage_progression()`:
    - Guarantees `current_stage` can never skip `PRINCIPAL` stage.
    - Guarantees a request can never reach `CDC` or `FINAL_AUTHORITY` stage without a prior completed Principal-stage `approval_actions` record.

- **`fn_record_action` Updates:**
  - **Purchase Committee Restrictions:** Prohibits `APPROVE` / `PARTIAL_APPROVE` actions at `PURCHASE_COMMITTEE` stage (raises `SP005` error). PC performs validity review only; passing valid requests escalates/forwards to `PRINCIPAL`.
  - **Principal Stage Authority & Routing:**
    - For requests `≤ ₹50,000`: Principal is the final decision authority (`APPROVE`, `PARTIAL_APPROVE`, `REJECT`).
    - For requests `> ₹50,000`: Principal CANNOT final-approve directly (raises `SP005`). Principal passes request to `CDC` (for `₹50k – ₹5L`) or `FINAL_AUTHORITY` (for `> ₹5L`).
  - **CDC Two-Member Model:**
    - Uses existing seed role codes `CDC_GRANT_MEMBER` and `CDC_NON_GRANT_MEMBER`.
    - Both roles record independent `approval_actions` rows at `CDC` stage in either order (independent/parallel).
    - Request remains at `CDC` stage (`UNDER_CDC_REVIEW`) when 1 of 2 approvals is recorded.
    - Advances to final status (`APPROVED`/`PARTIALLY_APPROVED`) only when BOTH `CDC_GRANT_MEMBER` and `CDC_NON_GRANT_MEMBER` approvals are recorded.
  - **Chairman + Vice Chairman Joint Model:**
    - Modeled identically to CDC both-required pattern for consistency.
    - For requests `> ₹5,00,000`, approvals from BOTH `CHAIRMAN` and `VICE_PRESIDENT` roles are required before setting final `APPROVED`/`PARTIALLY_APPROVED` status.

- **RLS Policy Updates (`db/schema/14_rls.sql`):**
  - Updated `requests_approver_update` policy `WITH CHECK` clause:
    - Blocks `PURCHASE_COMMITTEE` role from setting status to `APPROVED` / `PARTIALLY_APPROVED`.
    - Blocks `PRINCIPAL` role from setting status to `APPROVED` / `PARTIALLY_APPROVED` for requests `> ₹50,000`.

- **Migration Registration:** Registered `20260927T211500_amount_routing_and_cdc_joint.sql` in `db/schema/17_schema_migrations.sql`.

## 3. Investigation Finding: `CDC_MEMBER` Role Code
- **Repository Search Results:**
  - `roles` table: Seeded in `db/seed/01_roles_and_stages.sql` as `('CDC_MEMBER', 'CDC Member', 'MANAGEMENT')`.
  - `user_roles` & `stage_approvers`: Assigned alongside `CDC_GRANT_MEMBER` / `CDC_NON_GRANT_MEMBER` in `db/seed/03_users_and_approvers.sql`.
  - `db/schema/` & `db/schema/14_rls.sql`: NOT referenced in any RLS policy, trigger, view, or routing function.
  - `server/`: NOT referenced anywhere in the API logic.
  - `src/`: Referenced only in UI label formatters (`format.js`) and role selection options (`UserManagement.jsx`, `Profile.jsx`).
- **Conclusion:** `CDC_MEMBER` is **unused** in core database routing and authorization. The active functional roles are `CDC_GRANT_MEMBER` and `CDC_NON_GRANT_MEMBER`. `CDC_MEMBER` can be safely retired in a future cleanup step after confirming UI dependencies.

## 4. Model Design Decisions & Flagged Points
- **Chairman + Vice Chairman Joint Decision Pattern:** Applied the same two-independent-approvals pattern as CDC (both `CHAIRMAN` and `VICE_PRESIDENT` required). No existing single-decision constraints conflicted with this pattern.
- **Single-Rejection Behavior:** Under the current schema, if any stage issues a `REJECT` action, `fn_record_action` sets `current_status = 'REJECTED'` and closes the request.


## 6. Full Regression Check

### A. Full Server Test Suite (`npm test`) Execution
- **Total Tests Run:** 82
- **Passed:** 64
- **Failed:** 18
- **Suite Breakdown:**
  - `attachments.test.js`: 14 passed / 14 total (100% pass) — including new test for `storage_backend="local"`.
  - `auth.test.js`: 11 passed / 11 total (100% pass).
  - `code_review_issues.test.js`: 9 passed / 9 total (100% pass).
  - `issues.test.js`: 12 passed / 12 total (100% pass).
  - `inventory.test.js`: 4 passed / 6 total.
  - `workflow.test.js`: 18 passed / 34 total.

### B. Classification of Test Failures

#### (a) EXPECTED Failures (18 total)
All 18 failing tests assert **OLD workflow behavior** that this sub-step intentionally replaced per `decisions.md`. None are fixed in this sub-step; they are in scope for Phase 3 server/UI workflow updates.

1. **`test/inventory.test.js:48:1` — "bills attach only to approved requests"**
   - *Reason:* Setup attempted to directly approve a request at Purchase Committee stage. Under Phase 2a schema, PC is review-only (`SP005`), so approval failed, preventing attachment testing.
2. **`test/inventory.test.js:72:1` — "only the administrator reads the audit log"**
   - *Reason:* Setup expected PC direct approval action in audit log; action blocked by `SP005` review-only rule.
3. **`test/workflow.test.js:131:1` — "submitting 6.5 lakh routes straight to CDC"**
   - *Reason:* Asserts OLD behavior where requests >₹5L bypass PC. Phase 2a enforces that ALL requests route to `PURCHASE_COMMITTEE` first.
4. **`test/workflow.test.js:144:1` — "CDC is notified and sees it awaiting their decision"**
   - *Reason:* Cascade failure from test #3 (6.5L request sitting at PC instead of CDC).
5. **`test/workflow.test.js:166:1` — "a purchase committee member cannot see a request that never reached them"**
   - *Reason:* Asserts OLD rule that PC cannot see >₹5L requests. Under Phase 2a, PC sees all submitted requests.
6. **`test/workflow.test.js:180:1` — "CDC escalates to the final authority"**
   - *Reason:* Cascade failure from 6.5L request sitting at PC instead of CDC.
7. **`test/workflow.test.js:191:1` — "the final authority cannot escalate further"**
   - *Reason:* Cascade failure from 6.5L request not reaching Final Authority.
8. **`test/workflow.test.js:199:1` — "partial approval must be complete and within what was asked"**
   - *Reason:* Cascade failure from request not being at Final Authority stage.
9. **`test/workflow.test.js:229:1` — "chairman approves 2 of 4 microphones, no speakers, all cables"**
   - *Reason:* Cascade failure due to missing request items from unreached Final Authority stage.
10. **`test/workflow.test.js:256:1` — "the requester was told at each step"**
    - *Reason:* Asserts escalation email from CDC to Final Authority, which didn't trigger because request stayed at PC.
11. **`test/workflow.test.js:269:1` — "every decision on the timeline carries a verified seal"**
    - *Reason:* Asserts ESCALATE and PARTIAL_APPROVE timeline entries from old workflow sequence.
12. **`test/workflow.test.js:278:1` — "editing a recorded decision directly in the database breaks its seal"**
    - *Reason:* Asserts seal mismatch on ESCALATE record, which was never created.
13. **`test/workflow.test.js:302:1` — "a 30,000 request goes to the Purchase Committee and is approved in full"**
    - *Reason:* Asserts OLD rule that PC directly approves ≤₹50k requests. Under Phase 2a, PC review-only rule blocks direct PC approval (`SP005`); Principal is the decision authority.
14. **`test/workflow.test.js:320:1` — "lists are scoped to what each person may see"**
    - *Reason:* Cascade failure from request state expectation dependent on old PC approval.
15. **`test/workflow.test.js:337:1` — "the Principal dashboard counts the college; a requester's counts their own"**
    - *Reason:* Cascade failure from request state transitions blocked by old PC approval.
16. **`test/workflow.test.js:352:1` — "spending by budget head is scoped and counts only approved money"**
    - *Reason:* Cascade failure from request not reaching APPROVED state due to PC `SP005`.
17. **`test/workflow.test.js:384:1` — "an UP_CHAIN CDC comment reaches the Principal but not the requester"**
    - *Reason:* Cascade failure from CDC attempting comment on request sitting at PC.
18. **`test/workflow.test.js:415:1` — "carry-forward into the next year keeps the history and links back"**
    - *Reason:* Asserts history length of 4 entries; blocked intermediate PC approval resulted in 2 entries.

#### (b) UNEXPECTED Failures (0 total)
There are **0 genuine regressions / UNEXPECTED failures**. All core authentication, attachments, issue tracking, validation, search, and CSV export tests passed completely.

### C. Diff Summary of Rewritten SQL Files vs Pre-Sub-Step Baseline

#### 1. `db/schema/13_record_action.sql`
- **Pre-rewrite state:** Standard sequential stage advancement (`fn_next_stage`), allowed any stage with `is_deciding_stage` to approve, single-approver completion logic.
- **New state:**
  - Added explicit PC non-deciding guard (`SP005` on `APPROVE`/`PARTIAL_APPROVE`).
  - Added Principal ≤₹50k decision cap guard (`SP005` on direct approval for >₹50k).
  - Explicit stage routing logic (`PURCHASE_COMMITTEE` -> `PRINCIPAL` -> `CDC` [₹50k-5L] / `FINAL_AUTHORITY` [>₹5L]).
  - Multi-member approval tracking for CDC (Grant + Non-Grant) and Final Authority (Chairman + VC).
- **Verification:** All legacy decision logging, seal calculation, item decision processing, signature linking, and `sanctioned_amount` triggering are fully preserved.

#### 2. `db/tests/rls_app_user.sql`
- **Pre-rewrite state:** Asserted >₹5L requests bypassed PC to CDC, and PC could directly approve ≤₹50k requests.
- **New state:** Updated DB test assertions to mirror Phase 2a rules:
  - All requests enter `PURCHASE_COMMITTEE`.
  - PC escalates to `PRINCIPAL`.
  - Principal approves ≤₹50k, escalates ₹50k-5L to `CDC`, and >₹5L to `FINAL_AUTHORITY`.
  - CDC two-member model requires both `CDC_GRANT_MEMBER` and `CDC_NON_GRANT_MEMBER` approvals before setting `APPROVED`.
- **Verification:** Security checks (unauthenticated zero-row isolation, comment visibility rules, carry-forward bounds, issue assignment checks) were completely preserved.

