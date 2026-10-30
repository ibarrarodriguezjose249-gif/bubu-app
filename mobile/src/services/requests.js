// Pedidos publicados ("requests") y ofertas de proveedores ("requests/{id}/offers/{uidProveedor}").
//
// Flujo:
//  1. El cliente publica (status "open", vence en 30 min).
//  2. Proveedores aprobados de esa categoría y zona ofertan.
//  3. El cliente elige una oferta → se crea el pedido (orders) ya "aceptado"
//     y la solicitud queda "assigned" con el proveedor elegido.
// Todo lo valida firebase/firestore.rules.
import {
  collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc,
  Timestamp, updateDoc, where, writeBatch, addDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toMillis } from '../lib/time';
import { clampText, normalizePhone } from '../lib/validation';
import { OFFER_WINDOW_MIN } from '../constants/requests';

const byNewest = (a, b) => toMillis(b.createdAt) - toMillis(a.createdAt);

// Estado visible: open | expired | assigned | cancelled | closed
export function requestState(r, now = Date.now()) {
  if (!r) return 'closed';
  if (r.status === 'open') return toMillis(r.expiresAt) && toMillis(r.expiresAt) <= now ? 'expired' : 'open';
  return r.status;
}

export function requestSummary(r) {
  return [
    (r.services || []).join(', '),
    r.quantityText,
    r.description,
  ].filter(Boolean).join(' · ');
}

export function createRequest(uid, f) {
  return addDoc(collection(db, 'requests'), {
    customerId: uid,
    categoryId: f.categoryId,
    zoneId: f.zoneId,
    colonia: clampText(f.colonia, 80),
    // Ubicación APROXIMADA (~1 km): solo para saber qué socios le quedan cerca.
    ...(f.approxGeo && typeof f.approxGeo.lat === 'number' ? { approxGeo: { lat: f.approxGeo.lat, lng: f.approxGeo.lng } } : {}),
    description: clampText(f.description, 500),
    services: (f.services || []).slice(0, 8),
    quantityText: clampText(f.quantityText, 40),
    whenText: clampText(f.whenText, 40),
    ...(f.preferredDate ? { preferredDate: Timestamp.fromDate(f.preferredDate instanceof Date ? f.preferredDate : new Date(toMillis(f.preferredDate))) } : {}),
    fulfillmentMode: f.fulfillmentMode,
    expiresAt: Timestamp.fromMillis(Date.now() + OFFER_WINDOW_MIN * 60 * 1000),
    status: 'open',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// Publicar de nuevo un pedido vencido (crea uno nuevo con los mismos datos).
export function republishRequest(uid, r) {
  return createRequest(uid, r);
}

export function cancelRequest(id) {
  return updateDoc(doc(db, 'requests', id), { status: 'cancelled', updatedAt: serverTimestamp() });
}

export function subscribeMyRequests(uid, onData, onError) {
  return onSnapshot(
    query(collection(db, 'requests'), where('customerId', '==', uid)),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byNewest)),
    onError
  );
}

export function subscribeRequest(id, onData, onError) {
  return onSnapshot(doc(db, 'requests', id), (s) => onData(s.exists() ? { id: s.id, ...s.data() } : null), onError);
}

export function subscribeOffers(requestId, onData, onError) {
  return onSnapshot(
    collection(db, 'requests', requestId, 'offers'),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt))),
    onError
  );
}

// Pedidos de las categorías y zonas del proveedor (abiertos y pasados).
// Una consulta por cada combinación categoría × zona (en el piloto: 1 × 1).
export function subscribeZoneRequests(provider, onData, onError) {
  const combos = [];
  (provider.categoryIds || []).forEach((c) => (provider.zoneIds || []).forEach((z) => combos.push([c, z])));
  const buckets = {};
  const emit = () => {
    const all = {};
    Object.values(buckets).forEach((list) => list.forEach((r) => { all[r.id] = r; }));
    onData(Object.values(all).sort(byNewest));
  };
  const unsubs = combos.map(([c, z]) =>
    onSnapshot(
      query(collection(db, 'requests'), where('categoryId', '==', c), where('zoneId', '==', z)),
      (snap) => { buckets[`${c}|${z}`] = snap.docs.map((d) => ({ id: d.id, ...d.data() })); emit(); },
      onError
    )
  );
  if (!combos.length) onData([]);
  return () => unsubs.forEach((u) => u());
}

