import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { expectStatus, startApi } from './helpers.js';

let t;
const tok = {};
const ids = {};

before(async () => {
  t = await startApi();
  for (const [key, email] of Object.entries({
    head: 'head.cs@spcollege.edu',
    headChem: 'head.chem@spcollege.edu',
    clerkCs: 'clerk@spcollege.edu',
    pc1: 'pc1@spcollege.edu',
    principal: 'principal@spcollege.edu',
    cdcGrant: 'cdc.grant@spcollege.edu',
    cdcNonGrant: 'cdc.nongrant@spcollege.edu',
    chairman: 'chairman@spcollege.edu',
    vp: 'vp@spcollege.edu',
    admin: 'admin@spcollege.edu',
  })) {
    tok[key] = await t.login(email);
  }

  const heads = expectStatus(await t.api('GET', '/api/budget-heads', { token: tok.head }), 200);
  ids.it = heads.find((h) => h.code === 'IT').id;
  const itItems = expectStatus(await t.api('GET', `/api/budget-heads/${ids.it}/items`, { token: tok.head }), 200);
  for (const i of itItems) ids[i.code] = i.id;

  const depts = expectStatus(await t.api('GET', '/api/departments', { token: tok.head }), 200);
  ids.csDept = depts.find((d) => d.code === 'CS').id;
  ids.chemDept = depts.find((d) => d.code === 'CHEM').id;

  const fys = expectStatus(await t.api('GET', '/api/financial-years', { token: tok.head }), 200);
  ids.fy = fys[0].id;
});

after(() => t.close());

async function createSubmittedRequest(token, title, amount) {
  const draft = expectStatus(await t.api('POST', '/api/requests', {
    token,
    body: {
      title,
      budgetHeadId: ids.it,
      departmentId: ids.csDept,
      items: [{ budgetItemId: ids['MIC-01'], quantity: 1, unitCost: amount }],
    },
  }), 201);

  expectStatus(await t.api('POST', `/api/requests/${draft.id}/submit`, { token }), 200);
  return draft;
}

test('1. PC APPROVE is rejected', async () => {
  const req = await createSubmittedRequest(tok.head, 'Authz test - PC approve', 30000);

  const res = await t.api('POST', `/api/requests/${req.id}/actions`, {
    token: tok.pc1,
    body: { action: 'APPROVE' },
  });
  assert.equal(res.status === 422 || res.status === 400 || res.status === 403, true);
});

test('2. Principal APPROVE above 50,000 is rejected', async () => {
  const req = await createSubmittedRequest(tok.head, 'Authz test - Principal >50k approve', 100000);

  expectStatus(await t.api('POST', `/api/requests/${req.id}/actions`, {
    token: tok.pc1,
    body: { action: 'FORWARD' },
  }), 201);

  const res = await t.api('POST', `/api/requests/${req.id}/actions`, {
    token: tok.principal,
    body: { action: 'APPROVE' },
  });
  assert.equal(res.status === 422 || res.status === 400, true);
});

test('3. Single CDC member approving does not close request', async () => {
  const req = await createSubmittedRequest(tok.head, 'Authz test - Single CDC approve', 100000);

  expectStatus(await t.api('POST', `/api/requests/${req.id}/actions`, { token: tok.pc1, body: { action: 'FORWARD' } }), 201);
  expectStatus(await t.api('POST', `/api/requests/${req.id}/actions`, { token: tok.principal, body: { action: 'FORWARD' } }), 201);

  const res = expectStatus(await t.api('POST', `/api/requests/${req.id}/actions`, {
    token: tok.cdcGrant,
    body: { action: 'APPROVE' },
  }), 201);

  assert.equal(res.request.status, 'UNDER_CDC_REVIEW');
});

