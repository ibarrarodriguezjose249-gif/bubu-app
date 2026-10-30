// Pruebas de las reglas de Firestore de BÜBÜ contra el EMULADOR local.
// No tocan tu proyecto real: usan el proyecto ficticio "demo-bubu".
//
// Ejecutar (desde la carpeta firebase/):
//   npm install
//   npm run test:rules
//
// Requiere Java 21+ instalado (lo usa el emulador de Firestore).

import { before, after, beforeEach, describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, getDocs, query, where, serverTimestamp, writeBatch, Timestamp } from 'firebase/firestore';

const here = dirname(fileURLToPath(import.meta.url));
let env;

// ───── Usuarios de prueba ─────
const ANA = 'ana';        // cliente
const LUPE = 'lupe';      // proveedora aprobada
const PEPE = 'pepe';      // proveedor pendiente
const ADMIN = 'admin1';   // administrador
const EVA = 'eva';        // otra clienta

const ctx = (uid) => env.authenticatedContext(uid, { email: `${uid}@test.com` }).firestore();
const anon = () => env.unauthenticatedContext().firestore();

function userProfile(uid, extra = {}) {
  return {
    displayName: `Usuario ${uid}`,
    email: `${uid}@test.com`,
    phone: '8112345678',
    colonia: 'Centro',
    zoneId: 'general-zuazua',
    activeMode: 'client',
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...extra,
  };
}

function providerApp(extra = {}) {
  return {
    businessName: 'Lavandería de prueba',
    description: 'Lavo y doblo',
    categoryIds: ['lavanderia'],
    zoneIds: ['general-zuazua'],
    fulfillmentModes: ['dropoff', 'pickup_delivery'],
    status: 'pending',
    reviewNote: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...extra,
  };
}

function newOrder(extra = {}) {
  return {
    customerId: ANA,
    providerId: LUPE,
    categoryId: 'lavanderia',
    zoneId: 'general-zuazua',
    customerName: 'Ana',
    providerName: 'Lavandería Lupe',
    details: 'Una bolsa de ropa',
    fulfillmentMode: 'dropoff',
    colonia: 'Centro',
    status: 'requested',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...extra,
  };
}

// Datos base cargados SIN reglas (como si los hubiera puesto la consola).
async function seed() {
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    const now = Timestamp.now();
    await setDoc(doc(db, 'admins', ADMIN), { role: 'superadmin' });
    await setDoc(doc(db, 'categories', 'lavanderia'), { name: 'Lavandería', icon: '🧺', active: true, order: 1 });
    await setDoc(doc(db, 'categories', 'limpieza'), { name: 'Limpieza', icon: '🧽', active: false, order: 2 });
    await setDoc(doc(db, 'zones', 'general-zuazua'), { name: 'General Zuazua', active: true, colonias: [] });
    await setDoc(doc(db, 'zones', 'zona-inactiva'), { name: 'Otra', active: false, colonias: [] });
    for (const uid of [ANA, LUPE, PEPE, ADMIN, EVA]) {
      await setDoc(doc(db, 'users', uid), { ...userProfile(uid), createdAt: now, updatedAt: now });
    }
    await setDoc(doc(db, 'providers', LUPE), { ...providerApp({ status: 'approved', businessName: 'Lavandería Lupe', providerType: 'home', isAvailable: true }), createdAt: now, updatedAt: now });
    await setDoc(doc(db, 'providers', PEPE), { ...providerApp({ status: 'pending' }), createdAt: now, updatedAt: now });
    await setDoc(doc(db, 'services', 'srv-lupe'), {
      providerId: LUPE, providerName: 'Lavandería Lupe', categoryId: 'lavanderia', zoneIds: ['general-zuazua'],
      title: 'Lavado por carga', description: '', priceFrom: 85, priceUnit: 'por carga',
      fulfillmentModes: ['dropoff'], active: true, createdAt: now, updatedAt: now,
    });
    await setDoc(doc(db, 'orders', 'ord-1'), { ...newOrder(), createdAt: now, updatedAt: now });
    await setDoc(doc(db, 'requests', 'req-1'), {
      customerId: ANA, customerName: 'Ana', categoryId: 'lavanderia', zoneId: 'general-zuazua',
      colonia: 'Centro', description: 'Necesito lavar cobijas', fulfillmentMode: 'dropoff',
      status: 'open', createdAt: now, updatedAt: now,
    });
  });
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-bubu',
    firestore: { rules: readFileSync(join(here, '..', 'firestore.rules'), 'utf8') },
  });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); await seed(); });

// ═════════════════════════════════════════════════════════════
describe('Sin sesión', () => {
  it('puede leer el catálogo (categorías y zonas)', async () => {
    await assertSucceeds(getDocs(collection(anon(), 'categories')));
    await assertSucceeds(getDoc(doc(anon(), 'zones', 'general-zuazua')));
  });
  it('NO puede leer usuarios, proveedores, pedidos ni solicitudes', async () => {
    await assertFails(getDoc(doc(anon(), 'users', ANA)));
    await assertFails(getDoc(doc(anon(), 'providers', LUPE)));
    await assertFails(getDoc(doc(anon(), 'orders', 'ord-1')));
    await assertFails(getDoc(doc(anon(), 'requests', 'req-1')));
  });
  it('NO puede escribir nada', async () => {
    await assertFails(setDoc(doc(anon(), 'categories', 'x'), { name: 'X', active: true }));
    await assertFails(setDoc(doc(anon(), 'users', 'nadie'), userProfile('nadie')));
  });
});

describe('Usuarios', () => {
  it('un usuario nuevo crea su propio perfil', async () => {
    await assertSucceeds(setDoc(doc(ctx('nuevo'), 'users', 'nuevo'), userProfile('nuevo')));
  });
  it('NO puede crear el perfil de otra persona', async () => {
    await assertFails(setDoc(doc(ctx('nuevo'), 'users', 'otro'), userProfile('otro')));
  });
  it('NO puede registrarse con un correo distinto al de su sesión', async () => {
    await assertFails(setDoc(doc(ctx('nuevo'), 'users', 'nuevo'), userProfile('nuevo', { email: 'falso@test.com' })));
  });
  it('NO puede registrarse con estado distinto de active ni campos extra', async () => {
    await assertFails(setDoc(doc(ctx('nuevo'), 'users', 'nuevo'), userProfile('nuevo', { status: 'suspended' })));
    await assertFails(setDoc(doc(ctx('nuevo'), 'users', 'nuevo'), userProfile('nuevo', { role: 'admin' })));
  });
  it('lee su perfil pero NO el de otros', async () => {
    await assertSucceeds(getDoc(doc(ctx(ANA), 'users', ANA)));
    await assertFails(getDoc(doc(ctx(ANA), 'users', EVA)));
  });
  it('cambia su nombre y su modo cliente/proveedor', async () => {
    await assertSucceeds(updateDoc(doc(ctx(ANA), 'users', ANA), { displayName: 'Ana María', activeMode: 'provider', updatedAt: serverTimestamp() }));
  });
  it('NO puede cambiar su propio estado ni su correo', async () => {
    await assertFails(updateDoc(doc(ctx(ANA), 'users', ANA), { status: 'suspended' }));
    await assertFails(updateDoc(doc(ctx(ANA), 'users', ANA), { email: 'otro@test.com' }));
  });
  it('NO puede usar un modo inválido', async () => {
    await assertFails(updateDoc(doc(ctx(ANA), 'users', ANA), { activeMode: 'admin' }));
  });
  it('NO puede borrar su perfil desde la app', async () => {
    await assertFails(deleteDoc(doc(ctx(ANA), 'users', ANA)));
  });
});

