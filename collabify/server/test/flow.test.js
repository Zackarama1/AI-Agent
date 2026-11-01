import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, client, FAKE_KEY } from './helpers.js';

let srv;
before(async () => (srv = await startTestServer()));
after(() => srv.close());

test('full marketplace flow: post -> apply -> hire -> escrow -> release -> review', async () => {
  const boss = client(srv.base);
  const stu = client(srv.base);
  const other = client(srv.base);

  // Accounts
  let r = await boss.post('/api/auth/register', {
    email: 'founder@startup.io', password: 'password123', role: 'entrepreneur', name: 'Fay Founder',
    company: 'Startup Ltd', publicKey: FAKE_KEY, wrappedPrivateKey: FAKE_KEY,
  });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const bossId = r.data.user.id;
  assert.equal(r.data.user.passwordHash, undefined);

  r = await stu.post('/api/auth/register', {
    email: 'sam@gmail.com', password: 'password123', role: 'student', name: 'Sam Student',
    publicKey: FAKE_KEY, wrappedPrivateKey: FAKE_KEY,
  });
  assert.equal(r.status, 201);
  const stuId = r.data.user.id;
  await stu.put('/api/users/me', { skills: ['React', 'Figma'], headline: 'CS @ UCL' });

  r = await boss.post('/api/auth/register', { email: 'founder@startup.io', password: 'password123', role: 'entrepreneur', name: 'Dup' });
  assert.equal(r.status, 409);

  // Post a job
  const jobBody = {
    title: 'Build a landing page', description: 'We need a responsive landing page built in React with a signup form.',
    category: 'Software Development', budgetPence: 50000, duration: '2 weeks', skills: ['React', 'CSS'],
  };
  r = await stu.post('/api/jobs', jobBody);
  assert.equal(r.status, 403, 'students cannot post jobs');
  r = await boss.post('/api/jobs', jobBody);
  assert.equal(r.status, 201);
  const jobId = r.data.job.id;

  // Unverified students cannot apply
  const application = { coverLetter: 'I have built several React landing pages for societies at uni.', proposedPence: 50000 };
  r = await stu.post(`/api/jobs/${jobId}/applications`, application);
  assert.equal(r.status, 403);

  // Academic verification
  r = await stu.post('/api/verification/request', { academicEmail: 'sam@gmail.com' });
  assert.equal(r.status, 400, 'non-academic email rejected');
  r = await stu.post('/api/verification/request', { academicEmail: 'sam.student@ucl.ac.uk' });
  assert.equal(r.status, 200);
  const code = srv.emails.at(-1).text.match(/\d{6}/)[0];
  r = await stu.post('/api/verification/confirm', { code: code === '000000' ? '111111' : '000000' });
  assert.equal(r.status, 400);
  r = await stu.post('/api/verification/confirm', { code });
  assert.equal(r.status, 200);
  assert.equal(r.data.user.verified, true);

  // Apply + match score
  r = await stu.post(`/api/jobs/${jobId}/applications`, application);
  assert.equal(r.status, 201);
  const appId = r.data.application.id;
  r = await stu.post(`/api/jobs/${jobId}/applications`, application);
  assert.equal(r.status, 409, 'no duplicate applications');

  r = await boss.get(`/api/jobs/${jobId}`);
  assert.equal(r.data.applications.length, 1);
  assert.ok(r.data.applications[0].matchScore >= 45);

  r = await other.get(`/api/jobs/${jobId}`);
  assert.equal(r.data.applications, undefined, 'applications are private to the owner');

  // Hire -> contract with 15% commission
  r = await stu.post(`/api/applications/${appId}/accept`);
  assert.equal(r.status, 403);
  r = await boss.post(`/api/applications/${appId}/accept`);
  assert.equal(r.status, 201);
  const cid = r.data.contractId;

  r = await boss.get(`/api/contracts/${cid}`);
  assert.equal(r.data.contract.amountPence, 50000);
  assert.equal(r.data.contract.commissionPence, 7500);
  assert.equal(r.data.contract.payoutPence, 42500);
  assert.equal(r.data.contract.status, 'awaiting_funding');

  r = await other.get(`/api/contracts/${cid}`);
  assert.equal(r.status, 401);

  // Escrow lifecycle
  r = await stu.post(`/api/contracts/${cid}/submit`, { note: 'Done!' });
  assert.equal(r.status, 409, 'cannot submit before funding');
  r = await boss.post(`/api/contracts/${cid}/release`);
  assert.equal(r.status, 409, 'cannot release before funding');
  r = await boss.post(`/api/contracts/${cid}/fund`);
  assert.equal(r.data.contract.status, 'funded');
  r = await stu.post(`/api/contracts/${cid}/submit`, { note: 'Deployed at https://example.com - repo shared.' });
  assert.equal(r.data.contract.status, 'submitted');
  r = await stu.post(`/api/contracts/${cid}/release`);
  assert.equal(r.status, 403, 'student cannot release funds');
  r = await boss.post(`/api/contracts/${cid}/release`);
  assert.equal(r.data.contract.status, 'released');

  r = await boss.get(`/api/contracts/${cid}`);
  const kinds = Object.fromEntries(r.data.ledger.map((e) => [e.kind, e.amountPence]));
  assert.deepEqual(kinds, { escrow_deposit: 50000, payout: 42500, platform_commission: 7500 });

  r = await stu.get('/api/billing/summary');
  assert.equal(r.data.summary.earned, 42500);

  // Portfolio auto-populated, reviews
  r = await stu.post(`/api/contracts/${cid}/reviews`, { rating: 5, comment: 'Great client' });
  assert.equal(r.status, 201);
  r = await boss.post(`/api/contracts/${cid}/reviews`, { rating: 4, comment: 'Solid work' });
  assert.equal(r.status, 201);
  r = await boss.post(`/api/contracts/${cid}/reviews`, { rating: 4 });
  assert.equal(r.status, 409);

  r = await other.get(`/api/users/${stuId}`);
  assert.equal(r.data.user.rating.average, 4);
  assert.equal(r.data.user.completedProjects, 1);
  assert.equal(r.data.portfolio.length, 1);
  assert.equal(r.data.user.wrappedPrivateKey, undefined);

  r = await other.get(`/api/users/${bossId}`);
  assert.equal(r.data.user.rating.average, 5);
});

