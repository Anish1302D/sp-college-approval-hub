# S.P. College Approval and Workflow Management System

## Purpose

A role-based web application for the college's procurement approvals and
faculty issues, with inventory, purchase bills, reporting, notifications and a
full audit trail.

Sources: `SPCollege_ApprovalSystem_Requirements.docx`,
`Procurement_Workflow_Database_Documentation_2.docx`, and
`Email_Workflow_Master_Document_College_Procurement_Approval.docx`.

## Roles

Roles are data, not code: adding a CDC member is a row, not a release.

| Role | Does |
|---|---|
| Head of Department, Activity In-charge | Raise requests; follow their own |
| Purchase Committee | Decide requests under ₹50,000 |
| Principal | Decide ₹50,000 to under ₹5 lakh; read all college data; manage faculty issues |
| CDC (Grant and Non-Grant members) | Decide requests of ₹5 lakh and above |
| Chairman, Vice President | Final authority; no further escalation |
| Administrator | Inventory, purchase bills, exports, audit log |
| Anyone signed in | Raise and follow faculty issues |

## Approval workflow

A request enters at the stage its total belongs to, and each stage may
**approve**, **partly approve**, **reject** or **escalate** — except the final
authority, which cannot escalate.

| Request total | Enters at |
|---|---|
| Under ₹50,000 | Purchase Committee |
| ₹50,000 to under ₹5 lakh | Principal |
| ₹5 lakh and above | CDC |

## Functional requirements

- Sign in with a college email; every screen follows the person's real roles.
- A request carries **many line items**, each with a budget item, quantity and
  unit cost. The request total is the sum of its lines, never typed in.
- **Partial approval at item and quantity level.** The original request is never
  overwritten: requested, approved and unapproved quantities and amounts all
  remain on the record.
- Rejection requires a reason. Every decision is recorded with who took it,
  when, and against which items, and is sealed so later alteration is detectable.
- **Comments carry a visibility**: everyone on the request, up the chain, or one
  stage only. A restricted CDC note reaches the Principal but not the requester.
- Attachments (quotations, bills, photographs) on requests and issues.
- Unfinished requests **carry forward** to a later financial year, keeping the
  original request, its history and its signatures.
- Faculty issues: free text, deliberately lightweight, routed to the Principal,
  who can assign, escalate or resolve them.
- Inventory records and purchase bills, bills linked to approved requests.
- Notifications when a request reaches someone and when a decision is made.
- Dashboards, spending by budget head, a "pending more than 3 days" view, CSV
  export, and an append-only audit log.

## Non-functional requirements

- **Access control in the database, not only the interface.** Row-Level Security
  decides what each person can see; the application cannot widen it.
- Approval authority comes from stage staffing, never from a role list in code.
- Money is computed in SQL, where `NUMERIC` is exact, and displayed with Indian
  digit grouping (₹6,50,000.50).
- Responsive interface, usable on desktop and mobile widths.
- Files are stored outside the database; only their metadata is recorded.
- Runs on the college's own Windows server: PostgreSQL, a Node service, and
  static files behind IIS.
- Dependencies, build output and environment files are never committed.

## Current scope

Implemented: the database (`db/`), the REST API (`server/`), and the interface
(`src/`) connected to it. See `readme.md` for how to run all three.

Not yet built:

- **Email delivery.** Notifications appear in the application; sending them is
  planned in `docs/ApprovalHub_Mail_Plan.html`.
- **Returning a request for correction**, and the fulfilment and closing steps.
- **Deployment** to the college server.

## Open questions

1. When a stage approves, is the request finished, or passed up to the next
   stage? The email specification implies the latter; the system does the former.
2. Must both the Chairman and the Vice President approve, or does either decide?
3. Does `budget_heads.head_type` replace `budget_items.item_type`, or sit
   alongside it?
4. How is a request's Head of Department identified? Users are not linked to
   departments, which blocks the Head's copy on email notifications.