test('4. Same CDC member approving twice writes row but leaves status as UNDER_CDC_REVIEW', async () => {
  const req = await createSubmittedRequest(tok.head, 'Authz test - CDC double approve', 100000);

  expectStatus(await t.api('POST', `/api/requests/${req.id}/actions`, { token: tok.pc1, body: { action: 'FORWARD' } }), 201);
  expectStatus(await t.api('POST', `/api/requests/${req.id}/actions`, { token: tok.principal, body: { action: 'FORWARD' } }), 201);

  expectStatus(await t.api('POST', `/api/requests/${req.id}/actions`, { token: tok.cdcGrant, body: { action: 'APPROVE' } }), 201);

  const secondRes = await t.api('POST', `/api/requests/${req.id}/actions`, {
    token: tok.cdcGrant,
    body: { action: 'APPROVE' },
  });

  assert.equal(secondRes.status, 201);
  assert.equal(secondRes.body.request.status, 'UNDER_CDC_REVIEW');

  const dbRows = (await t.superuser.query("SELECT * FROM approval_actions WHERE request_id = $1 AND action = 'APPROVE'", [req.id])).rows;
  console.log('[Test 4] DB approval_actions count for duplicate approve:', dbRows.length);
  assert.equal(dbRows.length, 2, 'Two approval_actions rows are recorded in DB');
});

test('5. Two Grant members do not satisfy CDC', async () => {
  const grantRoleId = (await t.superuser.query("SELECT role_id FROM roles WHERE code = 'CDC_GRANT_MEMBER'")).rows[0].role_id;
  const cdcStageId = (await t.superuser.query("SELECT stage_id FROM workflow_stages WHERE code = 'CDC'")).rows[0].stage_id;

  const newUserRes = await t.superuser.query(`
    INSERT INTO users (email, full_name, password_hash)
    VALUES ('cdc.grant2@spcollege.edu', 'Second Grant Member', crypt('ChangeMe#2026', gen_salt('bf', 12)))
    RETURNING user_id;
  `);
  const grant2UserId = newUserRes.rows[0].user_id;

  await t.superuser.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [grant2UserId, grantRoleId]);
  await t.superuser.query('INSERT INTO stage_approvers (stage_id, user_id, role_id) VALUES ($1, $2, $3)', [cdcStageId, grant2UserId, grantRoleId]);

  const tokGrant2 = await t.login('cdc.grant2@spcollege.edu');

  const req = await createSubmittedRequest(tok.head, 'Authz test - Two Grant members', 100000);

  expectStatus(await t.api('POST', `/api/requests/${req.id}/actions`, { token: tok.pc1, body: { action: 'FORWARD' } }), 201);
  expectStatus(await t.api('POST', `/api/requests/${req.id}/actions`, { token: tok.principal, body: { action: 'FORWARD' } }), 201);

  expectStatus(await t.api('POST', `/api/requests/${req.id}/actions`, { token: tok.cdcGrant, body: { action: 'APPROVE' } }), 201);
  const res = expectStatus(await t.api('POST', `/api/requests/${req.id}/actions`, { token: tokGrant2, body: { action: 'APPROVE' } }), 201);

  assert.equal(res.request.status, 'UNDER_CDC_REVIEW');
});

test('6. Single Chairman approval does not close final stage', async () => {
  const req = await createSubmittedRequest(tok.head, 'Authz test - Final authority single approve', 600000);

  expectStatus(await t.api('POST', `/api/requests/${req.id}/actions`, { token: tok.pc1, body: { action: 'FORWARD' } }), 201);
  expectStatus(await t.api('POST', `/api/requests/${req.id}/actions`, { token: tok.principal, body: { action: 'FORWARD' } }), 201);

  const res = expectStatus(await t.api('POST', `/api/requests/${req.id}/actions`, { token: tok.chairman, body: { action: 'APPROVE' } }), 201);
  assert.equal(res.request.status, 'UNDER_FINAL_AUTHORITY_REVIEW');
});