describe('Administradores', () => {
  it('nadie se puede hacer admin desde la app', async () => {
    await assertFails(setDoc(doc(ctx(ANA), 'admins', ANA), { role: 'superadmin' }));
    await assertFails(setDoc(doc(ctx(ADMIN), 'admins', ANA), { role: 'superadmin' }));
  });
  it('cada usuario solo consulta si ÉL es admin', async () => {
    await assertSucceeds(getDoc(doc(ctx(ANA), 'admins', ANA)));
    await assertFails(getDoc(doc(ctx(ANA), 'admins', ADMIN)));
  });
  it('el admin lista usuarios y puede suspender', async () => {
    await assertSucceeds(getDocs(collection(ctx(ADMIN), 'users')));
    await assertSucceeds(updateDoc(doc(ctx(ADMIN), 'users', EVA), { status: 'suspended', updatedAt: serverTimestamp() }));
  });
  it('un cliente NO puede listar usuarios', async () => {
    await assertFails(getDocs(collection(ctx(ANA), 'users')));
  });
  it('el admin NO puede cambiar el nombre de un usuario', async () => {
    await assertFails(updateDoc(doc(ctx(ADMIN), 'users', EVA), { displayName: 'Hackeado' }));
  });
});

describe('Catálogo', () => {
  it('solo el admin crea categorías y zonas', async () => {
    await assertFails(setDoc(doc(ctx(ANA), 'categories', 'mudanzas'), { name: 'Mudanzas', active: false }));
    await assertSucceeds(setDoc(doc(ctx(ADMIN), 'categories', 'mudanzas'), { name: 'Mudanzas', icon: '📦', active: false, order: 5 }));
    await assertFails(updateDoc(doc(ctx(LUPE), 'zones', 'general-zuazua'), { active: false }));
    await assertSucceeds(updateDoc(doc(ctx(ADMIN), 'zones', 'general-zuazua'), { colonias: ['Centro'] }));
  });
  it('el admin carga el catálogo en lote con bitácora', async () => {
    const db = ctx(ADMIN);
    const b = writeBatch(db);
    b.set(doc(db, 'categories', 'jardineria'), { name: 'Jardinería', icon: '🌿', active: false, order: 4 });
    b.set(doc(db, 'categories', 'mascotas'), { name: 'Cuidado de mascotas', icon: '🐾', active: false, order: 6 });
    b.set(doc(collection(db, 'auditLog')), { adminId: ADMIN, action: 'seed_catalog', targetType: 'catalog', targetId: 'initial', details: {}, createdAt: serverTimestamp() });
    await assertSucceeds(b.commit());
  });
});

