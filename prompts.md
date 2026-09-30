# SP College Approval Hub — Revised Workflow Implementation Plan

**Purpose of this file:** This is the master plan for implementing the Principal's revised
requirements (see `SP_College_Approval_Hub_Revised_Workflow.docx`) on top of the existing
`sp-college-approval-hub` repo. It is written so that **any AntiGravity agent, on any model,
picking this up cold, knows exactly what phase we're on and what to do next.**

Drop this file into the repo root (or `docs/plan/`) before starting. At the start of every
phase, paste the "Prompt to give AntiGravity" for that phase — nothing else. The agent is
told to read this file and the phase output files first, so context survives across model
switches and fresh sessions.

---

## 0. Why phases, and why model-switching

Claude models inside AntiGravity have the tightest quota on the free/Pro tier. Gemini 3 Pro
has much more generous limits, and Gemini 3 Flash / GPT-OSS-120B are effectively free to
spam. So the strategy is:

- **Claude Sonnet** → only for the small number of moments where a wrong decision is
  expensive to undo: the workflow state-machine design, RLS/security enforcement, and
  final review of anything touching money, approvals, or auditability. Low volume, high
  stakes.
- **Gemini 3 Pro** → the bulk of implementation work: schema migrations, API routes,
  frontend screens, resubmission flow, budget module. It has a large context window and is
  good at grinding through an existing codebase without losing track of it.
- **Gemini 3 Flash** → mechanical, low-risk work: dropdown "Other" options, CSS/color
  changes, copy/labels, simple CRUD screens, seed data fixes, writing docs/READMEs.
- **GPT-OSS-120B** → isolated, well-specified codegen that doesn't need deep repo context:
  a report HTML/PDF template, a DOCX template, a standalone utility function — anything you
  can specify completely in the prompt without it needing to re-derive context from the
  existing code.

**Rule of thumb:** if getting it wrong means silent data corruption, a bypassed approval, or
a security hole → Claude. If getting it wrong just means a re-prompt → Gemini/GPT-OSS.

Every phase below has a **Model** and **Effort** line. Effort maps to how much you should
let the agent "think" / how many reasoning passes to allow before accepting its plan.

---

## 1. Two things that MUST be confirmed with the Principal before Phase 2 starts

The revised requirements doc is clear on most of the workflow, but leaves two things
genuinely ambiguous. **Do not let any model guess these — confirm them with Sir first**,
because they change the database schema and the state machine, and un-doing a wrong guess
later is expensive.

### Ambiguity A — Routing for requests under ₹50,000
The old workflow let Purchase Committee approve <₹50k requests directly. The revised
requirements remove PC's final-approval authority entirely, but never say what happens to
sub-₹50k requests now. Two readings:
- **A1:** Every request, regardless of amount, goes PC (review) → Principal (decision) →
  higher authority only if amount requires it.
- **A2:** Sub-₹50k requests skip PC entirely and go straight to Principal.

→ **Ask:** "Does a request under ₹50,000 still go through Purchase Committee review first,
or does it go straight to you?"

### Ambiguity B — What "CDC has two approvals" means
The notes explicitly flag this as unresolved. Four readings, each a different state machine:
- **B1:** Sequential — CDC Member 1 must approve before CDC Member 2 can act.
- **B2:** Sequential but either can reject/send back independently.
- **B3:** Parallel/independent — both act on the same request state, order doesn't matter,
  both required to proceed.
- **B4:** Either one alone is sufficient (only one CDC signature needed, chosen from two
  possible people).

→ **Ask:** "For CDC, do both members need to sign off before it moves on, and if so, does
the order matter — does Member 1 have to go first?"

Write the answers into `docs/plan/decisions.md` before Phase 2. Every phase below assumes
these are answered; if they aren't yet, Phase 1 will produce a plan with these as explicit
open items rather than guessing.

---

## Phase 1 — Full Analysis & Gap Report (NO CODE CHANGES)

**Goal:** A written comparison of current implementation vs. revised requirements, plus a
structured implementation plan for Phases 2–7, saved as a file in the repo.

