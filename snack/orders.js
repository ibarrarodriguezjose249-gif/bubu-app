// Pedidos confirmados (orders): reserva directa o nacidos de una oferta elegida.
import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from '@firebase/firestore';
import { db } from './bubuFirebase';
import { toMillis } from './time';
import { clampText, normalizePhone } from './validation';

const byNewest = (a, b) => toMillis(b.createdAt) - toMillis(a.createdAt);

// Reserva directa a un proveedor de la lista: nace "requested" y el proveedor acepta o rechaza.
export function createDirectOrder({ uid, profile, provider, f }) {
  const data = {
    customerId: uid,
    providerId: provider.id,
    categoryId: f.categoryId,
    zoneId: f.zoneId,
    customerName: clampText(profile?.displayName || 'Cliente', 80),
    providerName: clampText(provider.businessName, 80),
    details: clampText(f.details, 1000),
    fulfillmentMode: f.fulfillmentMode,
    colonia: clampText(f.colonia, 80),
    customerPhone: normalizePhone(f.customerPhone),
    whenText: clampText(f.whenText, 40),
    status: 'requested',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    statusChangedAt: serverTimestamp(),
  };
  if (f.fulfillmentMode === 'pickup_delivery') data.address = clampText(f.address, 200);
  return addDoc(collection(db, 'orders'), data);
}

export function subscribeMyOrders(uid, role, onData, onError) {
  const field = role === 'provider' ? 'providerId' : 'customerId';
  return onSnapshot(
    query(collection(db, 'orders'), where(field, '==', uid)),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byNewest)),
    onError
  );
}

export function subscribeOrder(id, onData, onError) {
  return onSnapshot(doc(db, 'orders', id), (s) => onData(s.exists() ? { id: s.id, ...s.data() } : null), onError);
}

// Cambia el estado respetando las transiciones de constants/orderStatus.js (las reglas lo vuelven a validar).
export function changeOrderStatus(orderId, to, extra = {}) {
  const data = { status: to, statusChangedAt: serverTimestamp(), updatedAt: serverTimestamp() };
  if (extra.cancelReason) data.cancelReason = clampText(extra.cancelReason, 300);
  if (extra.providerPhone) data.providerPhone = normalizePhone(extra.providerPhone);
  // Al recibir y pesar la ropa: total a pagar (tarjeta o efectivo).
  if (to === 'in_progress' && extra.amountDue) data.amountDue = Math.round(Number(extra.amountDue) * 100) / 100;
  if (to === 'in_progress' && extra.transferInfo) data.transferInfo = extra.transferInfo;
  // Fotos de la bolsa: báscula (obligatoria con el total) y al recolectar (opcional).
  if (to === 'in_progress' && extra.weightPhotoPath) data.weightPhotoPath = extra.weightPhotoPath;
  if (to === 'in_progress' && extra.pickupPhotoPath) data.pickupPhotoPath = extra.pickupPhotoPath;
  // Al entregar: total cobrado y % de comisión vigente (las reglas exigen ambos).
  if (to === 'delivered') {
    data.finalPrice = Math.round(Number(extra.finalPrice) * 100) / 100;
    data.commissionPct = extra.commissionPct;
    data.commissionIvaPct = extra.commissionIvaPct;
    if (extra.deliveredBy) data.deliveredBy = extra.deliveredBy;
    // En efectivo el socio también cobró la cuota de servicio (si se pagó con tarjeta, ya la fijó el servidor).
    if (typeof extra.serviceFee === 'number') data.serviceFee = extra.serviceFee;
  }
  return updateDoc(doc(db, 'orders', orderId), data);
}
