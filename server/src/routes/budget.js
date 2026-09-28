import { Router } from 'express';
import { z } from 'zod';
import { withUser } from '../db.js';
import { notFound, unprocessable } from '../errors.js';
import { amount, intId, param } from '../validate.js';

export const budgetRouter = Router();

const provisionInput = z.object({
  departmentId: intId,
  financialYearId: intId,
  budgetHeadId: intId.nullable().optional(),
  allocatedAmount: amount,
  remarks: z.string().trim().max(1000).optional(),
});

const summaryRow = (r) => ({
  id: r.budget_provision_id,
  department: { id: r.department_id, code: r.department_code, name: r.department_name },
  financialYear: { id: r.financial_year_id, label: r.financial_year },
  budgetHead: r.budget_head_id
    ? { id: r.budget_head_id, code: r.budget_head_code, name: r.budget_head_name }
    : null,
  allocatedAmount: Number(r.allocated_amount),
  utilizedAmount: Number(r.utilized_amount),
  committedAmount: Number(r.committed_amount),
  remainingAmount: Number(r.remaining_amount),
  availableAmount: Number(r.available_amount),
  remarks: r.remarks,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

// GET /api/budget-provisions — List provisions with computed figures
budgetRouter.get('/budget-provisions', async (req, res) => {
  const departmentId = req.query.departmentId ? parseInt(req.query.departmentId, 10) : null;
  const financialYearId = req.query.financialYearId ? parseInt(req.query.financialYearId, 10) : null;

  // TODO: Auth middleware role checks go here
  const rows = await withUser(req.user.id, async (db) => {
    const { rows: summaries } = await db.query(
      `SELECT * FROM v_department_budget_summary
        WHERE ($1::int IS NULL OR department_id = $1)
          AND ($2::int IS NULL OR financial_year_id = $2)
        ORDER BY department_name, financial_year DESC`,
      [departmentId, financialYearId],
    );
    return summaries;
  });

  res.json(rows.map(summaryRow));
});

// GET /api/budget-provisions/:id
budgetRouter.get('/budget-provisions/:id', async (req, res) => {
  const provisionId = param(req, 'id');

  // TODO: Auth middleware role checks go here
  const row = await withUser(req.user.id, async (db) => {
    const { rows } = await db.query(
      'SELECT * FROM v_department_budget_summary WHERE budget_provision_id = $1',
      [provisionId],
    );
    return rows[0] || null;
  });

  if (!row) throw notFound('Budget provision not found');
  res.json(summaryRow(row));
});

// POST /api/budget-provisions — Upsert provision
budgetRouter.post('/budget-provisions', async (req, res) => {
  const body = provisionInput.parse(req.body);

  // TODO: Auth middleware role checks go here (HOD / Admin)
  const detail = await withUser(req.user.id, async (db) => {
    const { rows } = await db.query(
      `INSERT INTO budget_provisions (department_id, financial_year_id, budget_head_id, allocated_amount, remarks, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (department_id, financial_year_id, COALESCE(budget_head_id, -1))
       DO UPDATE SET allocated_amount = EXCLUDED.allocated_amount,
                     remarks = EXCLUDED.remarks,
                     updated_at = NOW()
       RETURNING budget_provision_id`,
      [body.departmentId, body.financialYearId, body.budgetHeadId ?? null, body.allocatedAmount, body.remarks || null, req.user.id],
    );
    const id = rows[0].budget_provision_id;
    const { rows: fetched } = await db.query(
      'SELECT * FROM v_department_budget_summary WHERE budget_provision_id = $1',
      [id],
    );
    return fetched[0];
  });

  res.status(201).json(summaryRow(detail));
});
