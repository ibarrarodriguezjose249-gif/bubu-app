// Comisión de BÜBÜ por pedido entregado, estilo DiDi: se le descuenta al socio
// total × % de comisión, más IVA sobre esa comisión.
//   Con tarjeta: BÜBÜ cobra (Stripe) y cada semana le deposita al socio total − comisión.
//   En efectivo: el socio cobra y la comisión se descuenta de su siguiente depósito.
// La cuota de servicio que paga el cliente con tarjeta es aparte y es de BÜBÜ.
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toMillis } from '../lib/time';

// Deben coincidir con los valores por omisión de las reglas y del servidor.
export const DEFAULT_COMMISSION = { pct: 30, ivaPct: 16, serviceFee: 10, debtLimit: 300 };
export const DEFAULT_COMMISSION_PCT = DEFAULT_COMMISSION.pct;

const withDefaults = (d) => {
  const v = (k) => (d && typeof d[k] === 'number' ? d[k] : DEFAULT_COMMISSION[k]);
  return { pct: v('pct'), ivaPct: v('ivaPct'), serviceFee: v('serviceFee'), debtLimit: v('debtLimit'), cardEnabled: !!(d && d.cardEnabled === true),
    // Servidor activo (plan Blaze): fotos de la bolsa, PIN de entrega y avisos con la app cerrada.
    serverOn: !!(d && d.serverOn === true) };
};

export function subscribeCommissionConfig(onData, onError) {
  return onSnapshot(
    doc(db, 'config', 'commission'),
    (s) => onData(withDefaults(s.exists() ? s.data() : null)),
    (e) => { onData(withDefaults(null)); if (onError) onError(e); },
  );
}
// Compatibilidad: solo el %.
export function subscribeCommissionPct(onData, onError) {
  return subscribeCommissionConfig((c) => onData(c.pct), onError);
}

// Saldo calculado por el servidor y bloqueo por adeudo (si existe, el socio está bloqueado).
export function subscribeMyDebtBlock(uid, onData) {
  return onSnapshot(doc(db, 'debtBlocks', uid), (s) => onData(s.exists() ? s.data() : null), () => onData(null));
}

export function subscribeMyCommissionPayments(uid, onData, onError) {
  return onSnapshot(
    query(collection(db, 'commissionPayments'), where('providerId', '==', uid)),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))),
    onError,
  );
}

const round2 = (n) => Math.round(n * 100) / 100;

// Comisión de un monto con un % e IVA dados (para vista previa antes de entregar).
export function feeFor(amount, pct, ivaPct) {
  return round2(amount * (pct / 100) * (1 + (ivaPct || 0) / 100));
}

export function commissionOf(order) {
  if (order?.status !== 'delivered' || typeof order.finalPrice !== 'number') return 0;
  const pct = typeof order.commissionPct === 'number' ? order.commissionPct : DEFAULT_COMMISSION_PCT;
  const iva = typeof order.commissionIvaPct === 'number' ? order.commissionIvaPct : 0; // pedidos viejos: sin IVA
  return feeFor(order.finalPrice, pct, iva);
}

export const commissionLabel = (pct, ivaPct) => `${pct} %${ivaPct ? ' + IVA' : ''}`;

export function money2(n) {
  const v = typeof n === 'number' && !Number.isNaN(n) ? n : 0;
  return `$${v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Lo que BÜBÜ le ha transferido al socio (cortes semanales).
export function subscribeMyPayouts(uid, onData, onError) {
  return onSnapshot(
    query(collection(db, 'payouts'), where('providerId', '==', uid)),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))),
    onError,
  );
}

export const paidByCard = (o) => o?.paymentStatus === 'paid';

// Neto de un pedido entregado desde el punto de vista del socio:
//   con tarjeta → BÜBÜ le debe (total − comisión)                       (positivo)
//   en efectivo → el socio le debe la comisión + la cuota de servicio que cobró (negativo)
export function netForProvider(o) {
  if (o?.status !== 'delivered' || typeof o.finalPrice !== 'number') return 0;
  const fee = commissionOf(o);
  return paidByCard(o) ? round2(o.finalPrice - fee) : round2(-fee - (typeof o.serviceFee === 'number' ? o.serviceFee : 0));
}

// Semana de corte: sábado 00:00 → viernes 23:59. El depósito es el martes siguiente.
export function weekStart(now = Date.now()) {
  const d = new Date(now); const back = (d.getDay() + 1) % 7; // sábado = 0
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - back).getTime();
}

// Resumen para el socio. balance > 0: BÜBÜ le paga; balance < 0: el socio debe.
export function commissionSummary(orders, payments, now = Date.now(), payouts = []) {
  const delivered = (orders || []).filter((o) => o.status === 'delivered' && typeof o.finalPrice === 'number');
  const d = new Date(now);
  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const wk = weekStart(now);
  const when = (o) => toMillis(o.statusChangedAt || o.updatedAt);
  const month = delivered.filter((o) => when(o) >= monthStart);
  const week = delivered.filter((o) => when(o) >= wk);
  const sum = (list, f) => round2(list.reduce((a, x) => a + f(x), 0));
  const amt = (p) => (typeof p.amount === 'number' ? p.amount : 0);
  const owed = sum(delivered, commissionOf);
  const paid = sum(payments || [], amt);
  const received = sum(payouts || [], amt);
  const net = sum(delivered, netForProvider);
  return {
    monthCount: month.length,
    monthSales: sum(month, (o) => o.finalPrice),
    monthCommission: sum(month, commissionOf),
    weekCount: week.length,
    weekCard: sum(week.filter(paidByCard), (o) => o.finalPrice),
    weekCash: sum(week.filter((o) => !paidByCard(o)), (o) => o.finalPrice),
    weekCommission: sum(week, commissionOf),
    weekCashFees: sum(week.filter((o) => !paidByCard(o)), (o) => (typeof o.serviceFee === 'number' ? o.serviceFee : 0)),
    weekNet: sum(week, netForProvider),
    owed,
    paid,
    received,
    balance: round2(net - received + paid),
    recent: [...delivered].sort((a, b) => when(b) - when(a)).slice(0, 20),
  };
}