test('7. Resubmit by non-raiser is rejected', async () => {
  const req = await createSubmittedRequest(tok.head, 'Authz test - Resubmit by non-raiser', 20000);

  expectStatus(await t.api('POST', `/api/requests/${req.id}/actions`, { token: tok.pc1, body: { action: 'RETURN', comments: 'Fix details' } }), 201);

  const res = await t.api('POST', `/api/requests/${req.id}/resubmit`, {
    token: tok.headChem,
    body: { comments: 'Wrong user resubmit' },
  });
  assert.notEqual(res.status, 200);
});

test('8. Principal RETURN on 30k & 75k and PC RETURN resubmission routing', async () => {
  // (a) Principal RETURN on 30k
  const req30 = await createSubmittedRequest(tok.head, 'Authz test - Principal RETURN 30k', 30000);
  expectStatus(await t.api('POST', `/api/requests/${req30.id}/actions`, { token: tok.pc1, body: { action: 'FORWARD' } }), 201);
  expectStatus(await t.api('POST', `/api/requests/${req30.id}/actions`, { token: tok.principal, body: { action: 'RETURN', comments: 'Fix budget' } }), 201);

  const resub30 = expectStatus(await t.api('POST', `/api/requests/${req30.id}/resubmit`, { token: tok.head, body: { comments: 'Resubmitted' } }), 200);
  console.log('[Test 8a] 30k Principal RETURN -> Resubmit landed stage:', resub30.stage.code, 'status:', resub30.status);
  assert.equal(resub30.stage.code, 'PRINCIPAL', 'Resubmission lands directly back at PRINCIPAL stage, skipping PC');

  // (b) Principal RETURN on 75k
  const req75 = await createSubmittedRequest(tok.head, 'Authz test - Principal RETURN 75k', 75000);
  expectStatus(await t.api('POST', `/api/requests/${req75.id}/actions`, { token: tok.pc1, body: { action: 'FORWARD' } }), 201);
  expectStatus(await t.api('POST', `/api/requests/${req75.id}/actions`, { token: tok.principal, body: { action: 'RETURN', comments: 'Fix items' } }), 201);

  const resub75 = expectStatus(await t.api('POST', `/api/requests/${req75.id}/resubmit`, { token: tok.head, body: { comments: 'Resubmitted' } }), 200);
  console.log('[Test 8b] 75k Principal RETURN -> Resubmit landed stage:', resub75.stage.code, 'status:', resub75.status);
  assert.equal(resub75.stage.code, 'PRINCIPAL', 'Resubmission lands directly back at PRINCIPAL stage, skipping PC');

  // (c) PC RETURN
  const reqPc = await createSubmittedRequest(tok.head, 'Authz test - PC RETURN', 20000);
  expectStatus(await t.api('POST', `/api/requests/${reqPc.id}/actions`, { token: tok.pc1, body: { action: 'RETURN', comments: 'Fix vendor' } }), 201);

  const resubPc = expectStatus(await t.api('POST', `/api/requests/${reqPc.id}/resubmit`, { token: tok.head, body: { comments: 'Resubmitted' } }), 200);
  console.log('[Test 8c] PC RETURN -> Resubmit landed stage:', resubPc.stage.code, 'status:', resubPc.status);
  assert.equal(resubPc.stage.code, 'PURCHASE_COMMITTEE');
});

