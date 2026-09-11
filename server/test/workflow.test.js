import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { expectStatus, startApi } from './helpers.js';

// One procurement request through its whole life, over HTTP, as the real
// people involved — then the edges: authority, visibility, seals, carry-forward.

let t;
const tok = {};
const ids = {};

before(async () => {
  t = await startApi();
  for (const [key, email] of Object.entries({
    head: 'head.cs@spcollege.edu', incharge: 'incharge@spcollege.edu',
    pc1: 'pc1@spcollege.edu', principal: 'principal@spcollege.edu',
    cdc: 'cdc.grant@spcollege.edu', chairman: 'chairman@spcollege.edu',
    clerk: 'clerk@spcollege.edu', admin: 'admin@spcollege.edu',
  })) {
    tok[key] = await t.login(email);
  }
  const heads = expectStatus(await t.api('GET', '/api/budget-heads', { token: tok.head }), 200);
  ids.it = heads.find((h) => h.code === 'IT').id;
  ids.office = heads.find((h) => h.code === 'OFFICE').id;
  const itItems = expectStatus(await t.api('GET', `/api/budget-heads/${ids.it}/items`, { token: tok.head }), 200);
  const officeItems = expectStatus(await t.api('GET', `/api/budget-heads/${ids.office}/items`, { token: tok.head }), 200);
  for (const i of [...itItems, ...officeItems]) ids[i.code] = i.id;
});
after(() => t.close());

// ---------------------------------------------------------------------------
// Drafting
// ---------------------------------------------------------------------------

test('an empty dashboard still names its financial year', async () => {
  const d = expectStatus(await t.api('GET', '/api/dashboard', { token: tok.principal }), 200);
  assert.equal(d.financialYear, '2026-27');
  assert.equal(d.counts.total, 0);
});

test('master data includes the budget head type', async () => {
  const heads = expectStatus(await t.api('GET', '/api/budget-heads', { token: tok.head }), 200);
  assert.equal(heads.find((h) => h.code === 'IT').headType, 'CAPITAL');
  assert.equal(heads.find((h) => h.code === 'OFFICE').headType, 'REVENUE');
});

test('head drafts a multi-item request; the total is computed, not trusted', async () => {
  const draft = expectStatus(await t.api('POST', '/api/requests', {
    token: tok.head,
    body: {
      title: 'Seminar hall AV overhaul',
      budgetHeadId: ids.it,
      items: [
        { budgetItemId: ids['MIC-01'], quantity: 4, unitCost: 150000 },
        { budgetItemId: ids['SPK-01'], quantity: 2, unitCost: 25000 },
      ],
    },
  }), 201);
  ids.big = draft.id;
  assert.match(draft.requestNumber, /^REQ-\d{4}-\d{4,}$/);
  assert.equal(draft.status, 'DRAFT');
  assert.equal(draft.tentativeTotalCost, 650000);
  assert.equal(draft.items.find((i) => i.budgetItem.code === 'MIC-01').itemType, 'CAPITAL');
  assert.equal(draft.permissions.canSubmit, true);
});

test('money is exact: 3 x 0.10 is 0.30, not 0.30000000000000004', async () => {
  const res = expectStatus(await t.api('POST', `/api/requests/${ids.big}/items`, {
    token: tok.head, body: { budgetItemId: ids['HDMI-01'], quantity: 3, unitCost: 0.1 },
  }), 201);
  const hdmi = res.items.find((i) => i.budgetItem.code === 'HDMI-01');
  assert.equal(hdmi.estimatedTotal, 0.3);
  assert.equal(res.tentativeTotalCost, 650000.3);
  ids.hdmi = hdmi.id;
});

test('editing a line recomputes the request total', async () => {
  const res = expectStatus(await t.api('PATCH', `/api/requests/${ids.big}/items/${ids.hdmi}`, {
    token: tok.head, body: { quantity: 5 },
  }), 200);
  assert.equal(res.items.find((i) => i.id === ids.hdmi).estimatedTotal, 0.5);
  assert.equal(res.tentativeTotalCost, 650000.5);
});

