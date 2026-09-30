# Phase 3 — Backend / API

What the API offers after the revised workflow, and what changed to get there.
Written against the code as it stands, not as it was planned.

## The one endpoint that decides everything

`POST /api/requests/:id/actions` is still the single door every decision goes
through. It takes `APPROVE`, `PARTIAL_APPROVE`, `REJECT`, `ESCALATE` (`FORWARD`
is accepted as a synonym) and `RETURN`, and hands them to `fn_record_action`,
which is where authority actually lives. No new per-stage endpoints were added:
a stage's powers are a property of the stage, so a separate
`/pass-to-principal` route would only be a second name for the same call and a
second place for the rules to drift.

What each stage may do is now computed, not fixed:

| Stage | Offered | Why |
|---|---|---|
| Purchase Committee | `ESCALATE`, `RETURN`, `REJECT` | Completeness review; it cannot approve |
| Principal, ≤ ₹50,000 | `APPROVE`, `PARTIAL_APPROVE`, `REJECT`, `RETURN` | The Principal decides this band |
| Principal, > ₹50,000 | `ESCALATE`, `REJECT`, `RETURN` | The decision is CDC's or the board's |
| CDC | `APPROVE`, `PARTIAL_APPROVE`, `REJECT` | Both members required; the decision is theirs at this band |
| Chairman & Vice Chairman | `APPROVE`, `PARTIAL_APPROVE`, `REJECT` | Final; nothing above to escalate to |

`actionsAt()` in `server/src/routes/requests.js` produces that list for
`permissions.actions`, and the same rules are re-checked in the route handler
before the database is called. The list is a convenience for the interface; the
refusal is real.

### Changed in this pass

- `permissions.actions` used to be the same four actions at every stage, so the
  interface offered the Purchase Committee an Approve button that the database
  then refused, and never offered anyone Send-back-for-correction at all.
- The route now also refuses a Principal approval above ₹50,000 and a `RETURN`
  from any stage but the committee and the Principal. Both were already refused
  by `fn_record_action`; repeating them here turns a database exception into a
  plain refusal and keeps the rule visible where the route is read.
- Those route-level checks are skipped for a caller who is not staffed at the
  stage at all, so "you cannot act here" stays the reason they are refused
  rather than a rule about somebody else's stage.
- `RETURN` now requires a reason in the request body. It is the only thing the
  requester is shown.
- **CDC can no longer escalate.** It is a leftover from the old workflow: under
  the revised one the Principal already chose CDC or the board from the amount,
  so above ₹5,00,000 a request never reaches CDC in the first place. Left in,
  `fn_record_action` treats two escalations at CDC as a completed decision and
  closes the request as partially approved with nothing actually approved. The
  final authority's own refusal is left to the database, which raises `SP006`
  with a clearer reason.

## Resubmission

- `POST /api/requests/:id/resubmit` — the requester's own call. It seals the
  action the way every other decision is sealed (it previously did not), and
  `fn_resubmit_request` refuses anyone but the person who raised the request,
  and any request that was not sent back for correction.
- `PATCH /api/requests/:id`, and the line-item routes, now also accept a
  request in `AWAITING_RESUBMISSION`, not only a draft — otherwise there was no
  way to make the correction that was asked for. `DELETE /api/requests/:id`
  deliberately still accepts drafts only: a request that has been through the
  committee is a record, not a draft.
- The request detail carries `corrections` (newest first), `versionNumber`, and
  `permissions.canResubmit`, so the interface can show what was asked for and
  who is waiting on whom.

## Two-signature stages

The detail now carries `jointApprovals` for a request sitting at CDC or with
the Chairman and Vice Chairman: one row per required role, whether it has
decided, and who decided it. It is derived from `approval_actions` joined to
`stage_approvers`, so it cannot disagree with the decisions themselves.

## Documents

- `POST /api/attachments/:id/supersede` replaces a document with a new version
  and keeps the old one. It is also where the worst bug of this pass was — see
  `phase3-security-review.md`.
- `POST /api/budget-provisions/:id/attachments` (new) attaches the sanction
  letter to a department's provision. Only that department's head, or an
  administrator, may.
- Attachment rows returned with a request now carry `versionNumber`,
  `supersededById`, `requestVersionNumber` and `replacementReason`, which is
  what the version history in the interface is built from.

## Budget

- `GET /api/budget-provisions` and `/:id` return the provision with its
  computed figures, its documents, and whether the caller may change it.
- `POST /api/budget-provisions` is restricted to `HEAD` and `ADMIN`; the
  `budget_provisions_write` policy confines a head to their own department.
  These routes previously had no role check at all — only `TODO` comments.
- `GET /api/requests/:id/budget-context` returns the department's position for
  the request being reviewed. It needs no role list: the request is read under
  the caller's own row-level security first, so anyone who cannot see the
  request gets a 404 before a figure is read.

## Errors

`SP016`, `SP017` and `SP018` — the stage-skip guard, acting on a request that
is out for correction, and resubmitting one that was not sent back — were
raised by the database but not mapped in `server/src/errors.js`, so all three
reached the user as `500 Something went wrong`. They are now 409s with
sentences that say what happened.

## Tests

`server/test/` covers the workflow end to end (`workflow.test.js`), the
authorisation edges (`authz.test.js`), the Phase 3 routes
(`phase3_routes.test.js`) and the report (`reporting.test.js`). 133 tests pass.
`workflow.test.js` was largely rewritten: it asserted the old routing, where a
₹30,000 request was approved by the Purchase Committee and a ₹6.5 lakh one went
straight to CDC. Nothing was deleted to make a test pass — every rewritten test
asserts the new rule in place of the old one, and the resubmission and joint
stages gained tests they never had.
