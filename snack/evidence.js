// Evidencia del pedido: fotos de la BOLSA CERRADA (no de la ropa), PIN de entrega y código de bolsa.
//  • Foto de la báscula: obligatoria cuando el socio anota el total.
//  • Foto al recolectar: opcional.
//  • Foto de la entrega: solo si se entrega SIN PIN (queda para revisión del equipo).
// Las fotos viven en Storage (evidence/{orderId}/…) y se borran solas a los 90 días.
import { doc, getDoc, serverTimestamp, updateDoc } from '@firebase/firestore';
import { getFunctions, httpsCallable } from '@firebase/functions';
import { getDownloadURL, getStorage, ref as storageRef, uploadBytes } from '@firebase/storage';
import { app, db } from './bubuFirebase';

let ImagePicker = null;
try { ImagePicker = require('expo-image-picker'); } catch (e) { ImagePicker = null; }

// Código corto para escribir en la bolsa (sale del número del pedido).
export const bagCode = (id) => `BÜ-${String(id || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase()}`;

export const EVIDENCE_LABEL = { weight: 'Báscula', pickup: 'Al recolectar', delivery: 'Entrega' };

// Toma una foto con la cámara; si no hay permiso de cámara, deja elegir de la galería.
// Devuelve { uri, mimeType } o null si se canceló.
export async function takeEvidencePhoto() {
  if (!ImagePicker) throw new Error('Esta versión de la app no puede tomar fotos. Actualiza la app.');
  const opts = { mediaTypes: ['images'], quality: 0.5, allowsEditing: false };
  let r;
  const cam = await ImagePicker.requestCameraPermissionsAsync().catch(() => ({ granted: false }));
  if (cam.granted) {
    r = await ImagePicker.launchCameraAsync(opts);
  } else {
    const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!lib.granted) throw new Error('Permite el acceso a la cámara (o a tus fotos) para tomar la foto de la bolsa.');
    r = await ImagePicker.launchImageLibraryAsync(opts);
  }
  if (r.canceled || !r.assets?.length) return null;
  const a = r.assets[0];
  return { uri: a.uri, mimeType: a.mimeType || 'image/jpeg' };
}

// Sube la foto y devuelve su ruta (evidence/{orderId}/{tipo}-{fecha}.jpg).
export async function uploadEvidence(orderId, kind, image) {
  const ext = (String(image.mimeType).split('/')[1] || 'jpg').replace('jpeg', 'jpg').replace(/[^a-z]/g, '') || 'jpg';
  const path = `evidence/${orderId}/${kind}-${Date.now()}.${ext}`;
  const blob = await (await fetch(image.uri)).blob();
  if (blob.size > 5 * 1024 * 1024) throw new Error('La foto pesa más de 5 MB. Tómala otra vez con menos zoom.');
  await uploadBytes(storageRef(getStorage(app), path), blob, { contentType: image.mimeType || 'image/jpeg' });
  return path;
}

export function evidenceUrl(path) {
  return getDownloadURL(storageRef(getStorage(app), path));
}

// PIN de entrega: solo lo puede leer el cliente del pedido.
export async function getDeliveryPin(orderId) {
  const s = await getDoc(doc(db, 'deliveryPins', orderId));
  return s.exists() ? s.data() : null;
}

// El socio entrega con el PIN que le dice el cliente (lo verifica el servidor).
// Devuelve { ok: true } o { ok: false, attemptsLeft }.
export async function deliverWithPin(orderId, pin, finalPrice) {
  const call = httpsCallable(getFunctions(app), 'entregarConPin');
  const payload = { orderId, pin: String(pin || '').trim() };
  if (typeof finalPrice === 'number') payload.finalPrice = finalPrice;
  const { data } = await call(payload);
  return data || { ok: false };
}

// Entrega SIN PIN: con foto de la entrega. Queda marcada para revisión.
export function deliverWithPhoto(order, cfg, price, deliveryPhotoPath) {
  const data = {
    status: 'delivered', statusChangedAt: serverTimestamp(), updatedAt: serverTimestamp(),
    finalPrice: price, commissionPct: cfg.pct, commissionIvaPct: cfg.ivaPct, deliveredBy: 'provider',
    deliveryVerified: 'photo', deliveryPhotoPath,
  };
  if (order.paymentStatus !== 'paid') data.serviceFee = cfg.serviceFee;
  return updateDoc(doc(db, 'orders', order.id), data);
}
