// Pruebas de la lógica de avisos (sin Firebase ni internet): node --test test/
const test = require('node:test');
const assert = require('node:assert');
const L = require('../lib');

const req = { id: 'r1', customerId: 'ana', categoryId: 'lavanderia', zoneId: 'general-zuazua', fulfillmentMode: 'pickup_delivery', colonia: 'Centro', services: ['Lavado por kilo'], status: 'open' };
const P = (id, extra = {}) => ({ id, status: 'approved', isAvailable: true, categoryIds: ['lavanderia'], zoneIds: ['general-zuazua'], fulfillmentModes: ['dropoff', 'pickup_delivery'], ...extra });

test('solo socios aprobados, conectados, de la zona, categoría y modalidad', () => {
  const list = [P('ok'), P('off', { isAvailable: false }), P('pend', { status: 'pending' }), P('zona', { zoneIds: ['otra'] }),
    P('modo', { fulfillmentModes: ['dropoff'] }), P('cat', { categoryIds: ['otra'] }), P('ana'), P('sinCampo', { isAvailable: undefined })];
  assert.deepStrictEqual(L.matchProviders(list, req).map((p) => p.id), ['ok']);
});

test('el aviso de solicitud no trae datos personales', () => {
  const m = L.newRequestMessage({ ...req, customerName: 'Ana López', address: 'Calle 1' }, 'Lavandería');
  assert.match(m.title, /lavandería/);
  assert.match(m.body, /Centro/);
  assert.doesNotMatch(m.title + m.body, /Ana|Calle/);
  assert.deepStrictEqual(m.data, { type: 'new_request', requestId: 'r1' });
});

test('pedidos: reserva directa, elegido por oferta y otros', () => {
  assert.strictEqual(L.orderMessage({ id: 'o1', status: 'requested', colonia: 'Centro', customerName: 'Ana' }).data.type, 'direct_order');
  assert.doesNotMatch(L.orderMessage({ id: 'o1', status: 'requested', customerName: 'Ana' }).body, /Ana/);
  assert.strictEqual(L.orderMessage({ id: 'o2', status: 'accepted', requestId: 'r1' }).title, '¡Te eligieron!');
  assert.strictEqual(L.orderMessage({ id: 'o3', status: 'accepted' }), null);
  assert.strictEqual(L.orderMessage({ id: 'o4', status: 'delivered' }), null);
});

test('mensajes de Expo: canal, sonido y descarta tokens inválidos', () => {
  const msgs = L.toExpoMessages([{ uid: 'a', token: 'ExponentPushToken[xyz]' }, { uid: 'b', token: 'basura' }], { title: 't', body: 'b', data: { type: 'x' } });
  assert.strictEqual(msgs.length, 1);
  assert.strictEqual(msgs[0].channelId, 'pedidos');
  assert.strictEqual(msgs[0].sound, 'default');
  assert.strictEqual(msgs[0].priority, 'high');
});

test('envío en bloques de 100 y tokens muertos', async () => {
  const entries = Array.from({ length: 150 }, (_, i) => ({ uid: `u${i}`, token: `ExponentPushToken[t${i}]` }));
  const msgs = L.toExpoMessages(entries, { title: 't', body: 'b', data: {} });
  const calls = [];
  const fakeFetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    calls.push(body.length);
    assert.strictEqual(url, L.EXPO_PUSH_URL);
    return { status: 200, json: async () => ({ data: body.map((m) => (m.to === 'ExponentPushToken[t120]' ? { status: 'error', details: { error: 'DeviceNotRegistered' } } : { status: 'ok', id: 'x' })) }) };
  };
  const tickets = await L.sendExpo(msgs, fakeFetch);
  assert.deepStrictEqual(calls, [100, 50]);
  assert.strictEqual(tickets.length, 150);
  assert.deepStrictEqual(L.deadTokenUids(msgs, entries, tickets), ['u120']);
});

test('si Expo responde con error HTTP, se cuentan como fallidos', async () => {
  const msgs = L.toExpoMessages([{ uid: 'a', token: 'ExponentPushToken[a]' }], { title: 't', body: 'b', data: {} });
  const tickets = await L.sendExpo(msgs, async () => ({ status: 500, json: async () => { throw new Error('x'); } }));
  assert.strictEqual(tickets[0].status, 'error');
});

test('radio de servicio: solo socios que cubren la ubicación aproximada', () => {
  const r = { ...req, approxGeo: { lat: 25.89, lng: -100.11 } };
  const cerca = P('cerca', { serviceArea: { lat: 25.885, lng: -100.112, radiusKm: 3 } });
  const lejos = P('lejos', { serviceArea: { lat: 25.67, lng: -100.31, radiusKm: 5 } }); // Monterrey centro
  const sinMapa = P('sinMapa');
  assert.deepStrictEqual(L.matchProviders([cerca, lejos, sinMapa], r).map((p) => p.id), ['cerca', 'sinMapa']);
  assert.ok(Math.abs(L.distanceKm({ lat: 25.89, lng: -100.11 }, { lat: 25.67, lng: -100.31 }) - 31.6) < 2);
});
