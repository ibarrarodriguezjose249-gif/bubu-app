// PIN de entrega (sin Firebase, para poder probarlo aparte).
//  • Al crearse el pedido, el servidor genera un PIN de 4 dígitos que SOLO ve el cliente.
//  • Al entregar, el socio teclea el PIN que le dice el cliente; el servidor lo compara.
//  • Máximo 5 intentos. Después, el socio solo puede entregar con foto (queda para revisión).
const crypto = require('crypto');
const { configWithDefaults } = require('./saldos');

const MAX_ATTEMPTS = 5;
const round2 = (n) => Math.round(n * 100) / 100;

function newPin(randomInt = crypto.randomInt) {
  return String(randomInt(0, 10000)).padStart(4, '0');
}

// Compara sin filtrar por tiempo cuántos dígitos coinciden.
function samePin(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function validPrice(v) {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 100000 && round2(v) === v;
}

// Decide qué hacer con un intento de entrega con PIN.
// Devuelve { error } o { wrong: true, attemptsLeft } o { update } (campos a escribir en el pedido).
function pinDelivery({ uid, order, pinDoc, pin, finalPrice, cfg }) {
  if (!order) return { error: ['not-found', 'No encontramos el pedido.'] };
  if (order.providerId !== uid) return { error: ['permission-denied', 'Este pedido no es tuyo.'] };
  if (order.status !== 'ready') return { error: ['failed-precondition', 'El pedido no está listo para entregarse.'] };
  if (!pinDoc || typeof pinDoc.pin !== 'string') return { error: ['failed-precondition', 'Este pedido no tiene PIN. Entrega con foto.'] };
  const attempts = typeof pinDoc.attempts === 'number' ? pinDoc.attempts : 0;
  if (attempts >= MAX_ATTEMPTS) return { error: ['resource-exhausted', 'Se acabaron los intentos del PIN. Entrega con foto.'] };
  if (!/^[0-9]{4}$/.test(String(pin || ''))) return { error: ['invalid-argument', 'El PIN son 4 números.'] };

  // Total: si ya había total a pagar, es ESE (no se puede cambiar al entregar).
  const hasDue = typeof order.amountDue === 'number';
  const price = hasDue ? order.amountDue : finalPrice;
  if (!validPrice(price)) return { error: ['invalid-argument', 'Escribe cuánto cobraste.'] };

  if (!samePin(pin, pinDoc.pin)) {
    return { wrong: true, attempts: attempts + 1, attemptsLeft: MAX_ATTEMPTS - attempts - 1 };
  }
  const c = configWithDefaults(cfg);
  const update = {
    status: 'delivered',
    finalPrice: price,
    commissionPct: c.pct,
    commissionIvaPct: c.ivaPct,
    deliveredBy: 'provider',
    deliveryVerified: 'pin',
  };
  // Con tarjeta la cuota ya la fijó el servidor al cobrar; en efectivo/transferencia se anota la vigente.
  if ((order.paymentStatus || 'pending') !== 'paid') update.serviceFee = c.serviceFee;
  return { update };
}

module.exports = { MAX_ATTEMPTS, newPin, samePin, pinDelivery, validPrice };
