# Phase 6 — Regression and security sweep

## Test suite

| Suite | Before | After |
|---|---|---|
| `server/test` (API) | 76 tests, **20 failing** | 133 tests, 0 failing |
| `db/tests/rls_app_user.sql` | 52 checks, 0 failing | 52 checks, 0 failing |

### The 20 failures

Every one of them tested **old-workflow behaviour that Phase 2 deliberately
replaced** — a ₹30,000 request approved outright by the Purchase Committee, and
a ₹6.5 lakh request routed straight to CDC without the Principal. The first
assertion failed, and the rest of `workflow.test.js` cascaded from it, which is
why the count was so high.

They were rewritten, not deleted. Each now asserts the new rule where it
asserted the old one:

- the ₹6.5 lakh request enters at the Purchase Committee like everything else,
  is passed to the Principal, is refused when the Principal tries to approve
  it, and is decided by the Chairman **and** the Vice Chairman — one signature
  is shown to be insufficient;
- the ₹30,000 request is checked by the committee and approved by the
  Principal;
- the committee is offered no approval, and refused when it asks anyway.

New coverage that did not exist before: the whole return-and-resubmit cycle,
the CDC two-role model over HTTP, the joint-stage progress the interface
displays, the report (six tests), and the document-supersede bypass.

Two cascading assertions needed real thought rather than renumbering: the
seal-verification test's expected action list (the route is longer now) and the
carry-forward history length. The second turned out to be hiding a real bug —
below.

## Gaps found, and what was done

| # | Gap | Severity | Status |
|---|---|---|---|
| 1 | `fn_supersede_attachment` is `SECURITY DEFINER` with no authorisation check: any signed-in user could replace any document on any request | **High** — evidence tampering | Fixed, with a test that attempts the bypass |
| 2 | `RETURN` was a no-op in the shipped migration, so resubmission could never work on a deployed database | **High** — the feature was dead | Fixed by a new migration; both build paths now compared |
| 3 | Carry-forward impossible for anything that reached CDC or the board (`SP016` on insert) | **High** — silent loss of a year-end feature | Fixed; the Principal's decision is now looked for on the source request |
| 4 | `POST /api/budget-provisions` had no role check | Medium | `requireRole('HEAD','ADMIN')`; RLS confines a head to their own department |
| 5 | `permissions.actions` ignored stage and amount, so the interface offered buttons the database refused | Medium | Computed per stage and band; re-checked in the route |
| 6 | `SP016`/`SP017`/`SP018` unmapped — every one surfaced as `500 Something went wrong` | Medium | Mapped to 409s with real sentences |
| 7 | `authz.test.js` 10, 11 and 13 asserted nothing (console output only); 1, 2 and 12 accepted any of several statuses | Medium — the security suite was not testing security | All six now assert the specific refusal |
| 8 | Resubmission was not sealed, unlike every other action | Low | Sealed like the rest |
| 9 | Item and field edits impossible while a request was out for correction | Low — but it made correction impossible | Editing allowed in `AWAITING_RESUBMISSION`; deletion still drafts-only |

## Audit against section 26 (server-side enforcement)

- **Mutating endpoints.** Every route under `/api/requests`, `/api/attachments`,
  `/api/budget-provisions`, `/api/admin` and `/api/issues` was read for its
  authorisation. All of them now either carry a role check, run under
  `withUser` so row-level security decides, or call a function that checks for
  itself. The two that did neither were #1 and #4 above.
- **Stage order.** `fn_enforce_stage_progression` is a trigger, so it holds for
  the API and for anyone with a database connection. The route-level checks are
  a second layer, not the layer.
- **RLS coverage.** `requests`, `request_items`, `approval_actions`,
  `comments`, `notifications`, `attachments`, `issues`, `audit_logs`,
  `correction_requests`, `request_versions` and `budget_provisions` all have it
  enabled with policies that match the roles. `db/tests/rls_app_user.sql`
  exercises them as `app_user`, never as a superuser.
- **Ownership across versions.** A resubmitted request is the same row, so
  visibility does not change; `request_versions` and `correction_requests`
  follow the request's own visibility.
- **Report access** inherits request access exactly, in every format — tested.

## Found and deliberately not fixed

- **Whether the Purchase Committee may reject outright.** It can today. That
  contradicts "the Principal always sees every request", but removing it
  changes the workflow, and that is the Principal's call. Question 1 in
  `requirement.md`.
- **Disagreement at a two-signature stage.** The second decision's item figures
  overwrite the first's, and one rejection ends the request. `decisions.md`
  explicitly leaves this open. Question 2.
- **`CDC_MEMBER`**, the generic legacy role, is still seeded and still assigned
  to both CDC users. It grants nothing on its own — the two-role count ignores
  it — but it should be confirmed and removed rather than left to confuse.
- **Carry-forward resumes at the stage it left off at**, which after the fix
  above means a request can re-enter the new year already past the Principal.
  Defensible (the decision was made, only the money lapsed) but worth
  confirming. Question 4.
- **`storage.js`, `mailer.js`, `emailTemplates.js` and the notification paths
  were not touched** in this pass, by instruction.
