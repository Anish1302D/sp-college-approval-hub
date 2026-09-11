import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth.js';
import { queryAll, withUser } from '../db.js';
import { notFound } from '../errors.js';
import { flag, intId, pagination, param } from '../validate.js';

// Dashboards, reports, exports, the audit log and notifications. All request
// figures come through security_invoker views, so every number is scoped to
// what the caller is allowed to see — the Principal's dashboard covers the
// college, a requester's covers their own requests.
export const reportsRouter = Router();

/** The requested financial year, or the active one when none is given. */
async function financialYear(db, financialYearId) {
  const { rows } = await db.query(
    `SELECT financial_year_id AS id, label FROM financial_years
      WHERE CASE WHEN $1::int IS NULL THEN is_active ELSE financial_year_id = $1 END`,
    [financialYearId ?? null],
  );
  return rows[0] ?? { id: null, label: null };
}

const pendingRow = (r) => ({
  id: r.request_id,
  requestNumber: r.request_number,
  title: r.title,
  raisedBy: { id: r.raised_by, name: r.raised_by_name },
  status: r.current_status,
  stage: r.current_stage_code ? { code: r.current_stage_code, name: r.current_stage_name } : null,
  tentativeTotalCost: r.tentative_total_cost,
  daysPending: r.days_pending,
  submittedAt: r.submitted_at,
});

reportsRouter.get('/dashboard', async (req, res) => {
  const { financialYearId } = z.object({ financialYearId: intId.optional() }).parse(req.query);

  const body = await withUser(req.user.id, async (db) => {
    const year = await financialYear(db, financialYearId);
    const fy = year.id;
    const [counts, attention, awaiting, recent, higher] = await queryAll(db, [
      ['SELECT * FROM v_dashboard_by_fy WHERE financial_year_id = $1', [fy]],
      [`SELECT count(*)::int AS n FROM v_pending_gt_3_days
         WHERE financial_year_id = $1 AND current_status <> 'DRAFT'`, [fy]],
      [`SELECT count(*)::int AS n FROM requests r
         WHERE left(r.current_status::text, 6) = 'UNDER_'
           AND EXISTS (SELECT 1 FROM stage_approvers sa
                        WHERE sa.stage_id = r.current_stage_id AND sa.user_id = $1)`, [req.user.id]],
      [`SELECT r.request_id, r.request_number, r.title, r.current_status, r.updated_at,
               ws.name AS stage_name
          FROM requests r LEFT JOIN workflow_stages ws ON ws.stage_id = r.current_stage_id
         WHERE r.financial_year_id = $1
         ORDER BY r.updated_at DESC LIMIT 5`, [fy]],
      // The view's "escalated" counts a status the workflow never sets; what
      // people mean by escalated is "with CDC or the final authority".
      [`SELECT count(*)::int AS n FROM requests r
         WHERE r.financial_year_id = $1
           AND r.current_status IN ('UNDER_CDC_REVIEW', 'UNDER_FINAL_AUTHORITY_REVIEW')`, [fy]],
    ]);
    const c = counts.rows[0] ?? {};
    return {
      financialYearId: fy,
      financialYear: year.label,
      counts: {
        total: c.total ?? 0,
        pending: c.pending ?? 0,
        approved: c.approved ?? 0,
        partiallyApproved: c.partial ?? 0,
        rejected: c.rejected ?? 0,
        withHigherAuthority: higher.rows[0].n,
        inFulfilment: c.fulfilment ?? 0,
        carriedForward: c.carried_forward ?? 0,
      },
      // "3 requests have been pending for more than 3 days" (design doc §16).
      attention: { pendingOverThreeDays: attention.rows[0].n },
      awaitingMyDecision: awaiting.rows[0].n,
      recent: recent.rows.map((r) => ({
        id: r.request_id,
        requestNumber: r.request_number,
        title: r.title,
        status: r.current_status,
        stageName: r.stage_name,
        updatedAt: r.updated_at,
      })),
    };
  });

  res.json(body);
});

// Where the money went, by budget head, for the reports page. Scoped like
// everything else: the Principal sees the college, a requester their own.
const DECIDED_FOR = ['APPROVED', 'PARTIALLY_APPROVED', 'FULFILMENT_PENDING', 'FULFILLED', 'CLOSED'];

