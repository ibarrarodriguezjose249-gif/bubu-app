const test = require('node:test');
const assert = require('node:assert');
const S = require('../saldos');

const del = (x) => ({ status: 'delivered', commissionPct: 30, commissionIvaPct: 16, ...x });

test('comisión 30 % + IVA: $100 → $34.80', () => {
  assert.strictEqual(S.commissionOf(del({ finalPrice: 100 })), 34.8);
  assert.strictEqual(S.commissionOf(del({ finalPrice: 150 })), 52.2);
  assert.strictEqual(S.commissionOf({ status: 'ready', finalPrice: 100 }), 0);
});

test('tarjeta: BÜBÜ le debe total − comisión; efectivo: el socio debe la comisión', () => {
  assert.strictEqual(S.netForProvider(del({ finalPrice: 100, paymentStatus: 'paid' })), 65.2);
  assert.strictEqual(S.netForProvider(del({ finalPrice: 100, paymentStatus: 'cash' })), -34.8);
  // efectivo con cuota de servicio: el socio la cobró, la debe
  assert.strictEqual(S.netForProvider(del({ finalPrice: 100, paymentStatus: 'cash', serviceFee: 10 })), -44.8);
  // transferencia directa al socio: igual que efectivo
  assert.strictEqual(S.netForProvider(del({ finalPrice: 100, paymentStatus: 'transfer_ok', serviceFee: 10 })), -44.8);
  // tarjeta: la cuota ya llegó a BÜBÜ, no afecta al socio
  assert.strictEqual(S.netForProvider(del({ finalPrice: 100, paymentStatus: 'paid', serviceFee: 10 })), 65.2);
});

test('saldo con depósitos y pagos del socio', () => {
  const orders = [del({ finalPrice: 100, paymentStatus: 'paid' }), del({ finalPrice: 100 }), { status: 'in_progress', amountDue: 999 }];
  const b = S.balanceOf(orders, [{ amount: 10 }], [{ amount: 30 }]);
  // 65.2 − 34.8 = 30.4 ; −30 depositado ; +10 pagado
  assert.strictEqual(b.balance, 10.4);
  assert.strictEqual(b.owed, 69.6);
});

test('bloqueo: solo si debe MÁS que el límite; límite 0 = nunca', () => {
  assert.ok(S.isBlocked(-301, 300));
  assert.ok(!S.isBlocked(-300, 300));
  assert.ok(!S.isBlocked(50, 300));
  assert.ok(!S.isBlocked(-5000, 0));
});

test('configuración por omisión', () => {
  assert.deepStrictEqual(S.configWithDefaults(null), { pct: 30, ivaPct: 16, serviceFee: 10, debtLimit: 300, cardEnabled: false });
  assert.strictEqual(S.configWithDefaults({ cardEnabled: true }).cardEnabled, true);
  assert.strictEqual(S.configWithDefaults({ pct: 25 }).pct, 25);
});

test('semana de corte: sábado a viernes', () => {
  const fri = new Date(2026, 9, 30, 23, 0).getTime(); // viernes 30 oct
  const sat = new Date(2026, 9, 31, 1, 0).getTime();  // sábado 31 oct
  assert.strictEqual(new Date(S.cutWeekStart(fri)).getDate(), 24); // sábado 24
  assert.strictEqual(new Date(S.cutWeekStart(sat)).getDate(), 31);
});