describe('Proveedores', () => {
  it('un cliente envía su solicitud como pendiente', async () => {
    await assertSucceeds(setDoc(doc(ctx(ANA), 'providers', ANA), providerApp()));
  });
  it('NO se puede auto-aprobar al crear', async () => {
    await assertFails(setDoc(doc(ctx(ANA), 'providers', ANA), providerApp({ status: 'approved' })));
  });
  it('NO puede crear la solicitud de otra persona', async () => {
    await assertFails(setDoc(doc(ctx(ANA), 'providers', EVA), providerApp()));
  });
  it('NO puede pedir una categoría inactiva o zona inactiva', async () => {
    await assertFails(setDoc(doc(ctx(ANA), 'providers', ANA), providerApp({ categoryIds: ['limpieza'] })));
    await assertFails(setDoc(doc(ctx(ANA), 'providers', ANA), providerApp({ zoneIds: ['zona-inactiva'] })));
  });
  it('el pendiente NO puede aprobarse solo al editar', async () => {
    await assertFails(updateDoc(doc(ctx(PEPE), 'providers', PEPE), { status: 'approved' }));
    await assertSucceeds(updateDoc(doc(ctx(PEPE), 'providers', PEPE), { businessName: 'Pepe Lava', updatedAt: serverTimestamp() }));
  });
  it('rechazado puede reenviar (vuelve a pendiente)', async () => {
    await env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), 'providers', PEPE), { status: 'rejected' }));
    await assertSucceeds(updateDoc(doc(ctx(PEPE), 'providers', PEPE), { status: 'pending', updatedAt: serverTimestamp() }));
  });
  it('el admin aprueba', async () => {
    await assertSucceeds(updateDoc(doc(ctx(ADMIN), 'providers', PEPE), { status: 'approved', reviewedBy: ADMIN, reviewedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  });
  it('perfil pendiente NO es visible para otros; aprobado sí', async () => {
    await assertFails(getDoc(doc(ctx(ANA), 'providers', PEPE)));
    await assertSucceeds(getDoc(doc(ctx(ANA), 'providers', LUPE)));
    await assertSucceeds(getDocs(query(collection(ctx(ANA), 'providers'), where('status', '==', 'approved'))));
    await assertFails(getDocs(collection(ctx(ANA), 'providers')));
  });
  it('el dueño ve su propia solicitud aunque no exista todavía', async () => {
    await assertSucceeds(getDoc(doc(ctx(EVA), 'providers', EVA)));
  });
});

describe('Servicios', () => {
  const svc = (uid, extra = {}) => ({
    providerId: uid, providerName: 'Prov', categoryId: 'lavanderia', zoneIds: ['general-zuazua'],
    title: 'Lavado y doblado', description: '', priceFrom: 90, priceUnit: 'por carga',
    fulfillmentModes: ['dropoff'], active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra,
  });
  it('proveedor aprobado publica un servicio', async () => {
    await assertSucceeds(addDoc(collection(ctx(LUPE), 'services'), svc(LUPE)));
  });
  it('proveedor pendiente NO publica', async () => {
    await assertFails(addDoc(collection(ctx(PEPE), 'services'), svc(PEPE)));
  });
  it('NO publica a nombre de otro ni en categoría que no tiene', async () => {
    await assertFails(addDoc(collection(ctx(LUPE), 'services'), svc(PEPE)));
    await assertFails(addDoc(collection(ctx(LUPE), 'services'), svc(LUPE, { categoryId: 'limpieza' })));
  });
  it('precio negativo rechazado', async () => {
    await assertFails(addDoc(collection(ctx(LUPE), 'services'), svc(LUPE, { priceFrom: -5 })));
  });
  it('clientes ven servicios activos', async () => {
    await assertSucceeds(getDocs(query(collection(ctx(ANA), 'services'), where('active', '==', true))));
  });
});

describe('Pedidos y reservas', () => {
  it('cliente crea pedido a proveedor aprobado', async () => {
    await assertSucceeds(addDoc(collection(ctx(ANA), 'orders'), newOrder()));
  });
  it('cliente crea reserva con fecha futura', async () => {
    const tomorrow = Timestamp.fromMillis(Date.now() + 24 * 3600 * 1000);
    await assertSucceeds(addDoc(collection(ctx(ANA), 'orders'), newOrder({ scheduledAt: tomorrow, serviceId: 'srv-lupe' })));
  });
  it('NO se puede pedir a un proveedor pendiente', async () => {
    await assertFails(addDoc(collection(ctx(ANA), 'orders'), newOrder({ providerId: PEPE })));
  });
  it('NO se puede crear un pedido a nombre de otro ni con estado avanzado', async () => {
    await assertFails(addDoc(collection(ctx(ANA), 'orders'), newOrder({ customerId: EVA })));
    await assertFails(addDoc(collection(ctx(ANA), 'orders'), newOrder({ status: 'delivered' })));
  });
  it('recolección exige domicilio', async () => {
    await assertFails(addDoc(collection(ctx(ANA), 'orders'), newOrder({ fulfillmentMode: 'pickup_delivery' })));
    await assertSucceeds(addDoc(collection(ctx(ANA), 'orders'), newOrder({ fulfillmentMode: 'pickup_delivery', address: 'Calle 1 #123, Centro' })));
  });
  it('un proveedor no se puede pedir a sí mismo', async () => {
    await assertFails(addDoc(collection(ctx(LUPE), 'orders'), newOrder({ customerId: LUPE })));
  });
  it('solo cliente, proveedor y admin ven el pedido', async () => {
    await assertSucceeds(getDoc(doc(ctx(ANA), 'orders', 'ord-1')));
    await assertSucceeds(getDoc(doc(ctx(LUPE), 'orders', 'ord-1')));
    await assertSucceeds(getDoc(doc(ctx(ADMIN), 'orders', 'ord-1')));
    await assertFails(getDoc(doc(ctx(EVA), 'orders', 'ord-1')));
    await assertSucceeds(getDocs(query(collection(ctx(ANA), 'orders'), where('customerId', '==', ANA))));
    await assertFails(getDocs(collection(ctx(EVA), 'orders')));
  });
  it('proveedor sigue el flujo requested → accepted → in_progress → ready → delivered', async () => {
    const ref = doc(ctx(LUPE), 'orders', 'ord-1');
    for (const s of ['accepted', 'in_progress', 'ready']) {
      await assertSucceeds(updateDoc(ref, { status: s, statusChangedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    }
    // Al entregar se anota lo cobrado y el % vigente (30 % + 16 % IVA si el admin no lo ha fijado).
    await assertSucceeds(updateDoc(ref, { status: 'delivered', finalPrice: 150, commissionPct: 30, commissionIvaPct: 16, serviceFee: 10, statusChangedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  });
  it('proveedor NO salta estados', async () => {
    await assertFails(updateDoc(doc(ctx(LUPE), 'orders', 'ord-1'), { status: 'delivered', statusChangedAt: serverTimestamp() }));
  });
  it('cliente cancela, pero NO marca entregado', async () => {
    await assertFails(updateDoc(doc(ctx(ANA), 'orders', 'ord-1'), { status: 'delivered', statusChangedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(ctx(ANA), 'orders', 'ord-1'), { status: 'cancelled', statusChangedAt: serverTimestamp(), cancelReason: 'Ya no lo necesito' }));
  });
  it('nadie cambia el precio ni los datos del pedido después de crearlo', async () => {
    await assertFails(updateDoc(doc(ctx(ANA), 'orders', 'ord-1'), { priceEstimate: 1 }));
    await assertFails(updateDoc(doc(ctx(LUPE), 'orders', 'ord-1'), { details: 'cambiado' }));
  });
  it('NO se borran pedidos', async () => {
    await assertFails(deleteDoc(doc(ctx(ADMIN), 'orders', 'ord-1')));
  });
});

describe('Solicitudes abiertas y ofertas', () => {
  const reqData = (extra = {}) => ({
    customerId: EVA, customerName: 'Eva', categoryId: 'lavanderia', zoneId: 'general-zuazua',
    colonia: 'Centro', description: 'Lavar ropa de bebé', fulfillmentMode: 'pickup_delivery',
    services: ['Lavar', 'Doblar'], quantityText: '2–3 bolsas', whenText: 'Hoy',
    expiresAt: Timestamp.fromMillis(Date.now() + 30 * 60 * 1000),
    status: 'open', createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra,
  });
  it('cliente publica solicitud en zona y categoría activas', async () => {
    await assertSucceeds(addDoc(collection(ctx(EVA), 'requests'), reqData()));
    await assertFails(addDoc(collection(ctx(EVA), 'requests'), reqData({ categoryId: 'limpieza' })));
    await assertFails(addDoc(collection(ctx(EVA), 'requests'), reqData({ zoneId: 'zona-inactiva' })));
  });
  it('proveedor aprobado de la categoría y zona ve solicitudes abiertas; pendiente no', async () => {
    const q = (db) => query(collection(db, 'requests'), where('status', '==', 'open'), where('categoryId', '==', 'lavanderia'), where('zoneId', '==', 'general-zuazua'));
    await assertSucceeds(getDocs(q(ctx(LUPE))));
    await assertFails(getDocs(q(ctx(PEPE))));
    await assertFails(getDoc(doc(ctx(EVA), 'requests', 'req-1')));
  });
  it('proveedor aprobado ofrece; el cliente ve la oferta; otro cliente no', async () => {
    const offer = { providerId: LUPE, providerName: 'Lavandería Lupe', message: 'Puedo hoy', priceFrom: 120, createdAt: serverTimestamp() };
    await assertSucceeds(setDoc(doc(ctx(LUPE), 'requests', 'req-1', 'offers', LUPE), offer));
    await assertFails(setDoc(doc(ctx(PEPE), 'requests', 'req-1', 'offers', PEPE), { ...offer, providerId: PEPE }));
    await assertSucceeds(getDocs(collection(ctx(ANA), 'requests', 'req-1', 'offers')));
    await assertFails(getDocs(collection(ctx(EVA), 'requests', 'req-1', 'offers')));
  });
  it('el cliente cierra su solicitud', async () => {
    await assertSucceeds(updateDoc(doc(ctx(ANA), 'requests', 'req-1'), { status: 'closed', updatedAt: serverTimestamp() }));
  });
});

describe('Etapa 4: publicar pedido, ofertas y elegir', () => {
  const in30 = () => Timestamp.fromMillis(Date.now() + 30 * 60 * 1000);
  const reqBase = (extra = {}) => ({
    customerId: ANA, categoryId: 'lavanderia', zoneId: 'general-zuazua', colonia: 'Centro',
    description: '', services: ['Lavar'], quantityText: '1 bolsa', whenText: 'Hoy',
    fulfillmentMode: 'dropoff', expiresAt: in30(), status: 'open',
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra,
  });
  it('publica sin nombre ni teléfono, con 30 min para ofertas', async () => {
    await assertSucceeds(addDoc(collection(ctx(ANA), 'requests'), reqBase()));
  });
  it('rechaza pedido sin vencimiento o con vencimiento de 2 horas', async () => {
    const { expiresAt, ...sinVence } = reqBase();
    await assertFails(addDoc(collection(ctx(ANA), 'requests'), sinVence));
    await assertFails(addDoc(collection(ctx(ANA), 'requests'), reqBase({ expiresAt: Timestamp.fromMillis(Date.now() + 2 * 3600 * 1000) })));
  });
  it('rechaza pedido vacío (sin servicios ni descripción)', async () => {
    await assertFails(addDoc(collection(ctx(ANA), 'requests'), reqBase({ services: [], description: '' })));
  });
  it('el proveedor aprobado ve pedidos pasados de su zona (para "te perdiste")', async () => {
    await env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), 'requests', 'req-1'), { status: 'assigned' }));
    const q = query(collection(ctx(LUPE), 'requests'), where('categoryId', '==', 'lavanderia'), where('zoneId', '==', 'general-zuazua'));
    await assertSucceeds(getDocs(q));
  });
  it('no se puede ofertar a un pedido vencido', async () => {
    await env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), 'requests', 'req-1'), { expiresAt: Timestamp.fromMillis(Date.now() - 60 * 1000) }));
    const offer = { providerId: LUPE, providerName: 'Lupe', message: 'Hoy', createdAt: serverTimestamp() };
    await assertFails(setDoc(doc(ctx(LUPE), 'requests', 'req-1', 'offers', LUPE), offer));
  });
  it('el cliente elige una oferta: crea pedido aceptado y marca la solicitud', async () => {
    const offer = { providerId: LUPE, providerName: 'Lupe', message: 'Paso a las 5', priceFrom: 120, pickupText: 'Hoy 5 pm', readyText: 'Mañana', providerPhone: '8111111111', createdAt: serverTimestamp() };
    await assertSucceeds(setDoc(doc(ctx(LUPE), 'requests', 'req-1', 'offers', LUPE), offer));
    const db = ctx(ANA);
    const b = writeBatch(db);
    const orderRef = doc(collection(db, 'orders'));
    b.set(orderRef, newOrder({ requestId: 'req-1', status: 'accepted', priceEstimate: 120, agreedPickup: 'Hoy 5 pm', agreedReady: 'Mañana', providerPhone: '8111111111', statusChangedAt: serverTimestamp() }));
    b.update(doc(db, 'requests', 'req-1'), { status: 'assigned', chosenProviderId: LUPE, orderId: orderRef.id, updatedAt: serverTimestamp() });
    await assertSucceeds(b.commit());
  });
  it('no se puede crear pedido "aceptado" sin oferta de ese proveedor', async () => {
    await assertFails(addDoc(collection(ctx(ANA), 'orders'), newOrder({ requestId: 'req-1', status: 'accepted' })));
  });
  it('no se puede marcar asignado a un proveedor que no ofertó', async () => {
    await assertFails(updateDoc(doc(ctx(ANA), 'requests', 'req-1'), { status: 'assigned', chosenProviderId: LUPE, orderId: 'x', updatedAt: serverTimestamp() }));
  });
  it('el proveedor activa "Estoy disponible"', async () => {
    await assertSucceeds(updateDoc(doc(ctx(LUPE), 'providers', LUPE), { isAvailable: true, lastSeenAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(ctx(LUPE), 'providers', LUPE), { isAvailable: 'sí' }));
    await assertFails(updateDoc(doc(ctx(ANA), 'providers', LUPE), { isAvailable: false }));
  });
});

describe('Etapa 4.1: reglas más estrictas (GPT punto 2, 4, 8, 9)', () => {
  const offer = (extra = {}) => ({ providerId: LUPE, providerName: 'Lupe', kind: 'accept', providerType: 'home', message: 'Acepto', createdAt: serverTimestamp(), ...extra });
  it('proveedor disponible acepta con un toque (kind accept)', async () => {
    await assertSucceeds(setDoc(doc(ctx(LUPE), 'requests', 'req-1', 'offers', LUPE), offer()));
  });
  it('proveedor NO disponible no puede ofertar', async () => {
    await env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), 'providers', LUPE), { isAvailable: false }));
    await assertFails(setDoc(doc(ctx(LUPE), 'requests', 'req-1', 'offers', LUPE), offer()));
  });
  it('no puede ofertar si no ofrece la modalidad pedida', async () => {
    await env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), 'providers', LUPE), { fulfillmentModes: ['pickup_delivery'] }));
    await assertFails(setDoc(doc(ctx(LUPE), 'requests', 'req-1', 'offers', LUPE), offer()));
  });
  it('no puede ofertar a un pedido de otra zona', async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), 'zones', 'otra'), { name: 'Otra zona', active: true });
      await updateDoc(doc(c.firestore(), 'requests', 'req-1'), { zoneId: 'otra' });
    });
    await assertFails(setDoc(doc(ctx(LUPE), 'requests', 'req-1', 'offers', LUPE), offer()));
  });
  it('tipo de oferta y tipo de proveedor inválidos se rechazan', async () => {
    await assertFails(setDoc(doc(ctx(LUPE), 'requests', 'req-1', 'offers', LUPE), offer({ kind: 'gratis' })));
    await assertFails(setDoc(doc(ctx(LUPE), 'requests', 'req-1', 'offers', LUPE), offer({ providerType: 'empresa' })));
  });
  it('pedido aceptado suelto (sin marcar la solicitud en el mismo paso) se rechaza', async () => {
    await assertSucceeds(setDoc(doc(ctx(LUPE), 'requests', 'req-1', 'offers', LUPE), offer()));
    await assertFails(addDoc(collection(ctx(ANA), 'orders'), newOrder({ requestId: 'req-1', status: 'accepted' })));
  });
  it('NO se puede asignar dos veces la misma solicitud (doble proveedor)', async () => {
    await assertSucceeds(setDoc(doc(ctx(LUPE), 'requests', 'req-1', 'offers', LUPE), offer()));
    const db = ctx(ANA);
    const b1 = writeBatch(db);
    const o1 = doc(collection(db, 'orders'));
    b1.set(o1, newOrder({ requestId: 'req-1', status: 'accepted', statusChangedAt: serverTimestamp() }));
    b1.update(doc(db, 'requests', 'req-1'), { status: 'assigned', chosenProviderId: LUPE, orderId: o1.id, updatedAt: serverTimestamp() });
    await assertSucceeds(b1.commit());
    const b2 = writeBatch(db);
    const o2 = doc(collection(db, 'orders'));
    b2.set(o2, newOrder({ requestId: 'req-1', status: 'accepted', statusChangedAt: serverTimestamp() }));
    b2.update(doc(db, 'requests', 'req-1'), { status: 'assigned', chosenProviderId: LUPE, orderId: o2.id, updatedAt: serverTimestamp() });
    await assertFails(b2.commit());
  });
  it('la solicitud no puede apuntar a un pedido que no se creó en el mismo paso', async () => {
    await assertSucceeds(setDoc(doc(ctx(LUPE), 'requests', 'req-1', 'offers', LUPE), offer()));
    await assertFails(updateDoc(doc(ctx(ANA), 'requests', 'req-1'), { status: 'assigned', chosenProviderId: LUPE, orderId: 'inventado', updatedAt: serverTimestamp() }));
  });
  it('el proveedor guarda su tipo (negocio / desde casa)', async () => {
    await assertSucceeds(updateDoc(doc(ctx(LUPE), 'providers', LUPE), { providerType: 'business', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(ctx(LUPE), 'providers', LUPE), { providerType: 'otro', updatedAt: serverTimestamp() }));
  });
});

