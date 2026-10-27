// Catálogo: categorías y zonas de cobertura.
// Lectura: cualquier persona (son datos públicos, sin información personal).
// Escritura: solo administradores (lo exigen las reglas de Firestore).
import { collection, doc, getDocs, onSnapshot, writeBatch, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { INITIAL_CATEGORIES, INITIAL_ZONES, sortByOrder } from '../constants/catalog';

export function subscribeCategories(onData, onError) {
  return onSnapshot(
    collection(db, 'categories'),
    (snap) => onData(sortByOrder(snap.docs.map((d) => ({ id: d.id, ...d.data() })))),
    onError
  );
}

export function subscribeZones(onData, onError) {
  return onSnapshot(
    collection(db, 'zones'),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );
}

// Carga el catálogo inicial. Solo funciona si tu UID está en `admins`.
// Únicamente crea los documentos que NO existen: si ya editaste una categoría
// o zona, no la sobrescribe. Devuelve cuántos documentos creó.
export async function seedInitialCatalog() {
  const [catSnap, zoneSnap] = await Promise.all([
    getDocs(collection(db, 'categories')),
    getDocs(collection(db, 'zones')),
  ]);
  const existingCats = new Set(catSnap.docs.map((d) => d.id));
  const existingZones = new Set(zoneSnap.docs.map((d) => d.id));
  const newCats = INITIAL_CATEGORIES.filter((c) => !existingCats.has(c.id));
  const newZones = INITIAL_ZONES.filter((z) => !existingZones.has(z.id));
  if (newCats.length === 0 && newZones.length === 0) return 0;

  const batch = writeBatch(db);
  for (const { id, ...data } of newCats) {
    batch.set(doc(db, 'categories', id), { ...data, updatedAt: serverTimestamp() });
  }
  for (const { id, ...data } of newZones) {
    batch.set(doc(db, 'zones', id), { ...data, updatedAt: serverTimestamp() });
  }
  batch.set(doc(collection(db, 'auditLog')), {
    adminId: auth.currentUser.uid,
    action: 'seed_catalog',
    targetType: 'catalog',
    targetId: 'initial',
    details: { categories: newCats.map((c) => c.id), zones: newZones.map((z) => z.id) },
    createdAt: serverTimestamp(),
  });
  await batch.commit();
  return newCats.length + newZones.length;
}