**Model:** Gemini 3 Pro
**Effort:** High / maximum reasoning pass. This phase sets the foundation everything else
depends on — let it take its time. Do not let it start writing code.
**Why not Claude:** this is a large-context "read everything, summarize" task with no
irreversible decisions yet — exactly what Gemini 3 Pro's context window is for. Save Claude
quota for Phase 2 onward.

**Output:** `docs/plan/phase1-gap-analysis.md`

### Prompt to give AntiGravity

```
You are working on the existing S.P. College Approval Hub project.
Repository: https://github.com/Anish1302D/sp-college-approval-hub

This is an existing working project. DO NOT rebuild it from scratch and DO NOT
write or modify any code in this phase.

First, read APPROVAL_HUB_REVISED_WORKFLOW_PLAN.md in the repo root fully — it
explains the overall phased plan and two open questions (Ambiguity A and B)
that may or may not be answered yet in docs/plan/decisions.md. Check whether
that file exists and read it if so.

Then inspect and understand the entire existing codebase:
- db/ (schema, migrations, seed data, RLS policies, tests)
- server/ (routes, controllers, services, auth, validation)
- src/ (React frontend, all portals: admin, principal, approver, faculty)
- docs/
- requirement.md, readme.md, AI_LOGS.md
- existing approval workflow / state-machine logic
- existing role/permission logic
- existing document/attachment handling
- existing reports and export logic
- existing budget-head/budget-item logic
- existing audit trail
- existing tests (server/tests and db/tests)

The Principal has given revised requirements (attached as
SP_College_Approval_Hub_Revised_Workflow.docx — read it in full). These
supersede conflicting parts of the old requirement.md.

Produce a single file at docs/plan/phase1-gap-analysis.md containing:

1. REUSE — what already exists and can be kept as-is or lightly adapted
   (be specific: file paths, table names, endpoint names).
2. CONFLICTS — everywhere the current code assumes the OLD workflow (PC
   final-approves <₹50k, Principal independently handles 50k–5L, CDC
   receives 5L+ directly) and must be changed. Quote the exact file/line
   or SQL that encodes this.
3. DATABASE CHANGES — every table/column/constraint/RLS policy that needs
   to be added or altered, grouped by feature (workflow state machine,
   resubmission/versioning, budget provision, CDC two-approver model,
   document versioning). Do not write migrations yet, just describe them.
4. API CHANGES — every route that needs to change or be added, grouped
   the same way.
5. FRONTEND CHANGES — every screen/component affected, per portal (Admin,
   Principal, Purchase Committee/Approver, Faculty, CDC, Chairman/VP).
6. WORKFLOW/STATE-MACHINE CHANGES — describe the current state machine
   as implemented, then the target one, as a diff.
7. REPORTING CHANGES — what's needed for the new PDF/DOCX reporting
   module described in the revised requirements (section 18-24 of the
   docx).
8. SECURITY/RLS CHANGES — everywhere server-side enforcement is currently
   missing or relies on frontend hiding, per section 26 of the docx.
9. TESTS — what existing tests will break and need updating, and what
   new test coverage is needed.
10. AMBIGUITIES — list Ambiguity A and Ambiguity B from
    APPROVAL_HUB_REVISED_WORKFLOW_PLAN.md, note whether decisions.md
    answers them, and list any OTHER ambiguity you find in the revised
    requirements that should not be guessed. For each, propose the most
    likely reading but mark it clearly as "NEEDS CONFIRMATION."

Finish with a structured implementation plan broken into the same phases
as APPROVAL_HUB_REVISED_WORKFLOW_PLAN.md (Phase 2: schema, Phase 3:
backend, Phase 4: frontend, Phase 5: reporting, Phase 6: security/tests,
Phase 7: docs). For each phase, list the concrete files you expect to
touch.

Do not modify any code. Only write docs/plan/phase1-gap-analysis.md.
Stop after writing it and wait for review.
```

**Before moving on:** read the output yourself, resolve Ambiguity A and B with the
Principal, write `docs/plan/decisions.md` with the answers, then proceed.

---

## Phase 2 — Database Schema & Migrations

