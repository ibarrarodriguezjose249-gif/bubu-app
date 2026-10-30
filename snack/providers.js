// Solicitudes y perfiles de proveedor (colección `providers`, id = uid).
// El estado (pending/approved/rejected/suspended) SOLO lo cambia un admin;
// las reglas de Firestore impiden que un proveedor se apruebe solo.
import { collection, doc, onSnapshot, query, setDoc, updateDoc, serverTimestamp, where } from '@firebase/firestore';
import { db } from './bubuFirebase';
import { clampText, LIMITS } from './validation';
import { BRAND_NAME } from './brand';
import { ONLINE_WINDOW_MIN } from './constants_requests';
import { toMillis } from './time';

export const PROVIDER_STATUS = {
  pending: { label: 'En revisión', tone: 'warn', text: `El equipo de ${BRAND_NAME} está revisando tu solicitud. Aquí verás el cambio cuando la aprueben.` },
  approved: { label: 'Aprobado', tone: 'success', text: 'Tu perfil está aprobado. Toca "Conectarme" para ver pedidos de tu zona y mandar ofertas.' },
  rejected: { label: 'No aprobado', tone: 'error', text: 'Tu solicitud no fue aprobada. Revisa la nota, corrige y vuelve a enviarla.' },
  suspended: { label: 'Suspendido', tone: 'error', text: `Tu perfil está suspendido. Contacta a soporte de ${BRAND_NAME}.` },
};

function cleanApplication({ businessName, description, categoryIds, zoneIds, fulfillmentModes, providerType }) {
  return {
    providerType: providerType === 'business' ? 'business' : 'home',
    businessName: clampText(businessName, LIMITS.businessName),
    description: clampText(description, LIMITS.description),
    categoryIds: [...new Set(categoryIds || [])].slice(0, 10),
    zoneIds: [...new Set(zoneIds || [])].slice(0, 5),
    fulfillmentModes: [...new Set(fulfillmentModes || [])].filter((m) => m === 'dropoff' || m === 'pickup_delivery'),
  };
}

export function submitProviderApplication(uid, form) {
  return setDoc(doc(db, 'providers', uid), {
    ...cleanApplication(form),
    status: 'pending',
    reviewNote: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// Editar la solicitud. Si estaba rechazada, vuelve a "pending" para nueva revisión.
export function updateProviderApplication(uid, form, currentStatus) {
  const data = { ...cleanApplication(form), updatedAt: serverTimestamp() };
  if (currentStatus === 'rejected') data.status = 'pending';
  return updateDoc(doc(db, 'providers', uid), data);
}

// ───── Disponibilidad ("Estoy disponible") ─────
// Un proveedor cuenta como "conectado ahora" si activó Disponible y la app
// dio señal en los últimos minutos (ONLINE_WINDOW_MIN). Son datos reales.
export function isOnline(p, now = Date.now()) {
  return !!p?.isAvailable && toMillis(p.lastSeenAt) > now - ONLINE_WINDOW_MIN * 60 * 1000;
}

export function setAvailability(uid, on) {
  return updateDoc(doc(db, 'providers', uid), { isAvailable: !!on, lastSeenAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export function heartbeat(uid) {
  return updateDoc(doc(db, 'providers', uid), { lastSeenAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

// Proveedores aprobados (las reglas solo dejan listar los aprobados).
export function subscribeApprovedProviders(onData, onError) {
  return onSnapshot(
    query(collection(db, 'providers'), where('status', '==', 'approved')),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );
}
