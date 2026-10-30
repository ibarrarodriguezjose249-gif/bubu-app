// Lógica de los avisos (sin Firebase), para poder probarla aparte.
// Los textos NO llevan nombre, teléfono ni dirección del cliente, porque se ven
// en la pantalla bloqueada.

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CHANNEL_ID = 'pedidos';

const MODE_LABEL = { dropoff: 'Lo lleva al local', pickup_delivery: 'Recoger y entregar' };

// Distancia en km entre dos puntos {lat, lng}.
function distanceKm(a, b) {
  const R = 6371; const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat); const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
// ¿El pedido cae dentro de la zona de servicio del socio? (+1.2 km por la ubicación aproximada).
// Si alguno no tiene mapa, se usa solo la zona (como antes).
function areaCovers(area, point) {
  if (!area || typeof area.lat !== 'number' || typeof area.radiusKm !== 'number' || !point || typeof point.lat !== 'number') return true;
  return distanceKm(area, point) <= area.radiusKm + 1.2;
}

// Socios que deben enterarse de una solicitud abierta: aprobados, CONECTADOS,
// de esa zona, categoría y modalidad, dentro de su radio de servicio
// (y que no sean el mismo cliente).
function matchProviders(providers, r) {
  return providers.filter((p) => p && p.status === 'approved'
    && p.isAvailable === true
    && p.id !== r.customerId
    && (p.categoryIds || []).includes(r.categoryId)
    && (p.zoneIds || []).includes(r.zoneId)
    && (p.fulfillmentModes || []).includes(r.fulfillmentMode)
    && areaCovers(p.serviceArea, r.approxGeo));
}

function clip(text, max) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function newRequestMessage(r, categoryName) {
  const what = (r.services || []).length ? r.services.join(', ') : (categoryName || 'Pedido');
  const parts = [clip(what, 60), r.colonia, MODE_LABEL[r.fulfillmentMode]].filter(Boolean);
  return {
    title: `Nuevo pedido de ${String(categoryName || 'servicio').toLowerCase()} en tu zona`,
    body: `${parts.join(' · ')}. Tienes 30 min para responder.`,
    data: { type: 'new_request', requestId: r.id },
  };
}

// Pedido recién creado → aviso para el socio (o null si no aplica).
function orderMessage(o) {
  if (o.status === 'requested') {
    return {
      title: 'Nueva reserva',
      body: `Un cliente te reservó${o.colonia ? ` en ${o.colonia}` : ''}. Acepta o rechaza en BÜBÜ Socios.`,
      data: { type: 'direct_order', orderId: o.id },
    };
  }
  if (o.status === 'accepted' && o.requestId) {
    return {
      title: '¡Te eligieron!',
      body: 'El cliente eligió tu oferta. Abre el pedido para ver los datos.',
      data: { type: 'chosen', orderId: o.id },
    };
  }
  return null;
}

function isExpoToken(t) {
  return typeof t === 'string' && /^Expo(nent)?PushToken\[.+\]$/.test(t);
}

// entries: [{ uid, token }]
function toExpoMessages(entries, msg) {
  return entries.filter((e) => isExpoToken(e.token)).map((e) => ({
    to: e.token,
    title: msg.title,
    body: msg.body,
    data: msg.data,
    sound: 'default',
    priority: 'high',
    channelId: CHANNEL_ID,
  }));
}

// Manda en bloques de 100 (límite de Expo). Devuelve un ticket por mensaje, en orden.
async function sendExpo(messages, fetchImpl = fetch) {
  const tickets = [];
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const res = await fetchImpl(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(chunk),
    });
    const json = await res.json().catch(() => ({}));
    const data = Array.isArray(json.data) ? json.data : [];
    chunk.forEach((_, k) => tickets.push(data[k] || { status: 'error', message: `HTTP ${res.status}` }));
  }
  return tickets;
}

// Teléfonos que Expo dice que ya no existen (app desinstalada, etc.) → borrar su token.
function deadTokenUids(messages, entries, tickets) {
  const byToken = new Map(entries.map((e) => [e.token, e.uid]));
  return messages
    .map((m, i) => (tickets[i]?.status === 'error' && tickets[i]?.details?.error === 'DeviceNotRegistered' ? byToken.get(m.to) : null))
    .filter(Boolean);
}

module.exports = { distanceKm, areaCovers, matchProviders, newRequestMessage, orderMessage, toExpoMessages, sendExpo, deadTokenUids, isExpoToken, EXPO_PUSH_URL };
