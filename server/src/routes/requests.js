import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth.js';
import { queryAll, withUser } from '../db.js';
import { conflict, forbidden, notFound, unprocessable } from '../errors.js';
import { REQUESTER_ROLES } from '../roles.js';
import { seal, verifySeal } from '../signing.js';
import { removeFile } from '../storage.js';
import {
  amount, approvedQuantity, flag, id, intId, pagination, param, quantity,
} from '../validate.js';

export const requestsRouter = Router();

const STATUSES = [
  'DRAFT', 'SUBMITTED', 'UNDER_PURCHASE_COMMITTEE_REVIEW', 'UNDER_PRINCIPAL_REVIEW',
  'UNDER_CDC_REVIEW', 'UNDER_FINAL_AUTHORITY_REVIEW', 'APPROVED', 'PARTIALLY_APPROVED',
  'REJECTED', 'ESCALATED', 'FULFILMENT_PENDING', 'FULFILLED', 'CLOSED', 'CARRIED_FORWARD',
];
const NOT_CARRYABLE = ['REJECTED', 'CLOSED', 'FULFILLED', 'CARRIED_FORWARD'];
const ATTACH_CLOSED = ['CLOSED', 'CARRIED_FORWARD'];
const isUnderReview = (status) => status.startsWith('UNDER_');

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

const summaryRow = (r) => ({
  id: r.request_id,
  requestNumber: r.request_number,
  title: r.title,
  status: r.current_status,
  stage: r.stage_code ? { code: r.stage_code, name: r.stage_name } : null,
  budgetHead: { id: r.budget_head_id, name: r.budget_head_name, headType: r.head_type },
  financialYear: r.financial_year,
  raisedBy: { id: r.raised_by, name: r.raised_by_name },
  tentativeTotalCost: r.tentative_total_cost,
  sanctionedAmount: r.sanctioned_amount,
  itemCount: r.item_count,
  daysOpen: r.days_open,
  createdAt: r.created_at,
  submittedAt: r.submitted_at,
  updatedAt: r.updated_at,
});

const itemRow = (r) => ({
  id: r.request_item_id,
  budgetItem: { id: r.budget_item_id, code: r.code, name: r.name, unit: r.unit },
  itemType: r.item_type_snapshot,
  requestedQuantity: r.requested_quantity,
  unitCost: r.estimated_unit_cost,
  estimatedTotal: r.estimated_total,
  approvedQuantity: r.approved_quantity,
  approvedAmount: r.approved_amount,
  // Never overwritten, so the shortfall is always recoverable.
  unapprovedQuantity: Math.round((r.requested_quantity - r.approved_quantity) * 100) / 100,
  status: r.item_status,
  remarks: r.remarks,
});

const attachmentRow = (r) => ({
  id: r.attachment_id,
  fileName: r.file_name,
  mimeType: r.mime_type,
  sizeBytes: r.size_bytes,
  uploadedBy: { id: r.uploaded_by, name: r.uploaded_by_name },
  uploadedAt: r.uploaded_at,
});

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