describe('Bitácora', () => {
  it('solo admin escribe y lee; nadie la modifica', async () => {
    const entry = { adminId: ADMIN, action: 'approve_provider', targetType: 'provider', targetId: PEPE, details: {}, createdAt: serverTimestamp() };
    await assertSucceeds(addDoc(collection(ctx(ADMIN), 'auditLog'), entry));
    await assertFails(addDoc(collection(ctx(ANA), 'auditLog'), { ...entry, adminId: ANA }));
    await assertFails(addDoc(collection(ctx(ADMIN), 'auditLog'), { ...entry, adminId: 'otro' }));
    await assertFails(getDocs(collection(ctx(ANA), 'auditLog')));
  });
});

describe('Cuenta suspendida', () => {
  it('no puede crear pedidos ni editar su perfil', async () => {
    await env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), 'users', ANA), { status: 'suspended' }));
    await assertFails(addDoc(collection(ctx(ANA), 'orders'), newOrder()));
    await assertFails(updateDoc(doc(ctx(ANA), 'users', ANA), { displayName: 'Otra' }));
  });
});

describe('Etapa 5: calificaciones', () => {
  const review = (extra = {}) => ({ orderId: 'ord-r', providerId: LUPE, customerId: ANA, customerName: 'Ana', categoryId: 'lavanderia', stars: 5, comment: 'Muy bien', hidden: false, createdAt: serverTimestamp(), ...extra });
  const seedOrder = (status) => env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'orders', 'ord-r'), { ...newOrder(), status }));

  it('el cliente califica un pedido ENTREGADO, una sola vez', async () => {
    await seedOrder('delivered');
    await assertSucceeds(setDoc(doc(ctx(ANA), 'reviews', 'ord-r'), review()));
    await assertFails(setDoc(doc(ctx(ANA), 'reviews', 'ord-r'), review({ stars: 1 }))); // no se edita
  });
  it('no se califica un pedido que no está entregado', async () => {
    await seedOrder('accepted');
    await assertFails(setDoc(doc(ctx(ANA), 'reviews', 'ord-r'), review()));
  });
  it('solo el cliente del pedido; ni el proveedor ni otra persona', async () => {
    await seedOrder('delivered');
    await assertFails(setDoc(doc(ctx(LUPE), 'reviews', 'ord-r'), review({ customerId: LUPE })));
    await assertFails(setDoc(doc(ctx(EVA), 'reviews', 'ord-r'), review({ customerId: EVA })));
  });
  it('estrellas de 1 a 5 y proveedor correcto', async () => {
    await seedOrder('delivered');
    await assertFails(setDoc(doc(ctx(ANA), 'reviews', 'ord-r'), review({ stars: 6 })));
    await assertFails(setDoc(doc(ctx(ANA), 'reviews', 'ord-r'), review({ stars: 0 })));
    await assertFails(setDoc(doc(ctx(ANA), 'reviews', 'ord-r'), review({ providerId: PEPE })));
    await assertFails(setDoc(doc(ctx(ANA), 'reviews', 'ord-r'), review({ hidden: true })));
  });
  it('el admin oculta, pero no cambia las estrellas', async () => {
    await seedOrder('delivered');
    await assertSucceeds(setDoc(doc(ctx(ANA), 'reviews', 'ord-r'), review()));
    await assertSucceeds(updateDoc(doc(ctx(ADMIN), 'reviews', 'ord-r'), { hidden: true, hiddenNote: 'Ofensiva', hiddenBy: ADMIN, hiddenAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(ctx(ADMIN), 'reviews', 'ord-r'), { stars: 1 }));
    await assertFails(updateDoc(doc(ctx(LUPE), 'reviews', 'ord-r'), { hidden: true }));
  });
  it('lectura: visibles para todos con sesión; ocultas solo para dueños y admin', async () => {
    await seedOrder('delivered');
    await assertSucceeds(setDoc(doc(ctx(ANA), 'reviews', 'ord-r'), review()));
    await assertSucceeds(getDocs(query(collection(ctx(EVA), 'reviews'), where('providerId', 'in', [LUPE]), where('hidden', '==', false))));
    await assertSucceeds(getDoc(doc(ctx(EVA), 'reviews', 'no-existe')));
    await updateDoc(doc(ctx(ADMIN), 'reviews', 'ord-r'), { hidden: true });
    await assertFails(getDoc(doc(ctx(EVA), 'reviews', 'ord-r')));
    await assertSucceeds(getDoc(doc(ctx(ANA), 'reviews', 'ord-r')));
    await assertSucceeds(getDocs(query(collection(ctx(LUPE), 'reviews'), where('providerId', '==', LUPE))));
    await assertFails(getDocs(collection(anon(), 'reviews')));
  });
});

