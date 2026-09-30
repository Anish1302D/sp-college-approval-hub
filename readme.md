# S.P. College Approval and Workflow Management System

A working system for the college's procurement approvals and faculty issues:
a PostgreSQL database that holds the workflow rules, a REST API over it, and a
React interface.

A request lists the items it needs. Every request, whatever its size, is first
checked for completeness by the Purchase Committee and then seen by the
Principal. Who decides the money depends on the amount: the Principal up to
₹50,000, both CDC members up to ₹5 lakh, and the Chairman and Vice Chairman
together above that. Any stage can approve part of a request, and the Purchase
Committee or the Principal can send it back to the requester for correction.

Nothing an approver does overwrites what was asked for: requested, approved and
unapproved figures all stay on the record, a corrected request keeps its number
and every earlier version, and a replaced document is superseded rather than
deleted.

## Layout

```
db/       PostgreSQL: schema, seed data, migrations, tests   → db/README.md
server/   REST API (Node, Express, no ORM)                   → server/README.md
src/      React interface (Vite, Tailwind)
docs/     Design references: schema diagrams, backend and mail plans
```

## Running it

Three parts, in this order. Full detail in the READMEs above.

1. **Database** — Docker is easiest:

   ```bash
   cd db && docker compose up -d
   ```

   Then give the application role a password (the API refuses to connect as a
   superuser, which would bypass every access rule):

   ```sql
   ALTER ROLE app_user LOGIN PASSWORD '<choose one>';
   ```

2. **API** — copy `server/.env.example` to `server/.env`, fill in the database
   URL and secrets, then:

   ```bash
   cd server && npm install && npm run dev
   ```

3. **Interface**:

   ```bash
   npm install && npm run dev
   ```

   Open http://localhost:3000. In development the page proxies `/api` to the
   API, so both run as one site, exactly as they will behind IIS or nginx.

Development sign-ins come from `db/seed/03_users_and_approvers.sql` — the login
page lists them in development builds only. **That seed file is not for the
college server**: it creates accounts that all share one password.

## Tests

```bash
cd server && npm test                                    # 133 API tests
psql -U postgres -d spc_approval -f db/tests/rls_app_user.sql   # 52 access checks
```

The access checks run as `app_user`, the same role the API uses. Running them
as a superuser proves nothing — superusers bypass the rules being tested.

`db/schema/` and `db/migrations/` must end at the same database. After changing
either, prove it: build one from the schema files, replay the migrations over
it, and compare (`db/migrations/README.md`).

## What is not built yet

- **The fulfilment and closing steps** after a request is approved.
- **Reports as true PDF or .docx files.** The report prints to PDF from the
  browser and opens in Word; generating the binary formats server-side would
  mean adding a rendering library.
- **Deployment** to the college server.
