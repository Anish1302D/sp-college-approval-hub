import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { expectStatus, pdf, startApi } from './helpers.js';

let t;
const tok = {};
const who = {};
let issueId;

before(async () => {
  t = await startApi();
  for (const [key, email] of Object.entries({
    head: 'head.cs@spcollege.edu', incharge: 'incharge@spcollege.edu',
    pc1: 'pc1@spcollege.edu', principal: 'principal@spcollege.edu',
  })) {
    tok[key] = await t.login(email);
    who[key] = expectStatus(await t.api('GET', '/api/auth/me', { token: tok[key] }), 200).id;
  }
});
after(() => t.close());

test('anyone can raise an issue, and the Principal hears about it', async () => {
  const issue = expectStatus(await t.api('POST', '/api/issues', {
    token: tok.head, body: { title: 'Projector in room 204 is broken', description: 'No image since Monday.' },
  }), 201);
  issueId = issue.id;
  assert.match(issue.issueNumber, /^ISS-\d{4,}$/);
  assert.equal(issue.status, 'SUBMITTED');
  assert.deepEqual(issue.events.map((e) => e.action), ['CREATED']);

  const n = expectStatus(await t.api('GET', '/api/notifications', { token: tok.principal }), 200);
  assert.ok(n.items.some((x) => x.issue?.id === issueId));
});

test('only participants can see an issue', async () => {
  expectStatus(await t.api('GET', `/api/issues/${issueId}`, { token: tok.incharge }), 404);
  expectStatus(await t.api('GET', `/api/issues/${issueId}`, { token: tok.principal }), 200);
});

test('the raiser cannot assign or review their own issue', async () => {
  expectStatus(await t.api('PATCH', `/api/issues/${issueId}`, {
    token: tok.head, body: { assignedTo: who.pc1 } }), 403);
  expectStatus(await t.api('PATCH', `/api/issues/${issueId}`, {
    token: tok.head, body: { status: 'IN_REVIEW' } }), 403);
});

test('the Principal reviews and assigns it', async () => {
  const res = expectStatus(await t.api('PATCH', `/api/issues/${issueId}`, {
    token: tok.principal, body: { status: 'IN_REVIEW', assignedTo: who.pc1, note: 'Please check the lamp' },
  }), 200);
  assert.equal(res.status, 'IN_REVIEW');
  assert.equal(res.assignedTo.id, who.pc1);
  assert.deepEqual(res.events.map((e) => e.action), ['CREATED', 'ASSIGNED', 'IN_REVIEW']);
});

test('the assignee can now see it, attach a photo, and resolve it', async () => {
  const detail = expectStatus(await t.api('GET', `/api/issues/${issueId}`, { token: tok.pc1 }), 200);
  assert.deepEqual(detail.permissions.statusesAllowed, ['RESOLVED']);
  expectStatus(await t.api('POST', `/api/issues/${issueId}/attachments`,
    { token: tok.pc1, form: pdf('service-report.pdf').form }), 201);
  expectStatus(await t.api('PATCH', `/api/issues/${issueId}`, {
    token: tok.pc1, body: { status: 'CLOSED' } }), 403);
  const res = expectStatus(await t.api('PATCH', `/api/issues/${issueId}`, {
    token: tok.pc1, body: { status: 'RESOLVED', note: 'Lamp replaced' } }), 200);
  assert.equal(res.status, 'RESOLVED');
  assert.ok(res.resolvedAt);
});

test('the raiser is told, sees the attachment, and confirms by closing', async () => {
  const n = expectStatus(await t.api('GET', '/api/notifications', { token: tok.head }), 200);
  assert.ok(n.items.some((x) => x.issue?.id === issueId && /resolved/.test(x.subject)));
  const detail = expectStatus(await t.api('GET', `/api/issues/${issueId}`, { token: tok.head }), 200);
  assert.equal(detail.attachments.length, 1);
  assert.deepEqual(detail.permissions.statusesAllowed, ['CLOSED']);
  expectStatus(await t.api('PATCH', `/api/issues/${issueId}`, { token: tok.head, body: { status: 'CLOSED' } }), 200);
});

test('a closed issue is final', async () => {
  expectStatus(await t.api('PATCH', `/api/issues/${issueId}`, {
    token: tok.principal, body: { status: 'IN_REVIEW' } }), 409);
  expectStatus(await t.api('POST', `/api/issues/${issueId}/events`, {
    token: tok.head, body: { note: 'one more thing' } }), 409);
});

test('escalating needs a target, and notifies them', async () => {
  const issue = expectStatus(await t.api('POST', '/api/issues', {
    token: tok.incharge, body: { title: 'Lab roof leaks', description: 'Needs structural repair.' } }), 201);
  expectStatus(await t.api('PATCH', `/api/issues/${issue.id}`, {
    token: tok.principal, body: { status: 'ESCALATED' } }), 422);
  const { rows } = await t.superuser.query("SELECT user_id FROM users WHERE email = 'chairman@spcollege.edu'");
  const res = expectStatus(await t.api('PATCH', `/api/issues/${issue.id}`, {
    token: tok.principal, body: { escalatedTo: rows[0].user_id } }), 200);
  assert.equal(res.status, 'ESCALATED');
  const chairman = await t.login('chairman@spcollege.edu');
  expectStatus(await t.api('GET', `/api/issues/${issue.id}`, { token: chairman }), 200);
});

test('lists are scoped', async () => {
  const mine = expectStatus(await t.api('GET', '/api/issues?mine=true', { token: tok.head }), 200);
  assert.deepEqual(mine.items.map((i) => i.id), [issueId]);
  const incharge = expectStatus(await t.api('GET', '/api/issues', { token: tok.incharge }), 200);
  assert.ok(incharge.items.every((i) => i.raisedBy.id === who.incharge));
  const principal = expectStatus(await t.api('GET', '/api/issues', { token: tok.principal }), 200);
  assert.equal(principal.total, 2);
});
