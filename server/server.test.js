import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from './server.js';

let server;
let baseUrl;

test.before(async () => {
  server = createServer();
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test('health endpoint responds with ok', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body, { status: 'ok' });
});

test('products endpoint returns a product list', async () => {
  const response = await fetch(`${baseUrl}/api/products`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(Array.isArray(body));
  assert.ok(body.length > 0);
  assert.ok(body[0].title);
});

test('checkout session endpoint returns a redirect url', async () => {
  process.env.STRIPE_SECRET_KEY = '';
  process.env.STRIPE_SUCCESS_URL = 'http://localhost/success';
  process.env.STRIPE_CANCEL_URL = 'http://localhost/cancel';

  const response = await fetch(`${baseUrl}/api/create-checkout-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ title: 'Demo item', price: 25, quantity: 1 }] })
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(body.url);
  assert.equal(body.mock, true);
});

test('webhook creates an order and GET /api/orders returns it', async () => {
  const event = {
    type: 'mock.checkout.completed',
    data: {
      object: {
        id: 'sess_123',
        amount_total: 7425,
        display_items: [
          { description: 'Bloom Dress', amount: 7425, quantity: 1 }
        ]
      }
    }
  };

  const response = await fetch(`${baseUrl}/api/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event)
  });

  assert.equal(response.status, 200);
  const webhookBody = await response.json();
  assert.deepEqual(webhookBody, { received: true });

  const list = await fetch(`${baseUrl}/api/orders`);
  assert.equal(list.status, 200);
  const orders = await list.json();
  assert.ok(Array.isArray(orders));
  const found = orders.find(o => o.id === 'sess_123' || o.id === 'sess_123');
  assert.ok(found);
});

test('webhook signature verification rejects invalid signature', async () => {
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
  process.env.STRIPE_SECRET_KEY = ''

  const event = { type: 'checkout.session.completed', data: { object: { id: 'sess_sig_1', amount_total: 1000 } } }

  // no signature header provided
  const response = await fetch(`${baseUrl}/api/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event)
  })

  assert.equal(response.status, 400);
});

test('webhook signature verification accepts valid signature when signed', async () => {
  const crypto = await import('node:crypto')
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
  process.env.STRIPE_SECRET_KEY = 'sk_test_mock'

  const event = { type: 'mock.checkout.completed', data: { object: { id: 'sess_signed_1', amount_total: 2500, display_items: [{ description: 'Signed Item', amount: 2500, quantity: 1 }] } } }
  const raw = JSON.stringify(event)
  const t = Math.floor(Date.now() / 1000)
  const payload = `${t}.${raw}`
  const h = crypto.createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET).update(payload).digest('hex')
  const sig = `t=${t},v1=${h}`

  const response = await fetch(`${baseUrl}/api/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': sig },
    body: raw
  })

  assert.equal(response.status, 200)
  const webhookBody = await response.json()
  assert.deepEqual(webhookBody, { received: true })

  const list = await fetch(`${baseUrl}/api/orders`)
  const orders = await list.json()
  const found = orders.find(o => o.id === 'sess_signed_1')
  assert.ok(found)
})