**Goal:** All schema changes for the new workflow, resubmission/versioning, budget
provision, CDC two-approver model, and document versioning — migrations only, no API/UI
yet.

**Model:** Claude Sonnet
**Effort:** High / extended thinking if the tool offers it. This is the highest-stakes
phase — a wrong schema decision here (e.g. collapsing CDC into one approval row, or
overwriting original request data on resubmission) is expensive to unwind later and every
later phase builds on it. Spend Claude quota here, not on boilerplate.

**Output:** New files under `db/migrations/`, plus `docs/plan/phase2-schema-notes.md`
explaining what changed and why.

### Prompt to give AntiGravity

```
Read APPROVAL_HUB_REVISED_WORKFLOW_PLAN.md, docs/plan/phase1-gap-analysis.md,
and docs/plan/decisions.md (contains the confirmed answers to Ambiguity A
and B) before doing anything else.

Implement ONLY the database schema changes identified in section 3
(DATABASE CHANGES) of phase1-gap-analysis.md. Do not touch server/ or src/
in this phase.

Requirements to encode in the schema:

1. WORKFLOW STATE MACHINE: model the new stage progression per
   decisions.md's answer to Ambiguity A (whether sub-₹50k requests visit
   Purchase Committee). Purchase Committee actions must be modeled as
   review/forward/escalate/partial-recommend/resubmit — NOT as a final
   "approved" status. Add a backend-enforceable constraint (not just an
   enum) so a request's current_stage can never jump from Purchase
   Committee straight to CDC or Chairman/VP, skipping Principal, at the
   database level (e.g. a trigger or a stage-transition table validated
   in the same transaction as the status update).

2. CDC TWO-APPROVER MODEL per decisions.md's answer to Ambiguity B. Do
   not collapse both CDC approvals into a single approval_actions row.
   Each CDC member's decision needs its own row with its own user,
   decision, comments, timestamp, and audit trail, and the schema must
   express whichever relationship (sequential/parallel/either-sufficient)
   was confirmed.

3. RESUBMISSION / VERSIONING: the original request_id must never be
   reused for a new unrelated request, and resubmission must not
   overwrite the original submission. Model this as a request_versions
   or request_revisions concept that preserves every prior version's
   full state (fields, decisions, comments) while keeping one stable
   request_id the user always sees. Record: who requested the
   correction, reason, timestamp, previous status, resubmitted status.

4. DOCUMENT VERSIONING: extend or replace the current single-version
   attachment model so a document can be superseded without deleting the
   old one. Each document version needs: file name, type, uploaded_by,
   uploaded_at, version number, related request (and version, if
   relevant), and an optional reason/description. Old versions must
   remain queryable, not just the latest.

5. BUDGET PROVISION: new table(s) for department + academic_year +
   annual budget provision + budget head, supporting an uploaded PDF
   document, with utilized/committed/remaining amounts derivable from
   actual request/approval records rather than manually typed totals
   wherever the data already exists to compute them.

6. PARTIAL APPROVAL: confirm the existing requested/approved/unapproved
   quantity and amount columns on request_items are sufficient for the
   new workflow, where partial approval can now happen at Purchase
   Committee (as a recommendation, not a final approval) as well as at
   Principal/CDC. Add a column or flag to distinguish a PC
   "recommendation" from an actual "approval" if the current schema
   doesn't already separate these concepts.

7. RLS: update or add Row-Level Security policies so that:
   - Purchase Committee role has no UPDATE path that sets a request to
     a final-approved status.
   - A request cannot have its current_stage_id set to a CDC or
     Chairman/VP stage unless it has a completed Principal-stage
     approval_actions record in its history.
   - Document access respects the same role rules as request access.

Write each schema change as a new numbered migration file under
db/migrations/ following the existing migration naming convention (check
existing files first). Do not edit already-applied migrations in place —
only add new ones, consistent with how db/ is organized (check
db/README.md for the project's own migration policy first).

After the migrations, write docs/plan/phase2-schema-notes.md explaining:
- what each migration does
- how you encoded the Ambiguity A/B answers
- any RLS policy you added or changed and why
- how existing data (already-seeded requests) will be affected/migrated

Do not modify server/ or src/. Do not run the migrations against a
database that has real data without confirming with me first. Stop after
writing the migrations and notes, and wait for review before Phase 3.
```

