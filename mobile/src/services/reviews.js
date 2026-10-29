// Calificaciones (colección `reviews`, id = id del pedido → una sola reseña por pedido).
// Las reglas de Firestore exigen: que la escriba el cliente de ese pedido, que el
// pedido esté "Entregado", 1 a 5 estrellas y que no se pueda editar después.
// El admin solo puede ocultarlas (hidden), no cambiar lo que escribió el cliente.
import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toMillis } from '../lib/time';
import { clampText } from '../lib/validation';

export const REVIEW_COMMENT_MAX = 300;
const byNewest = (a, b) => toMillis(b.createdAt) - toMillis(a.createdAt);

export function submitReview({ order, uid, profile, stars, comment }) {
  const n = Math.round(Number(stars));
  if (!(n >= 1 && n <= 5)) return Promise.reject(Object.assign(new Error('Elige de 1 a 5 estrellas.'), { code: 'invalid-argument' }));
  const firstName = clampText(String(profile?.displayName || '').split(' ')[0] || 'Cliente', 40);
  return setDoc(doc(db, 'reviews', order.id), {
    orderId: order.id,
    providerId: order.providerId,
    customerId: uid,
    customerName: firstName, // solo el primer nombre
    categoryId: order.categoryId || '',
    stars: n,
    comment: clampText(comment, REVIEW_COMMENT_MAX),
    hidden: false,
    createdAt: serverTimestamp(),
  });
}

export async function getReview(orderId) {
  const s = await getDoc(doc(db, 'reviews', orderId));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

// Reseñas visibles de varios proveedores (Firestore permite hasta 30 por consulta "in").
export function subscribeReviewsFor(providerIds, onData, onError) {
  const ids = [...new Set((providerIds || []).filter(Boolean))];
  if (!ids.length) { onData({}); return () => {}; }
  const chunks = [];
  for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
  const buckets = {};
  const emit = () => {
    const byProvider = {};
    Object.values(buckets).forEach((list) => list.forEach((r) => { (byProvider[r.providerId] = byProvider[r.providerId] || []).push(r); }));
    Object.values(byProvider).forEach((l) => l.sort(byNewest));
    onData(byProvider);
  };
  const unsubs = chunks.map((chunk, i) => onSnapshot(
    query(collection(db, 'reviews'), where('providerId', 'in', chunk), where('hidden', '==', false)),
    (snap) => { buckets[i] = snap.docs.map((d) => ({ id: d.id, ...d.data() })); emit(); },
    onError
  ));
  return () => unsubs.forEach((u) => u());
}

// Mis reseñas como proveedor (incluye las ocultas por el admin).
export function subscribeMyProviderReviews(uid, onData, onError) {
  return onSnapshot(
    query(collection(db, 'reviews'), where('providerId', '==', uid)),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byNewest)),
    onError
  );
}

// Promedio con un decimal. Sin reseñas → null (la app dice "Nuevo").
export function ratingSummary(reviews) {
  const list = (reviews || []).filter((r) => !r.hidden && typeof r.stars === 'number');
  if (!list.length) return null;
  const avg = list.reduce((a, r) => a + r.stars, 0) / list.length;
  return { avg: Math.round(avg * 10) / 10, count: list.length };
}
