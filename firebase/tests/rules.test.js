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
    await setDoc(doc(db, 'providers', LUPE), { ...providerApp({ status: 'approved', businessName: 'Lavandería Lupe' }), createdAt: now, updatedAt: now });
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
    for (const s of ['accepted', 'in_progress', 'ready', 'delivered']) {
      await assertSucceeds(updateDoc(ref, { status: s, statusChangedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    }
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