reportsRouter.get('/reports/by-budget-head', async (req, res) => {
  const { financialYearId } = z.object({ financialYearId: intId.optional() }).parse(req.query);
  const body = await withUser(req.user.id, async (db) => {
    const year = await financialYear(db, financialYearId);
    const { rows } = await db.query(
      `SELECT bh.budget_head_id, bh.name, bh.head_type,
              count(*)::int AS requests,
              count(*) FILTER (WHERE r.current_status::text = ANY($2::text[]))::int AS approved,
              count(*) FILTER (WHERE r.current_status = 'REJECTED')::int AS rejected,
              COALESCE(sum(r.tentative_total_cost), 0) AS requested,
              COALESCE(sum(r.sanctioned_amount) FILTER (WHERE r.current_status::text = ANY($2::text[])), 0) AS sanctioned
         FROM requests r
         JOIN budget_heads bh ON bh.budget_head_id = r.budget_head_id
        WHERE r.current_status <> 'DRAFT' AND r.financial_year_id = $1
        GROUP BY bh.budget_head_id, bh.name, bh.head_type
        ORDER BY requested DESC, bh.name`,
      [year.id, DECIDED_FOR],
    );
    return {
      financialYear: year.label,
      rows: rows.map((r) => ({
        budgetHead: { id: r.budget_head_id, name: r.name, headType: r.head_type },
        requests: r.requests,
        approved: r.approved,
        rejected: r.rejected,
        requested: r.requested,
        sanctioned: r.sanctioned,
      })),
    };
  });
  res.json(body);
});

// The attention panel's target: opens straight onto the stale requests rather
// than the whole list.
reportsRouter.get('/reports/pending', async (req, res) => {
  const f = z.object({
    minDays: z.coerce.number().int().min(0).max(365).default(3),
    financialYearId: intId.optional(),
  }).parse(req.query);
  const rows = await withUser(req.user.id, async (db) => (await db.query(
    `SELECT * FROM v_pending_requests
      WHERE days_pending > $1 AND current_status <> 'DRAFT'
        AND ($2::int IS NULL OR financial_year_id = $2)
      ORDER BY days_pending DESC, request_number`,
    [f.minDays, f.financialYearId ?? null],
  )).rows);
  res.json(rows.map(pendingRow));
});