---

## Phase 3 — Backend / API Changes

**Goal:** Wire the new schema into the API — state-machine enforcement, resubmission
endpoints, budget endpoints, document versioning endpoints, notifications, CDC two-approver
endpoints.

**Model:** Gemini 3 Pro for the bulk of routes/controllers. **Switch to Claude Sonnet**
specifically for the authorization/RLS-adjacent middleware and the stage-transition
validation logic (the code that enforces "cannot skip Principal," "cannot fake a CDC
approval," etc.) — that's the part where a subtle bug is a real security hole, not just a
bug.
**Effort:** Gemini: standard. Claude (auth/transition logic only): high.

**Output:** New/changed files under `server/`, plus `docs/plan/phase3-api-notes.md` and new
entries in `server/tests/`.

### Prompt to give AntiGravity (Gemini 3 Pro — general API work)

```
Read APPROVAL_HUB_REVISED_WORKFLOW_PLAN.md, docs/plan/phase1-gap-analysis.md,
docs/plan/decisions.md, and docs/plan/phase2-schema-notes.md (and the
migrations under db/migrations/ it describes) before doing anything else.
Do not modify db/ or src/ in this phase.

Implement the API changes identified in section 4 (API CHANGES) of
phase1-gap-analysis.md, against the new schema from Phase 2:

1. Purchase Committee endpoints: replace/extend the current approve
   action with forward, escalate, partial-recommend, and resubmit
   actions. None of these should be able to set a request to a final
   "approved" terminal status — enforce this in the route handler as a
   defense-in-depth check in addition to the DB constraint from Phase 2.

2. Principal endpoints: review, reject, escalate/forward to next
   authority, send-back-for-resubmission. The Principal's decision must
   be the only thing that advances a request out of the Purchase
   Committee stage — a PC "forward" action alone must not auto-advance
   the stage; it should only make the request visible/actionable to the
   Principal.

3. Resubmission endpoints: allow the requester to edit permitted fields,
   upload revised/additional documents and quotations, and resubmit
   under the same request_id, per the versioning model from Phase 2.
   Preserve full history — do not let this path overwrite prior data.

4. Document endpoints: support versioned upload (new version replaces
   which document is "current" without deleting prior versions), and
   list/fetch by request including version history.

5. Budget provision endpoints: HOD can submit/update a department's
   annual budget provision for an academic year including a PDF upload;
   Principal can review it; a read endpoint that returns computed
   utilized/committed/remaining figures for a department+year (compute
   from real request/approval data, not stored totals, wherever that
   data already exists).

6. Budget-in-review endpoint: when a Purchase Committee member or
   Principal opens a request, expose the relevant department's current
   budget picture (annual provision, utilized, pending/committed,
   this request's amount, projected remaining) so the frontend can show
   it during review.

7. CDC endpoints implementing the two-approver model per
   docs/plan/decisions.md's answer to Ambiguity B — do not collapse the
   two approvals into one call.

8. Notifications: when an HOD submits/updates budget info, notify the
   relevant Purchase Committee/Principal users in-app. Do not add new
   approval steps just for this.

9. Principal → Purchase Committee feedback endpoint: record
   clarification/observation messages tied to a request, visible to PC,
   distinct from a formal decision.

For every new/changed endpoint, add or update tests under server/tests/
following the existing test structure and conventions (check the
existing 76 tests first for the patterns used). Do not remove or weaken
any existing passing test unless it tests old-workflow behavior that
this phase intentionally replaces — if so, say so explicitly in your
summary rather than silently deleting it.

Write docs/plan/phase3-api-notes.md summarizing every route added/changed,
old routes removed or deprecated, and any place you deferred a decision
because it depends on stage-transition/auth logic being handled
separately (that part will be done in a follow-up pass).

Stop after this and wait for review before the auth/transition-logic
follow-up pass.
```

### Prompt to give AntiGravity (Claude Sonnet — auth & stage-transition enforcement only)

```
Read docs/plan/phase3-api-notes.md and the routes it describes before
doing anything else. Do not touch unrelated routes or files.

Your only job in this pass: review and harden the server-side enforcement
that a request's stage can never be advanced except through the exact
sequence required by the revised workflow (see
APPROVAL_HUB_REVISED_WORKFLOW_PLAN.md and docs/plan/decisions.md):

- No API call, under any role, malformed input, or direct call bypassing
  the frontend, can move a request from Purchase Committee to CDC or
  Chairman/VP without a completed Principal decision in its history.
- No API call can record a CDC approval that doesn't match the confirmed
  two-approver model from decisions.md.
- No API call can set a request to a terminal "approved" status via a
  Purchase Committee action.
- Resubmission cannot be used to silently overwrite or erase prior
  decisions or documents.

For each of these, write or point to the exact middleware/validation
function that enforces it, and add a focused authorization test for each
one that attempts the bypass directly against the API (not through the
UI) and asserts it is rejected. Put these under server/tests/security/ or
alongside the existing security-relevant tests — check the existing test
layout first.

Summarize what you checked and what you added or fixed in
docs/plan/phase3-security-review.md. If you find the Phase 2 schema
doesn't actually support enforcing one of these (e.g. no DB constraint
backs it up), say so explicitly rather than working around it only in
application code — flag it for a Phase 2 follow-up migration instead.

Stop and wait for review.
```

---

## Phase 4 — Frontend / Dashboard Changes

**Goal:** Update each portal's UI to match the new roles, actions, and information the
revised workflow requires.

**Model:** Gemini 3 Flash for mechanical/cosmetic items (dropdown "Other" options, Courses
Grant/Non-Grant field, decision-panel color coding, copy changes). Gemini 3 Pro for anything
that involves wiring new multi-step flows (resubmission UI, budget submission UI, versioned
document upload/history UI, budget-during-review panel). No Claude needed here unless a
screen directly renders financial approval totals that must match the backend exactly —
in that case, have Gemini 3 Pro implement it and have Claude do a short review pass only
(see below), not build it from scratch.
**Effort:** Standard for both Flash and Pro.

**Output:** Changed/new files under `src/`, plus `docs/plan/phase4-frontend-notes.md`.

### Prompt to give AntiGravity (Gemini 3 Pro — main pass)

```
Read APPROVAL_HUB_REVISED_WORKFLOW_PLAN.md, docs/plan/phase1-gap-analysis.md,
and docs/plan/phase3-api-notes.md (for the new/changed endpoints) before
doing anything else. Do not modify db/ or server/ in this phase.

Implement the frontend changes from section 5 (FRONTEND CHANGES) of
phase1-gap-analysis.md:

1. Purchase Committee portal (currently the "approver" portal for this
   role): remove the final "Approve" action; replace with Forward,
   Escalate, Partial Recommendation, and Resubmit, matching the new API.
   Make sure the review screen surfaces everything section 3 of the
   revised requirements doc lists: justification, budget provision
   context, requested items/quantities/costs, budget head/item,
   quotations, supporting documents, previous comments/resubmissions/
   history. Reuse RequestDetailModal.jsx where possible rather than
   building a new component — extend it if it's missing fields.

2. Principal portal: add Send-back-for-resubmission alongside existing
   Review/Reject/Escalate. Make clear in the UI that a PC "forward"
   alone does not move the request forward without the Principal's own
   decision.

3. Resubmission flow (requester-facing, likely in the Faculty portal):
   a screen that shows the correction reason, lets the requester edit
   permitted fields, upload revised/additional documents, and resubmit
   under the same request ID, with the full prior history visible below.

4. Documents section: on any request detail view, show document version
   history (not just the latest file), who uploaded each version and
   when, and why (if a reason was given).

5. Budget module UI: a screen for HOD to submit/update a department's
   annual budget provision for an academic year with PDF upload; a
   Principal-facing review of that; and a compact "budget context" panel
   shown wherever a request is being reviewed (annual provision,
   utilized, committed/pending, this request's amount, projected
   remaining) sourced from the Phase 3 budget-in-review endpoint.

6. CDC portal: reflect the two-approver model from decisions.md
   explicitly in the UI — do not show it as one generic "CDC approved"
   step if the confirmed model is sequential or has two distinct
   signatures.

7. Chairman/Vice Chairman portal: review-only visibility into the full
   case (request, items, quantities, amounts, budget context, PC
   observations, Principal decision, CDC decisions, resubmission
   history, comments, audit trail). Do not add decision/approval buttons
   for them unless phase1-gap-analysis.md explicitly said the revised
   requirements grant them one — if in doubt, leave it read-only and
   flag it in your notes rather than guessing.

8. General dropdown "Other" option: for every dropdown identified in
   phase1-gap-analysis.md (Budget Head, Department, Course, Budget Item,
   Urgency, and any others found), add an "Other" choice that reveals a
   free-text input, wired to whatever field/column Phase 2/3 provided
   for it.

9. Courses: add Grant / Non-Grant classification to the course
   create/edit UI and to wherever courses are displayed or filtered.

Write docs/plan/phase4-frontend-notes.md listing every screen/component
touched, and flag anywhere you had to guess at a design detail the
requirements doc didn't specify (e.g. exact wording of a button, exact
layout of the budget panel) so it can be adjusted in review rather than
treated as final.

Stop after this and wait for review before the color-coding /
mechanical-fixes pass.
```

### Prompt to give AntiGravity (Gemini 3 Flash — mechanical follow-up)

```
Read docs/plan/phase4-frontend-notes.md first so you know what the main
pass already touched. Do the following small, independent fixes without
altering any workflow logic:

1. In DecisionPanel.jsx, give each of the action buttons (Approve/
   whatever the current equivalent set is post-Phase-4, Partial,
   Reject, Escalate) a persistent color-coded style even before
   selection, not only on click.

2. Fix the seed data / add a migration-adjacent seed fix (check with the
   Phase 2 migrations first) so the Courses dropdown is no longer empty
   for the seeded departments (CS, CHEM, PHY, ADMIN).

3. Sweep for spacing/hierarchy consistency issues on Profile, Settings,
   DecisionsArchive, and ReviewQueue pages, and add a success toast after
   approve/reject/forward/escalate/resubmit actions wherever one is
   currently missing.

Write a short summary of what you changed in
docs/plan/phase4-mechanical-notes.md. Stop and wait for review.
```

---

## Phase 5 — Reporting Module (PDF / DOCX)

**Goal:** The formal, college-branded reporting module — this is called out as the
highest-priority feature in the revised requirements (section 18).

**Model:** GPT-OSS-120B for the report template itself (HTML/PDF or DOCX template
generation is a self-contained task once given the exact field list — doesn't need deep
repo context). Gemini 3 Pro for wiring the template to real data from the API. Claude
Sonnet for a final pass specifically checking that the report's numbers and narrative
cannot mismatch the underlying approval records (see below) — this is the phase most likely
to embarrass you in front of the Principal if it's wrong.
**Effort:** GPT-OSS: standard. Gemini: standard. Claude review pass: high.

**Output:** New reporting service/routes, template files, `docs/plan/phase5-reporting-notes.md`.

### Prompt to give AntiGravity (GPT-OSS-120B — template only)

```
Design a report template (produce both an HTML template suitable for
PDF rendering, and a DOCX template/generation approach) for a college
procurement approval report. Do not look at or modify any other part of
the codebase — this is a standalone template task.

The report needs a header with: S.P. College logo placeholder, college
name, report title, Request ID, Department, Academic Year, Date,
Relevant authority, and a footer with page numbers.

The body needs these sections, in this order, each clearly headed:
A. Request Information (Request ID, Requester, Department, Academic
   Year, Date, Purpose, Justification)
B. Item Details (table: item, budget item, budget head, quantity
   requested, quantity approved, quantity unapproved, unit cost,
   requested amount, approved amount, unapproved amount)
C. Budget Information (annual departmental provision, budget allocated,
   amount utilized, pending/committed amount, current request, remaining
   provision)
D. Supporting Documents (list: quotations, budget PDF, justification
   documents, supporting files, revised documents — with version/date)
E. Workflow History (submission, PC review + comments/actions, Principal
   review + comments/actions, CDC review/decisions per member, Chairman/
   VP review, final decision) — presented as a narrative, not just a
   table: e.g. "Requested amount: ₹6,00,000. Purchase Committee reviewed
   justification and forwarded to Principal. Principal reviewed budget
   provision and escalated to CDC. CDC reviewed. ₹3,00,000 approved;
   ₹3,00,000 remained unapproved." — every sentence must be filled from
   real fields, not boilerplate.
F. Resubmission History (reason, date, requested correction, changes
   made, new documents, who resubmitted) — only rendered if the request
   was actually resubmitted.
G. Audit Trail (table: user, action, date/time, previous status, new
   status, comments)
H. A workflow visualization showing ONLY the stages this specific
   request actually passed through (not a generic full-pipeline diagram)
   — simple boxes-and-arrows is fine, doesn't need to be fancy.

Every value must come from a clearly named placeholder/variable — do not
hardcode any example data into the final template. Provide a short
README describing what data object shape the template expects (field
names) so it can be wired to the real API in a later step.

Output the template files and the README only. Do not touch any other
part of the project.
```

### Prompt to give AntiGravity (Gemini 3 Pro — wiring)

```
Read docs/plan/phase1-gap-analysis.md, docs/plan/phase3-api-notes.md, and
the README produced by the GPT-OSS-120B template pass (find it under
wherever that agent saved it — check recent changes) before doing
anything else.

Wire the report template to real data: build the backend
service/endpoint that assembles the exact data-shape the template
expects from a given request_id, covering every section A-H, pulling
from the actual request, request_items, approval_actions, documents,
budget provision, and audit trail tables/records (including the Phase 2
resubmission-versioning and CDC two-approver schema). Add:

- An endpoint to generate the complete final report (PDF and DOCX) for
  a given request.
- Endpoints for the individual stage reports listed in section 20 of
  the revised requirements doc (Purchase Committee Review Report,
  Principal Review Report, Resubmission Report, Rejection Report,
  Partial Approval Report, CDC Review/Approval Report, Chairman/VP
  Review Report, Final Decision Report) — these can reuse most of the
  same data-assembly logic, filtered to the relevant section(s).
- Role-based access control on report generation/download matching the
  same rules as request/document access (a role that can't see a
  request's documents shouldn't be able to generate its report either).

Section H (workflow visualization) must only show stages the specific
request actually passed through — compute this from the request's
actual stage history, don't render a static full-pipeline image.

Write docs/plan/phase5-reporting-notes.md describing the endpoints added
and exactly how each report section's data is sourced. Stop and wait for
review before the Claude verification pass.
```

### Prompt to give AntiGravity (Claude Sonnet — correctness review only)

```
Read docs/plan/phase5-reporting-notes.md and the reporting service code
it describes. Do not add new features — your only job is verification.

For at least 3 realistic scenarios (a straightforward single-stage
approval, a partial approval that also got escalated to CDC, and a
resubmitted request), trace through the reporting code by hand against
the underlying schema and confirm:

- Every number shown in the report (requested/approved/unapproved
  quantities and amounts, budget remaining) is computed from the same
  source of truth the approval workflow itself uses — not a separately
  maintained total that could drift out of sync.
- The workflow-history narrative text cannot describe a stage the
  request didn't actually pass through, and cannot omit a stage it did
  pass through.
- A resubmitted request's report correctly shows both the original and
  resubmitted history rather than only the latest version.
- Report access respects the same role restrictions as the underlying
  data.

Write your findings in docs/plan/phase5-verification-notes.md. If you
find a mismatch, propose the minimal fix but do not implement broad
refactors — flag anything larger for a follow-up. Stop and wait for
review.
```

---

## Phase 6 — Security Hardening & Full Regression

**Goal:** Confirm nothing in the old test suite silently broke, and that every rule in
section 26 of the revised requirements doc (server-side enforcement, no reliance on
frontend hiding) holds across the whole app, not just the areas touched in earlier phases.

**Model:** Claude Sonnet.
**Effort:** High. This is a deliberate, final, whole-system check — worth spending quota on
even though it's late in the plan, because this is the phase that catches anything the
earlier per-phase reviews missed.

**Output:** `docs/plan/phase6-security-report.md`, test additions.

### Prompt to give AntiGravity

```
Read APPROVAL_HUB_REVISED_WORKFLOW_PLAN.md and every docs/plan/phase*-notes.md
file produced so far before doing anything else.

Run the full existing test suite (server/tests and db/tests/rls_app_user.sql)
and report what passes, what fails, and — for anything that fails —
whether it fails because it correctly tests OLD workflow behavior that
this project intentionally replaced (expected) or because something
genuinely broke (needs fixing).

Then do a project-wide audit against section 26 of the revised
requirements doc:
- API authorization: for every mutating endpoint across the whole app
  (not just the ones touched in Phases 2-5), confirm role checks exist
  server-side.
- Stage checks: confirm no endpoint anywhere lets a request's stage
  advance in an order the state machine forbids.
- RLS policies: confirm every table holding request/document/budget
  data has RLS enabled and the policies match actual role needs — flag
  any table where RLS is missing or looks copy-pasted incorrectly.
- Request ownership: confirm a user can only see/edit requests they're
  authorized for, including resubmitted versions.
- Document access, report access, CDC access, Principal access,
  Chairman/VP access: spot-check each against the roles that should and
  shouldn't have it.

For each gap found, add a test that proves the gap exists (failing
test), then fix the minimal issue and confirm the test passes. Do not
do a broad refactor — targeted fixes only.

Write docs/plan/phase6-security-report.md summarizing: test suite
results, every gap found, every fix made, and anything you found but
deliberately did NOT fix because it's out of scope (with a one-line
reason). Stop and wait for review.
```

---

## Phase 7 — Documentation & Wrap-up

**Goal:** Update the project's own documentation to reflect the new system, so the next
person (or the next AntiGravity session) doesn't have to reverse-engineer what changed.

**Model:** Gemini 3 Flash.
**Effort:** Standard.

### Prompt to give AntiGravity

```
Read APPROVAL_HUB_REVISED_WORKFLOW_PLAN.md and every docs/plan/phase*-notes.md
and docs/plan/phase*-report.md file. Update:

- requirement.md to reflect the new workflow, replacing the old
  threshold-based rules described in section 6 of the revised
  requirements doc.
- readme.md: update the "What is not built yet" section (resubmission
  is now built; note reporting module and budget provision as newly
  added features).
- AI_LOGS.md: add an entry summarizing this whole revised-workflow
  effort across Phases 1-6, in the same style as existing entries.

Do not touch code. Stop after the doc updates.
```

---

## Quick reference table

| Phase | What | Model | Effort |
|---|---|---|---|
| 1 | Gap analysis, no code | Gemini 3 Pro | High |
| — | Confirm Ambiguity A & B with Principal | (you) | — |
| 2 | DB schema/migrations | **Claude Sonnet** | High |
| 3a | API routes (general) | Gemini 3 Pro | Standard |
| 3b | Auth/stage-transition enforcement | **Claude Sonnet** | High |
| 4a | Frontend main pass | Gemini 3 Pro | Standard |
| 4b | Frontend mechanical fixes | Gemini 3 Flash | Standard |
| 5a | Report template | GPT-OSS-120B | Standard |
| 5b | Report data wiring | Gemini 3 Pro | Standard |
| 5c | Report correctness review | **Claude Sonnet** | High |
| 6 | Security hardening & regression | **Claude Sonnet** | High |
| 7 | Docs wrap-up | Gemini 3 Flash | Standard |

Claude is used in exactly 4 of the 12 sub-phases — the schema, the auth-enforcement code,
the report-correctness check, and the final security sweep. Everything else runs on
Gemini/GPT-OSS, which should keep Claude quota available for when it actually matters.