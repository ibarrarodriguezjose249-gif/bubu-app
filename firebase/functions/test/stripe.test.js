const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const ST = require('../stripe');

const order = { id: 'o1', customerId: 'ana', providerName: 'Lavandería Ana', status: 'in_progress', amountDue: 150 };
const session = (x = {}) => ({ id: 'cs_1', payment_intent: 'pi_1', payment_status: 'paid', amount_total: 16000, currency: 'mxn', livemode: false, metadata: { orderId: 'o1', amountDue: '150', serviceFee: '10' }, ...x });
const sign = (body, secret, t) => `t=${t},v1=${crypto.createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;

test('solo el cliente, con total y sin pagar, puede cobrar', () => {
  assert.strictEqual(ST.cannotCharge(order, 'ana'), null);
  assert.match(ST.cannotCharge(order, 'eva'), /no es tuyo/);
  assert.match(ST.cannotCharge({ ...order, amountDue: undefined }, 'ana'), /total/);
  assert.match(ST.cannotCharge({ ...order, paymentStatus: 'paid' }, 'ana'), /ya está pagado/);
});

test('sesión: servicio + cuota de servicio en centavos MXN y referencia al pedido', () => {
  const p = ST.sessionParams(order, 10, 'https://x/pagoListo');
  assert.strictEqual(p.get('line_items[0][price_data][unit_amount]'), '15000');
  assert.strictEqual(p.get('line_items[1][price_data][unit_amount]'), '1000');
  assert.strictEqual(p.get('line_items[0][price_data][currency]'), 'mxn');
  assert.strictEqual(p.get('metadata[orderId]'), 'o1');
  assert.strictEqual(p.get('success_url'), 'https://x/pagoListo?estado=pagado');
  assert.strictEqual(ST.sessionParams(order, 0, 'u').get('line_items[1][quantity]'), null);
});

test('llave de prueba vs real', () => {
  assert.ok(ST.isTestKey('sk_test_123'));
  assert.ok(ST.isTestKey('rk_test_123'));
  assert.ok(!ST.isTestKey('sk_live_123'));
});

test('firma del aviso: válida, alterada, vieja o ausente', () => {
  const body = JSON.stringify({ type: 'checkout.session.completed', data: { object: session() } });
  const now = 1_800_000_000;
  assert.strictEqual(ST.verifyEvent(Buffer.from(body), sign(body, 'whsec_x', now), 'whsec_x', now).type, 'checkout.session.completed');
  assert.throws(() => ST.verifyEvent(body.replace('16000', '1'), sign(body, 'whsec_x', now), 'whsec_x', now), /no coincide/);
  assert.throws(() => ST.verifyEvent(body, sign(body, 'otra', now), 'whsec_x', now), /no coincide/);
  assert.throws(() => ST.verifyEvent(body, sign(body, 'whsec_x', now - 3600), 'whsec_x', now), /viejo/);
  assert.throws(() => ST.verifyEvent(body, '', 'whsec_x', now), /sin firma/);
});

test('pago completo por total + cuota → pagado (con cuota guardada)', () => {
  const u = ST.sessionUpdate(order, session());
  assert.strictEqual(u.paymentStatus, 'paid');
  assert.strictEqual(u.paymentId, 'pi_1');
  assert.strictEqual(u.serviceFee, 10);
  assert.strictEqual(u.paidAmount, 160);
});

test('no pagado, de otro pedido, monto o moneda distintos', () => {
  assert.strictEqual(ST.sessionUpdate(order, session({ payment_status: 'unpaid' })), null);
  assert.strictEqual(ST.sessionUpdate(order, session({ metadata: { orderId: 'otro', serviceFee: '10' } })), null);
  assert.strictEqual(ST.sessionUpdate(order, session({ amount_total: 100 })).paymentStatus, 'review');
  assert.strictEqual(ST.sessionUpdate(order, session({ currency: 'usd' })).paymentStatus, 'review');
  assert.strictEqual(ST.sessionUpdate({ ...order, amountDue: 170 }, session()).paymentStatus, 'review');
});

test('aviso repetido no hace nada; segundo pago → revisión sin pisar el primero', () => {
  assert.strictEqual(ST.sessionUpdate({ ...order, paymentStatus: 'paid', paymentId: 'pi_1' }, session()), null);
  const u = ST.sessionUpdate({ ...order, paymentStatus: 'paid', paymentId: 'pi_1' }, session({ payment_intent: 'pi_2' }));
  assert.strictEqual(u.paymentStatus, 'review');
  assert.strictEqual(u.paymentId, undefined);
});

test('stripeFetch manda la llave y avisa errores', async () => {
  let seen;
  await ST.stripeFetch('/checkout/sessions', 'sk_test_x', { method: 'POST', form: new URLSearchParams({ a: '1' }), fetchImpl: async (url, o) => { seen = { url, o }; return { status: 200, json: async () => ({ id: 'cs' }) }; } });
  assert.strictEqual(seen.url, 'https://api.stripe.com/v1/checkout/sessions');
  assert.strictEqual(seen.o.headers.Authorization, 'Bearer sk_test_x');
  assert.strictEqual(seen.o.body, 'a=1');
  await assert.rejects(ST.stripeFetch('/x', 'k', { fetchImpl: async () => ({ status: 401, json: async () => ({ error: { message: 'Invalid API Key' } }) }) }), /401/);
});
