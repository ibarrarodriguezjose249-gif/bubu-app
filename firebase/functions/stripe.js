// Pagos con Stripe (sin Firebase), para poder probarlo aparte.
// Regla de oro: un pedido solo queda "pagado" si Stripe confirma (aviso FIRMADO) un
// pago COMPLETO, de ESE pedido, en MXN y por EXACTAMENTE total + cuota de servicio.
const crypto = require('crypto');

const API = 'https://api.stripe.com/v1';
const cents = (n) => Math.round(Number(n) * 100);

function isTestKey(key) { return typeof key === 'string' && /^(sk|rk)_test_/.test(key); }

function cannotCharge(order, uid) {
  if (!order) return 'El pedido no existe.';
  if (order.customerId !== uid) return 'Este pedido no es tuyo.';
  if (!['in_progress', 'ready'].includes(order.status)) return 'Este pedido todavía no tiene total para pagar.';
  if (typeof order.amountDue !== 'number' || !(order.amountDue > 0)) return 'El socio todavía no anota el total.';
  if (['paid', 'review'].includes(order.paymentStatus)) return 'Este pedido ya está pagado.';
  return null;
}

// Parámetros de la sesión de pago (Stripe Checkout), en formato de formulario.
function sessionParams(order, serviceFee, returnUrl) {
  const p = new URLSearchParams();
  p.append('mode', 'payment');
  p.append('locale', 'es');
  p.append('client_reference_id', order.id);
  p.append('line_items[0][quantity]', '1');
  p.append('line_items[0][price_data][currency]', 'mxn');
  p.append('line_items[0][price_data][unit_amount]', String(cents(order.amountDue)));
  p.append('line_items[0][price_data][product_data][name]', `Servicio · ${String(order.providerName || 'BÜBÜ').slice(0, 60)}`);
  if (serviceFee > 0) {
    p.append('line_items[1][quantity]', '1');
    p.append('line_items[1][price_data][currency]', 'mxn');
    p.append('line_items[1][price_data][unit_amount]', String(cents(serviceFee)));
    p.append('line_items[1][price_data][product_data][name]', 'Cuota de servicio BÜBÜ');
  }
  p.append('metadata[orderId]', order.id);
  p.append('metadata[amountDue]', String(order.amountDue));
  p.append('metadata[serviceFee]', String(serviceFee));
  p.append('payment_intent_data[metadata][orderId]', order.id);
  p.append('success_url', `${returnUrl}?estado=pagado`);
  p.append('cancel_url', `${returnUrl}?estado=cancelado`);
  return p;
}

// Verifica la firma del aviso de Stripe (encabezado Stripe-Signature). Devuelve el evento o lanza error.
function verifyEvent(rawBody, header, secret, nowSec = Math.floor(Date.now() / 1000), toleranceSec = 300) {
  if (!rawBody || !header || !secret) throw new Error('Aviso sin firma');
  const parts = {};
  const v1 = [];
  String(header).split(',').forEach((kv) => {
    const i = kv.indexOf('='); const k = kv.slice(0, i).trim(); const v = kv.slice(i + 1).trim();
    if (k === 't') parts.t = v; else if (k === 'v1') v1.push(v);
  });
  const t = Number(parts.t);
  if (!t || !v1.length) throw new Error('Firma inválida');
  if (Math.abs(nowSec - t) > toleranceSec) throw new Error('Aviso viejo');
  const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  const ok = v1.some((sig) => sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)));
  if (!ok) throw new Error('Firma no coincide');
  return JSON.parse(body);
}

// Qué escribir en el pedido según la sesión pagada (o null = nada).
function sessionUpdate(order, session) {
  if (!order || !session || session.payment_status !== 'paid') return null;
  if ((session.metadata || {}).orderId !== order.id) return null;
  const pid = String(session.payment_intent || session.id);
  if (order.paymentId === pid) return null; // aviso repetido
  if (order.paymentStatus === 'paid') {
    return { paymentStatus: 'review', paymentNote: `Pago duplicado ${pid}: revisar y reembolsar en Stripe.` };
  }
  const fee = Number((session.metadata || {}).serviceFee) || 0;
  const expected = typeof order.amountDue === 'number' ? cents(order.amountDue) + cents(fee) : -1;
  const base = { paymentId: pid, paidAmount: (session.amount_total || 0) / 100, serviceFee: fee, paymentLive: !!session.livemode };
  return session.currency === 'mxn' && session.amount_total === expected
    ? { ...base, paymentStatus: 'paid' }
    : { ...base, paymentStatus: 'review', paymentNote: `Pagó ${(session.amount_total || 0) / 100} ${String(session.currency).toUpperCase()} pero el total era ${order.amountDue} + cuota ${fee}.` };
}

async function stripeFetch(path, key, { method = 'GET', form, fetchImpl = fetch } = {}) {
  const res = await fetchImpl(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form ? form.toString() : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (res.status >= 300) { const e = new Error(`Stripe ${res.status}: ${json.error?.message || ''}`); e.status = res.status; throw e; }
  return json;
}

module.exports = { isTestKey, cannotCharge, sessionParams, verifyEvent, sessionUpdate, stripeFetch, cents, API };