/** Full request as the caller may see it, or null when RLS hides it. */
export async function loadDetail(db, requestId, user) {
  const { rows } = await db.query(
    `SELECT r.*, u.full_name AS raised_by_name,
            bh.code AS budget_head_code, bh.name AS budget_head_name, bh.head_type,
            fy.label AS financial_year, d.name AS department_name, c.name AS course_name,
            ws.code AS stage_code, ws.name AS stage_name, ws.is_final AS stage_is_final,
            src.request_number AS carried_from_number, cfy.label AS carried_from_fy,
            EXISTS (SELECT 1 FROM stage_approvers sa
                     WHERE sa.stage_id = r.current_stage_id AND sa.user_id = $2) AS staffed_here
       FROM requests r
       JOIN users u            ON u.user_id = r.raised_by
       JOIN budget_heads bh    ON bh.budget_head_id = r.budget_head_id
       JOIN financial_years fy ON fy.financial_year_id = r.financial_year_id
       LEFT JOIN departments d ON d.department_id = r.department_id
       LEFT JOIN courses c     ON c.course_id = r.course_id
       LEFT JOIN workflow_stages ws  ON ws.stage_id = r.current_stage_id
       LEFT JOIN requests src        ON src.request_id = r.carried_forward_from_request_id
       LEFT JOIN financial_years cfy ON cfy.financial_year_id = r.carried_forward_from_fy_id
      WHERE r.request_id = $1`,
    [requestId, user.id],
  );
  const r = rows[0];
  if (!r) return null;

  const [items, attachments] = await queryAll(db, [
    [`SELECT ri.*, bi.code, bi.name, bi.unit
        FROM request_items ri JOIN budget_items bi ON bi.budget_item_id = ri.budget_item_id
       WHERE ri.request_id = $1 ORDER BY bi.name, ri.request_item_id`, [requestId]],
    [`SELECT a.*, u.full_name AS uploaded_by_name
        FROM attachments a JOIN users u ON u.user_id = a.uploaded_by
       WHERE a.request_id = $1 ORDER BY a.uploaded_at`, [requestId]],
  ]);

  const isOwner = r.raised_by === user.id;
  const isAdmin = user.roles.includes('ADMIN');
  const canEdit = r.current_status === 'DRAFT' && (isOwner || isAdmin);
  const canAct = r.staffed_here && isUnderReview(r.current_status);

  return {
    id: r.request_id,
    requestNumber: r.request_number,
    title: r.title,
    description: r.description,
    status: r.current_status,
    stage: r.stage_code
      ? { id: r.current_stage_id, code: r.stage_code, name: r.stage_name, isFinal: r.stage_is_final }
      : null,
    budgetHead: { id: r.budget_head_id, code: r.budget_head_code, name: r.budget_head_name, headType: r.head_type },
    financialYear: { id: r.financial_year_id, label: r.financial_year },
    department: r.department_id ? { id: r.department_id, name: r.department_name } : null,
    course: r.course_id ? { id: r.course_id, name: r.course_name } : null,
    raisedBy: { id: r.raised_by, name: r.raised_by_name },
    tentativeTotalCost: r.tentative_total_cost,
    sanctionedAmount: r.sanctioned_amount,
    extra: r.extra,
    carriedForwardFrom: r.carried_forward_from_request_id
      ? { requestId: r.carried_forward_from_request_id, requestNumber: r.carried_from_number,
          financialYear: r.carried_from_fy }
      : null,
    items: items.rows.map(itemRow),
    attachments: attachments.rows.map(attachmentRow),
    createdAt: r.created_at,
    submittedAt: r.submitted_at,
    updatedAt: r.updated_at,
    closedAt: r.closed_at,
    // What the UI may offer. Every one is enforced again when attempted.
    permissions: {
      canEdit,
      canSubmit: canEdit && items.rowCount > 0,
      canAct,
      actions: canAct
        ? ['APPROVE', 'PARTIAL_APPROVE', 'REJECT', ...(r.stage_is_final ? [] : ['ESCALATE'])]
        : [],
      canAttach: !ATTACH_CLOSED.includes(r.current_status) && (isOwner || isAdmin || r.staffed_here),
      canCarryForward: (isOwner || isAdmin) && !NOT_CARRYABLE.includes(r.current_status),
    },
  };
}

async function requireDetail(db, requestId, user) {
  const detail = await loadDetail(db, requestId, user);
  if (!detail) throw notFound('Request not found');
  return detail;
}

/** A draft the caller may change, locked for the rest of the transaction. */
async function lockEditableDraft(db, requestId, user) {
  const { rows } = await db.query(
    'SELECT request_id, raised_by, current_status, budget_head_id FROM requests WHERE request_id = $1',
    [requestId],
  );
  const r = rows[0];
  if (!r) throw notFound('Request not found');
  if (r.raised_by !== user.id && !user.roles.includes('ADMIN')) {
    throw forbidden('Only the person who raised this request can change it');
  }
  if (r.current_status !== 'DRAFT') {
    throw conflict('Only draft requests can be changed; this one has been submitted');
  }
  await db.query('SELECT 1 FROM requests WHERE request_id = $1 FOR UPDATE', [requestId]);
  return r;
}

// ---------------------------------------------------------------------------
// Items: validation and totals
// ---------------------------------------------------------------------------

const itemInput = z.object({
  budgetItemId: intId,
  quantity,
  unitCost: amount,
  remarks: z.string().trim().max(1000).optional(),
});

