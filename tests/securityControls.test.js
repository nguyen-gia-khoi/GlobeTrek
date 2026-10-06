const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { verifyWebhook } = require('../src/Middleware/security/webhookAuth');
const { allowedOrigins } = require('../src/config/cors');
const redis = require('../src/config/redis');

test.after(async () => {
  if (redis.status !== 'end') await redis.quit();
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
});

test('webhook rejects missing, invalid, and replayed signatures', async () => {
  process.env.WEBHOOK_SECRET = 'webhook-test-secret';
  const rawBody = Buffer.from('{"orderID":"1","status":200}');
  const timestamp = String(Date.now());
  const signature = crypto.createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(`${timestamp}.${rawBody.toString()}`)
    .digest('hex');

  const invoke = (headers) => new Promise((resolve) => {
    const req = {
      rawBody,
      get: (name) => headers[name.toLowerCase()] || headers[name],
    };
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json() { resolve(this.statusCode); },
    };
    verifyWebhook(req, res, () => resolve(200));
  });

  assert.equal(await invoke({}), 401);
  assert.equal(await invoke({
    'x-globetrek-timestamp': timestamp,
    'x-globetrek-signature': 'bad-signature',
  }), 401);
  assert.equal(await invoke({
    'x-globetrek-timestamp': timestamp,
    'x-globetrek-signature': signature,
  }), 200);
  assert.equal(await invoke({
    'x-globetrek-timestamp': timestamp,
    'x-globetrek-signature': signature,
  }), 409);
});

test('CORS allowlist excludes wildcard and development localhost stays out of production', () => {
  const previous = {
    nodeEnv: process.env.NODE_ENV,
    origins: process.env.CORS_ORIGINS,
    frontend: process.env.FRONTEND_URL,
    client: process.env.CLIENT_URL,
    redirect: process.env.VITE_REDIRECT_URL,
  };
  process.env.NODE_ENV = 'production';
  process.env.CORS_ORIGINS = 'https://globetrek-six.vercel.app,*';
  process.env.FRONTEND_URL = 'https://globetrek-six.vercel.app';
  process.env.CLIENT_URL = 'https://globetrek-six.vercel.app';
  process.env.VITE_REDIRECT_URL = 'https://globetrek-six.vercel.app';
  const origins = allowedOrigins();
  assert.equal(origins.includes('*'), false);
  assert.equal(origins.includes('http://localhost:5173'), false);
  assert.equal(origins.includes('https://globetrek-six.vercel.app'), true);
  process.env.NODE_ENV = previous.nodeEnv;
  process.env.CORS_ORIGINS = previous.origins;
  process.env.FRONTEND_URL = previous.frontend;
  process.env.CLIENT_URL = previous.client;
  process.env.VITE_REDIRECT_URL = previous.redirect;
});

test('payout endpoint stays disabled and does not trust a client amount', async () => {
  mongoose.set('bufferCommands', false);
  const { processMonthlyPayments } = require('../src/controllers/Admin/revenueController');
  const result = await new Promise((resolve) => {
    const req = { user: { _id: 'admin', role: 'admin' }, body: { partneremail: 'a@b.c', partnerAmount: 999999999 }, ip: '127.0.0.1' };
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) { resolve({ status: this.statusCode, body }); },
    };
    processMonthlyPayments(req, res);
  });
  assert.equal(result.status, 403);
  assert.equal(result.body.message, 'Đối soát đang tạm khóa');
});