describe('Etapa 6: avisos al teléfono (pushTokens)', () => {
  const tok = (extra = {}) => ({ token: 'ExponentPushToken[abcdefghijklmnop]', platform: 'android', app: 'socios', updatedAt: serverTimestamp(), ...extra });
  it('cada quien guarda y borra solo su token', async () => {
    await assertSucceeds(setDoc(doc(ctx(LUPE), 'pushTokens', LUPE), tok()));
    await assertSucceeds(setDoc(doc(ctx(LUPE), 'pushTokens', LUPE), tok({ platform: 'ios' })));
    await assertFails(setDoc(doc(ctx(ANA), 'pushTokens', LUPE), tok()));
    await assertFails(deleteDoc(doc(ctx(ANA), 'pushTokens', LUPE)));
    await assertSucceeds(deleteDoc(doc(ctx(LUPE), 'pushTokens', LUPE)));
  });
  it('nadie más lo lee ni lo lista (ni sin sesión)', async () => {
    await setDoc(doc(ctx(LUPE), 'pushTokens', LUPE), tok());
    await assertSucceeds(getDoc(doc(ctx(LUPE), 'pushTokens', LUPE)));
    await assertFails(getDoc(doc(ctx(ANA), 'pushTokens', LUPE)));
    await assertFails(getDocs(collection(ctx(ADMIN), 'pushTokens')));
    await assertFails(getDoc(doc(anon(), 'pushTokens', LUPE)));
  });
  it('solo campos permitidos y token con formato de Expo', async () => {
    await assertFails(setDoc(doc(ctx(LUPE), 'pushTokens', LUPE), tok({ token: 'cualquier-cosa-que-no-es-token' })));
    await assertFails(setDoc(doc(ctx(LUPE), 'pushTokens', LUPE), tok({ platform: 'windows' })));
    await assertFails(setDoc(doc(ctx(LUPE), 'pushTokens', LUPE), tok({ isAdmin: true })));
    await assertFails(setDoc(doc(anon(), 'pushTokens', LUPE), tok()));
  });
});

describe('Etapa 6: comisión por pedido', () => {
  const toReady = async () => env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'orders', 'ord-c'), { ...newOrder(), status: 'ready' }));
  const deliver = (uid, extra = {}) => updateDoc(doc(ctx(uid), 'orders', 'ord-c'), { status: 'delivered', finalPrice: 200, commissionPct: 30, commissionIvaPct: 16, serviceFee: 10, statusChangedAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra });
  it('para entregar hay que anotar cuánto se cobró', async () => {
    await toReady();
    await assertFails(updateDoc(doc(ctx(LUPE), 'orders', 'ord-c'), { status: 'delivered', statusChangedAt: serverTimestamp() }));
    await assertFails(deliver(LUPE, { finalPrice: 0 }));
    await assertFails(deliver(LUPE, { finalPrice: -5 }));
    await assertFails(deliver(LUPE, { finalPrice: 'mucho' }));
    await assertSucceeds(deliver(LUPE));
  });
  it('el socio no elige su %: debe ser el vigente', async () => {
    await toReady();
    await assertFails(deliver(LUPE, { commissionPct: 0 }));
    await assertFails(deliver(LUPE, { commissionIvaPct: 0 }));
    await assertFails(deliver(LUPE, { serviceFee: 0 })); // en efectivo la cuota también se cobra
    await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'config', 'commission'), { pct: 12, ivaPct: 16, serviceFee: 10, debtLimit: 300 }));
    await assertFails(deliver(LUPE, { commissionPct: 30 }));
    await assertSucceeds(deliver(LUPE, { commissionPct: 12 }));
  });
  it('no se toca el total en otros pasos ni después de entregado', async () => {
    await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'orders', 'ord-c'), { ...newOrder(), status: 'accepted' }));
    await assertFails(updateDoc(doc(ctx(LUPE), 'orders', 'ord-c'), { status: 'in_progress', finalPrice: 1, statusChangedAt: serverTimestamp() }));
    await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'orders', 'ord-c'), { ...newOrder(), status: 'delivered', finalPrice: 200, commissionPct: 30, commissionIvaPct: 16 }));
    await assertFails(updateDoc(doc(ctx(LUPE), 'orders', 'ord-c'), { finalPrice: 20 }));
    await assertFails(updateDoc(doc(ctx(ANA), 'orders', 'ord-c'), { finalPrice: 20 }));
    await assertSucceeds(updateDoc(doc(ctx(ADMIN), 'orders', 'ord-c'), { finalPrice: 180, adminNote: 'Corrección' }));
    await assertFails(updateDoc(doc(ctx(ADMIN), 'orders', 'ord-c'), { commissionPct: 50 }));
  });
  it('solo el admin fija comisión, IVA, cuota de servicio y límite de adeudo', async () => {
    const cfg = (uid, extra = {}) => setDoc(doc(ctx(uid), 'config', 'commission'), { pct: 30, ivaPct: 16, serviceFee: 10, debtLimit: 300, updatedAt: serverTimestamp(), updatedBy: uid, ...extra });
    await assertFails(cfg(LUPE));
    await assertFails(cfg(ADMIN, { pct: 50 }));
    await assertFails(cfg(ADMIN, { ivaPct: 20 }));
    await assertFails(cfg(ADMIN, { serviceFee: 500 }));
    await assertFails(cfg(ADMIN, { debtLimit: -1 }));
    await assertSucceeds(cfg(ADMIN));
    await assertSucceeds(getDoc(doc(ctx(LUPE), 'config', 'commission')));
    await assertFails(getDoc(doc(anon(), 'config', 'commission')));
    await assertFails(setDoc(doc(ctx(ADMIN), 'config', 'otra'), { pct: 5, updatedAt: serverTimestamp(), updatedBy: ADMIN }));
  });
  it('pagos de comisión: los registra el admin; el socio ve solo los suyos', async () => {
    const pay = (uid, extra = {}) => setDoc(doc(ctx(uid), 'commissionPayments', 'p1'), { providerId: LUPE, amount: 300, method: 'Transferencia', createdAt: serverTimestamp(), createdBy: uid, ...extra });
    await assertFails(pay(LUPE));
    await assertFails(pay(ADMIN, { amount: 0 }));
    await assertSucceeds(pay(ADMIN));
    await assertFails(updateDoc(doc(ctx(ADMIN), 'commissionPayments', 'p1'), { amount: 1 }));
    await assertSucceeds(getDocs(query(collection(ctx(LUPE), 'commissionPayments'), where('providerId', '==', LUPE))));
    await assertFails(getDocs(query(collection(ctx(PEPE), 'commissionPayments'), where('providerId', '==', LUPE))));
    await assertFails(deleteDoc(doc(ctx(LUPE), 'commissionPayments', 'p1')));
    await assertSucceeds(deleteDoc(doc(ctx(ADMIN), 'commissionPayments', 'p1')));
  });
});

