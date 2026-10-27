// Solicitudes y perfiles de proveedor (colección `providers`, id = uid).
// El estado (pending/approved/rejected/suspended) SOLO lo cambia un admin;
// las reglas de Firestore impiden que un proveedor se apruebe solo.
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { clampText, LIMITS } from '../lib/validation';
import { BRAND_NAME } from '../constants/brand';

export const PROVIDER_STATUS = {
  pending: { label: 'En revisión', tone: 'warn', text: `El equipo de ${BRAND_NAME} está revisando tu solicitud. Aquí verás el cambio cuando la aprueben.` },
  approved: { label: 'Aprobado', tone: 'success', text: 'Tu perfil está aprobado. La publicación de servicios y la recepción de pedidos llegan en la próxima versión.' },
  rejected: { label: 'No aprobado', tone: 'error', text: 'Tu solicitud no fue aprobada. Revisa la nota, corrige y vuelve a enviarla.' },
  suspended: { label: 'Suspendido', tone: 'error', text: `Tu perfil está suspendido. Contacta a soporte de ${BRAND_NAME}.` },
};

function cleanApplication({ businessName, description, categoryIds, zoneIds, fulfillmentModes }) {
  return {
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