// A leading = + - @ (or tab / carriage return) makes spreadsheet software
// treat a cell as a formula. A request title of =HYPERLINK(...) would
// otherwise execute when the Principal opens the export in Excel.
function csvCell(value) {
  if (value === null || value === undefined) return '';
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

reportsRouter.get('/exports/requests.csv', async (req, res) => {
  const f = z.object({
    financialYearId: intId.optional(),
    status: z.string().max(400).optional(),
  }).parse(req.query);
  const statuses = f.status ? f.status.split(',').map((s) => s.trim().toUpperCase()) : null;

  const rows = await withUser(req.user.id, async (db) => (await db.query(
    `SELECT r.request_number, r.title, r.current_status, ws.name AS stage, fy.label AS financial_year,
            bh.name AS budget_head, bh.head_type, u.full_name AS raised_by,
            r.tentative_total_cost, r.sanctioned_amount, r.created_at, r.submitted_at, r.closed_at
       FROM requests r
       JOIN users u            ON u.user_id = r.raised_by
       JOIN budget_heads bh    ON bh.budget_head_id = r.budget_head_id
       JOIN financial_years fy ON fy.financial_year_id = r.financial_year_id
       LEFT JOIN workflow_stages ws ON ws.stage_id = r.current_stage_id
      WHERE ($1::int IS NULL OR r.financial_year_id = $1)
        AND ($2::text[] IS NULL OR r.current_status::text = ANY($2))
      ORDER BY r.created_at`,
    [f.financialYearId ?? null, statuses],
  )).rows);

  const header = ['Request number', 'Title', 'Status', 'Stage', 'Financial year', 'Budget head',
    'Head type', 'Raised by', 'Requested', 'Sanctioned', 'Created', 'Submitted', 'Closed'];
  const lines = [header, ...rows.map((r) => [
    r.request_number, r.title, r.current_status, r.stage, r.financial_year, r.budget_head,
    r.head_type, r.raised_by, r.tentative_total_cost, r.sanctioned_amount,
    r.created_at, r.submitted_at, r.closed_at,
  ])].map((cells) => cells.map(csvCell).join(','));

  res.type('text/csv; charset=utf-8');
  res.attachment(`requests-${new Date().toISOString().slice(0, 10)}.csv`);
  // Byte-order mark so Excel reads the ₹ and Devanagari names as UTF-8.
  res.send(String.fromCharCode(0xfeff) + lines.join('\r\n') + '\r\n');
});

reportsRouter.get('/audit', requireRole('ADMIN'), async (req, res) => {
  const f = z.object({
    entityType: z.string().trim().max(50).optional(),
    entityId: z.string().trim().max(100).optional(),
    ...pagination,
  }).parse(req.query);
  const rows = await withUser(req.user.id, async (db) => (await db.query(
    `SELECT al.*, u.full_name AS actor_name, count(*) OVER () AS total_count
       FROM audit_logs al LEFT JOIN users u ON u.user_id = al.actor_user_id
      WHERE ($1::text IS NULL OR al.entity_type = $1)
        AND ($2::text IS NULL OR al.entity_id = $2)
      ORDER BY al.created_at DESC, al.audit_id DESC
      LIMIT $3 OFFSET $4`,
    [f.entityType ?? null, f.entityId ?? null, f.limit, f.offset],
  )).rows);
  res.json({
    items: rows.map((r) => ({
      id: r.audit_id,
      at: r.created_at,
      entityType: r.entity_type,
      entityId: r.entity_id,
      action: r.action,
      actor: r.actor_user_id ? { id: r.actor_user_id, name: r.actor_name } : null,
      before: r.before_json,
      after: r.after_json,
    })),
    total: rows[0]?.total_count ?? 0,
    limit: f.limit,
    offset: f.offset,
  });
});

// ---------------------------------------------------------------------------
// Notifications — RLS limits every query to the caller's own.
// ---------------------------------------------------------------------------

reportsRouter.get('/notifications', async (req, res) => {
  const f = z.object({ unread: flag, ...pagination }).parse(req.query);
  const { rows, unread } = await withUser(req.user.id, async (db) => {
    const [list, count] = await queryAll(db, [
      [`SELECT n.*, r.request_number, i.issue_number, count(*) OVER () AS total_count
          FROM notifications n
          LEFT JOIN requests r ON r.request_id = n.request_id
          LEFT JOIN issues   i ON i.issue_id   = n.issue_id
         WHERE NOT $1 OR n.read_at IS NULL
         ORDER BY n.created_at DESC, n.notification_id
         LIMIT $2 OFFSET $3`, [f.unread ?? false, f.limit, f.offset]],
      ['SELECT count(*)::int AS n FROM notifications WHERE read_at IS NULL', []],
    ]);
    return { rows: list.rows, unread: count.rows[0].n };
  });
  res.json({
    items: rows.map((n) => ({
      id: n.notification_id,
      subject: n.subject,
      body: n.body,
      request: n.request_id ? { id: n.request_id, requestNumber: n.request_number } : null,
      issue: n.issue_id ? { id: n.issue_id, issueNumber: n.issue_number } : null,
      read: n.read_at !== null,
      createdAt: n.created_at,
    })),
    unread,
    total: rows[0]?.total_count ?? 0,
    limit: f.limit,
    offset: f.offset,
  });
});

reportsRouter.post('/notifications/:id/read', async (req, res) => {
  const notificationId = param(req, 'id');
  const { rowCount } = await withUser(req.user.id, (db) => db.query(
    `UPDATE notifications SET read_at = COALESCE(read_at, NOW()), status = 'READ'
      WHERE notification_id = $1`,
    [notificationId],
  ));
  if (!rowCount) throw notFound('Notification not found');
  res.status(204).end();
});

reportsRouter.post('/notifications/read-all', async (req, res) => {
  const { rowCount } = await withUser(req.user.id, (db) => db.query(
    "UPDATE notifications SET read_at = NOW(), status = 'READ' WHERE read_at IS NULL"));
  res.json({ marked: rowCount });
});
