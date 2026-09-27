import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth.js';
import { anonQuery, withUser } from '../db.js';
import { HttpError, conflict, notFound } from '../errors.js';

// Admin-only: user & role management. All routes require the ADMIN role.
// Passwords are always hashed here — plain text is never stored or logged.
export const adminRouter = Router();

adminRouter.use(requireRole('ADMIN'));

const BCRYPT_ROUNDS = 12;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function userDetail(userId) {
  const { rows } = await anonQuery(
    `SELECT u.user_id, u.email, u.full_name, u.is_active, u.created_at, u.updated_at,
            COALESCE(
              json_agg(
                json_build_object('id', r.role_id, 'code', r.code, 'name', r.name)
                ORDER BY r.code
              ) FILTER (WHERE r.role_id IS NOT NULL),
              '[]'
            ) AS roles
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.user_id
       LEFT JOIN roles r       ON r.role_id  = ur.role_id
      WHERE u.user_id = $1
      GROUP BY u.user_id`,
    [userId],
  );
  if (!rows[0]) return null;
  const u = rows[0];
  return {
    id: u.user_id,
    email: u.email,
    name: u.full_name,
    isActive: u.is_active,
    createdAt: u.created_at,
    updatedAt: u.updated_at,
    roles: u.roles,
  };
}

async function validateRoleIds(db, roleIds) {
  if (!roleIds.length) return;
  const { rows } = await db.query(
    'SELECT role_id FROM roles WHERE role_id = ANY($1::int[])',
    [roleIds],
  );
  if (rows.length !== roleIds.length) {
    throw new HttpError(422, 'One or more role IDs are invalid');
  }
}

// ---------------------------------------------------------------------------
// GET /api/admin/users  —  list every user with their roles
// ---------------------------------------------------------------------------
adminRouter.get('/users', async (_req, res) => {
  const { rows } = await anonQuery(
    `SELECT u.user_id, u.email, u.full_name, u.is_active, u.created_at, u.updated_at,
            COALESCE(
              json_agg(
                json_build_object('id', r.role_id, 'code', r.code, 'name', r.name)
                ORDER BY r.code
              ) FILTER (WHERE r.role_id IS NOT NULL),
              '[]'
            ) AS roles
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.user_id
       LEFT JOIN roles r       ON r.role_id  = ur.role_id
      GROUP BY u.user_id
      ORDER BY u.full_name`,
  );
  res.json(rows.map((u) => ({
    id: u.user_id,
    email: u.email,
    name: u.full_name,
    isActive: u.is_active,
    createdAt: u.created_at,
    updatedAt: u.updated_at,
    roles: u.roles,
  })));
});

// ---------------------------------------------------------------------------
// GET /api/admin/roles  —  list all available roles
// ---------------------------------------------------------------------------
adminRouter.get('/roles', async (_req, res) => {
  const { rows } = await anonQuery(
    'SELECT role_id, code, name, description FROM roles ORDER BY name',
  );
  res.json(rows.map((r) => ({
    id: r.role_id,
    code: r.code,
    name: r.name,
    description: r.description,
  })));
});

// ---------------------------------------------------------------------------
// POST /api/admin/users  —  create a new user
// ---------------------------------------------------------------------------
const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  fullName: z.string().trim().min(2).max(200),
  password: z.string().min(8).max(200),
  roleIds: z.array(z.number().int().positive()).min(1, 'Assign at least one role'),
  isActive: z.boolean().default(true),
});