test('encrypted messaging stores ciphertext only and enforces membership', async () => {
  const a = client(srv.base);
  const b = client(srv.base);
  const c = client(srv.base);
  const reg = (cl, email, role) =>
    cl.post('/api/auth/register', { email, password: 'password123', role, name: 'User ' + email.split('@')[0], publicKey: FAKE_KEY, wrappedPrivateKey: FAKE_KEY });
  const ua = (await reg(a, 'a@biz.com', 'entrepreneur')).data.user;
  const ub = (await reg(b, 'b@x.com', 'student')).data.user;
  await reg(c, 'c@x.com', 'student');

  let r = await b.post('/api/conversations', { userId: (await c.get('/api/auth/me')).data.user.id });
  assert.equal(r.status, 403, 'student-to-student messaging blocked');

  r = await a.post('/api/conversations', { userId: ub.id });
  assert.equal(r.status, 201);
  const conv = r.data.conversationId;
  r = await b.post('/api/conversations', { userId: ua.id });
  assert.equal(r.data.conversationId, conv, 'same conversation either direction');

  r = await a.post(`/api/conversations/${conv}/messages`, { ciphertext: 'q2xhc3NpZmllZA==', iv: 'AAAAAAAAAAAAAAAA' });
  assert.equal(r.status, 201);
  r = await b.get('/api/conversations');
  assert.equal(r.data.conversations[0].unread, 1);
  r = await c.get(`/api/conversations/${conv}/messages`);
  assert.equal(r.status, 403);
  const row = srv.db.prepare('SELECT * FROM messages').get();
  assert.equal(row.ciphertext, 'q2xhc3NpZmllZA==');
  assert.equal(Object.keys(row).includes('body'), false);
});

test('plans: free entrepreneurs are limited to 2 active listings, upgrades lift the limit', async () => {
  const e = client(srv.base);
  await e.post('/api/auth/register', { email: 'limits@biz.com', password: 'password123', role: 'entrepreneur', name: 'Lim' });
  const job = (n) => ({
    title: `Job number ${n}`, description: 'A sufficiently long description for validation purposes here.',
    category: 'Design', budgetPence: 2000, skills: ['Figma'],
  });
  assert.equal((await e.post('/api/jobs', job(1))).status, 201);
  assert.equal((await e.post('/api/jobs', job(2))).status, 201);
  assert.equal((await e.post('/api/jobs', job(3))).status, 403);
  const r = await e.post('/api/billing/subscribe', { plan: 'growth' });
  assert.equal(r.data.user.plan, 'growth');
  const posted = await e.post('/api/jobs', job(3));
  assert.equal(posted.status, 201);
  assert.equal(posted.data.job.priority, true);

  const f = await e.post(`/api/jobs/${posted.data.job.id}/feature`);
  assert.equal(f.data.job.featured, true);
  const list = await e.get('/api/jobs');
  assert.equal(list.data.jobs[0].id, posted.data.job.id, 'featured jobs list first');
});

test('rejects non-JSON state-changing requests (CSRF guard)', async () => {
  const res = await fetch(srv.base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'email=a&password=b',
  });
  assert.equal(res.status, 415);
});
