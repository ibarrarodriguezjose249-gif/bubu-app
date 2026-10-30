// Chat de un pedido (cliente ↔ socio). Cada pedido tiene su propia conversación.
// Cliente y socio la ven solo mientras el pedido está activo (y 48 h después de
// entregado). El equipo de BÜBÜ puede revisarla siempre. Nadie la edita ni la borra.
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from '@firebase/firestore';
import { db } from './bubuFirebase';
import { toMillis } from './time';

export const CHAT_MAX = 1000;
const OPEN = ['requested', 'accepted', 'in_progress', 'ready'];

export function chatIsOpen(order, now = Date.now()) {
  if (!order) return false;
  if (OPEN.includes(order.status)) return true;
  return order.status === 'delivered' && toMillis(order.statusChangedAt || order.updatedAt) > now - 48 * 3600 * 1000;
}

export function subscribeMessages(orderId, onData, onError) {
  return onSnapshot(
    query(collection(db, 'orders', orderId, 'messages'), orderBy('createdAt', 'asc')),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }))),
    onError,
  );
}

export function sendMessage(orderId, { uid, role, text }) {
  const t = String(text || '').trim().slice(0, CHAT_MAX);
  if (!t) return Promise.resolve();
  return addDoc(collection(db, 'orders', orderId, 'messages'), { senderId: uid, senderRole: role, text: t, createdAt: serverTimestamp() });
}