adminRouter.post('/users', async (req, res) => {
  const body = createUserSchema.parse(req.body);
  // Hash before opening the transaction — bcrypt is CPU-bound and slow;
  // holding a DB connection while it runs would waste pool capacity.
  const hash = await bcrypt.hash(body.password, BCRYPT_ROUNDS);

  const created = await withUser(req.user.id, async (db) => {
    const dup = await db.query(
      'SELECT 1 FROM users WHERE email = $1', [body.email],
    );
    if (dup.rowCount) throw conflict('A user with this email already exists');

    await validateRoleIds(db, body.roleIds);

    const { rows } = await db.query(
      `INSERT INTO users (email, full_name, password_hash, is_active)
       VALUES ($1, $2, $3, $4) RETURNING user_id`,
      [body.email, body.fullName, hash, body.isActive],
    );
    const userId = rows[0].user_id;

    await db.query(
      `INSERT INTO user_roles (user_id, role_id)
       SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING`,
      [userId, body.roleIds],
    );

    return userId;
  });

  res.status(201).json(await userDetail(created));
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/users/:id  —  edit name/email/password/roles/active status
// ---------------------------------------------------------------------------
const updateUserSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254).optional(),
    fullName: z.string().trim().min(2).max(200).optional(),
    password: z.string().min(8).max(200).optional(),
    roleIds: z.array(z.number().int().positive()).min(1).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

adminRouter.patch('/users/:id', async (req, res) => {
  const userId = req.params.id;
  const body = updateUserSchema.parse(req.body);

  // Hash outside the transaction for the same reason as above.
  const hash = body.password ? await bcrypt.hash(body.password, BCRYPT_ROUNDS) : undefined;

  await withUser(req.user.id, async (db) => {
    const existing = await db.query(
      'SELECT user_id FROM users WHERE user_id = $1', [userId],
    );
    if (!existing.rowCount) throw notFound('User not found');

    if (body.email) {
      const dup = await db.query(
        'SELECT 1 FROM users WHERE email = $1 AND user_id != $2', [body.email, userId],
      );
      if (dup.rowCount) throw conflict('This email is already taken by another user');
    }

    // Build SET clause dynamically so we never blank out unmentioned columns.
    const sets = [];
    const vals = [];
    const push = (col, val) => { vals.push(val); sets.push(`${col} = $${vals.length}`); };

    if (body.email !== undefined) push('email', body.email);
    if (body.fullName !== undefined) push('full_name', body.fullName);
    if (hash !== undefined) push('password_hash', hash);
    if (body.isActive !== undefined) push('is_active', body.isActive);

    if (sets.length) {
      push('updated_at', new Date());
      vals.push(userId);
      await db.query(
        `UPDATE users SET ${sets.join(', ')} WHERE user_id = $${vals.length}`,
        vals,
      );
    }

    // Replace roles atomically when roleIds is given.
    if (body.roleIds !== undefined) {
      await validateRoleIds(db, body.roleIds);
      await db.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
      if (body.roleIds.length) {
        await db.query(
          `INSERT INTO user_roles (user_id, role_id)
           SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING`,
          [userId, body.roleIds],
        );
      }
    }
  });

  res.json(await userDetail(userId));
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/users/:id  —  deactivate (soft-delete; preserves history)
// ---------------------------------------------------------------------------
adminRouter.delete('/users/:id', async (req, res) => {
  const userId = req.params.id;
  if (userId === req.user.id) {
    throw new HttpError(400, 'You cannot deactivate your own account');
  }

  await withUser(req.user.id, async (db) => {
    const { rowCount } = await db.query(
      `UPDATE users SET is_active = FALSE, updated_at = NOW()
        WHERE user_id = $1`,
      [userId],
    );
    if (!rowCount) throw notFound('User not found');
  });

  res.status(204).end();
});

// ---------------------------------------------------------------------------
// POST /api/admin/users/:id/reactivate  —  re-enable a deactivated account
// ---------------------------------------------------------------------------
adminRouter.post('/users/:id/reactivate', async (req, res) => {
  const userId = req.params.id;

  await withUser(req.user.id, async (db) => {
    const { rowCount } = await db.query(
      `UPDATE users SET is_active = TRUE, updated_at = NOW()
        WHERE user_id = $1`,
      [userId],
    );
    if (!rowCount) throw notFound('User not found');
  });

  res.json(await userDetail(userId));
});
