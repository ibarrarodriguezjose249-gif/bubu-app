const test = require('node:test');
const assert = require('node:assert');
const E = require('../entrega');

const order = (x = {}) => ({ providerId: 'lupe', customerId: 'ana', status: 'ready', amountDue: 150, paymentStatus: 'cash', ...x });
const pinDoc = (x = {}) => ({ pin: '0427', attempts: 0, ...x });
const run = (x = {}) => E.pinDelivery({ uid: 'lupe', order: order(), pinDoc: pinDoc(), pin: '0427', cfg: null, ...x });

test('PIN de 4 dígitos, con ceros a la izquierda', () => {
  assert.strictEqual(E.newPin(() => 7), '0007');
  assert.strictEqual(E.newPin(() => 9999), '9999');
  for (let i = 0; i < 200; i++) assert.match(E.newPin(), /^[0-9]{4}$/);
});

test('PIN correcto: entregado con total fijo y % vigente', () => {
  const r = run();
  assert.deepStrictEqual(r.update, { status: 'delivered', finalPrice: 150, commissionPct: 30, commissionIvaPct: 16, deliveredBy: 'provider', deliveryVerified: 'pin', serviceFee: 10 });
  // el socio no puede cambiar el total aunque mande otro
  assert.strictEqual(run({ finalPrice: 90 }).update.finalPrice, 150);
  // % del admin
  assert.strictEqual(run({ cfg: { pct: 12, ivaPct: 16, serviceFee: 5 } }).update.commissionPct, 12);
  // con tarjeta no se toca la cuota
  assert.ok(!('serviceFee' in run({ order: order({ paymentStatus: 'paid' }) }).update));
});

test('pedido viejo sin total: se usa lo que escribe el socio', () => {
  assert.strictEqual(run({ order: order({ amountDue: undefined }), finalPrice: 120 }).update.finalPrice, 120);
  assert.ok(run({ order: order({ amountDue: undefined }) }).error);
  assert.ok(run({ order: order({ amountDue: undefined }), finalPrice: -1 }).error);
});

test('PIN incorrecto suma intento; a los 5 se bloquea', () => {
  const r = run({ pin: '1111' });
  assert.deepStrictEqual(r, { wrong: true, attempts: 1, attemptsLeft: 4 });
  assert.strictEqual(run({ pin: '1111', pinDoc: pinDoc({ attempts: 4 }) }).attemptsLeft, 0);
  assert.strictEqual(run({ pinDoc: pinDoc({ attempts: 5 }) }).error[0], 'resource-exhausted'); // ni el correcto
});

test('solo el socio del pedido, en el paso correcto', () => {
  assert.strictEqual(run({ uid: 'eva' }).error[0], 'permission-denied');
  assert.strictEqual(run({ uid: 'ana' }).error[0], 'permission-denied');
  assert.strictEqual(run({ order: order({ status: 'accepted' }) }).error[0], 'failed-precondition');
  assert.strictEqual(run({ order: order({ status: 'in_progress' }) }).error[0], 'failed-precondition'); // primero "listo"
  assert.strictEqual(run({ order: order({ status: 'delivered' }) }).error[0], 'failed-precondition');
  assert.strictEqual(run({ order: null }).error[0], 'not-found');
  assert.strictEqual(run({ pinDoc: null }).error[0], 'failed-precondition');
  assert.strictEqual(run({ pin: '12a4' }).error[0], 'invalid-argument');
  assert.strictEqual(run({ pin: '04270' }).error[0], 'invalid-argument');
});
