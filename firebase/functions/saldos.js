// Saldo de cada socio con BÜBÜ (misma cuenta que la app, la web y el panel).
//   Comisión de un pedido entregado = total × % × (1 + IVA %)
//   Pagado con tarjeta → BÜBÜ le debe al socio: total − comisión   (positivo)
//   Efectivo o transferencia directa al socio → el socio le debe a BÜBÜ la comisión + la cuota de servicio
//                        que cobró al cliente                       (negativo)
//   Saldo = Σ netos − depósitos que BÜBÜ ya le hizo + pagos que el socio ya hizo
// La cuota de servicio es 100 % de BÜBÜ: con tarjeta ya llegó a BÜBÜ por Stripe;
// en efectivo la cobró el socio y por eso la debe.
const DEFAULTS = { pct: 30, ivaPct: 16, serviceFee: 10, debtLimit: 300 };
const round2 = (n) => Math.round(n * 100) / 100;

function configWithDefaults(c) {
  const v = (k) => (c && typeof c[k] === 'number' ? c[k] : DEFAULTS[k]);
  return { pct: v('pct'), ivaPct: v('ivaPct'), serviceFee: v('serviceFee'), debtLimit: v('debtLimit'), cardEnabled: !!(c && c.cardEnabled === true) };
}

function commissionOf(o) {
  if (!o || o.status !== 'delivered' || typeof o.finalPrice !== 'number') return 0;
  const pct = typeof o.commissionPct === 'number' ? o.commissionPct : DEFAULTS.pct;
  const iva = typeof o.commissionIvaPct === 'number' ? o.commissionIvaPct : 0; // pedidos viejos: sin IVA
  return round2(o.finalPrice * (pct / 100) * (1 + iva / 100));
}

function netForProvider(o) {
  if (!o || o.status !== 'delivered' || typeof o.finalPrice !== 'number') return 0;
  if (o.paymentStatus === 'paid') return round2(o.finalPrice - commissionOf(o));
  return round2(-commissionOf(o) - (typeof o.serviceFee === 'number' ? o.serviceFee : 0));
}

function balanceOf(orders, payments, payouts) {
  const sum = (l, f) => round2((l || []).reduce((a, x) => a + f(x), 0));
  const amt = (p) => (typeof p.amount === 'number' ? p.amount : 0);
  const delivered = (orders || []).filter((o) => o.status === 'delivered');
  const net = sum(delivered, netForProvider);
  const paid = sum(payments, amt);
  const received = sum(payouts, amt);
  return { owed: sum(delivered, commissionOf), net, paid, received, balance: round2(net - received + paid) };
}

// Bloqueado si le debe a BÜBÜ MÁS que el límite (límite 0 = no se bloquea).
function isBlocked(balance, debtLimit) {
  return debtLimit > 0 && balance < -debtLimit;
}

// Semana de corte: sábado 00:00 → viernes 23:59 (hora de México). Depósito: el martes siguiente.
function cutWeekStart(nowMs = Date.now()) {
  const d = new Date(nowMs); const back = (d.getDay() + 1) % 7; // sábado = 0
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - back).getTime();
}

module.exports = { cutWeekStart, DEFAULTS, configWithDefaults, commissionOf, netForProvider, balanceOf, isBlocked, round2 };