test('9. Dual-staffed CDC member cannot be inserted twice due to stage_approvers_pkey constraint', async () => {
  const grantRoleId = (await t.superuser.query("SELECT role_id FROM roles WHERE code = 'CDC_GRANT_MEMBER'")).rows[0].role_id;
  const nonGrantRoleId = (await t.superuser.query("SELECT role_id FROM roles WHERE code = 'CDC_NON_GRANT_MEMBER'")).rows[0].role_id;
  const cdcStageId = (await t.superuser.query("SELECT stage_id FROM workflow_stages WHERE code = 'CDC'")).rows[0].stage_id;

  const dualUserRes = await t.superuser.query(`
    INSERT INTO users (email, full_name, password_hash)
    VALUES ('cdc.dual2@spcollege.edu', 'Dual Staffed CDC Member', crypt('ChangeMe#2026', gen_salt('bf', 12)))
    RETURNING user_id;
  `);
  const dualUserId = dualUserRes.rows[0].user_id;

  await t.superuser.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2), ($1, $3)', [dualUserId, grantRoleId, nonGrantRoleId]);
  
  // First role insertion in stage_approvers succeeds
  await t.superuser.query('INSERT INTO stage_approvers (stage_id, user_id, role_id) VALUES ($1, $2, $3)', [cdcStageId, dualUserId, grantRoleId]);

  // Second role insertion for same user at same stage fails due to PK (stage_id, user_id)
  let pkeyFailed = false;
  try {
    await t.superuser.query('INSERT INTO stage_approvers (stage_id, user_id, role_id) VALUES ($1, $2, $3)', [cdcStageId, dualUserId, nonGrantRoleId]);
  } catch (err) {
    pkeyFailed = (err.code === '23505');
  }
  assert.equal(pkeyFailed, true, 'stage_approvers_pkey prevents assigning multiple role_ids to the same user at the same stage');
});

test('10. Endpoint checks for Budget Context, Budget Provisions, and Supersede', async () => {
  const req = await createSubmittedRequest(tok.head, 'Authz test - Endpoint checks', 20000);

  // budget-context for own dept clerk
  const resContextOwn = await t.api('GET', `/api/requests/${req.id}/budget-context`, { token: tok.clerkCs });
  console.log('[Test 10a] budget-context (own dept clerk): status', resContextOwn.status, resContextOwn.body ? 'Got context' : 'No context');

  // budget-context for cross-dept HOD
  const resContextCross = await t.api('GET', `/api/requests/${req.id}/budget-context`, { token: tok.headChem });
  console.log('[Test 10b] budget-context (cross-dept HOD): status', resContextCross.status, resContextCross.body);

  // budget-provisions POST for home HOD
  const resProvHome = await t.api('POST', '/api/budget-provisions', {
    token: tok.head,
    body: { departmentId: ids.csDept, financialYearId: ids.fy, allocatedAmount: 500000 },
  });
  console.log('[Test 10c] POST /api/budget-provisions (home HOD): status', resProvHome.status, resProvHome.body);
});

test('11. HOD cross-department read checks', async () => {
  const req = await createSubmittedRequest(tok.head, 'Authz test - Cross department read', 20000);

  const detailRes = await t.api('GET', `/api/requests/${req.id}`, { token: tok.headChem });
  const listRes = await t.api('GET', `/api/requests?departmentId=${ids.csDept}`, { token: tok.headChem });

  console.log('[Test 11] HOD cross-dept detail status:', detailRes.status);
  console.log('[Test 11] HOD cross-dept list count:', listRes.body?.items?.length ?? listRes.body?.length ?? listRes.status);
});

test('12. ADMIN attempting an approver action', async () => {
  const req = await createSubmittedRequest(tok.head, 'Authz test - Admin action', 20000);

  const res = await t.api('POST', `/api/requests/${req.id}/actions`, {
    token: tok.admin,
    body: { action: 'FORWARD' },
  });
  console.log('[Test 12] ADMIN action status:', res.status, res.body);
  assert.notEqual(res.status, 201);
});

test('13. CDC and Chairman RETURN attempt', async () => {
  const reqCdc = await createSubmittedRequest(tok.head, 'Authz test - CDC Return attempt', 100000);
  expectStatus(await t.api('POST', `/api/requests/${reqCdc.id}/actions`, { token: tok.pc1, body: { action: 'FORWARD' } }), 201);
  expectStatus(await t.api('POST', `/api/requests/${reqCdc.id}/actions`, { token: tok.principal, body: { action: 'FORWARD' } }), 201);

  const resCdcReturn = await t.api('POST', `/api/requests/${reqCdc.id}/actions`, {
    token: tok.cdcGrant,
    body: { action: 'RETURN', comments: 'Needs budget fix' },
  });
  console.log('[Test 13] CDC RETURN status:', resCdcReturn.status, resCdcReturn.body);
});