test('draft validation', async (s) => {
  const make = (body) => t.api('POST', '/api/requests', { token: tok.head, body });
  const base = { title: 'Validation probe', budgetHeadId: ids.it };

  await s.test('quantity must be greater than zero (Madhuri Mam)', async () => {
    expectStatus(await make({ ...base, items: [{ budgetItemId: ids['MIC-01'], quantity: 0, unitCost: 1 }] }), 422);
    expectStatus(await make({ ...base, items: [{ budgetItemId: ids['MIC-01'], quantity: -2, unitCost: 1 }] }), 422);
  });
  await s.test('no third decimal place', async () => {
    expectStatus(await make({ ...base, items: [{ budgetItemId: ids['MIC-01'], quantity: 1, unitCost: 1.005 }] }), 422);
  });
  await s.test('items must belong to the chosen budget head', async () => {
    const res = expectStatus(await make({ ...base, items: [{ budgetItemId: ids['CART-01'], quantity: 1, unitCost: 1 }] }), 422);
    assert.deepEqual(res.error.details.budgetItemIds, [ids['CART-01']]);
  });
  await s.test('an item may appear once', async () => {
    const line = { budgetItemId: ids['MIC-01'], quantity: 1, unitCost: 1 };
    expectStatus(await make({ ...base, items: [line, line] }), 422);
  });
  await s.test('an empty draft cannot be submitted', async () => {
    const empty = expectStatus(await make(base), 201);
    const res = expectStatus(await t.api('POST', `/api/requests/${empty.id}/submit`, { token: tok.head }), 422);
    assert.match(res.error.message, /at least one item/);
    expectStatus(await t.api('DELETE', `/api/requests/${empty.id}`, { token: tok.head }), 204);
  });
});

test('only requester roles may raise requests', async () => {
  const res = await t.api('POST', '/api/requests', {
    token: tok.clerk, body: { title: 'Not allowed', budgetHeadId: ids.it } });
  expectStatus(res, 403);
});

test('a draft is private to its author', async () => {
  for (const who of ['incharge', 'principal', 'cdc']) {
    expectStatus(await t.api('GET', `/api/requests/${ids.big}`, { token: tok[who] }), 404);
  }
  // Not 403: that would confirm the request exists.
  expectStatus(await t.api('PATCH', `/api/requests/${ids.big}`, { token: tok.incharge, body: { title: 'mine now' } }), 404);
  expectStatus(await t.api('GET', `/api/requests/${ids.big}`, { token: tok.admin }), 200);
});

// ---------------------------------------------------------------------------
// Submission and routing
// ---------------------------------------------------------------------------

test('submitting 6.5 lakh routes straight to CDC', async () => {
  const res = expectStatus(await t.api('POST', `/api/requests/${ids.big}/submit`, { token: tok.head }), 200);
  assert.equal(res.status, 'UNDER_CDC_REVIEW');
  assert.equal(res.stage.code, 'CDC');
  assert.equal(res.permissions.canEdit, false);
  assert.deepEqual(res.permissions.actions, []);
});

test('a submitted request can no longer be edited', async () => {
  expectStatus(await t.api('PATCH', `/api/requests/${ids.big}`, { token: tok.head, body: { title: 'changed' } }), 409);
  expectStatus(await t.api('POST', `/api/requests/${ids.big}/submit`, { token: tok.head }), 409);
});

test('CDC is notified and sees it awaiting their decision', async () => {
  const n = expectStatus(await t.api('GET', '/api/notifications?unread=true', { token: tok.cdc }), 200);
  assert.ok(n.items.some((x) => x.request?.id === ids.big && /awaits your review/.test(x.subject)));
  const list = expectStatus(await t.api('GET', '/api/requests?awaitingMe=true', { token: tok.cdc }), 200);
  assert.deepEqual(list.items.map((r) => r.id), [ids.big]);
  const detail = expectStatus(await t.api('GET', `/api/requests/${ids.big}`, { token: tok.cdc }), 200);
  assert.deepEqual(detail.permissions.actions, ['APPROVE', 'PARTIAL_APPROVE', 'REJECT', 'ESCALATE']);
});