export async function getMyOffer(requestId, uid) {
  const s = await getDoc(doc(db, 'requests', requestId, 'offers', uid));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

export function sendOffer(requestId, uid, provider, f) {
  const price = Number(String(f.price || '').replace(/[^0-9.]/g, ''));
  const data = {
    providerId: uid,
    providerName: clampText(provider.businessName, 80),
    kind: f.kind === 'accept' ? 'accept' : 'offer',
    ...(provider.providerType ? { providerType: provider.providerType } : {}),
    message: clampText(f.message, 500),
    pickupText: clampText(f.pickupText, 60),
    readyText: clampText(f.readyText, 60),
    providerPhone: normalizePhone(f.providerPhone),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (f.price && !Number.isNaN(price)) data.priceFrom = Math.min(price, 100000);
  return setDoc(doc(db, 'requests', requestId, 'offers', uid), data);
}

// "Acepto": un toque, en el horario que pidió el cliente y sin proponer precio.
export function acceptRequest(request, uid, provider, profile) {
  return sendOffer(request.id, uid, provider, {
    kind: 'accept',
    pickupText: request.whenText || 'En el horario que pediste',
    readyText: '',
    message: 'Acepto tu pedido en el horario que pediste.',
    providerPhone: profile?.phone || '',
  });
}

// Editar mi oferta (solo campos editables; las reglas no permiten cambiar quién la manda).
export function updateOffer(requestId, uid, f) {
  const price = Number(String(f.price || '').replace(/[^0-9.]/g, ''));
  const data = {
    message: clampText(f.message, 500),
    pickupText: clampText(f.pickupText, 60),
    readyText: clampText(f.readyText, 60),
    providerPhone: normalizePhone(f.providerPhone),
    updatedAt: serverTimestamp(),
  };
  if (f.price && !Number.isNaN(price)) data.priceFrom = Math.min(price, 100000);
  return updateDoc(doc(db, 'requests', requestId, 'offers', uid), data);
}

// El cliente elige una oferta: pedido "aceptado" + solicitud "assigned", en un solo paso.
export async function chooseOffer({ request, offer, uid, profile, address, customerPhone }) {
  const batch = writeBatch(db);
  const orderRef = doc(collection(db, 'orders'));
  const order = {
    customerId: uid,
    providerId: offer.providerId,
    requestId: request.id,
    categoryId: request.categoryId,
    zoneId: request.zoneId,
    customerName: clampText(profile?.displayName || 'Cliente', 80),
    providerName: clampText(offer.providerName, 80),
    details: clampText(requestSummary(request) || 'Servicio de lavandería', 1000),
    fulfillmentMode: request.fulfillmentMode,
    colonia: clampText(request.colonia, 80),
    customerPhone: normalizePhone(customerPhone),
    providerPhone: normalizePhone(offer.providerPhone),
    agreedPickup: clampText(offer.pickupText, 60),
    agreedReady: clampText(offer.readyText, 60),
    whenText: clampText(request.whenText, 40),
    status: 'accepted',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    statusChangedAt: serverTimestamp(),
  };
  if (request.fulfillmentMode === 'pickup_delivery') order.address = clampText(address, 200);
  if (typeof offer.priceFrom === 'number') order.priceEstimate = offer.priceFrom;
  batch.set(orderRef, order);
  batch.update(doc(db, 'requests', request.id), {
    status: 'assigned',
    chosenProviderId: offer.providerId,
    orderId: orderRef.id,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
  return orderRef.id;
}
