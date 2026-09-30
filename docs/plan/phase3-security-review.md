# Phase 3 — Authorisation and stage-transition review

The four rules this pass had to prove, what enforces each, and what was found
broken. Everything below was checked against a running database, not read off
the plan.

## 1. Nothing reaches CDC or the board without a Principal decision

**Enforced by** `fn_enforce_stage_progression`, a `BEFORE INSERT OR UPDATE OF
current_stage_id` trigger on `requests` (`db/schema/12_functions.sql`). Moving
into the CDC or final-authority stage requires an existing `approval_actions`
row at the Principal stage. A second clause refuses the Purchase Committee →
CDC jump outright. Both raise `SP016`.

Because it is a trigger, it holds for any path that writes the row — the API,
a script, or somebody with a `psql` prompt.

**Found and fixed.** The trigger also fired on *insert*, and
`fn_carry_forward_request` inserts the new financial year's copy with the stage
it left off at. A carried-forward request has no history of its own, so the
Principal's decision was looked for on a request that had never been decided,
and `SP016` made carrying forward **anything that had reached CDC or the
Chairman impossible**. The check now looks for the decision on
`COALESCE(NEW.carried_forward_from_request_id, NEW.request_id)` — the request
the copy came from, where its history actually lives.

This had been masked: the test that would have caught it was already failing
for an unrelated reason, so the carry-forward call never ran that far.

## 2. No Purchase Committee approval, no Principal approval above ₹50,000

**Enforced by** `fn_record_action`, which refuses `APPROVE` and
`PARTIAL_APPROVE` at the Purchase Committee stage, and refuses them at the
Principal stage when `tentative_total_cost > 50000` (both `SP005`). The
`requests_approver_update` policy refuses the same two cases again at the row
level, so a direct `UPDATE` cannot set an approved status either. The route
repeats both checks before calling the function.

Tested by `authz.test.js` 1 and 2, and by `workflow.test.js` ("the Purchase
Committee … is never offered an approval", which also asks anyway and asserts
the refusal).

## 3. A CDC or board approval must match the two-role model

**Enforced by** `fn_record_action`: after a decision at either stage it counts
`DISTINCT` roles among the decisions recorded there, restricted to
`CDC_GRANT_MEMBER`/`CDC_NON_GRANT_MEMBER` or `CHAIRMAN`/`VICE_PRESIDENT`. Fewer
than two and the request stays where it is.

Counting distinct *roles* rather than users is what makes it hold: `authz.test.js`
5 staffs a second Grant member and shows two of them still do not satisfy CDC.
Test 9 shows the `stage_approvers` primary key stops one person being staffed
under both roles at once.

**Not settled, and out of scope to invent:** what happens when the two
disagree. Both decisions are recorded, but the second one's item figures
overwrite the first's, and a rejection by one is simply a rejection. This is
question 2 in `requirement.md`; it needs the Principal's answer, not a guess.

## 4. Resubmission cannot erase a decision or a document

**Enforced by** `fn_resubmit_request`, which refuses anyone but the requester
(`SP004`) and any request not in `AWAITING_RESUBMISSION` (`SP018`), and writes
a new `request_versions` snapshot rather than editing the old one. Approvers
are frozen out meanwhile: `fn_record_action` refuses every action on a request
in that status (`SP017`), and the progression trigger refuses to move it except
by resubmission.

**Found and fixed — the resubmission flow did not work at all on a deployed
database.** `db/schema/13_record_action.sql` had the corrected `RETURN`
handling, but the migration that shipped it
(`20260927T211500_amount_routing_and_cdc_joint.sql`) carried an older copy in
which `RETURN` behaved like `COMMENT`: the status never became
`AWAITING_RESUBMISSION`, no `correction_requests` row was written, any stage
could return a request and no reason was required. A database built from
`db/schema/` behaved correctly; one built by applying migrations did not, so on
the college server `fn_resubmit_request` would have raised `SP018` forever.
`20260929T120000_fix_return_action_and_resubmit_seal.sql` restates both
functions verbatim from the schema files, and the same migration adds the
`p_signature_hash` parameter the schema declares (dropping the three-argument
overload first, or every three-argument call would have become ambiguous).

To stop the two drifting again, the two build paths are now compared directly:
build a database from `db/schema/`, replay every migration over it, and diff
`pg_get_functiondef` for every function. It currently reports no differences.

## 5. Replacing a document — the one that was wide open

`fn_supersede_attachment` is `SECURITY DEFINER`, so row-level security does not
apply to what it touches, and it made **no authorisation check whatsoever**:
not that the caller could see the request, not that the actor matched the
session user, not that the request was still open. `POST
/api/attachments/:id/supersede` did not check either. Any signed-in user —
a clerk, a head from another department — could replace the quotation on any
request in the college, including a decided one, with the replacement recorded
as a legitimate new version.

Fixed by giving the function the checks the RLS policies would have made: the
actor must be the session user (`SP013`), the caller must be the uploader, an
administrator, able to see the request or issue, or the head of the provision's
own department (`SP004`), and a closed or carried-forward request's documents
cannot be replaced at all (`SP003`).

`phase3_routes.test.js` now has a test that attempts exactly this bypass from
another department's head and asserts both the 403 and that nothing was
written.

## Smaller things fixed in passing

- `SP016`/`SP017`/`SP018` reached callers as `500 Something went wrong`.
- `POST /api/budget-provisions` had no role check — only a `TODO`. The write
  policy would still have refused a foreign department, but as a row-level
  violation rather than a clear 403, and any signed-in user could write their
  own department's provision.
- `authz.test.js` tests 10, 11 and 13 asserted nothing — they printed to the
  console and passed regardless. They now assert the refusals, as do tests 1, 2
  and 12, which accepted any of several statuses.