describe('Etapa 6: total a pagar y pago con tarjeta', () => {
  const put = (data) => env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'orders', 'ord-p'), { ...newOrder(), ...data }));
  const upd = (uid, data) => updateDoc(doc(ctx(uid), 'orders', 'ord-p'), data);
  it('el socio anota el total al recibir la ropa y lo corrige mientras no esté pagado', async () => {
    await put({ status: 'accepted' });
    await assertFails(upd(LUPE, { status: 'in_progress', amountDue: 0, statusChangedAt: serverTimestamp() }));
    await assertFails(upd(LUPE, { status: 'in_progress', amountDue: 150, weightPhotoPath: 'evidence/otro/weight-1700000000.jpg', statusChangedAt: serverTimestamp() }));
    await assertSucceeds(upd(LUPE, { status: 'in_progress', amountDue: 150, statusChangedAt: serverTimestamp() })); // servidor apagado: foto opcional
    await assertSucceeds(upd(LUPE, { amountDue: 170, updatedAt: serverTimestamp() }));
    await assertFails(upd(ANA, { amountDue: 1 }));
    await put({ status: 'in_progress', amountDue: 150, paymentStatus: 'paid' });
    await assertFails(upd(LUPE, { amountDue: 170 }));
  });
  it('el cliente elige tarjeta o efectivo, pero NUNCA se marca pagado desde la app', async () => {
    await put({ status: 'in_progress', amountDue: 150 });
    await assertSucceeds(upd(ANA, { paymentStatus: 'cash', updatedAt: serverTimestamp() }));
    await assertSucceeds(upd(ANA, { paymentStatus: 'pending', updatedAt: serverTimestamp() }));
    await assertFails(upd(ANA, { paymentStatus: 'paid' }));
    await assertFails(upd(LUPE, { paymentStatus: 'paid' }));
    await assertFails(upd(ANA, { paymentStatus: 'cash', paidAmount: 150 }));
    await assertFails(upd(EVA, { paymentStatus: 'cash' }));
  });
  it('pagado con tarjeta: al entregar, el total debe ser lo pagado', async () => {
    await put({ status: 'ready', amountDue: 150, paymentStatus: 'paid' });
    const deliver = (fp, extra = {}) => upd(LUPE, { status: 'delivered', finalPrice: fp, commissionPct: 30, commissionIvaPct: 16, statusChangedAt: serverTimestamp(), ...extra });
    await assertFails(deliver(100));
    await assertFails(deliver(150, { serviceFee: 0 })); // la cuota de un pago con tarjeta la fija el servidor
    await assertSucceeds(deliver(150));
  });
  it('pagos semanales a socios: solo admin; el socio ve los suyos', async () => {
    const pay = (uid) => setDoc(doc(ctx(uid), 'payouts', 'po1'), { providerId: LUPE, amount: 900, method: 'Transferencia', period: 'Semana 26 oct – 1 nov', createdAt: serverTimestamp(), createdBy: uid });
    await assertFails(pay(LUPE));
    await assertSucceeds(pay(ADMIN));
    await assertSucceeds(getDocs(query(collection(ctx(LUPE), 'payouts'), where('providerId', '==', LUPE))));
    await assertFails(getDocs(query(collection(ctx(PEPE), 'payouts'), where('providerId', '==', LUPE))));
    await assertFails(updateDoc(doc(ctx(ADMIN), 'payouts', 'po1'), { amount: 1 }));
  });
});

describe('Etapa 6: saldo y bloqueo por adeudo (solo servidor)', () => {
  it('nadie escribe saldos ni bloqueos desde la app; el socio ve los suyos', async () => {
    await assertFails(setDoc(doc(ctx(LUPE), 'providerBalances', LUPE), { balance: 999 }));
    await assertFails(setDoc(doc(ctx(ADMIN), 'debtBlocks', LUPE), { debt: 1 }));
    await assertFails(deleteDoc(doc(ctx(LUPE), 'debtBlocks', LUPE)));
    await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'providerBalances', LUPE), { balance: -400 }));
    await assertSucceeds(getDoc(doc(ctx(LUPE), 'providerBalances', LUPE)));
    await assertFails(getDoc(doc(ctx(ANA), 'providerBalances', LUPE)));
  });
  it('socio bloqueado por adeudo: no oferta ni recibe reservas', async () => {
    await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'debtBlocks', LUPE), { debt: 400 }));
    await assertFails(addDoc(collection(ctx(ANA), 'orders'), newOrder()));
    await env.withSecurityRulesDisabled((c) => deleteDoc(doc(c.firestore(), 'debtBlocks', LUPE)));
    await assertSucceeds(addDoc(collection(ctx(ANA), 'orders'), newOrder()));
  });
  it('bloqueado puede terminar los pedidos que ya tiene', async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), 'orders', 'ord-b'), { ...newOrder(), status: 'in_progress', amountDue: 100 });
      await setDoc(doc(c.firestore(), 'debtBlocks', LUPE), { debt: 400 });
    });
    await assertSucceeds(updateDoc(doc(ctx(LUPE), 'orders', 'ord-b'), { status: 'ready', statusChangedAt: serverTimestamp() }));
  });
});

describe('Etapa 6: transferencia directa al socio', () => {
  const ti = { holder: 'Lupe Pérez', bank: 'BBVA', account: '012345678901234567' };
  const put = (data) => env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'orders', 'ord-t'), { ...newOrder(), ...data }));
  const upd = (uid, data) => updateDoc(doc(ctx(uid), 'orders', 'ord-t'), data);
  it('el socio guarda su cuenta; nadie más la lee', async () => {
    await assertSucceeds(setDoc(doc(ctx(LUPE), 'providerPayInfo', LUPE), { ...ti, updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(ctx(LUPE), 'providerPayInfo', LUPE), { ...ti, account: '1', updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(ctx(ANA), 'providerPayInfo', LUPE), { ...ti, updatedAt: serverTimestamp() }));
    await assertFails(getDoc(doc(ctx(ANA), 'providerPayInfo', LUPE)));
    await assertSucceeds(getDoc(doc(ctx(ADMIN), 'providerPayInfo', LUPE)));
  });
  it('los datos de transferencia van en el pedido al recibir la ropa', async () => {
    await put({ status: 'accepted' });
    await assertFails(upd(LUPE, { status: 'in_progress', amountDue: 150, transferInfo: { holder: 'X', account: '1' }, statusChangedAt: serverTimestamp() }));
    await assertSucceeds(upd(LUPE, { status: 'in_progress', amountDue: 150, transferInfo: ti, weightPhotoPath: 'evidence/ord-t/weight-1700000000.jpg', statusChangedAt: serverTimestamp() }));
    await assertSucceeds(getDoc(doc(ctx(ANA), 'orders', 'ord-t')));
  });
  it('cliente elige transferencia; solo el socio confirma que le llegó', async () => {
    await put({ status: 'in_progress', amountDue: 150, transferInfo: ti });
    await assertSucceeds(upd(ANA, { paymentStatus: 'transfer', updatedAt: serverTimestamp() }));
    await assertFails(upd(ANA, { paymentStatus: 'transfer_ok' }));
    await assertFails(upd(EVA, { paymentStatus: 'transfer_ok' }));
    await assertSucceeds(upd(LUPE, { paymentStatus: 'transfer_ok', updatedAt: serverTimestamp() }));
    await assertFails(upd(ANA, { paymentStatus: 'cash' }));          // ya confirmada
    await assertFails(upd(LUPE, { amountDue: 999 }));                 // ya no se cambia el total
  });
  it('tarjeta activable solo por el admin (cardEnabled booleano)', async () => {
    const cfg = (uid, extra = {}) => setDoc(doc(ctx(uid), 'config', 'commission'), { pct: 15, ivaPct: 16, serviceFee: 10, debtLimit: 300, cardEnabled: false, updatedAt: serverTimestamp(), updatedBy: uid, ...extra });
    await assertSucceeds(cfg(ADMIN));
    await assertFails(cfg(ADMIN, { cardEnabled: 'si' }));
    await assertFails(cfg(LUPE, { cardEnabled: true }));
  });
});