test('the Principal can see it but not decide it', async () => {
  expectStatus(await t.api('GET', `/api/requests/${ids.big}`, { token: tok.principal }), 200);
  const res = expectStatus(await t.api('POST', `/api/requests/${ids.big}/actions`, {
    token: tok.principal, body: { action: 'APPROVE' } }), 403);
  assert.equal(res.error.code, 'SP004');
});

test('a requester cannot approve their own request', async () => {
  const res = expectStatus(await t.api('POST', `/api/requests/${ids.big}/actions`, {
    token: tok.head, body: { action: 'APPROVE' } }), 403);
  assert.equal(res.error.code, 'SP004');
});

test('a purchase committee member cannot see a request that never reached them', async () => {
  expectStatus(await t.api('GET', `/api/requests/${ids.big}`, { token: tok.pc1 }), 404);
});

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

test('rejecting needs a reason', async () => {
  const res = expectStatus(await t.api('POST', `/api/requests/${ids.big}/actions`, {
    token: tok.cdc, body: { action: 'REJECT' } }), 422);
  assert.equal(res.error.details[0].path, 'rejectionReason');
});

test('CDC escalates to the final authority', async () => {
  const res = expectStatus(await t.api('POST', `/api/requests/${ids.big}/actions`, {
    token: tok.cdc, body: { action: 'ESCALATE', comments: 'Grant budget unavailable' } }), 201);
  assert.equal(res.request.status, 'UNDER_FINAL_AUTHORITY_REVIEW');
  assert.deepEqual(res.request.permissions.actions, []);
  // Once it has moved on, CDC can still read it but no longer act.
  const again = expectStatus(await t.api('POST', `/api/requests/${ids.big}/actions`, {
    token: tok.cdc, body: { action: 'APPROVE' } }), 403);
  assert.equal(again.error.code, 'SP004');
});

test('the final authority cannot escalate further', async () => {
  const detail = expectStatus(await t.api('GET', `/api/requests/${ids.big}`, { token: tok.chairman }), 200);
  assert.ok(!detail.permissions.actions.includes('ESCALATE'));
  const res = expectStatus(await t.api('POST', `/api/requests/${ids.big}/actions`, {
    token: tok.chairman, body: { action: 'ESCALATE' } }), 422);
  assert.equal(res.error.code, 'SP006');
});

test('partial approval must be complete and within what was asked', async (s) => {
  const detail = expectStatus(await t.api('GET', `/api/requests/${ids.big}`, { token: tok.chairman }), 200);
  const item = (code) => detail.items.find((i) => i.budgetItem.code === code).id;
  ids.mic = item('MIC-01');
  ids.spk = item('SPK-01');
  const decide = (itemDecisions) => t.api('POST', `/api/requests/${ids.big}/actions`, {
    token: tok.chairman, body: { action: 'PARTIAL_APPROVE', itemDecisions } });

  await s.test('every item must be decided', async () => {
    const res = expectStatus(await decide([{ requestItemId: ids.mic, approvedQuantity: 2 }]), 422);
    assert.equal(res.error.details.requestItemIds.length, 2);
  });
  await s.test('cannot approve more than was requested', async () => {
    expectStatus(await decide([
      { requestItemId: ids.mic, approvedQuantity: 5 },
      { requestItemId: ids.spk, approvedQuantity: 0 },
      { requestItemId: ids.hdmi, approvedQuantity: 0 },
    ]), 422);
  });
  await s.test('cannot decide an item from another request', async () => {
    expectStatus(await decide([
      { requestItemId: '00000000-0000-4000-8000-000000000000', approvedQuantity: 1 },
    ]), 422);
  });
  await s.test('nothing was recorded by the refused attempts', async () => {
    const tl = expectStatus(await t.api('GET', `/api/requests/${ids.big}/timeline`, { token: tok.chairman }), 200);
    assert.deepEqual(tl.map((e) => e.action), ['SUBMIT', 'ESCALATE']);
  });
});

