// Pago del cliente: en efectivo al socio, por TRANSFERENCIA DIRECTA a la cuenta del socio
// (BÜBÜ no toca ese dinero) o, cuando el admin lo active, con tarjeta (Stripe, por el servidor).
// La app NUNCA marca un pedido como pagado: lo hace el servidor cuando Stripe
// confirma el pago. Por ahora solo en MODO DE PRUEBA (tarjetas de prueba).
import { Linking } from 'react-native';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getDownloadURL, getStorage, ref as storageRef, uploadBytes } from 'firebase/storage';
import { app, db } from '../lib/firebase';

export const PAYMENT_STATUS = {
  pending: { label: 'Por pagar', tone: 'warn', icon: 'time-outline' },
  cash: { label: 'Pagará en efectivo', tone: 'info', icon: 'cash-outline' },
  transfer: { label: 'Pagará por transferencia', tone: 'info', icon: 'swap-horizontal-outline' },
  transfer_ok: { label: 'Transferencia recibida', tone: 'success', icon: 'checkmark-done-outline' },
  paid: { label: 'Pagado con tarjeta', tone: 'success', icon: 'card-outline' },
  review: { label: 'Pago en revisión', tone: 'warn', icon: 'alert-circle-outline' },
  refunded: { label: 'Reembolsado', tone: 'info', icon: 'return-down-back-outline' },
};
export const paymentStatusOf = (o) => o?.paymentStatus || 'pending';

// Abre la página de pago de Stripe para este pedido (total + cuota de servicio).
export async function payWithCard(orderId) {
  const call = httpsCallable(getFunctions(app), 'crearPago');
  const { data } = await call({ orderId });
  if (!data?.url) throw new Error('No se pudo abrir el pago. Intenta de nuevo.');
  await Linking.openURL(data.url);
  return data;
}

// 'cash' = efectivo al socio; 'transfer' = transferencia a la cuenta del socio; 'pending' = aún no decide / tarjeta.
export function choosePayment(orderId, choice) {
  const v = ['cash', 'transfer'].includes(choice) ? choice : 'pending';
  return updateDoc(doc(db, 'orders', orderId), { paymentStatus: v, updatedAt: serverTimestamp() });
}

// El socio confirma que le llegó la transferencia.
export function confirmTransfer(orderId) {
  return updateDoc(doc(db, 'orders', orderId), { paymentStatus: 'transfer_ok', updatedAt: serverTimestamp() });
}

// Cuenta del socio para recibir transferencias (solo él y el admin la ven; al cliente
// le llega copiada dentro de su pedido cuando el socio anota el total).
export async function getPayInfo(uid) {
  const s = await getDoc(doc(db, 'providerPayInfo', uid));
  return s.exists() ? s.data() : null;
}
export function savePayInfo(uid, f) {
  const clean = (t, n) => String(t || '').trim().slice(0, n);
  const data = { holder: clean(f.holder, 80), account: clean(f.account, 40).replace(/\s+/g, ' '), updatedAt: serverTimestamp() };
  if (clean(f.bank, 40)) data.bank = clean(f.bank, 40);
  if (clean(f.note, 100)) data.note = clean(f.note, 100);
  return setDoc(doc(db, 'providerPayInfo', uid), data);
}
export function deletePayInfo(uid) { return deleteDoc(doc(db, 'providerPayInfo', uid)); }
// Lo que se copia al pedido (sin la fecha).
export const transferInfoFrom = (p) => (p && p.holder && p.account
  ? { holder: p.holder, account: p.account, ...(p.bank ? { bank: p.bank } : {}), ...(p.note ? { note: p.note } : {}) } : null);

// El socio corrige el total (y refresca su cuenta) mientras no esté pagado.
// Si el pedido no tiene foto de báscula (o el socio tomó una nueva), va weightPhotoPath.
export function setAmountDue(orderId, amount, transferInfo, weightPhotoPath) {
  const data = { amountDue: Math.round(Number(amount) * 100) / 100, updatedAt: serverTimestamp() };
  if (transferInfo) data.transferInfo = transferInfo;
  if (weightPhotoPath) data.weightPhotoPath = weightPhotoPath;
  return updateDoc(doc(db, 'orders', orderId), data);
}

export function parseAmount(text) {
  const v = Number(String(text ?? '').replace(/[$,\s]/g, ''));
  return Number.isFinite(v) && v > 0 && v <= 100000 ? Math.round(v * 100) / 100 : 0;
}

// ───────────── Comprobante de transferencia (foto) ─────────────

let ImagePicker = null;
try { ImagePicker = require('expo-image-picker'); } catch (e) { ImagePicker = null; }

// Abre la galería para elegir la captura del comprobante. Devuelve { uri, mimeType } o null.
export async function pickReceipt() {
  if (!ImagePicker) throw new Error('Esta versión de la app no puede adjuntar fotos. Actualiza la app.');
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('Permite el acceso a tus fotos para adjuntar el comprobante.');
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, allowsEditing: false });
  if (r.canceled || !r.assets?.length) return null;
  const a = r.assets[0];
  return { uri: a.uri, mimeType: a.mimeType || 'image/jpeg' };
}

// "Ya transferí": sube la foto (si hay) y guarda la clave de rastreo en el pedido.
export async function reportTransfer(orderId, { transferRef, image }) {
  const data = { paymentStatus: 'transfer', transferReportedAt: serverTimestamp(), updatedAt: serverTimestamp() };
  const refText = String(transferRef || '').trim().slice(0, 40);
  if (refText) data.transferRef = refText;
  if (image) {
    const ext = (image.mimeType.split('/')[1] || 'jpg').replace('jpeg', 'jpg').replace(/[^a-z]/g, '');
    const path = `receipts/${orderId}/${Date.now()}.${ext}`;
    const blob = await (await fetch(image.uri)).blob();
    if (blob.size > 5 * 1024 * 1024) throw new Error('La foto pesa más de 5 MB. Toma una captura de pantalla en lugar de una foto.');
    await uploadBytes(storageRef(getStorage(app), path), blob, { contentType: image.mimeType });
    data.receiptPath = path;
  }
  return updateDoc(doc(db, 'orders', orderId), data);
}

export function receiptUrl(path) {
  return getDownloadURL(storageRef(getStorage(app), path));
}

// "Ya recibí mi ropa": el cliente cierra el pedido con el total que vio.
export function customerDeliver(order, cfg) {
  const data = {
    status: 'delivered', statusChangedAt: serverTimestamp(), updatedAt: serverTimestamp(),
    finalPrice: order.amountDue, commissionPct: cfg.pct, commissionIvaPct: cfg.ivaPct, deliveredBy: 'customer',
  };
  if (order.paymentStatus !== 'paid') data.serviceFee = cfg.serviceFee;
  return updateDoc(doc(db, 'orders', order.id), data);
}