/** Items must belong to the request's budget head, once each. */
async function checkItems(db, budgetHeadId, budgetItemIds, alreadyOnRequest = []) {
  const all = [...alreadyOnRequest, ...budgetItemIds];
  if (new Set(all).size !== all.length) {
    throw unprocessable('Each budget item may appear only once on a request');
  }
  if (!budgetItemIds.length) return;
  const { rows } = await db.query(
    `SELECT budget_item_id FROM budget_items
      WHERE budget_item_id = ANY($1::int[]) AND budget_head_id = $2 AND is_active`,
    [budgetItemIds, budgetHeadId],
  );
  if (rows.length !== budgetItemIds.length) {
    const found = new Set(rows.map((row) => row.budget_item_id));
    throw unprocessable('Items must belong to the request\'s budget head', {
      budgetItemIds: budgetItemIds.filter((itemId) => !found.has(itemId)),
    });
  }
}

async function insertItems(db, requestId, items) {
  if (!items.length) return;
  // The line total is computed in SQL: NUMERIC multiplication is exact,
  // JavaScript's floating point is not.
  await db.query(
    `INSERT INTO request_items (request_id, budget_item_id, item_type_snapshot,
                                requested_quantity, estimated_unit_cost, estimated_total, remarks)
     SELECT $1, bi.budget_item_id, bi.item_type, x.qty, x.cost, round(x.qty * x.cost, 2), x.remarks
       FROM unnest($2::int[], $3::numeric[], $4::numeric[], $5::text[]) AS x(item_id, qty, cost, remarks)
       JOIN budget_items bi ON bi.budget_item_id = x.item_id`,
    [
      requestId,
      items.map((i) => i.budgetItemId),
      items.map((i) => i.quantity),
      items.map((i) => i.unitCost),
      items.map((i) => i.remarks ?? null),
    ],
  );
}

/** The request total is always the sum of its lines, never typed in. */
function recalcTotal(db, requestId) {
  return db.query(
    `UPDATE requests
        SET tentative_total_cost = COALESCE(
              (SELECT SUM(estimated_total) FROM request_items WHERE request_id = $1), 0)
      WHERE request_id = $1`,
    [requestId],
  );
}

async function checkPlacement(db, { departmentId, courseId }) {
  if (courseId == null) return;
  const { rows } = await db.query('SELECT department_id FROM courses WHERE course_id = $1', [courseId]);
  if (!rows[0]) throw unprocessable('Course not found');
  if (departmentId != null && rows[0].department_id !== departmentId) {
    throw unprocessable('That course belongs to a different department');
  }
}

// ---------------------------------------------------------------------------
// Routes: list, create, read, update, delete
// ---------------------------------------------------------------------------

const listQuery = z.object({
  status: z
    .string()
    .optional()
    .transform((value) => (value ? value.split(',').map((s) => s.trim().toUpperCase()) : null))
    .pipe(z.array(z.enum(STATUSES)).nullable()),
  financialYearId: intId.optional(),
  stage: z.enum(['PURCHASE_COMMITTEE', 'PRINCIPAL', 'CDC', 'FINAL_AUTHORITY']).optional(),
  mine: flag,
  awaitingMe: flag,
  q: z.string().trim().max(100).optional(),
  ...pagination,
});