test('chairman approves 2 of 4 microphones, no speakers, all cables', async () => {
  const res = expectStatus(await t.api('POST', `/api/requests/${ids.big}/actions`, {
    token: tok.chairman,
    body: {
      action: 'PARTIAL_APPROVE',
      comments: 'Within trust ceiling',
      itemDecisions: [
        { requestItemId: ids.mic, approvedQuantity: 2 },
        { requestItemId: ids.spk, approvedQuantity: 0 },
        // Upper-case id: must be treated exactly like the lower-case one.
        { requestItemId: ids.hdmi.toUpperCase(), approvedQuantity: 5 },
      ],
    },
  }), 201);
  const r = res.request;
  assert.equal(r.status, 'PARTIALLY_APPROVED');
  assert.equal(r.sanctionedAmount, 300000.5);
  assert.equal(r.tentativeTotalCost, 650000.5, 'the original request is never overwritten');

  const by = (id) => r.items.find((i) => i.id === id);
  assert.deepEqual([by(ids.mic).status, by(ids.mic).approvedQuantity, by(ids.mic).unapprovedQuantity],
    ['PARTIALLY_APPROVED', 2, 2]);
  assert.equal(by(ids.mic).approvedAmount, 300000, 'defaults to quantity x unit cost');
  assert.equal(by(ids.spk).status, 'REJECTED');
  assert.equal(by(ids.hdmi).status, 'APPROVED');
});

test('the requester was told at each step', async () => {
  const n = expectStatus(await t.api('GET', '/api/notifications', { token: tok.head }), 200);
  const subjects = n.items.filter((x) => x.request?.id === ids.big).map((x) => x.subject);
  assert.ok(subjects.some((s) => /escalated/.test(s)));
  assert.ok(subjects.some((s) => /partially approved/.test(s)));
  assert.ok(n.items.every((x) => x.request === null || x.request.id === ids.big),
    'no one else\'s notifications leak through');
});

// ---------------------------------------------------------------------------
// Seals
// ---------------------------------------------------------------------------

test('every decision on the timeline carries a verified seal', async () => {
  const tl = expectStatus(await t.api('GET', `/api/requests/${ids.big}/timeline`, { token: tok.head }), 200);
  assert.deepEqual(tl.map((e) => [e.action, e.seal]),
    [['SUBMIT', 'UNSEALED'], ['ESCALATE', 'VERIFIED'], ['PARTIAL_APPROVE', 'VERIFIED']]);
  const partial = tl.at(-1);
  assert.equal(partial.by.name, 'Shri. K. Bhave (Chairman)');
  assert.equal(partial.amountApproved, 300000.5);
});

test('editing a recorded decision directly in the database breaks its seal', async () => {
  const tl = expectStatus(await t.api('GET', `/api/requests/${ids.big}/timeline`, { token: tok.head }), 200);
  const actionId = tl.at(-1).id;
  // Someone with database access quietly raises an approved amount.
  await t.superuser.query(
    `UPDATE approval_action_items SET approved_amount = approved_amount + 1
      WHERE action_id = $1 AND request_item_id = $2`, [actionId, ids.mic]);
  try {
    const after = expectStatus(await t.api('GET', `/api/requests/${ids.big}/timeline`, { token: tok.head }), 200);
    assert.equal(after.at(-1).seal, 'MISMATCH');
    assert.equal(after.at(-2).seal, 'VERIFIED', 'other decisions are unaffected');
  } finally {
    await t.superuser.query(
      `UPDATE approval_action_items SET approved_amount = approved_amount - 1
        WHERE action_id = $1 AND request_item_id = $2`, [actionId, ids.mic]);
  }
  const restored = expectStatus(await t.api('GET', `/api/requests/${ids.big}/timeline`, { token: tok.head }), 200);
  assert.equal(restored.at(-1).seal, 'VERIFIED');
});

// ---------------------------------------------------------------------------
// The small route, lists and dashboards
// ---------------------------------------------------------------------------