describe('Etapa 6: protecciones de pago', () => {
  const put = (data) => env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'orders', 'ord-x'), { ...newOrder(), ...data }));
  const upd = (uid, data) => updateDoc(doc(ctx(uid), 'orders', 'ord-x'), data);
  const deliverData = (extra = {}) => ({ status: 'delivered', finalPrice: 150, commissionPct: 30, commissionIvaPct: 16, serviceFee: 10, statusChangedAt: serverTimestamp(), ...extra });
  it('el socio NO puede bajar el total al entregar', async () => {
    await put({ status: 'ready', amountDue: 150, paymentStatus: 'cash' });
    await assertFails(upd(LUPE, deliverData({ finalPrice: 90 })));
    await assertSucceeds(upd(LUPE, deliverData({ deliveredBy: 'provider' })));
  });
  it('el cliente cierra con "Ya recibí mi ropa" (total = el que vio)', async () => {
    await put({ status: 'in_progress', amountDue: 150, paymentStatus: 'cash' });
    await assertFails(upd(ANA, deliverData({ finalPrice: 100, deliveredBy: 'customer' })));
    await assertFails(upd(ANA, deliverData({ deliveredBy: 'provider' })));
    await assertFails(upd(EVA, deliverData({ deliveredBy: 'customer' })));
    await assertSucceeds(upd(ANA, deliverData({ deliveredBy: 'customer' })));
  });
  it('sin total anotado el cliente no puede cerrar', async () => {
    await put({ status: 'in_progress' });
    await assertFails(upd(ANA, deliverData({ deliveredBy: 'customer' })));
  });
  it('"Ya transferí": clave de rastreo y comprobante de ESTE pedido', async () => {
    await put({ status: 'in_progress', amountDue: 150, paymentStatus: 'transfer' });
    const rep = (extra = {}) => upd(ANA, { paymentStatus: 'transfer', transferRef: 'MBAN01002611010012345', receiptPath: 'receipts/ord-x/170000.jpg', transferReportedAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra });
    await assertFails(rep({ receiptPath: 'receipts/otro-pedido/1.jpg' }));
    await assertFails(rep({ transferRef: 'x'.repeat(60) }));
    await assertFails(upd(LUPE, { transferRef: 'ABC', transferReportedAt: serverTimestamp() }));
    await assertSucceeds(rep());
  });
  it('ya entregado: el cliente puede reportar su transferencia, no cambiar a efectivo', async () => {
    await put({ status: 'delivered', amountDue: 150, finalPrice: 150, paymentStatus: 'transfer' });
    await assertSucceeds(upd(ANA, { paymentStatus: 'transfer', transferRef: 'ABC123', transferReportedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    await assertFails(upd(ANA, { paymentStatus: 'cash' }));
  });
});

describe('Etapa 6: chat por pedido', () => {
  const put = (data) => env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'orders', 'ord-m'), { ...newOrder(), ...data }));
  const msg = (uid, role, extra = {}) => addDoc(collection(ctx(uid), 'orders', 'ord-m', 'messages'), { senderId: uid, senderRole: role, text: 'Hola', createdAt: serverTimestamp(), ...extra });
  it('cliente y socio escriben y leen mientras el pedido está activo', async () => {
    await put({ status: 'accepted' });
    await assertSucceeds(msg(ANA, 'customer'));
    await assertSucceeds(msg(LUPE, 'provider'));
    await assertSucceeds(getDocs(collection(ctx(ANA), 'orders', 'ord-m', 'messages')));
    await assertFails(msg(EVA, 'customer'));
    await assertFails(getDocs(collection(ctx(EVA), 'orders', 'ord-m', 'messages')));
    await assertFails(msg(ANA, 'provider'));           // no se hace pasar por el socio
    await assertFails(msg(ANA, 'customer', { senderId: LUPE }));
  });
  it('pedido cerrado: ellos ya no ven el chat; el admin sí, y nadie borra', async () => {
    await put({ status: 'accepted' });
    await msg(ANA, 'customer');
    await env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), 'orders', 'ord-m'), { status: 'cancelled' }));
    await assertFails(getDocs(collection(ctx(ANA), 'orders', 'ord-m', 'messages')));
    await assertFails(msg(LUPE, 'provider'));
    const all = await env.withSecurityRulesDisabled(async (c) => getDocs(collection(c.firestore(), 'orders', 'ord-m', 'messages')));
    const mid = all.docs[0].id;
    await assertSucceeds(getDocs(collection(ctx(ADMIN), 'orders', 'ord-m', 'messages')));
    await assertFails(deleteDoc(doc(ctx(ADMIN), 'orders', 'ord-m', 'messages', mid)));
    await assertFails(updateDoc(doc(ctx(ANA), 'orders', 'ord-m', 'messages', mid), { text: 'editado' }));
  });
});

describe('Etapa 6: colaboradores y revisión', () => {
  const STAFF = 'staff1';
  it('el superadmin agrega y quita colaboradores (solo staff)', async () => {
    const add = (uid, target, extra = {}) => setDoc(doc(ctx(uid), 'admins', target), { role: 'staff', email: `${target}@test.com`, createdAt: serverTimestamp(), createdBy: uid, ...extra });
    await assertFails(add(ADMIN, EVA, { role: 'superadmin' }));
    await assertFails(add(ANA, EVA, { createdBy: ANA }));
    await assertSucceeds(add(ADMIN, EVA));
    await assertFails(add(EVA, ANA, { createdBy: EVA }));               // un staff no agrega
    await assertFails(deleteDoc(doc(ctx(EVA), 'admins', ADMIN)));
    await assertFails(deleteDoc(doc(ctx(ADMIN), 'admins', ADMIN)));     // no se quita a sí mismo
    await assertSucceeds(deleteDoc(doc(ctx(ADMIN), 'admins', EVA)));
  });
  it('un colaborador revisa y lee chats, pero no toca dinero ni configuración', async () => {
    await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'admins', STAFF), { role: 'staff' }));
    await assertSucceeds(getDocs(collection(ctx(STAFF), 'orders')));
    await assertFails(setDoc(doc(ctx(STAFF), 'config', 'commission'), { pct: 1, ivaPct: 16, serviceFee: 0, debtLimit: 0, updatedAt: serverTimestamp(), updatedBy: STAFF }));
    await assertFails(setDoc(doc(ctx(STAFF), 'payouts', 'x'), { providerId: LUPE, amount: 5, createdAt: serverTimestamp(), createdBy: STAFF }));
    await assertSucceeds(updateDoc(doc(ctx(STAFF), 'users', EVA), { status: 'review', statusNote: 'Pedido sospechoso', updatedAt: serverTimestamp() }));
  });
  it('cliente en revisión no puede publicar ni reservar', async () => {
    await env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), 'users', ANA), { status: 'review' }));
    await assertFails(addDoc(collection(ctx(ANA), 'orders'), newOrder()));
  });
});

