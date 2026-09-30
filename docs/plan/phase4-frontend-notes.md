# Phase 4 — Interface

Screens and components changed for the revised workflow, and the places a
design detail was decided rather than specified.

## Decision panel (`src/components/requests/DecisionPanel.jsx`)

The panel has always drawn its buttons from `permissions.actions`, so most of
this phase's work was making the server send the right list (see
`phase3-api-notes.md`). What changed here:

- **Send back for correction** added as an action, in amber, with a required
  reason box. The confirm button stays disabled until a reason is written,
  because that text is the only thing the requester will see.
- **Escalate is named after where the request is going**: "Pass to Principal"
  at the committee, "Refer to CDC" or "Refer to Chairman & Vice Chairman" at
  the Principal depending on the amount. The action sent to the server is the
  same `ESCALATE` either way.
- **A note per stage** explains the stage's authority — that the committee
  cannot approve the spending, and that the Principal decides up to ₹50,000 and
  refers larger requests on.
- **Two-signature stages show both signatures**: each required role with
  whether it has decided and who decided it, and a line saying both are needed
  and either may go first.

## Correction and resubmission

- `RequestEditPanel.jsx` replaces `DraftPanel.jsx`. It is the requester's own
  panel and now covers both states in which a request is theirs to change: a
  draft, and one sent back for correction. The editing is identical; what
  differs is the heading, what they are answering, and the button at the end.
  Renamed because "draft panel" stopped being true.
- In the correction state it shows the reason, who asked for it, from which
  stage and when, then a "Resubmit ₹x for review" button and an optional note
  of what changed.
- Approvers looking at a request that is out for correction see an amber banner
  naming the requester it is waiting on, and the reason — so it is obvious why
  nothing is moving and that it is not theirs to move.
- A **Corrections** section lists every correction on the request, resolved or
  not, with the version that answered it.
- "Now with" shows the requester, marked *for correction*, instead of a dash.
- `AWAITING_RESUBMISSION` gained a label and colour ("Back for correction",
  orange) — it was rendering as the raw status code — and the timeline's
  `RETURN`/`RESUBMIT` entries are now named.

## Documents (`src/components/ui/Attachments.jsx`)

- Files are grouped into version chains: the current document is listed, with
  its earlier versions folded behind a history button, each downloadable.
- Past the draft, a **Replace** action uploads a new version (with an optional
  reason) instead of deleting, matching the fact that a submitted document is
  evidence.
- A version number is shown on any document that has been replaced at least
  once, and the reason it was replaced.

## Budget

- **`BudgetContext.jsx`** — a compact panel above the decision panel wherever a
  request is being reviewed: annual provision, already sanctioned, committed
  and awaiting decision, this request, and what is left if everything pending
  is approved. It turns red when approving everything pending would exceed the
  provision.
- **`BudgetProvisions.jsx`** (new page, "Departmental budgets" in the
  Principal, approver, faculty and admin menus) — heads record their own
  department's provision for the year with a note, and anyone who reviews
  requests can read all of them. Each card shows the computed figures and the
  provision's documents.

## Courses

Grant / Non-Grant is now a property of the course: a required choice on the
course form in Master data, a coloured tag in the course list, and
`fundingType` on the course API. It decides which CDC member a course's
requests belong to, which is why it lives on the course rather than the
request.

## Reports

A **Report** section on any submitted request: "Open the full report" (prints
to PDF from the browser) and "Download for Word". See
`phase5-reporting-notes.md`.

## Decided here, not specified — worth a look in review

- The wording of every new button and stage note above.
- **"Refer to CDC"** rather than "Escalate to CDC": the Principal is not
  escalating a problem, they are passing a decision to whoever holds it.
- The budget panel shows *"left if everything pending is approved"* rather than
  a bare "remaining", because the figure already has this request and every
  other in-flight one deducted. The plainer word would have been misleading.
- Replacing a document asks for the reason in a browser prompt. It is the one
  piece of interface here that is not styled; a small modal would be better if
  the college uses the feature often.
- The Purchase Committee is still offered **Reject**. The panel no longer
  claims it cannot reject, but whether it *should* be able to is question 1 in
  `requirement.md` — a rejection there would stop the Principal ever seeing the
  request, which `decisions.md` says must always happen.