test('a 30,000 request goes to the Purchase Committee and is approved in full', async () => {
  const draft = expectStatus(await t.api('POST', '/api/requests', {
    token: tok.incharge,
    body: { title: 'Printer cartridges', budgetHeadId: ids.office,
            items: [{ budgetItemId: ids['CART-01'], quantity: 10, unitCost: 3000 }] },
  }), 201);
  ids.small = draft.id;
  const submitted = expectStatus(await t.api('POST', `/api/requests/${ids.small}/submit`, { token: tok.incharge }), 200);
  assert.equal(submitted.stage.code, 'PURCHASE_COMMITTEE');

  const res = expectStatus(await t.api('POST', `/api/requests/${ids.small}/actions`, {
    token: tok.pc1, body: { action: 'APPROVE' } }), 201);
  assert.equal(res.request.status, 'APPROVED');
  assert.equal(res.request.sanctionedAmount, 30000);
  const tl = expectStatus(await t.api('GET', `/api/requests/${ids.small}/timeline`, { token: tok.incharge }), 200);
  assert.equal(tl.at(-1).seal, 'VERIFIED');
});

test('lists are scoped to what each person may see', async () => {
  const mine = expectStatus(await t.api('GET', '/api/requests', { token: tok.incharge }), 200);
  assert.deepEqual(mine.items.map((r) => r.id), [ids.small]);
  const principal = expectStatus(await t.api('GET', '/api/requests', { token: tok.principal }), 200);
  assert.deepEqual(new Set(principal.items.map((r) => r.id)), new Set([ids.big, ids.small]));
  const partial = expectStatus(await t.api('GET', '/api/requests?status=PARTIALLY_APPROVED', { token: tok.principal }), 200);
  assert.deepEqual(partial.items.map((r) => r.id), [ids.big]);
  expectStatus(await t.api('GET', '/api/requests?status=NONSENSE', { token: tok.principal }), 422);
});

test('search treats wildcards literally', async () => {
  const all = expectStatus(await t.api('GET', `/api/requests?q=${encodeURIComponent('%')}`, { token: tok.principal }), 200);
  assert.equal(all.total, 0);
  const hit = expectStatus(await t.api('GET', '/api/requests?q=cartridge', { token: tok.principal }), 200);
  assert.deepEqual(hit.items.map((r) => r.id), [ids.small]);
});

test('the Principal dashboard counts the college; a requester\'s counts their own', async () => {
  const p = expectStatus(await t.api('GET', '/api/dashboard', { token: tok.principal }), 200);
  assert.equal(p.financialYear, '2026-27');
  assert.deepEqual([p.counts.total, p.counts.approved, p.counts.partiallyApproved], [2, 1, 1]);
  const i = expectStatus(await t.api('GET', '/api/dashboard', { token: tok.incharge }), 200);
  assert.deepEqual([i.counts.total, i.counts.approved], [1, 1]);
});

test('the dashboard counts requests sitting with CDC or the final authority', async () => {
  // At this point the big request has been decided, so nothing is with them.
  const p = expectStatus(await t.api('GET', '/api/dashboard', { token: tok.principal }), 200);
  assert.equal(p.counts.withHigherAuthority, 0);
  assert.equal('escalated' in p.counts, false, 'the never-set ESCALATED count is gone');
});

test('spending by budget head is scoped and counts only approved money', async () => {
  const p = expectStatus(await t.api('GET', '/api/reports/by-budget-head', { token: tok.principal }), 200);
  assert.equal(p.financialYear, '2026-27');
  const it = p.rows.find((r) => r.budgetHead.name === 'IT Equipment');
  const office = p.rows.find((r) => r.budgetHead.name === 'Office Expenses');
  assert.deepEqual([it.requests, it.approved, it.requested, it.sanctioned], [1, 1, 650000.5, 300000.5]);
  assert.deepEqual([office.approved, office.sanctioned], [1, 30000]);
  assert.equal(it.budgetHead.headType, 'CAPITAL');

  const incharge = expectStatus(await t.api('GET', '/api/reports/by-budget-head', { token: tok.incharge }), 200);
  assert.deepEqual(incharge.rows.map((r) => r.budgetHead.name), ['Office Expenses']);
});