describe('Etapa 6: mapa (cobertura, zona del socio, ubicación aproximada)', () => {
  const req = (extra = {}) => ({
    customerId: ANA, categoryId: 'lavanderia', zoneId: 'general-zuazua', colonia: 'Centro',
    services: ['Lavar'], fulfillmentMode: 'dropoff', expiresAt: Timestamp.fromMillis(Date.now() + 30 * 60 * 1000),
    status: 'open', createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra,
  });
  it('la solicitud puede llevar ubicación aproximada válida (sin otros datos)', async () => {
    await assertSucceeds(addDoc(collection(ctx(ANA), 'requests'), req({ approxGeo: { lat: 25.89, lng: -100.11 } })));
    await assertFails(addDoc(collection(ctx(ANA), 'requests'), req({ approxGeo: { lat: 125, lng: -100.11 } })));
    await assertFails(addDoc(collection(ctx(ANA), 'requests'), req({ approxGeo: { lat: 25.89, lng: -100.11, address: 'Calle 1' } })));
  });
  it('el socio guarda su zona de servicio (punto + radio de 0.5 a 50 km)', async () => {
    const ref = doc(ctx(LUPE), 'providers', LUPE);
    await assertSucceeds(updateDoc(ref, { serviceArea: { lat: 25.885, lng: -100.112, radiusKm: 5 }, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { serviceArea: { lat: 25.885, lng: -100.112, radiusKm: 500 }, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(ctx(ANA), 'providers', LUPE), { serviceArea: { lat: 1, lng: 1, radiusKm: 5 } }));
  });
  it('solo el admin dibuja la cobertura de una zona', async () => {
    const zone = { name: 'General Zuazua', active: true, coverage: { lat: 25.89, lng: -100.11, radiusKm: 8 } };
    await assertSucceeds(setDoc(doc(ctx(ADMIN), 'zones', 'general-zuazua'), zone));
    await assertFails(setDoc(doc(ctx(ADMIN), 'zones', 'general-zuazua'), { ...zone, coverage: { lat: 25.89, lng: -100.11 } }));
    await assertFails(setDoc(doc(ctx(LUPE), 'zones', 'general-zuazua'), zone));
  });
});

describe('Etapa 7: PIN de entrega y fotos de evidencia', () => {
  beforeEach(async () => { await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'config', 'commission'), { pct: 30, ivaPct: 16, serviceFee: 10, debtLimit: 300, serverOn: true })); });
  const put = (data) => env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'orders', 'ord-e'), { ...newOrder(), ...data }));
  const upd = (uid, data) => updateDoc(doc(ctx(uid), 'orders', 'ord-e'), data);
  const deliver = (extra = {}) => upd(LUPE, { status: 'delivered', finalPrice: 150, commissionPct: 30, commissionIvaPct: 16, serviceFee: 10, statusChangedAt: serverTimestamp(), ...extra });
  it('el PIN solo lo lee el cliente (y el admin); nadie lo escribe desde la app', async () => {
    await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'deliveryPins', 'ord-e'), { pin: '1234', customerId: ANA, providerId: LUPE, attempts: 0 }));
    await assertSucceeds(getDoc(doc(ctx(ANA), 'deliveryPins', 'ord-e')));
    await assertSucceeds(getDoc(doc(ctx(ADMIN), 'deliveryPins', 'ord-e')));
    await assertFails(getDoc(doc(ctx(LUPE), 'deliveryPins', 'ord-e')));   // el socio NO ve el PIN
    await assertFails(getDoc(doc(ctx(EVA), 'deliveryPins', 'ord-e')));
    await assertFails(getDocs(collection(ctx(ADMIN), 'deliveryPins')));
    await assertFails(setDoc(doc(ctx(ANA), 'deliveryPins', 'ord-e'), { pin: '0000', customerId: ANA }));
    await assertFails(updateDoc(doc(ctx(LUPE), 'deliveryPins', 'ord-e'), { attempts: 0 }));
  });
  it('entregar sin PIN exige foto de entrega de ESTE pedido', async () => {
    await put({ status: 'ready', amountDue: 150, paymentStatus: 'cash', weightPhotoPath: 'evidence/ord-e/weight-1700000000.jpg' });
    await assertFails(deliver());
    await assertFails(deliver({ deliveryVerified: 'pin', deliveryPhotoPath: 'evidence/ord-e/delivery-1700000000.jpg' })); // 'pin' solo lo pone el servidor
    await assertFails(deliver({ deliveryVerified: 'photo', deliveryPhotoPath: 'evidence/ord-x/delivery-1700000000.jpg' }));
    await assertFails(deliver({ deliveryVerified: 'photo', deliveryPhotoPath: 'evidence/ord-e/weight-1700000000.jpg' }));
    await assertSucceeds(deliver({ deliveryVerified: 'photo', deliveryPhotoPath: 'evidence/ord-e/delivery-1700000000.jpg' }));
    // Solo el equipo la marca como revisada
    await assertFails(upd(LUPE, { deliveryReviewed: true, updatedAt: serverTimestamp() }));
    await assertFails(upd(ADMIN, { deliveryReviewed: 'si', updatedAt: serverTimestamp() }));
    await assertSucceeds(upd(ADMIN, { deliveryReviewed: true, updatedAt: serverTimestamp() }));
  });
  it('con servidor: el total exige foto de báscula de ESTE pedido', async () => {
    await put({ status: 'accepted' });
    await assertFails(upd(LUPE, { status: 'in_progress', amountDue: 150, statusChangedAt: serverTimestamp() }));
    await assertFails(upd(LUPE, { status: 'in_progress', amountDue: 150, weightPhotoPath: 'evidence/otro/weight-1700000000.jpg', statusChangedAt: serverTimestamp() }));
    await assertSucceeds(upd(LUPE, { status: 'in_progress', amountDue: 150, weightPhotoPath: 'evidence/ord-e/weight-1700000000.jpg', pickupPhotoPath: 'evidence/ord-e/pickup-1700000000.jpg', statusChangedAt: serverTimestamp() }));
  });
  it('las fotos no se cambian después ni fuera de su paso', async () => {
    await put({ status: 'ready', amountDue: 150, weightPhotoPath: 'evidence/ord-e/weight-1700000000.jpg' });
    await assertFails(upd(LUPE, { status: 'delivered', weightPhotoPath: 'evidence/ord-e/weight-1700000001.jpg', statusChangedAt: serverTimestamp() }));
    await assertFails(upd(LUPE, { deliveryVerified: 'photo', updatedAt: serverTimestamp() }));
    await assertFails(upd(ANA, { weightPhotoPath: 'evidence/ord-e/weight-1700000002.jpg' }));
    // corregir el total sí, con foto nueva de báscula
    await assertSucceeds(upd(LUPE, { amountDue: 170, weightPhotoPath: 'evidence/ord-e/weight-1700000003.jpg', updatedAt: serverTimestamp() }));
  });
});

describe('Etapa 7: modo puente (servidor apagado, sin Blaze)', () => {
  const put = (data) => env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'orders', 'ord-s'), { ...newOrder(), ...data }));
  const upd = (uid, data) => updateDoc(doc(ctx(uid), 'orders', 'ord-s'), data);
  it('sin servidor: total sin foto y entrega directa sin foto ni PIN', async () => {
    await put({ status: 'accepted' });
    await assertSucceeds(upd(LUPE, { status: 'in_progress', amountDue: 150, statusChangedAt: serverTimestamp() }));
    await assertSucceeds(upd(LUPE, { amountDue: 160, updatedAt: serverTimestamp() }));
    await assertFails(upd(LUPE, { amountDue: 170, weightPhotoPath: 'evidence/otro/weight-1700000000.jpg', updatedAt: serverTimestamp() }));
    await put({ status: 'ready', amountDue: 150, paymentStatus: 'cash' });
    const deliver = (extra = {}) => upd(LUPE, { status: 'delivered', finalPrice: 150, commissionPct: 30, commissionIvaPct: 16, serviceFee: 10, deliveredBy: 'provider', statusChangedAt: serverTimestamp(), ...extra });
    await assertFails(deliver({ deliveryVerified: 'pin' }));
    await assertSucceeds(deliver());
  });
  it('solo el superadmin prende el servidor (booleano)', async () => {
    const cfg = (uid, extra = {}) => setDoc(doc(ctx(uid), 'config', 'commission'), { pct: 30, ivaPct: 16, serviceFee: 10, debtLimit: 300, cardEnabled: false, serverOn: true, updatedAt: serverTimestamp(), updatedBy: uid, ...extra });
    await assertFails(cfg(LUPE));
    await assertFails(cfg(ADMIN, { serverOn: 'si' }));
    await assertSucceeds(cfg(ADMIN));
  });
});
