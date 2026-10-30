// BÜBÜ — Cloud Functions (servidor).
//
//  Avisos push a socios:
//  • avisarSolicitudNueva: solicitud abierta → socios aprobados y CONECTADOS de esa zona.
//  • avisarPedidoNuevo: reserva directa → "Nueva reserva"; oferta elegida → "¡Te eligieron!".
//
//  Pagos con tarjeta (Stripe, modo prueba por omisión):
//  • crearPago: el cliente pide pagar → sesión de Stripe por total + cuota de servicio.
//  • webhookStripe: Stripe avisa (firmado) que se pagó → el pedido queda "pagado".
//  • pagoListo: página a la que regresa el cliente.
//
//  Saldos de socios:
//  • saldoPor…: recalcula el saldo de un socio y lo bloquea si su adeudo pasa el límite.
//
//  PIN de entrega:
//  • crearPinEntrega / entregarConPin (ver abajo).
//
// Lo único que este servidor ESCRIBE: estado de pago de pedidos, pedidos entregados
// con PIN, PINs (deliveryPins), saldos (providerBalances), bloqueos (debtBlocks) y
// tokens de teléfonos que ya no existen.
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { setGlobalOptions, logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { matchProviders, newRequestMessage, orderMessage, toExpoMessages, sendExpo, deadTokenUids } = require('./lib');

admin.initializeApp();
const db = admin.firestore();

// Debe coincidir con la ubicación de tu base de Firestore
// (nam5 o us-central1 → 'us-central1').
setGlobalOptions({ region: 'us-central1', maxInstances: 5 });

async function tokensFor(uids) {
  const unique = [...new Set(uids)].filter(Boolean);
  if (!unique.length) return [];
  const snaps = await db.getAll(...unique.map((uid) => db.collection('pushTokens').doc(uid)));
  return snaps.filter((s) => s.exists && s.get('token')).map((s) => ({ uid: s.id, token: s.get('token') }));
}

async function deliver(uids, msg) {
  const entries = await tokensFor(uids);
  const messages = toExpoMessages(entries, msg);
  if (!messages.length) {
    logger.info('Sin teléfonos registrados', { type: msg.data.type, socios: uids.length });
    return;
  }
  const tickets = await sendExpo(messages);
  const dead = deadTokenUids(messages, entries, tickets);
  await Promise.all(dead.map((uid) => db.collection('pushTokens').doc(uid).delete().catch(() => {})));
  const failed = tickets.filter((t) => t.status !== 'ok');
  logger.info('Avisos enviados', { type: msg.data.type, enviados: messages.length, fallidos: failed.length, tokensBorrados: dead.length });
  if (failed.length) logger.warn('Detalle de fallos', failed.slice(0, 5));
}

exports.avisarSolicitudNueva = onDocumentCreated('requests/{requestId}', async (event) => {
  const r = { id: event.params.requestId, ...(event.data?.data() || {}) };
  if (r.status !== 'open' || !r.categoryId || !r.zoneId) return;

  const snap = await db.collection('providers')
    .where('status', '==', 'approved')
    .where('categoryIds', 'array-contains', r.categoryId)
    .get();
  const providers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  let targets = matchProviders(providers, r).map((p) => p.id);
  // Socios pausados por adeudo no reciben avisos de pedidos nuevos.
  if (targets.length) {
    const blocks = await db.getAll(...targets.map((id) => db.collection('debtBlocks').doc(id)));
    const blocked = new Set(blocks.filter((b) => b.exists).map((b) => b.id));
    targets = targets.filter((id) => !blocked.has(id));
  }
  if (!targets.length) {
    logger.info('Solicitud sin socios conectados', { requestId: r.id });
    return;
  }

  const cat = await db.collection('categories').doc(r.categoryId).get();
  await deliver(targets, newRequestMessage(r, cat.exists ? cat.get('name') : ''));
});

exports.avisarPedidoNuevo = onDocumentCreated('orders/{orderId}', async (event) => {
  const o = { id: event.params.orderId, ...(event.data?.data() || {}) };
  const msg = orderMessage(o);
  if (!msg || !o.providerId) return;
  await deliver([o.providerId], msg);
});

// ═════════════════════════════════════════════════════════════
//  Pagos con tarjeta (Stripe). Por omisión SOLO modo de prueba:
//  con una llave real (sk_live_) se niega a cobrar, a menos que
//  PAGOS_REALES = si (archivo functions/.env, que NO existe por omisión).
// ═════════════════════════════════════════════════════════════
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { defineSecret, defineString } = require('firebase-functions/params');
const ST = require('./stripe');
const SAL = require('./saldos');

const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');
const PAGOS_REALES = defineString('PAGOS_REALES', { default: 'no' });
const fnUrl = (name) => `https://us-central1-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/${name}`;
const FV = () => admin.firestore.FieldValue;

async function getConfig() {
  const s = await db.collection('config').doc('commission').get();
  return SAL.configWithDefaults(s.exists ? s.data() : null);
}

exports.crearPago = onCall({ secrets: [STRIPE_SECRET_KEY] }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Inicia sesión.');
  const orderId = String(req.data?.orderId || '');
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(orderId)) throw new HttpsError('invalid-argument', 'Pedido inválido.');
  const ref = db.collection('orders').doc(orderId);
  const snap = await ref.get();
  const order = snap.exists ? { id: snap.id, ...snap.data() } : null;
  const why = ST.cannotCharge(order, req.auth.uid);
  if (why) throw new HttpsError('failed-precondition', why);

  const key = STRIPE_SECRET_KEY.value();
  const test = ST.isTestKey(key);
  if (!test && PAGOS_REALES.value() !== 'si') throw new HttpsError('failed-precondition', 'Los pagos reales todavía no están activados.');

  const { serviceFee, cardEnabled } = await getConfig();
  if (!cardEnabled) throw new HttpsError('failed-precondition', 'El pago con tarjeta todavía no está disponible. Paga en efectivo o por transferencia al socio.');
  const session = await ST.stripeFetch('/checkout/sessions', key, { method: 'POST', form: ST.sessionParams(order, serviceFee, fnUrl('pagoListo')) });
  await ref.update({ paymentSessionId: String(session.id || ''), updatedAt: FV().serverTimestamp() });
  logger.info('Sesión de pago creada', { orderId, test, serviceFee });
  return { url: session.url, test, serviceFee, total: order.amountDue + serviceFee };
});

