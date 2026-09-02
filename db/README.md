# Database

PostgreSQL schema for the S.P. College Approval & Workflow Management System.

## Layout

```
db/
  schema/            DDL, one file per module, run in numeric order
  seed/              Reference data (roles, workflow stages, sample masters)
  docker/init.sh     Init script executed by the Postgres container on first start
  docker-compose.yml Docker path (Postgres + pgAdmin)
  run_all.sql        One-shot loader used from psql (local install)
```

## Local setup

Pick one of the two paths. They can coexist — the local install listens on port **5432**, the Docker one on **5433**.

### Path A — local PostgreSQL install (port 5432)

1. Create the database:

   ```bash
   psql -U postgres -c "CREATE DATABASE spc_approval;"
   ```

2. Load schema + seed:

   ```bash
   psql -U postgres -d spc_approval -f db/run_all.sql
   ```

   Seed files are idempotent (`ON CONFLICT DO NOTHING`), so re-running is safe. For a clean slate: `DROP DATABASE spc_approval; CREATE DATABASE spc_approval;` then rerun.

### Path B — Docker (port 5433)

Requires Docker Desktop running.

```bash
cd db
docker compose up -d
```

First start:
- Postgres 16 starts with an empty volume.
- `docker/init.sh` auto-runs every file in `schema/` then `seed/`.
- pgAdmin comes up at http://localhost:5050 (login `admin@local` / `devpass`).

Connect pgAdmin to the DB using host `postgres`, port `5432`, user `postgres`, password `devpass`.

From your host machine (any client outside the container network), use:
- host `localhost`, port `5433`, user `postgres`, password `devpass`, db `spc_approval`.

Reset the Docker DB (fresh init):

```bash
docker compose down -v   # -v drops the volume so init.sh reruns on next up
docker compose up -d
```

Reload schema/seed into an already-initialised container (init.sh does not rerun automatically):

```bash
docker exec -i spc-postgres psql -U postgres -d spc_approval < db/run_all.sql
```

## Module map

| File | What it holds |
|---|---|
| `00_extensions.sql`  | `pgcrypto`, `citext` |
| `01_enums.sql`       | All controlled vocabularies (status, action, visibility, ...) |
| `02_master_data.sql` | `users`, `roles`, `user_roles`, `departments`, `courses`, `financial_years`, `budget_heads`, `budget_items` |
| `03_workflow.sql`    | `workflow_stages`, `stage_routing_rules`, `stage_approvers` |
| `04_requests.sql`    | `requests`, `request_items` |
| `05_approvals.sql`   | `digital_signatures`, `approval_actions`, `approval_action_items` |
| `06_comms.sql`       | `comments`, `notifications` |
| `07_audit_and_files.sql` | `attachments`, `audit_logs` |
| `08_non_financial.sql`   | `issues`, `issue_events` + late-bound FKs |
| `09_inventory.sql`   | `purchase_bills`, `inventory_items` |
| `10_triggers.sql`    | `updated_at` maintenance + `sanctioned_amount` sync |
| `11_views.sql`       | Dashboard, pending-request and timeline views |
| `12_functions.sql`   | `fn_route_stage`, `fn_stage_status`, `fn_next_stage`, `fn_submit_request`, `fn_carry_forward_request` |
| `13_record_action.sql` | `fn_record_action` — the approval decision engine |
| `14_rls.sql`         | Row-Level Security policies and the `app_user` role |

## Recording a decision

Every approval, rejection, partial approval and escalation goes through one
function. Do not write `approval_actions` by hand — `fn_record_action` checks
authority, writes the signature, records per-item decisions, updates item
statuses, recomputes the request status, and logs the audit entry, all in one
transaction.

```sql
-- Approve everything as requested
SELECT fn_record_action(
    '<request_id>', '<actor_id>', 'APPROVE',
    NULL, 'Looks good', NULL, '<signature hash>');

-- Partially approve: 2 of 4 microphones, reject the speakers
SELECT fn_record_action(
    '<request_id>', '<actor_id>', 'PARTIAL_APPROVE',
    '[{"request_item_id":"<item1>","approved_quantity":2,"approved_amount":100000},
      {"request_item_id":"<item2>","approved_quantity":0,"approved_amount":0}]'::jsonb,
    'Approved within ceiling', NULL, '<signature hash>');

-- Escalate to the next stage
SELECT fn_record_action(
    '<request_id>', '<actor_id>', 'ESCALATE',
    NULL, 'Grant budget unavailable', NULL, '<signature hash>');
```

It refuses to act when the actor is not staffed at the request's current stage,
when a rejection carries no reason, when a partial approval names no items, when
the final authority tries to escalate, or when the request is already closed.

`item_status` is derived, not supplied: zero approved quantity is `REJECTED`,
the full requested quantity is `APPROVED`, anything between is
`PARTIALLY_APPROVED`.

## Row-Level Security

Policies are active on `requests`, `request_items`, `approval_actions`,
`comments`, `notifications`, `attachments`, `issues` and `audit_logs`.

The application must connect as `app_user` — **not** `postgres`, which is a
superuser and bypasses RLS entirely — and identify the caller per transaction:

```sql
SET LOCAL app.user_id = '<authenticated user uuid>';
```

Use `SET LOCAL`, never plain `SET`: the value must not survive into the next
request that reuses a pooled connection. With no `app.user_id` set, every policy
evaluates to false and queries return zero rows — it fails closed.

Give the role a login before deploying:

```sql
ALTER ROLE app_user LOGIN PASSWORD '<choose one>';
```

## Seed data

`seed/01` and `seed/02` are reference and sample master data, safe anywhere.

**`seed/03_users_and_approvers.sql` is development only.** It creates eleven
working accounts sharing the password `ChangeMe#2026` and staffs every workflow
stage. Skip it on the college server, or reset every password immediately after
loading — without stage staffing, though, no one can approve anything, so some
equivalent seeding is required for the workflow to function.

## Migrations

`db/schema/` builds from nothing and is safe to edit **until the first real
deployment**. After that, schema changes go in `db/migrations/` — see the README
there.

## Design rules baked in

- **Financial year only** — no academic year anywhere.
- **`request_items.requested_quantity > 0`** enforced by CHECK.
- **`budget_heads.head_type`** (`REVENUE | CAPITAL`).
- **`budget_items.item_type`** (`CONSUMABLE | CAPITAL | REVENUE`).
- **Item-level and quantity-level partial approval** — originals never overwritten; approved quantity / amount clamped to requested.
- **Multi-approver stages** — `stage_approvers` is many-to-many.
- **Amount-based routing** — `stage_routing_rules` picks the entry stage.
- **Hierarchical comment visibility** — `visibility` column on `comments`.
- **File payloads live in object storage**; DB stores metadata only in `attachments`.
