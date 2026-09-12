import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth.js';
import { withUser } from '../db.js';
import { ISSUE_MANAGER_ROLES } from '../roles.js';

// A directory of active people, for the Principal and administrators to pick
// someone to assign or escalate an issue to. Not open to everyone: a full
// staff list with email addresses is more than a requester needs.
export const usersRouter = Router();

usersRouter.get('/users', requireRole(...ISSUE_MANAGER_ROLES), async (req, res) => {
  const { role } = z.object({
    role: z.string().trim().toUpperCase().max(40).optional(),
  }).parse(req.query);

  const rows = await withUser(req.user.id, async (db) => (await db.query(
    `SELECT u.user_id, u.full_name, u.email,
            ARRAY(SELECT r.code FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id
                   WHERE ur.user_id = u.user_id ORDER BY r.code) AS roles
       FROM users u
      WHERE u.is_active
        AND ($1::text IS NULL OR EXISTS (
              SELECT 1 FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id
               WHERE ur.user_id = u.user_id AND r.code = $1))
      ORDER BY u.full_name`,
    [role ?? null],
  )).rows);

  res.json(rows.map((u) => ({ id: u.user_id, name: u.full_name, email: u.email, roles: u.roles })));
});
