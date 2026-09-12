# S.P. College Approval and Workflow Management System

A working system for the college's procurement approvals and faculty issues:
a PostgreSQL database that holds the workflow rules, a REST API over it, and a
React interface.

A request lists the items it needs. It enters the approval chain at the stage
its amount belongs to, and each stage can approve it, approve part of it,
reject it or send it higher — up to the Chairman and Vice President, whose
decision is final. Nothing an approver does overwrites what was asked for, so
requested, approved and unapproved figures all stay on the record.

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
cd server && npm test                                    # 76 API tests
psql -U postgres -d spc_approval -f db/tests/rls_app_user.sql   # 45 access checks
```

The access checks run as `app_user`, the same role the API uses. Running them
as a superuser proves nothing — superusers bypass the rules being tested.

## What is not built yet

- **Email.** Notifications appear in the app; sending them is planned in
  `docs/ApprovalHub_Mail_Plan.html`.
- **Returning a request for correction**, and the fulfilment and closing steps.
- **Deployment** to the college server.