// Página a la que regresa el cliente después de pagar (o cancelar) en Stripe.
exports.pagoListo = onRequest((req, res) => {
  const ok = req.query.estado === 'pagado';
  res.set('Content-Type', 'text/html; charset=utf-8').send(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BÜBÜ</title>
<style>body{margin:0;font-family:system-ui,sans-serif;background:#0066FF;color:#fff;display:grid;place-items:center;min-height:100vh;text-align:center;padding:24px}h1{font-size:44px;margin:0 0 12px;letter-spacing:2px}p{font-size:18px;max-width:420px;line-height:1.5}</style></head>
<body><div><h1>BÜBÜ</h1><p>${ok ? 'Listo. Tu pago se está confirmando.<br>Regresa a la app de BÜBÜ: en unos segundos verás tu pedido como pagado.' : 'No se hizo ningún cargo.<br>Regresa a la app de BÜBÜ para pagar con tarjeta o elegir efectivo.'}</p></div></body></html>`);
});

exports.webhookStripe = onRequest({ secrets: [STRIPE_WEBHOOK_SECRET] }, async (req, res) => {
  let event;
  try {
    event = ST.verifyEvent(req.rawBody, req.get('stripe-signature'), STRIPE_WEBHOOK_SECRET.value());
  } catch (e) {
    logger.warn('Aviso de Stripe rechazado', { message: e.message });
    res.status(400).send('firma inválida');
    return;
  }
  if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) { res.status(200).send('ok'); return; }
  const session = event.data?.object || {};
  const orderId = String(session.metadata?.orderId || '');
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(orderId)) { res.status(200).send('ok'); return; }
  try {
    const ref = db.collection('orders').doc(orderId);
    const result = await db.runTransaction(async (t) => {
      const s = await t.get(ref);
      const upd = ST.sessionUpdate(s.exists ? { id: s.id, ...s.data() } : null, session);
      if (!upd) return null;
      t.update(ref, { ...upd, paidAt: FV().serverTimestamp(), updatedAt: FV().serverTimestamp() });
      return { ...upd, providerId: s.get('providerId'), amountDue: s.get('amountDue') };
    });
    if (result) {
      logger.info('Pago registrado', { orderId, status: result.paymentStatus });
      if (result.paymentStatus === 'paid') {
        await deliver([result.providerId], { title: 'Pago recibido', body: `El cliente pagó $${result.amountDue} con tarjeta. Ya puedes lavar.`, data: { type: 'paid', orderId } }).catch(() => {});
      }
    }
    res.status(200).send('ok');
  } catch (e) {
    logger.error('Error en webhook', { orderId, message: e.message });
    res.status(500).send('error'); // Stripe lo reintenta
  }
});

// ═════════════════════════════════════════════════════════════
//  Saldo de cada socio y bloqueo por adeudo (solo el servidor los escribe).
// ═════════════════════════════════════════════════════════════
async function recalcularSaldo(providerId) {
  if (!providerId) return;
  const [cfg, ords, pays, outs, prevBlock] = await Promise.all([
    getConfig(),
    db.collection('orders').where('providerId', '==', providerId).where('status', '==', 'delivered').get(),
    db.collection('commissionPayments').where('providerId', '==', providerId).get(),
    db.collection('payouts').where('providerId', '==', providerId).get(),
    db.collection('debtBlocks').doc(providerId).get(),
  ]);
  const data = (q) => q.docs.map((d) => d.data());
  const b = SAL.balanceOf(data(ords), data(pays), data(outs));
  const blocked = SAL.isBlocked(b.balance, cfg.debtLimit);
  await db.collection('providerBalances').doc(providerId).set({ ...b, debtLimit: cfg.debtLimit, blocked, updatedAt: FV().serverTimestamp() });
  const blockRef = db.collection('debtBlocks').doc(providerId);
  if (blocked && !prevBlock.exists) {
    await blockRef.set({ debt: -b.balance, debtLimit: cfg.debtLimit, createdAt: FV().serverTimestamp() });
    await deliver([providerId], { title: 'Tienes un adeudo con BÜBÜ', body: `Debes $${(-b.balance).toFixed(2)} de comisiones. Págalo para volver a recibir pedidos.`, data: { type: 'debt' } }).catch(() => {});
  } else if (blocked) {
    await blockRef.set({ debt: -b.balance, debtLimit: cfg.debtLimit }, { merge: true });
  } else if (prevBlock.exists) {
    await blockRef.delete();
    await deliver([providerId], { title: 'Listo, ya puedes recibir pedidos', body: 'Tu adeudo con BÜBÜ quedó cubierto.', data: { type: 'debt' } }).catch(() => {});
  }
  logger.info('Saldo recalculado', { providerId, balance: b.balance, blocked });
}

exports.saldoPorPedido = onDocumentWritten('orders/{orderId}', async (event) => {
  const before = event.data?.before?.data(); const after = event.data?.after?.data();
  const touches = (x) => x && x.status === 'delivered';
  if (!touches(before) && !touches(after)) return;
  if (touches(before) && touches(after) && ['finalPrice', 'commissionPct', 'commissionIvaPct', 'paymentStatus'].every((k) => before[k] === after[k])) return;
  await recalcularSaldo((after || before).providerId);
});
exports.saldoPorPagoDeSocio = onDocumentWritten('commissionPayments/{id}', async (event) => {
  await recalcularSaldo((event.data?.after?.data() || event.data?.before?.data() || {}).providerId);
});
exports.saldoPorDeposito = onDocumentWritten('payouts/{id}', async (event) => {
  await recalcularSaldo((event.data?.after?.data() || event.data?.before?.data() || {}).providerId);
});
// Si el admin cambia el límite de adeudo, se revisan todos los socios con saldo.
exports.saldoPorConfig = onDocumentWritten('config/commission', async () => {
  const all = await db.collection('providerBalances').get();
  for (const d of all.docs) await recalcularSaldo(d.id);
});

// ═════════════════════════════════════════════════════════════
//  Avisos al socio por acciones del cliente
//  • El cliente reporta "Ya transferí" → revisa tu banco y confirma.
//  • El cliente marca "Ya recibí mi ropa" → el pedido quedó cerrado.
// ═════════════════════════════════════════════════════════════
const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
exports.avisoAccionCliente = onDocumentUpdated('orders/{orderId}', async (event) => {
  const b = event.data?.before?.data() || {}; const a = event.data?.after?.data() || {};
  const orderId = event.params.orderId;
  if (!a.providerId) return;
  if (a.transferReportedAt && !(b.transferReportedAt && b.transferReportedAt.isEqual && b.transferReportedAt.isEqual(a.transferReportedAt))) {
    await deliver([a.providerId], {
      title: 'El cliente reportó una transferencia',
      body: `Revisa tu banco${a.transferRef ? ` (clave de rastreo ${String(a.transferRef).slice(0, 30)})` : ''}. Si te llegó, confírmalo en el pedido.`,
      data: { type: 'transfer_reported', orderId },
    }).catch(() => {});
  }
  if (b.status !== 'delivered' && a.status === 'delivered' && a.deliveredBy === 'customer') {
    await deliver([a.providerId], { title: 'El cliente recibió su ropa', body: 'El pedido quedó como entregado. ¡Gracias!', data: { type: 'delivered_by_customer', orderId } }).catch(() => {});
  }
});

// Mensaje nuevo en el chat de un pedido → aviso a la otra persona (si tiene la app con avisos).
exports.avisoMensaje = onDocumentCreated('orders/{orderId}/messages/{messageId}', async (event) => {
  const m = event.data?.data() || {};
  const o = await db.collection('orders').doc(event.params.orderId).get();
  if (!o.exists) return;
  const to = m.senderRole === 'customer' ? o.get('providerId') : o.get('customerId');
  const from = m.senderRole === 'customer' ? (o.get('customerName') || 'El cliente') : (o.get('providerName') || 'La lavandería');
  const text = String(m.text || '').replace(/\s+/g, ' ').slice(0, 120);
  await deliver([to], { title: `Mensaje de ${String(from).split(' ')[0]}`, body: text, data: { type: 'chat', orderId: event.params.orderId } }).catch(() => {});
});

// ═════════════════════════════════════════════════════════════
//  PIN de entrega
//  • crearPinEntrega: al crearse un pedido se genera un PIN de 4 dígitos en
//    deliveryPins/{orderId}. Lo lee SOLO el cliente (y el admin); el socio no.
//  • entregarConPin: el socio teclea el PIN que le dice el cliente. Máximo 5 intentos.
//    Si es correcto, el servidor marca el pedido como entregado ("verificado con PIN").
//    Sin PIN (o sin intentos) el socio entrega con foto y el pedido queda para revisión.
// ═════════════════════════════════════════════════════════════
const ENT = require('./entrega');

exports.crearPinEntrega = onDocumentCreated('orders/{orderId}', async (event) => {
  const o = event.data?.data();
  if (!o || !o.customerId || !o.providerId) return;
  const ref = db.collection('deliveryPins').doc(event.params.orderId);
  // create() falla si ya existe: así un reintento no cambia el PIN.
  await ref.create({ pin: ENT.newPin(), customerId: o.customerId, providerId: o.providerId, attempts: 0, createdAt: FV().serverTimestamp() })
    .catch((e) => { if (e.code !== 6) throw e; }); // 6 = ALREADY_EXISTS
});

exports.entregarConPin = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Inicia sesión.');
  const orderId = String(req.data?.orderId || '');
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(orderId)) throw new HttpsError('invalid-argument', 'Pedido inválido.');
  const pin = String(req.data?.pin || '').trim();
  const finalPrice = req.data?.finalPrice === undefined ? undefined : Number(req.data.finalPrice);
  const cfg = await db.collection('config').doc('commission').get();
  const orderRef = db.collection('orders').doc(orderId);
  const pinRef = db.collection('deliveryPins').doc(orderId);

  const result = await db.runTransaction(async (tx) => {
    const [o, p] = await Promise.all([tx.get(orderRef), tx.get(pinRef)]);
    const r = ENT.pinDelivery({
      uid: req.auth.uid,
      order: o.exists ? o.data() : null,
      pinDoc: p.exists ? p.data() : null,
      pin, finalPrice,
      cfg: cfg.exists ? cfg.data() : null,
    });
    if (r.wrong) {
      tx.update(pinRef, { attempts: r.attempts, lastTryAt: FV().serverTimestamp() });
    } else if (r.update) {
      const now = FV().serverTimestamp();
      tx.update(orderRef, { ...r.update, statusChangedAt: now, updatedAt: now });
      tx.update(pinRef, { usedAt: now });
    }
    return r;
  });
  if (result.error) throw new HttpsError(result.error[0], result.error[1]);
  if (result.wrong) {
    logger.warn('PIN incorrecto', { orderId, attemptsLeft: result.attemptsLeft });
    return { ok: false, attemptsLeft: result.attemptsLeft };
  }
  logger.info('Entregado con PIN', { orderId });
  return { ok: true };
});
