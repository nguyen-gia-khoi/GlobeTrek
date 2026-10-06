const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const cookieParser = require('cookie-parser');
const { classifySession, accountAllowed } = require('../src/Middleware/authPolicy');
const { createAuthMiddleware } = require('../src/Middleware/authMiddleware');
const { issueCsrf, verifyCsrf } = require('../src/Middleware/security/csrf');

const listen = (app) => new Promise((resolve) => {
  const server = app.listen(0, () => resolve(server));
});

const adminRoutes = require('../src/routes/Admin/orderRoutes');
const partnerRoutes = require('../src/routes/Partner/partnerToursRoutes');
const countryRoutes = require('../src/routes/Admin/countryRoutes');
const regionRoutes = require('../src/routes/Admin/regionRoutes');
const { requireAdmin, requireVerifiedPartner } = require('../src/Middleware/authMiddleware');
const redis = require('../src/config/redis');

test.after(async () => {
  if (redis.status !== 'end') await redis.quit();
});

test('dual portal cookies are rejected and wrong-role cookies do not elevate', () => {
  assert.equal(classifySession({
    AdminaccessToken: 'admin',
    PartneraccessToken: 'partner',
  }, 'admin').status, 401);
  assert.equal(classifySession({ PartneraccessToken: 'partner' }, 'admin').status, 403);
  assert.equal(classifySession({ AdminaccessToken: 'admin' }, 'partner').status, 403);
  assert.equal(classifySession({ AdminaccessToken: 'admin' }, 'admin').cookie, 'AdminaccessToken');
  assert.equal(classifySession({ PartneraccessToken: 'partner' }, 'partner').cookie, 'PartneraccessToken');
});

test('banned, unverified, and wrong roles are denied', () => {
  assert.equal(accountAllowed({ role: 'partner', status: 'verified', UserStatus: 'unban' }, 'admin').status, 403);
  assert.equal(accountAllowed({ role: 'admin', UserStatus: 'unban' }, 'partner').status, 403);
  assert.equal(accountAllowed({ role: 'partner', status: 'unverify', UserStatus: 'unban' }, 'partner').reason, 'unverified');
  assert.equal(accountAllowed({ role: 'admin', UserStatus: 'ban' }, 'admin').reason, 'banned');
  assert.equal(accountAllowed({ role: 'partner', status: 'verified', UserStatus: 'unban' }, 'partner').ok, true);
});

test('portal routes keep admin and partner middleware separate', () => {
  assert.equal(adminRoutes.stack.some((layer) => layer.handle === requireAdmin), true);
  assert.equal(partnerRoutes.stack.some((layer) => layer.handle === requireVerifiedPartner), true);
  const countryDeletes = countryRoutes.stack
    .filter((layer) => layer.route && layer.route.path === '/delete/:id')
    .flatMap((layer) => Object.keys(layer.route.methods));
  const regionDeletes = regionRoutes.stack
    .filter((layer) => layer.route && layer.route.path === '/delete/:id')
    .flatMap((layer) => Object.keys(layer.route.methods));
  assert.deepEqual(countryDeletes, ['post']);
  assert.deepEqual(regionDeletes, ['post']);
});

test('authenticated requests honor role boundaries and immediate revocation', async () => {
  const users = new Map([
    ['admin', { _id: 'admin', role: 'admin', UserStatus: 'unban' }],
    ['partner', { _id: 'partner', role: 'partner', status: 'verified', UserStatus: 'unban' }],
    ['pending', { _id: 'pending', role: 'partner', status: 'unverify', UserStatus: 'unban' }],
    ['banned', { _id: 'banned', role: 'admin', UserStatus: 'ban' }],
  ]);
  const tokens = new Map([
    ['admin', 'admin-token'],
    ['partner', 'partner-token'],
    ['pending', 'pending-token'],
    ['banned', 'banned-token'],
  ]);
  const auth = createAuthMiddleware({
    verifyJwt: (token) => ({ userId: [...tokens.entries()].find(([, value]) => value === token)[0] }),
    readStoredToken: async (userId) => tokens.get(userId),
    findUser: async (userId) => users.get(userId),
    revoke: async (userId) => tokens.delete(userId),
  });
  const app = express();
  app.use(cookieParser());
  app.get('/admin', auth.requireAdmin, (req, res) => res.json({ role: req.user.role }));
  app.get('/partner', auth.requireVerifiedPartner, (req, res) => res.json({ role: req.user.role }));
  const server = await listen(app);
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    const partnerOnAdmin = await fetch(`${base}/admin`, { headers: { Cookie: 'PartneraccessToken=partner-token', Accept: 'application/json' } });
    assert.equal(partnerOnAdmin.status, 403);
    const adminOnPartner = await fetch(`${base}/partner`, { headers: { Cookie: 'AdminaccessToken=admin-token', Accept: 'application/json' } });
    assert.equal(adminOnPartner.status, 403);
    const both = await fetch(`${base}/admin`, { headers: { Cookie: 'AdminaccessToken=admin-token; PartneraccessToken=partner-token', Accept: 'application/json' } });
    assert.equal(both.status, 401);
    const pending = await fetch(`${base}/partner`, { headers: { Cookie: 'PartneraccessToken=pending-token', Accept: 'application/json' } });
    assert.equal(pending.status, 403);
    assert.equal(tokens.has('pending'), false);
    const banned = await fetch(`${base}/admin`, { headers: { Cookie: 'AdminaccessToken=banned-token', Accept: 'application/json' } });
    assert.equal(banned.status, 403);
    assert.equal(tokens.has('banned'), false);
    const partnerOk = await fetch(`${base}/partner`, { headers: { Cookie: 'PartneraccessToken=partner-token', Accept: 'application/json' } });
    assert.equal(partnerOk.status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('cookie-authenticated mutations require a matching CSRF token', async () => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(issueCsrf);
  app.use(verifyCsrf);
  app.post('/admin/users', (req, res) => res.json({ ok: true }));
  const server = await listen(app);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const rejected = await fetch(`${base}/admin/users`, {
      method: 'POST',
      headers: { Cookie: 'AdminaccessToken=session; gt_csrf=abc', 'Content-Type': 'application/json', Accept: 'application/json' },
      body: '{}',
    });
    assert.equal(rejected.status, 403);
    const accepted = await fetch(`${base}/admin/users`, {
      method: 'POST',
      headers: {
        Cookie: 'AdminaccessToken=session; gt_csrf=abc',
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-csrf-token': 'abc',
      },
      body: '{}',
    });
    assert.equal(accepted.status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