test('CSV export neutralises spreadsheet formulas', async () => {
  const evil = expectStatus(await t.api('POST', '/api/requests', {
    token: tok.head,
    body: { title: '=HYPERLINK("http://evil.example","Click")', budgetHeadId: ids.it,
            items: [{ budgetItemId: ids['TRI-01'], quantity: 1, unitCost: 100 }] },
  }), 201);
  const res = await t.api('GET', '/api/exports/requests.csv', { token: tok.head });
  expectStatus(res, 200);
  assert.match(res.headers.get('content-type'), /text\/csv/);
  const text = res.buffer.toString('utf8');
  assert.equal(text.charCodeAt(0), 0xfeff, 'starts with a byte-order mark for Excel');
  assert.ok(text.includes('"\'=HYPERLINK(""http://evil.example"",""Click"")"'), text);
  expectStatus(await t.api('DELETE', `/api/requests/${evil.id}`, { token: tok.head }), 204);
});

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

test('an UP_CHAIN CDC comment reaches the Principal but not the requester', async () => {
  expectStatus(await t.api('POST', `/api/requests/${ids.big}/comments`, {
    token: tok.cdc,
    body: { body: 'Grant budget is unavailable. Consider Non-Grant budget.', visibility: 'UP_CHAIN' },
  }), 201);
  const seen = async (who) =>
    expectStatus(await t.api('GET', `/api/requests/${ids.big}/comments`, { token: tok[who] }), 200).length;
  assert.equal(await seen('principal'), 1);
  assert.equal(await seen('chairman'), 1);
  assert.equal(await seen('head'), 0);
});

test('requesters cannot post restricted comments, and outsiders cannot comment', async () => {
  expectStatus(await t.api('POST', `/api/requests/${ids.big}/comments`, {
    token: tok.head, body: { body: 'secret', visibility: 'STAGE_ONLY' } }), 422);
  expectStatus(await t.api('POST', `/api/requests/${ids.big}/comments`, {
    token: tok.incharge, body: { body: 'drive-by' } }), 404);
});

// ---------------------------------------------------------------------------
// Carry-forward
// ---------------------------------------------------------------------------

test('carry-forward refuses an earlier year', async () => {
  const years = expectStatus(await t.api('GET', '/api/financial-years', { token: tok.head }), 200);
  const earlier = years.find((y) => y.label === '2025-26').id;
  const res = expectStatus(await t.api('POST', `/api/requests/${ids.big}/carry-forward`, {
    token: tok.head, body: { financialYearId: earlier } }), 422);
  assert.equal(res.error.code, 'SP015');
});

test('carry-forward into the next year keeps the history and links back', async () => {
  const { rows } = await t.superuser.query(
    `INSERT INTO financial_years (label, start_date, end_date)
     VALUES ('2027-28', '2027-04-01', '2028-03-31') RETURNING financial_year_id`);
  const res = expectStatus(await t.api('POST', `/api/requests/${ids.big}/carry-forward`, {
    token: tok.head, body: { financialYearId: rows[0].financial_year_id } }), 201);
  assert.equal(res.financialYear.label, '2027-28');
  assert.equal(res.carriedForwardFrom.requestId, ids.big);
  assert.equal(res.carriedForwardFrom.financialYear, '2026-27');
  assert.equal(res.items.length, 3);

  const original = expectStatus(await t.api('GET', `/api/requests/${ids.big}`, { token: tok.head }), 200);
  assert.equal(original.status, 'CARRIED_FORWARD');
  const tl = expectStatus(await t.api('GET', `/api/requests/${ids.big}/timeline`, { token: tok.head }), 200);
  assert.equal(tl.at(-1).action, 'CARRY_FORWARD');
  assert.equal(tl.length, 4, 'the original history is preserved');

  const again = expectStatus(await t.api('POST', `/api/requests/${ids.big}/carry-forward`, {
    token: tok.head, body: { financialYearId: rows[0].financial_year_id } }), 409);
  assert.equal(again.error.code, 'SP014');
});