requestsRouter.get('/', async (req, res) => {
  const f = listQuery.parse(req.query);
  // Wildcards in the search text are matched literally.
  const q = f.q ? `%${f.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;

  const rows = await withUser(req.user.id, async (db) => (await db.query(
    `SELECT r.request_id, r.request_number, r.title, r.current_status,
            r.tentative_total_cost, r.sanctioned_amount, r.created_at, r.submitted_at, r.updated_at,
            r.raised_by, u.full_name AS raised_by_name,
            r.budget_head_id, bh.name AS budget_head_name, bh.head_type,
            fy.label AS financial_year, ws.code AS stage_code, ws.name AS stage_name,
            (SELECT count(*) FROM request_items ri WHERE ri.request_id = r.request_id)::int AS item_count,
            EXTRACT(DAY FROM NOW() - COALESCE(r.submitted_at, r.created_at))::int AS days_open,
            count(*) OVER () AS total_count
       FROM requests r
       JOIN users u            ON u.user_id = r.raised_by
       JOIN budget_heads bh    ON bh.budget_head_id = r.budget_head_id
       JOIN financial_years fy ON fy.financial_year_id = r.financial_year_id
       LEFT JOIN workflow_stages ws ON ws.stage_id = r.current_stage_id
      WHERE ($1::request_status[] IS NULL OR r.current_status = ANY($1))
        AND ($2::int  IS NULL OR r.financial_year_id = $2)
        AND ($3::text IS NULL OR ws.code::text = $3)
        AND (NOT $4 OR r.raised_by = $6)
        AND (NOT $5 OR (left(r.current_status::text, 6) = 'UNDER_' AND EXISTS (
               SELECT 1 FROM stage_approvers sa
                WHERE sa.stage_id = r.current_stage_id AND sa.user_id = $6)))
        AND ($7::text IS NULL OR r.title ILIKE $7 OR r.request_number ILIKE $7)
      ORDER BY r.updated_at DESC, r.request_id
      LIMIT $8 OFFSET $9`,
    [f.status, f.financialYearId ?? null, f.stage ?? null, f.mine ?? false,
      f.awaitingMe ?? false, req.user.id, q, f.limit, f.offset],
  )).rows);

  res.json({
    items: rows.map(summaryRow),
    total: rows[0]?.total_count ?? 0,
    limit: f.limit,
    offset: f.offset,
  });
});

const createSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(5000).optional(),
  budgetHeadId: intId,
  financialYearId: intId.optional(),
  departmentId: intId.nullable().optional(),
  courseId: intId.nullable().optional(),
  extra: z.record(z.string(), z.unknown()).optional(),
  items: z.array(itemInput).max(50).default([]),
});

requestsRouter.post('/', requireRole(...REQUESTER_ROLES), async (req, res) => {
  const body = createSchema.parse(req.body);

  const detail = await withUser(req.user.id, async (db) => {
    const head = await db.query(
      'SELECT 1 FROM budget_heads WHERE budget_head_id = $1 AND is_active', [body.budgetHeadId]);
    if (!head.rowCount) throw unprocessable('Budget head not found');
    await checkItems(db, body.budgetHeadId, body.items.map((i) => i.budgetItemId));
    await checkPlacement(db, body);

    const { rows } = await db.query(
      `INSERT INTO requests (raised_by, financial_year_id, budget_head_id, department_id, course_id,
                             title, description, extra, tentative_total_cost)
       VALUES ($1,
               COALESCE($2, (SELECT financial_year_id FROM financial_years WHERE is_active)),
               $3, $4, $5, $6, $7, $8, 0)
       RETURNING request_id`,
      [req.user.id, body.financialYearId ?? null, body.budgetHeadId, body.departmentId ?? null,
        body.courseId ?? null, body.title, body.description ?? null, body.extra ?? {}],
    );
    const requestId = rows[0].request_id;
    await insertItems(db, requestId, body.items);
    await recalcTotal(db, requestId);
    return requireDetail(db, requestId, req.user);
  });

  res.status(201).location(`/api/requests/${detail.id}`).json(detail);
});

requestsRouter.get('/:id', async (req, res) => {
  const requestId = param(req, 'id');
  res.json(await withUser(req.user.id, (db) => requireDetail(db, requestId, req.user)));
});

const updateSchema = createSchema.omit({ items: true }).partial();

requestsRouter.patch('/:id', async (req, res) => {
  const requestId = param(req, 'id');
  const body = updateSchema.parse(req.body);

  const detail = await withUser(req.user.id, async (db) => {
    const current = await lockEditableDraft(db, requestId, req.user);

    if (body.budgetHeadId !== undefined && body.budgetHeadId !== current.budget_head_id) {
      const { rows } = await db.query(
        'SELECT budget_item_id FROM request_items WHERE request_id = $1', [requestId]);
      await checkItems(db, body.budgetHeadId, rows.map((r) => r.budget_item_id));
    }
    await checkPlacement(db, body);

    const columns = {
      title: 'title', description: 'description', budgetHeadId: 'budget_head_id',
      financialYearId: 'financial_year_id', departmentId: 'department_id',
      courseId: 'course_id', extra: 'extra',
    };
    const sets = [];
    const values = [];
    for (const [key, column] of Object.entries(columns)) {
      if (body[key] !== undefined) {
        values.push(body[key]);
        sets.push(`${column} = $${values.length}`);
      }
    }
    if (sets.length) {
      values.push(requestId);
      await db.query(`UPDATE requests SET ${sets.join(', ')} WHERE request_id = $${values.length}`, values);
    }
    return requireDetail(db, requestId, req.user);
  });

  res.json(detail);
});

requestsRouter.delete('/:id', async (req, res) => {
  const requestId = param(req, 'id');
  const files = await withUser(req.user.id, async (db) => {
    await lockEditableDraft(db, requestId, req.user);
    const { rows } = await db.query(
      'SELECT storage_path FROM attachments WHERE request_id = $1', [requestId]);
    await db.query('DELETE FROM requests WHERE request_id = $1', [requestId]);
    return rows.map((r) => r.storage_path);
  });
  // Files go only after the delete has committed; a rollback must not leave
  // rows pointing at files that no longer exist.
  await Promise.all(files.map(removeFile));
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// Routes: line items on a draft
// ---------------------------------------------------------------------------

requestsRouter.post('/:id/items', async (req, res) => {
  const requestId = param(req, 'id');
  const item = itemInput.parse(req.body);

  const detail = await withUser(req.user.id, async (db) => {
    const current = await lockEditableDraft(db, requestId, req.user);
    const { rows } = await db.query(
      'SELECT budget_item_id FROM request_items WHERE request_id = $1', [requestId]);
    await checkItems(db, current.budget_head_id, [item.budgetItemId], rows.map((r) => r.budget_item_id));
    await insertItems(db, requestId, [item]);
    await recalcTotal(db, requestId);
    return requireDetail(db, requestId, req.user);
  });

  res.status(201).json(detail);
});

const itemUpdate = z
  .object({ quantity: quantity.optional(), unitCost: amount.optional(),
            remarks: z.string().trim().max(1000).nullable().optional() })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

requestsRouter.patch('/:id/items/:itemId', async (req, res) => {
  const requestId = param(req, 'id');
  const itemId = param(req, 'itemId');
  const body = itemUpdate.parse(req.body);

  const detail = await withUser(req.user.id, async (db) => {
    await lockEditableDraft(db, requestId, req.user);
    const { rowCount } = await db.query(
      `UPDATE request_items
          SET requested_quantity  = COALESCE($3, requested_quantity),
              estimated_unit_cost = COALESCE($4, estimated_unit_cost),
              estimated_total     = round(COALESCE($3, requested_quantity)
                                          * COALESCE($4, estimated_unit_cost), 2),
              remarks = CASE WHEN $5 THEN $6 ELSE remarks END
        WHERE request_item_id = $2 AND request_id = $1`,
      [requestId, itemId, body.quantity ?? null, body.unitCost ?? null,
        body.remarks !== undefined, body.remarks ?? null],
    );
    if (!rowCount) throw notFound('Item not found on this request');
    await recalcTotal(db, requestId);
    return requireDetail(db, requestId, req.user);
  });

  res.json(detail);
});

requestsRouter.delete('/:id/items/:itemId', async (req, res) => {
  const requestId = param(req, 'id');
  const itemId = param(req, 'itemId');

  const detail = await withUser(req.user.id, async (db) => {
    await lockEditableDraft(db, requestId, req.user);
    const { rowCount } = await db.query(
      'DELETE FROM request_items WHERE request_item_id = $2 AND request_id = $1', [requestId, itemId]);
    if (!rowCount) throw notFound('Item not found on this request');
    await recalcTotal(db, requestId);
    return requireDetail(db, requestId, req.user);
  });

  res.json(detail);
});

// ---------------------------------------------------------------------------
// Routes: workflow
// ---------------------------------------------------------------------------

requestsRouter.post('/:id/submit', async (req, res) => {
  const requestId = param(req, 'id');

  const detail = await withUser(req.user.id, async (db) => {
    await lockEditableDraft(db, requestId, req.user);
    const { rows } = await db.query(
      'SELECT count(*)::int AS n FROM request_items WHERE request_id = $1', [requestId]);
    if (rows[0].n === 0) throw unprocessable('Add at least one item before submitting');
    await recalcTotal(db, requestId);
    await db.query('SELECT fn_submit_request($1)', [requestId]);
    return requireDetail(db, requestId, req.user);
  });

  res.json(detail);
});

const note = z.string().trim().max(2000).optional()
  .transform((value) => value || null);

const decisionInput = z.object({
  requestItemId: id,
  approvedQuantity,
  approvedAmount: amount.optional(),
  remarks: z.string().trim().max(1000).optional(),
});

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('APPROVE'), comments: note }),
  z.object({ action: z.literal('PARTIAL_APPROVE'), comments: note,
             itemDecisions: z.array(decisionInput).min(1).max(50) }),
  z.object({ action: z.literal('REJECT'), comments: note,
             rejectionReason: z.string().trim().min(3).max(2000) }),
  z.object({ action: z.literal('ESCALATE'), comments: note }),
]);

/**
 * The per-item figures a decision will record. Built in SQL so that a
 * defaulted approved amount (quantity x unit cost) is exact.
 */
async function buildDecisions(db, requestId, body) {
  const { rows: items } = await db.query(
    `SELECT request_item_id, requested_quantity, estimated_unit_cost, estimated_total
       FROM request_items WHERE request_id = $1`,
    [requestId],
  );

  if (body.action === 'APPROVE') {
    return items.map((i) => ({
      requestItemId: i.request_item_id,
      approvedQuantity: i.requested_quantity,
      approvedAmount: i.estimated_total,
      remarks: null,
    }));
  }
  if (body.action !== 'PARTIAL_APPROVE') return [];

  const decisions = body.itemDecisions.map((d) => ({ ...d, requestItemId: d.requestItemId.toLowerCase() }));
  const byId = new Map(items.map((i) => [i.request_item_id, i]));

  const unknown = decisions.filter((d) => !byId.has(d.requestItemId)).map((d) => d.requestItemId);
  if (unknown.length) {
    throw unprocessable('The decision refers to items that are not on this request', { requestItemIds: unknown });
  }
  if (new Set(decisions.map((d) => d.requestItemId)).size !== decisions.length) {
    throw unprocessable('Each item may be decided only once');
  }
  // Every line must be decided. Leaving some untouched would leave them
  // pending under a decision that reads as final.
  const missing = items.filter((i) => !decisions.some((d) => d.requestItemId === i.request_item_id));
  if (missing.length) {
    throw unprocessable('A partial approval must decide every item on the request', {
      requestItemIds: missing.map((i) => i.request_item_id),
    });
  }

  for (const d of decisions) {
    const item = byId.get(d.requestItemId);
    if (d.approvedQuantity > item.requested_quantity) {
      throw unprocessable('Approved quantity cannot exceed the requested quantity', { requestItemId: d.requestItemId });
    }
    if (d.approvedAmount !== undefined && d.approvedAmount > item.estimated_total) {
      throw unprocessable('Approved amount cannot exceed the requested amount', { requestItemId: d.requestItemId });
    }
    if (d.approvedQuantity === 0 && d.approvedAmount) {
      throw unprocessable('An item approved at zero quantity cannot carry an amount', { requestItemId: d.requestItemId });
    }
  }

  const { rows } = await db.query(
    `SELECT ri.request_item_id,
            x.qty AS approved_quantity,
            COALESCE(x.amt, round(x.qty * ri.estimated_unit_cost, 2)) AS approved_amount,
            x.remarks
       FROM unnest($2::uuid[], $3::numeric[], $4::numeric[], $5::text[]) AS x(item_id, qty, amt, remarks)
       JOIN request_items ri ON ri.request_item_id = x.item_id AND ri.request_id = $1`,
    [
      requestId,
      decisions.map((d) => d.requestItemId),
      decisions.map((d) => d.approvedQuantity),
      decisions.map((d) => d.approvedAmount ?? null),
      decisions.map((d) => d.remarks || null),
    ],
  );
  return rows.map((r) => ({
    requestItemId: r.request_item_id,
    approvedQuantity: r.approved_quantity,
    approvedAmount: r.approved_amount,
    remarks: r.remarks,
  }));
}

requestsRouter.post('/:id/actions', async (req, res) => {
  const requestId = param(req, 'id');
  const body = actionSchema.parse(req.body);

  const result = await withUser(req.user.id, async (db) => {
    const visible = await db.query('SELECT 1 FROM requests WHERE request_id = $1', [requestId]);
    if (!visible.rowCount) throw notFound('Request not found');

    const decisions = await buildDecisions(db, requestId, body);
    const rejectionReason = body.action === 'REJECT' ? body.rejectionReason : null;
    const signature = seal({
      requestId, action: body.action, actorId: req.user.id,
      decisions, comments: body.comments, rejectionReason,
    });

    // Authority, the stage transition, item updates, the sanctioned total and
    // the audit entry all happen inside this one call, atomically.
    const { rows } = await db.query(
      'SELECT fn_record_action($1, $2, $3, $4, $5, $6, $7) AS action_id',
      [
        requestId, req.user.id, body.action,
        decisions.length
          ? JSON.stringify(decisions.map((d) => ({
            request_item_id: d.requestItemId,
            approved_quantity: d.approvedQuantity,
            approved_amount: d.approvedAmount,
            remarks: d.remarks,
          })))
          : null,
        body.comments, rejectionReason, signature,
      ],
    );
    return { actionId: rows[0].action_id, request: await requireDetail(db, requestId, req.user) };
  });

  res.status(201).json(result);
});

requestsRouter.get('/:id/timeline', async (req, res) => {
  const requestId = param(req, 'id');

  const rows = await withUser(req.user.id, async (db) => {
    const visible = await db.query('SELECT 1 FROM requests WHERE request_id = $1', [requestId]);
    if (!visible.rowCount) throw notFound('Request not found');
    return (await db.query(
      `SELECT t.*, a.performed_by, ds.signed_hash, ds.signed_at,
              COALESCE((SELECT json_agg(json_build_object(
                          'requestItemId', aai.request_item_id,
                          'approvedQuantity', aai.approved_quantity,
                          'approvedAmount', aai.approved_amount,
                          'decision', aai.item_decision))
                          FROM approval_action_items aai WHERE aai.action_id = t.action_id), '[]') AS decisions
         FROM v_request_timeline t
         JOIN approval_actions a ON a.action_id = t.action_id
         LEFT JOIN digital_signatures ds ON ds.signature_id = t.signature_id
        WHERE t.request_id = $1
        ORDER BY t.created_at, t.action_id`,
      [requestId],
    )).rows;
  });

  res.json(rows.map((r) => {
    let sealStatus = 'UNSEALED';
    if (r.signed_hash) {
      sealStatus = verifySeal(r.signed_hash, {
        requestId, action: r.action, actorId: r.performed_by,
        decisions: r.decisions, comments: r.comments, rejectionReason: r.rejection_reason,
      }) ? 'VERIFIED' : 'MISMATCH';
    }
    return {
      id: r.action_id,
      at: r.created_at,
      action: r.action,
      stage: r.stage_code ? { code: r.stage_code, name: r.stage_name } : null,
      by: { id: r.performed_by, name: r.performed_by_name },
      previousStatus: r.previous_status,
      newStatus: r.new_status,
      amountRequested: r.amount_requested_snapshot,
      amountApproved: r.amount_approved,
      rejectionReason: r.rejection_reason,
      comments: r.comments,
      itemDecisions: r.decisions,
      // VERIFIED: the recorded decision is exactly what the API sealed.
      // MISMATCH: it has been altered since. UNSEALED: e.g. a submission.
      seal: sealStatus,
    };
  }));
});

requestsRouter.post('/:id/carry-forward', async (req, res) => {
  const requestId = param(req, 'id');
  const { financialYearId } = z.object({ financialYearId: intId }).parse(req.body);

  const detail = await withUser(req.user.id, async (db) => {
    const { rows } = await db.query('SELECT raised_by FROM requests WHERE request_id = $1', [requestId]);
    if (!rows[0]) throw notFound('Request not found');
    if (rows[0].raised_by !== req.user.id && !req.user.roles.includes('ADMIN')) {
      throw forbidden('Only the person who raised this request can carry it forward');
    }
    const created = await db.query(
      'SELECT fn_carry_forward_request($1, $2, $3) AS request_id',
      [requestId, financialYearId, req.user.id],
    );
    return requireDetail(db, created.rows[0].request_id, req.user);
  });

  res.status(201).location(`/api/requests/${detail.id}`).json(detail);
});
