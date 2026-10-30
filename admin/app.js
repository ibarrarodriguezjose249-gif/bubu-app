// ═══════════════════════════════════════════════════════════════════════════
//  BÜBÜ — Panel administrativo (web, sin instalar nada)
//  Se publica en Cloudflare subiendo esta carpeta. Usa Firebase desde su CDN.
//
//  Seguridad: este archivo NO tiene ninguna clave privada. Quién puede leer o
//  cambiar cada cosa lo deciden las reglas de Firestore (firebase/firestore.rules):
//  solo una cuenta que exista en la colección `admins` puede usar este panel.
//  Cada acción del panel deja un registro en `auditLog`, en el mismo paso.
// ═══════════════════════════════════════════════════════════════════════════
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail,
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import {
  getFirestore, doc, collection, getDoc, getDocs, onSnapshot, query, orderBy, limit, where,
  writeBatch, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';
import { getStorage, ref as storageRef, getDownloadURL } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-storage.js';
import { firebaseConfig } from './config.js';

// ───────────── Constantes (las mismas que la app móvil) ─────────────
const BRAND = 'BÜBÜ';
const ONLINE_WINDOW_MIN = 15;
const LIST_LIMIT = 500;
const PROVIDER_STATUS = {
  pending: { label: 'En revisión', tone: 'warn' },
  approved: { label: 'Aprobado', tone: 'ok' },
  rejected: { label: 'No aprobado', tone: 'err' },
  suspended: { label: 'Suspendido', tone: 'err' },
};
const USER_STATUS = { active: { label: 'Activo', tone: 'ok' }, review: { label: 'En revisión', tone: 'warn' }, suspended: { label: 'Suspendido', tone: 'err' } };
const ORDER_STATUS = {
  requested: { label: 'Solicitado', tone: '' },
  accepted: { label: 'Aceptado', tone: 'ok' },
  rejected: { label: 'Rechazado', tone: 'err' },
  in_progress: { label: 'En proceso', tone: 'warn' },
  ready: { label: 'Listo', tone: 'ok' },
  delivered: { label: 'Entregado', tone: 'ok' },
  cancelled: { label: 'Cancelado', tone: 'mute' },
  disputed: { label: 'En revisión', tone: 'err' },
};
const REQUEST_STATE = {
  open: { label: 'Recibiendo ofertas', tone: '' },
  expired: { label: 'Venció sin elegir', tone: 'mute' },
  assigned: { label: 'Asignado', tone: 'ok' },
  cancelled: { label: 'Cancelado', tone: 'mute' },
  closed: { label: 'Cerrado', tone: 'mute' },
};
const MODES = { dropoff: '🏪 El cliente lo lleva', pickup_delivery: '🚗 Recolección y entrega' };
const PROVIDER_TYPES = { business: '🏪 Negocio', home: '🏠 Desde casa' };
const AUDIT_LABELS = {
  'provider.approved': 'Aprobó proveedor', 'provider.rejected': 'Rechazó proveedor', 'provider.suspended': 'Suspendió proveedor',
  'provider.pending': 'Puso socio en revisión', 'user.suspended': 'Suspendió usuario', 'user.active': 'Reactivó usuario',
  'order.status': 'Cambió estado de pedido', 'request.status': 'Cambió solicitud', 'category.create': 'Creó categoría',
  'category.update': 'Editó categoría', 'commission.rate': 'Cambió comisión, cuota o límite', 'commission.payment': 'Registró pago de comisión',
  'commission.paymentDeleted': 'Borró pago de comisión', 'order.finalPrice': 'Corrigió total cobrado',
  'payout.create': 'Registró depósito a socio', 'staff.add': 'Agregó colaborador', 'zone.coverage': 'Cambió cobertura de zona', 'staff.remove': 'Quitó colaborador',
  'user.review': 'Puso usuario en revisión', 'payout.deleted': 'Borró depósito a socio', 'order.payment': 'Cambió estado de pago', 'order.deliveryReviewed': 'Revisó entrega con foto', 'review.hide': 'Ocultó reseña', 'review.show': 'Volvió a mostrar reseña', 'zone.create': 'Creó zona', 'zone.update': 'Editó zona', 'seedCatalog': 'Cargó catálogo inicial',
};

// ───────────── Firebase ─────────────
const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
auth.languageCode = 'es';
const db = getFirestore(fbApp);
const storage = getStorage(fbApp);

// ───────────── Utilidades ─────────────
const $app = document.getElementById('app');
const $modal = document.getElementById('modal-root');
const $toast = document.getElementById('toast');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (t, max) => String(t ?? '').trim().slice(0, max);
const round2 = (n) => Math.round(n * 100) / 100;
const money2 = (n) => `$${(typeof n === 'number' && !Number.isNaN(n) ? n : 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const parseMoney = (t) => { const v = Number(String(t ?? '').replace(/[$,\s]/g, '')); return Number.isFinite(v) && v > 0 && v <= 1000000 ? round2(v) : 0; };
// Comisión: igual que la app y las reglas (10 % si el admin no ha fijado otro).
const DEFAULT_CFG = { pct: 30, ivaPct: 16, serviceFee: 10, debtLimit: 300 };
const DEFAULT_COMMISSION_PCT = DEFAULT_CFG.pct;
const cfgFrom = (d) => ({ ...Object.fromEntries(Object.keys(DEFAULT_CFG).map((k) => [k, d && typeof d[k] === 'number' ? d[k] : DEFAULT_CFG[k]])), cardEnabled: !!(d && d.cardEnabled === true), serverOn: !!(d && d.serverOn === true) });
const feeFor = (amount, pct, iva) => round2(amount * (pct / 100) * (1 + (iva || 0) / 100));
const commissionLabel = (pct, iva) => `${pct} %${iva ? ' + IVA' : ''}`;
const commissionOf = (o) => (o?.status === 'delivered' && typeof o.finalPrice === 'number'
  ? feeFor(o.finalPrice, typeof o.commissionPct === 'number' ? o.commissionPct : DEFAULT_COMMISSION_PCT, typeof o.commissionIvaPct === 'number' ? o.commissionIvaPct : 0) : 0);
function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  return typeof ts === 'number' ? ts : 0;
}
function fmtDate(ts, withTime = true) {
  const ms = toMillis(ts);
  if (!ms) return '—';
  const opts = withTime ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short', year: 'numeric' };
  return new Date(ms).toLocaleString('es-MX', opts);
}
function timeAgo(ts) {
  const ms = toMillis(ts);
  if (!ms) return '—';
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return 'hace un momento';
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}
const badge = (map, key) => { const s = map[key] || { label: key || '—', tone: 'mute' }; return `<span class="badge ${s.tone}">${esc(s.label)}</span>`; };
const isOnline = (p) => !!p?.isAvailable && toMillis(p.lastSeenAt) > Date.now() - ONLINE_WINDOW_MIN * 60000;
function requestState(r) {
  if (r.status === 'open') return toMillis(r.expiresAt) && toMillis(r.expiresAt) <= Date.now() ? 'expired' : 'open';
  return r.status;
}
const byNewest = (a, b) => toMillis(b.createdAt) - toMillis(a.createdAt);
const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const linesToList = (t, max, maxLen) => [...new Set(String(t || '').split(/\n|,/).map((x) => x.trim().slice(0, maxLen)).filter(Boolean))].slice(0, max);
function friendly(e) {
  const c = e?.code || '';
  if (c.includes('permission-denied')) return 'Firebase no lo permitió (reglas). ¿Esta cuenta está en la colección admins?';
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found')) return 'Correo o contraseña incorrectos.';
  if (c.includes('too-many-requests')) return 'Demasiados intentos. Espera unos minutos.';
  if (c.includes('network') || c.includes('unavailable')) return 'Sin conexión con Firebase. Revisa tu internet.';
  if (c.includes('unauthorized-domain')) return 'Este dominio no está autorizado en Firebase → Authentication → Configuración → Dominios autorizados.';
  return e?.message || 'Ocurrió un error.';
}
let toastTimer;
function toast(msg, isErr = false) {
  $toast.textContent = msg;
  $toast.className = 'show' + (isErr ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $toast.className = ''; }, 3200);
}

// ───────────── Estado ─────────────
const S = {
  phase: 'loading', // loading | login | denied | ready
  user: null,
  page: 'resumen',
  data: { providers: [], users: [], orders: [], requests: [], categories: [], zones: [], audit: [], reviews: [], delivered: [], payments: [], payouts: [], blocks: [], admins: [] },
  cfg: { pct: 30, ivaPct: 16, serviceFee: 10, debtLimit: 300 }, // config/commission (valores por omisión si no existe)
  loaded: {},
  errors: {},
  filter: { providers: 'pending', orders: 'all', requests: 'all', users: 'all', reviews: 'all' },
  search: '',
  loginError: '',
  busy: false,
};
let unsubs = [];
const usersById = () => Object.fromEntries(S.data.users.map((u) => [u.id, u]));
const catName = (id) => { const c = S.data.categories.find((x) => x.id === id); return c ? `${c.icon || ''} ${c.name}`.trim() : id; };
const zoneName = (id) => S.data.zones.find((x) => x.id === id)?.name || id;
function ratingOf(providerId) {
  const list = S.data.reviews.filter((r) => r.providerId === providerId && !r.hidden && typeof r.stars === 'number');
  if (!list.length) return null;
  return { avg: Math.round((list.reduce((a, r) => a + r.stars, 0) / list.length) * 10) / 10, count: list.length };
}
const ratingHtml = (id) => { const r = ratingOf(id); return r ? `<span class="badge star">★ ${r.avg.toFixed(1)} (${r.count})</span>` : ''; };
const starsTxt = (n) => '★'.repeat(n || 0) + '☆'.repeat(5 - (n || 0));
const providerName = (id) => S.data.providers.find((p) => p.id === id)?.businessName || usersById()[id]?.displayName || id;

// ───────────── Sesión ─────────────
onAuthStateChanged(auth, async (u) => {
  stopListening();
  S.user = u;
  if (!u) { S.phase = 'login'; return render(); }
  S.phase = 'loading';
  render();
  try {
    const a = await getDoc(doc(db, 'admins', u.uid));
    if (!a.exists()) { S.phase = 'denied'; return render(); }
    S.role = a.data().role === 'superadmin' ? 'superadmin' : 'staff';
    S.phase = 'ready';
    startListening();
    render();
  } catch (e) {
    S.phase = 'denied';
    S.loginError = friendly(e);
    render();
  }
});

function listen(key, ref, sort) {
  const un = onSnapshot(ref, (snap) => {
    let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (sort) list = list.sort(sort);
    S.data[key] = list;
    S.loaded[key] = true;
    delete S.errors[key];
    render();
  }, (e) => { S.errors[key] = friendly(e); S.loaded[key] = true; render(); });
  unsubs.push(un);
}
function startListening() {
  listen('providers', collection(db, 'providers'), byNewest);
  listen('users', query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(LIST_LIMIT)));
  listen('orders', query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(LIST_LIMIT)));
  listen('requests', query(collection(db, 'requests'), orderBy('createdAt', 'desc'), limit(LIST_LIMIT)));
  listen('categories', collection(db, 'categories'), (a, b) => (a.order ?? 99) - (b.order ?? 99));
  listen('zones', collection(db, 'zones'), (a, b) => String(a.name).localeCompare(String(b.name)));
  listen('audit', query(collection(db, 'auditLog'), orderBy('createdAt', 'desc'), limit(200)));
  listen('reviews', query(collection(db, 'reviews'), orderBy('createdAt', 'desc'), limit(LIST_LIMIT)));
  // Comisiones: TODOS los pedidos entregados (no solo los últimos 500) y los pagos registrados.
  listen('delivered', query(collection(db, 'orders'), where('status', '==', 'delivered')));
  listen('payments', collection(db, 'commissionPayments'), byNewest);
  listen('payouts', collection(db, 'payouts'), byNewest);
  listen('blocks', collection(db, 'debtBlocks'));
  listen('admins', collection(db, 'admins'));
  unsubs.push(onSnapshot(doc(db, 'config', 'commission'), (s) => {
    S.cfg = cfgFrom(s.exists() ? s.data() : null); S.loaded.config = true; render();
  }, (e) => { S.errors.config = friendly(e); render(); }));
}
function stopListening() {
  unsubs.forEach((u) => { try { u(); } catch { /* nada */ } });
  unsubs = [];
  S.loaded = {};
  S.errors = {};
}

// Escribe un cambio y su registro en la bitácora en el MISMO paso.
async function commitWithAudit(ref, data, { action, targetType, targetId, details }, mode = 'update') {
  const batch = writeBatch(db);
  if (mode === 'set') batch.set(ref, data); else if (mode === 'delete') batch.delete(ref); else batch.update(ref, data);
  batch.set(doc(collection(db, 'auditLog')), {
    adminId: S.user.uid, action, targetType, targetId, details: details || {}, createdAt: serverTimestamp(),
  });
  await batch.commit();
}

// ───────────── Render ─────────────
function render() {
  const active = document.activeElement;
  const keepSearch = active && active.id === 'search';
  const caret = keepSearch ? active.selectionStart : 0;

  if (S.phase === 'loading') $app.innerHTML = '<div class="boot">Cargando panel…</div>';
  else if (S.phase === 'login') $app.innerHTML = loginView();
  else if (S.phase === 'denied') $app.innerHTML = deniedView();
  else $app.innerHTML = shellView();

  if (keepSearch) {
    const s = document.getElementById('search');
    if (s) { s.focus(); s.setSelectionRange(caret, caret); }
  }
}

function loginView() {
  return `<div class="login-wrap"><form class="login-card" data-form="login" autocomplete="on">
    <div class="logo">BÜ<span>BÜ</span></div>
    <h1>Panel administrativo</h1>
    <label class="f" for="email">Correo</label>
    <input class="in" id="email" name="email" type="email" required autocomplete="username" />
    <label class="f" for="password">Contraseña</label>
    <input class="in" id="password" name="password" type="password" required autocomplete="current-password" />
    ${S.loginError ? `<div class="notice err">${esc(S.loginError)}</div>` : ''}
    <div style="height:14px"></div>
    <button class="btn block" type="submit" ${S.busy ? 'disabled' : ''}>${S.busy ? 'Entrando…' : 'Entrar'}</button>
    <div style="text-align:center;margin-top:12px"><button type="button" class="btn ghost small" data-act="reset">Olvidé mi contraseña</button></div>
    <p class="hint" style="text-align:center;margin-top:16px">Solo para cuentas registradas en la colección <b>admins</b> de Firebase.</p>
  </form></div>`;
}

function deniedView() {
  return `<div class="login-wrap"><div class="login-card">
    <div class="logo">BÜ<span>BÜ</span></div>
    <h1>Sin acceso</h1>
    <div class="notice warn">La cuenta <b>${esc(S.user?.email)}</b> no es administradora.</div>
    ${S.loginError ? `<div class="notice err">${esc(S.loginError)}</div>` : ''}
    <p class="hint">Para dar acceso: Firebase → Firestore → colección <b>admins</b> → documento con ID = UID de la cuenta
      (<span class="mono">${esc(S.user?.uid)}</span>) y el campo <b>role</b> = <b>superadmin</b>.</p>
    <button class="btn block" data-act="logout">Salir</button>
  </div></div>`;
}

const PAGES = [
  ['resumen', '📊', 'Resumen'],
  ['proveedores', '🧺', 'Proveedores'],
  ['pedidos', '📦', 'Pedidos'],
  ['comisiones', '💰', 'Pagos a socios'],
  ['solicitudes', '📣', 'Solicitudes'],
  ['usuarios', '👥', 'Usuarios'],
  ['categorias', '🗂️', 'Categorías'],
  ['resenas', '⭐', 'Reseñas'],
  ['zonas', '📍', 'Zonas y colonias'],
  ['bitacora', '📝', 'Bitácora'],
  ['equipo', '🧑‍💼', 'Colaboradores'],
];

function shellView() {
  const pending = S.data.providers.filter((p) => p.status === 'pending').length;
  const nav = PAGES.map(([id, ic, label]) => `<button class="nav-btn ${S.page === id ? 'on' : ''}" data-page="${id}">
      <span>${ic}</span>${esc(label)}${id === 'proveedores' && pending ? `<span class="count">${pending}</span>` : ''}</button>`).join('');
  const views = { resumen, proveedores, pedidos, comisiones, solicitudes, usuarios, categorias, resenas, zonas, bitacora, equipo };
  return `<div class="shell">
    <nav class="side">
      <div class="logo">BÜ<span>BÜ</span></div><div class="sub">Panel administrativo</div>
      ${nav}
      <div class="who"><span>${esc(S.user?.email)}</span><button class="btn ghost small" data-act="logout">Salir</button></div>
    </nav>
    <main>${views[S.page]()}</main>
  </div>`;
}

const head = (title, sub, right = '') => `<div class="page-head"><div><h2>${esc(title)}</h2>${sub ? `<p>${sub}</p>` : ''}</div>${right}</div>`;
const errBox = (key) => (S.errors[key] ? `<div class="notice err">No se pudo leer <b>${esc(key)}</b>: ${esc(S.errors[key])}</div>` : '');
const loadingOr = (key, html) => (!S.loaded[key] ? '<div class="empty">Cargando…</div>' : html);
const chips = (group, options) => `<div class="toolbar">${options.map(([v, l, n]) =>
  `<button class="chip ${S.filter[group] === v ? 'on' : ''}" data-filter="${group}" data-value="${v}">${esc(l)}${n != null ? ` · ${n}` : ''}</button>`).join('')}
  <input id="search" class="search" type="search" placeholder="Buscar…" value="${esc(S.search)}" /></div>`;
const matches = (...fields) => { const q = S.search.trim().toLowerCase(); return !q || fields.some((f) => String(f ?? '').toLowerCase().includes(q)); };

// ───────────── Resumen ─────────────
// Alertas: transferencias reportadas sin confirmar (+24 h) y pedidos sin cerrar (+3 días).
function paymentAlerts() {
  const now = Date.now();
  const transfers = S.data.orders.filter((o) => o.paymentStatus === 'transfer' && o.transferReportedAt && toMillis(o.transferReportedAt) < now - 86400000);
  const stale = S.data.orders.filter((o) => ['in_progress', 'ready'].includes(o.status) && toMillis(o.statusChangedAt || o.updatedAt || o.createdAt) < now - 3 * 86400000);
  // Entregas SIN PIN (con foto): el equipo las revisa.
  const photoDeliveries = S.data.orders.filter((o) => o.status === 'delivered' && o.deliveryVerified === 'photo' && o.deliveryReviewed !== true);
  return { transfers, stale, photoDeliveries };
}
// Código corto de la bolsa (igual que en las apps).
const bagCode = (id) => `BÜ-${String(id || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase()}`;
const EVIDENCE = [['weightPhotoPath', 'Báscula'], ['pickupPhotoPath', 'Recolección'], ['deliveryPhotoPath', 'Entrega']];
function alertsHtml() {
  const { transfers, stale, photoDeliveries } = paymentAlerts();
  const row = (o, txt) => `<div class="row clickable" data-act="order-view" data-id="${esc(o.id)}"><div><div class="t">${esc(o.providerName || providerName(o.providerId))} · ${esc(o.customerName || 'Cliente')}</div><div class="m">${txt}</div></div><div class="acts"><button class="btn ghost small" data-act="order-view" data-id="${esc(o.id)}">Ver</button></div></div>`;
  return (transfers.length ? `<div class="notice warn"><b>${transfers.length} transferencia${transfers.length === 1 ? '' : 's'} sin confirmar por el socio (más de 24 h).</b> Revisa el comprobante y la clave de rastreo en Banxico; llama al socio.</div>
      <div class="list">${transfers.map((o) => row(o, `Reportada ${esc(timeAgo(o.transferReportedAt))}${o.transferRef ? ` · clave ${esc(o.transferRef)}` : ''}${o.receiptPath ? ' · con foto' : ''}`)).join('')}</div>` : '')
    + (stale.length ? `<div class="notice warn"><b>${stale.length} pedido${stale.length === 1 ? '' : 's'} sin cerrar (más de 3 días en proceso).</b> Pregunta al socio o al cliente si ya se entregó.</div>
      <div class="list">${stale.map((o) => row(o, `${esc(ORDER_STATUS[o.status]?.label || o.status)} desde ${esc(timeAgo(o.statusChangedAt || o.updatedAt || o.createdAt))}${typeof o.amountDue === 'number' ? ` · total ${money2(o.amountDue)}` : ''}`)).join('')}</div>` : '')
    + (photoDeliveries.length ? `<div class="notice warn"><b>${photoDeliveries.length} entrega${photoDeliveries.length === 1 ? '' : 's'} sin PIN (con foto) por revisar.</b> Mira la foto y, si hay duda, llama al cliente para confirmar que recibió su ropa.</div>
      <div class="list">${photoDeliveries.map((o) => row(o, `Bolsa ${esc(bagCode(o.id))} · entregado ${esc(timeAgo(o.statusChangedAt || o.updatedAt))}${typeof o.finalPrice === 'number' ? ` · ${money2(o.finalPrice)}` : ''}`)).join('')}</div>` : '');
}

function resumen() {
  const d = S.data;
  const weekAgo = Date.now() - 7 * 86400000;
  const online = d.providers.filter((p) => p.status === 'approved' && isOnline(p)).length;
  const approved = d.providers.filter((p) => p.status === 'approved').length;
  const pending = d.providers.filter((p) => p.status === 'pending').length;
  const reqWeek = d.requests.filter((r) => toMillis(r.createdAt) > weekAgo);
  const openNow = d.requests.filter((r) => requestState(r) === 'open').length;
  const assignedWeek = reqWeek.filter((r) => r.status === 'assigned').length;
  const expiredWeek = reqWeek.filter((r) => requestState(r) === 'expired').length;
  const active = d.orders.filter((o) => ['requested', 'accepted', 'in_progress', 'ready'].includes(o.status)).length;
  const deliveredWeek = d.orders.filter((o) => o.status === 'delivered' && toMillis(o.statusChangedAt || o.updatedAt) > weekAgo).length;
  const stat = (n, l, hot) => `<div class="stat ${hot ? 'hot' : ''}"><div class="n">${n}</div><div class="l">${esc(l)}</div></div>`;
  const recent = [...d.orders].slice(0, 6);
  const needsCatalog = S.loaded.categories && d.categories.length === 0;
  const zoneNoColonias = d.zones.filter((z) => z.active && !(z.colonias || []).length);
  return head('Resumen', `Datos reales de Firebase · ${new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}`)
    + ['providers', 'users', 'orders', 'requests'].map(errBox).join('')
    + alertsHtml()
    + (pending ? `<div class="notice warn">Tienes <b>${pending}</b> solicitud${pending > 1 ? 'es' : ''} de proveedor por revisar. <button class="btn small" data-page="proveedores">Revisar</button></div>` : '')
    + (needsCatalog ? '<div class="notice warn">No hay categorías en Firebase. Cárgalas desde la app (Perfil → Herramientas de administrador).</div>' : '')
    + (zoneNoColonias.length ? `<div class="notice">La zona <b>${esc(zoneNoColonias[0].name)}</b> aún no tiene colonias capturadas. <button class="btn small ghost" data-page="zonas">Capturar</button></div>` : '')
    + `<div class="stats">
        ${stat(online, 'Proveedores conectados ahora', true)}
        ${stat(approved, 'Proveedores aprobados')}
        ${stat(pending, 'Por revisar')}
        ${stat(d.users.length, 'Usuarios registrados')}
        ${stat(openNow, 'Solicitudes recibiendo ofertas')}
        ${stat(reqWeek.length, 'Solicitudes en 7 días')}
        ${stat(assignedWeek, 'Asignadas en 7 días')}
        ${stat(expiredWeek, 'Vencieron sin elegir (7 días)')}
        ${stat(active, 'Pedidos en curso')}
        ${stat(deliveredWeek, 'Entregados en 7 días')}
        ${stat(d.reviews.length ? (d.reviews.filter((r) => !r.hidden).reduce((a, r) => a + (r.stars || 0), 0) / Math.max(1, d.reviews.filter((r) => !r.hidden).length)).toFixed(1) + ' ★' : '—', `Calificación promedio (${d.reviews.filter((r) => !r.hidden).length} reseñas)`)}
      </div>
      <div class="section-title">Pedidos recientes</div>
      ${loadingOr('orders', recent.length ? `<div class="list">${recent.map(orderRow).join('')}</div>` : '<div class="empty">Aún no hay pedidos.</div>')}`;
}

// ───────────── Proveedores ─────────────
function proveedores() {
  const all = S.data.providers;
  const count = (s) => all.filter((p) => p.status === s).length;
  const f = S.filter.providers;
  const users = usersById();
  const list = all.filter((p) => (f === 'all' || p.status === f) && matches(p.businessName, p.description, users[p.id]?.email, users[p.id]?.displayName, p.id));
  return head('Proveedores', 'Aprueba, rechaza o suspende negocios. El proveedor ve el cambio al instante en su app.')
    + errBox('providers')
    + chips('providers', [['pending', 'Por revisar', count('pending')], ['approved', 'Aprobados', count('approved')], ['rejected', 'No aprobados', count('rejected')], ['suspended', 'Suspendidos', count('suspended')], ['all', 'Todos', all.length]])
    + loadingOr('providers', list.length ? `<div class="list">${list.map((p) => providerRow(p, users[p.id])).join('')}</div>` : '<div class="empty">No hay proveedores en este filtro.</div>');
}
function providerRow(p, u) {
  const acts = [];
  if (p.status !== 'approved') acts.push(`<button class="btn ok small" data-act="prov-approve" data-id="${esc(p.id)}">Aprobar</button>`);
  if (p.status === 'pending') acts.push(`<button class="btn danger small" data-act="prov-reject" data-id="${esc(p.id)}">Rechazar</button>`);
  if (p.status === 'approved') acts.push(`<button class="btn danger small" data-act="prov-suspend" data-id="${esc(p.id)}">Suspender</button>`);
  acts.push(`<button class="btn ghost small" data-act="prov-view" data-id="${esc(p.id)}">Ver</button>`);
  return `<div class="row"><div>
      <div class="t">${p.status === 'approved' ? `<span class="dot ${isOnline(p) ? 'on' : ''}" title="${isOnline(p) ? 'Conectado ahora' : 'No conectado'}"></span>` : ''}${esc(p.businessName || '(sin nombre)')} ${badge(PROVIDER_STATUS, p.status)} ${ratingHtml(p.id)}${hasArea(p.serviceArea) && !providerCovered(p) ? ' <span class="badge err">Fuera de cobertura</span>' : ''}</div>
      <div class="m">${esc(PROVIDER_TYPES[p.providerType] || '')} · ${(p.categoryIds || []).map((c) => esc(catName(c))).join(', ')} · ${(p.zoneIds || []).map((z) => esc(zoneName(z))).join(', ')}<br>
        ${esc(u?.displayName || '')} ${u?.email ? '· ' + esc(u.email) : ''} ${u?.phone ? '· ' + esc(u.phone) : ''} · envió ${esc(timeAgo(p.createdAt))}
        ${p.reviewNote ? `<br>Nota: ${esc(p.reviewNote)}` : ''}</div>
    </div><div class="acts">${acts.join('')}</div></div>`;
}
function providerDetail(id) {
  const p = S.data.providers.find((x) => x.id === id);
  if (!p) return;
  const u = usersById()[id];
  const orders = S.data.orders.filter((o) => o.providerId === id);
  const delivered = orders.filter((o) => o.status === 'delivered').length;
  openModal(`<h3>${esc(p.businessName)} ${badge(PROVIDER_STATUS, p.status)}</h3>
    <dl class="kv" style="margin-top:14px">
      <dt>Tipo</dt><dd>${esc(PROVIDER_TYPES[p.providerType] || '—')}</dd>
      <dt>Descripción</dt><dd>${esc(p.description || '—')}</dd>
      <dt>Categorías</dt><dd>${(p.categoryIds || []).map((c) => esc(catName(c))).join(', ') || '—'}</dd>
      <dt>Zonas</dt><dd>${(p.zoneIds || []).map((z) => esc(zoneName(z))).join(', ') || '—'}</dd>
      <dt>Modalidad</dt><dd>${(p.fulfillmentModes || []).map((m) => esc(MODES[m] || m)).join('<br>') || '—'}</dd>
      <dt>Zona de servicio</dt><dd>${hasArea(p.serviceArea) ? `${esc(p.serviceArea.radiusKm)} km alrededor de ${esc(p.serviceArea.lat.toFixed(3))}, ${esc(p.serviceArea.lng.toFixed(3))}${providerCovered(p) ? '' : ' · <span class="badge err">Fuera de cobertura</span>'}` : 'No la ha marcado en el mapa'}</dd>
      <dt>Disponible</dt><dd>${isOnline(p) ? '<span class="dot on"></span>Conectado ahora' : p.isAvailable ? 'Activó "Disponible", sin señal reciente' : 'No'} · última señal ${esc(timeAgo(p.lastSeenAt))}</dd>
      <dt>Titular</dt><dd>${esc(u?.displayName || '—')}<br>${esc(u?.email || '')}${u?.phone ? '<br>' + esc(u.phone) : ''}</dd>
      <dt>Pedidos</dt><dd>${orders.length} en total · ${delivered} entregados</dd>
      <dt>Calificación</dt><dd>${ratingOf(id) ? `★ ${ratingOf(id).avg.toFixed(1)} de 5 · ${ratingOf(id).count} reseña(s) visibles` : 'Sin reseñas'}</dd>
      <dt>Enviada</dt><dd>${esc(fmtDate(p.createdAt))}</dd>
      <dt>Revisada</dt><dd>${p.reviewedAt ? esc(fmtDate(p.reviewedAt)) : '—'}</dd>
      <dt>Nota</dt><dd>${esc(p.reviewNote || '—')}</dd>
      <dt>UID</dt><dd class="mono">${esc(p.id)}</dd>
    </dl>
    <div class="section-title">Pedidos de este local (${orders.length})</div>
    ${orders.length ? `<div class="list">${orders.map(orderMiniRow).join('')}</div>` : '<div class="empty">Sin pedidos todavía.</div>'}
    <div class="foot">
      ${p.status !== 'approved' ? `<button class="btn ok" data-act="prov-approve" data-id="${esc(id)}">Aprobar</button>` : ''}
      ${p.status === 'pending' ? `<button class="btn danger" data-act="prov-reject" data-id="${esc(id)}">Rechazar</button>` : ''}
      ${p.status === 'approved' ? `<button class="btn" data-act="prov-review" data-id="${esc(id)}">Poner en revisión</button>` : ''}
      ${p.status === 'approved' || p.status === 'pending' ? `<button class="btn danger" data-act="prov-suspend" data-id="${esc(id)}">Suspender</button>` : ''}
      <button class="btn ghost" data-act="close">Cerrar</button>
    </div>`);
}
// Renglón compacto de pedido (para el detalle de un local o de un cliente).
function orderMiniRow(o) {
  const pay = o.paymentStatus ? (PAY_LABEL[o.paymentStatus] || o.paymentStatus) : (typeof o.amountDue === 'number' ? 'Por pagar' : '—');
  const extras = [bagCode(o.id), o.transferRef || o.receiptPath ? '🧾 comprobante' : '', o.deliveredBy === 'customer' ? 'cerrado por el cliente' : '', o.deliveryVerified === 'pin' ? 'entregado con PIN' : '', o.deliveryVerified === 'photo' ? `📷 entregado con foto${o.deliveryReviewed ? ' (revisado)' : ''}` : ''].filter(Boolean).join(' · ');
  return `<div class="row clickable" data-act="order-view" data-id="${esc(o.id)}"><div>
      <div class="t">${esc(o.customerName || 'Cliente')} → ${esc(o.providerName || providerName(o.providerId))} ${badge(ORDER_STATUS, o.status)}</div>
      <div class="m">${typeof o.amountDue === 'number' ? money2(o.amountDue) + ' · ' : ''}${esc(pay)}${extras ? ' · ' + esc(extras) : ''} · ${esc(timeAgo(o.createdAt))}</div>
    </div><div class="acts"><button class="btn ghost small" data-act="order-view" data-id="${esc(o.id)}">Ver</button></div></div>`;
}
function userDetail(id) {
  const u = S.data.users.find((x) => x.id === id); if (!u) return;
  const orders = S.data.orders.filter((o) => o.customerId === id);
  openModal(`<h3>${esc(u.displayName || u.email || 'Usuario')} ${badge(USER_STATUS, u.status)}</h3>
    <dl class="kv" style="margin-top:14px">
      <dt>Correo</dt><dd>${esc(u.email || '—')}</dd><dt>Teléfono</dt><dd>${esc(u.phone || '—')}</dd>
      <dt>Colonia</dt><dd>${esc(u.colonia || '—')}</dd><dt>Desde</dt><dd>${esc(fmtDate(u.createdAt, false))}</dd>
      ${u.statusNote ? `<dt>Nota</dt><dd>${esc(u.statusNote)}</dd>` : ''}<dt>UID</dt><dd class="mono">${esc(u.id)}</dd>
    </dl>
    <div class="section-title">Pedidos como cliente (${orders.length})</div>
    ${orders.length ? `<div class="list">${orders.map(orderMiniRow).join('')}</div>` : '<div class="empty">Sin pedidos.</div>'}
    <div class="foot">${userActions(u)}<button class="btn ghost" data-act="close">Cerrar</button></div>`);
}
function userActions(u) {
  if (!u || u.id === S.user?.uid) return '';
  return u.status === 'active'
    ? `<button class="btn" data-act="user-review" data-id="${esc(u.id)}">Poner en revisión</button><button class="btn danger" data-act="user-suspend" data-id="${esc(u.id)}">Suspender</button>`
    : `<button class="btn ok" data-act="user-activate" data-id="${esc(u.id)}">Reactivar</button>${u.status === 'review' ? `<button class="btn danger" data-act="user-suspend" data-id="${esc(u.id)}">Suspender</button>` : ''}`;
}

async function setProviderStatus(id, status, note) {
  const p = S.data.providers.find((x) => x.id === id);
  await commitWithAudit(doc(db, 'providers', id), {
    status, reviewNote: clamp(note, 300), reviewedAt: serverTimestamp(), reviewedBy: S.user.uid, updatedAt: serverTimestamp(),
  }, { action: `provider.${status}`, targetType: 'provider', targetId: id, details: { from: p?.status || '', to: status, note: clamp(note, 300), name: p?.businessName || '' } });
}

// ───────────── Pedidos ─────────────
function pedidos() {
  const all = S.data.orders;
  const f = S.filter.orders;
  const groups = { all: () => true, active: (o) => ['requested', 'accepted', 'in_progress', 'ready'].includes(o.status), delivered: (o) => o.status === 'delivered', closed: (o) => ['cancelled', 'rejected', 'disputed'].includes(o.status) };
  const list = all.filter((o) => groups[f](o) && matches(o.customerName, o.providerName, o.colonia, o.details, o.id));
  return head('Pedidos', 'Todos los pedidos asignados o reservados. Puedes corregir el estado si hay un problema.')
    + errBox('orders')
    + chips('orders', [['all', 'Todos', all.length], ['active', 'En curso', all.filter(groups.active).length], ['delivered', 'Entregados', all.filter(groups.delivered).length], ['closed', 'Cancelados / rechazados', all.filter(groups.closed).length]])
    + loadingOr('orders', list.length ? `<div class="list">${list.map(orderRow).join('')}</div>` : '<div class="empty">No hay pedidos en este filtro.</div>');
}
function orderRow(o) {
  return `<div class="row clickable" data-act="order-view" data-id="${esc(o.id)}"><div>
      <div class="t">${esc(catName(o.categoryId))} · ${esc(o.customerName || 'Cliente')} → ${esc(o.providerName || providerName(o.providerId))} ${badge(ORDER_STATUS, o.status)}</div>
      <div class="m">📍 ${esc(o.colonia || '—')} · ${esc(MODES[o.fulfillmentMode] || '')}${o.whenText ? ' · ' + esc(o.whenText) : ''} · ${o.requestId ? 'desde ofertas' : 'reserva directa'} · ${esc(timeAgo(o.createdAt))}</div>
    </div><div class="acts"><button class="btn ghost small" data-act="order-view" data-id="${esc(o.id)}">Ver</button></div></div>`;
}
function orderDetail(id) {
  const o = S.data.orders.find((x) => x.id === id);
  if (!o) return;
  const opts = Object.entries(ORDER_STATUS).map(([k, v]) => `<option value="${k}" ${k === o.status ? 'selected' : ''}>${esc(v.label)}</option>`).join('');
  openModal(`<h3>Pedido ${badge(ORDER_STATUS, o.status)}</h3>
    <dl class="kv" style="margin-top:14px">
      <dt>Servicio</dt><dd>${esc(catName(o.categoryId))}</dd>
      <dt>Detalles</dt><dd>${esc(o.details || '—')}</dd>
      <dt>Cliente</dt><dd>${esc(o.customerName || '—')}${o.customerPhone ? ' · ' + esc(o.customerPhone) : ''}</dd>
      <dt>Proveedor</dt><dd>${esc(o.providerName || providerName(o.providerId))}${o.providerPhone ? ' · ' + esc(o.providerPhone) : ''}</dd>
      <dt>Modalidad</dt><dd>${esc(MODES[o.fulfillmentMode] || '—')}</dd>
      <dt>Colonia</dt><dd>${esc(o.colonia || '—')}${o.address ? '<br>' + esc(o.address) : ''}</dd>
      <dt>Cuándo</dt><dd>${esc(o.whenText || '—')}${o.agreedPickup ? '<br>Recolección: ' + esc(o.agreedPickup) : ''}${o.agreedReady ? '<br>Listo: ' + esc(o.agreedReady) : ''}</dd>
      <dt>Precio estimado</dt><dd>${typeof o.priceEstimate === 'number' ? '$' + esc(o.priceEstimate) + ' MXN (se paga directo)' : '—'}</dd>
      ${typeof o.amountDue === 'number' ? `<dt>Pago</dt><dd>${money2(o.amountDue)} · <b>${esc(PAY_LABEL[o.paymentStatus || 'pending'] || o.paymentStatus)}</b>${o.paymentId ? ` · Stripe <span class="mono">${esc(o.paymentId)}</span>${o.paymentLive === false ? ' (prueba)' : ''}` : ''}${typeof o.paidAmount === 'number' ? ` · pagó ${money2(o.paidAmount)}` : ''}${o.paymentNote ? `<br>${esc(o.paymentNote)}` : ''}</dd>` : ''}
      ${o.status === 'delivered' ? `<dt>Total cobrado</dt><dd>${typeof o.finalPrice === 'number' ? `${money2(o.finalPrice)}${typeof o.serviceFee === 'number' && o.serviceFee > 0 ? ` + cuota ${money2(o.serviceFee)}` : ''} · comisión ${commissionLabel(o.commissionPct ?? DEFAULT_COMMISSION_PCT, o.commissionIvaPct)} = <b>${money2(commissionOf(o))}</b>` : '<span class="badge warn">Sin total anotado</span>'}</dd>` : ''}
      <dt>Origen</dt><dd>${o.requestId ? 'Oferta elegida' : 'Reserva directa'}</dd>
      <dt>Creado</dt><dd>${esc(fmtDate(o.createdAt))}</dd>
      <dt>Último cambio</dt><dd>${esc(fmtDate(o.statusChangedAt || o.updatedAt))}</dd>
      ${o.cancelReason ? `<dt>Motivo</dt><dd>${esc(o.cancelReason)}</dd>` : ''}
      ${o.adminNote ? `<dt>Nota admin</dt><dd>${esc(o.adminNote)}</dd>` : ''}
      ${o.transferRef || o.receiptPath ? `<dt>Comprobante</dt><dd>${o.transferRef ? `Clave de rastreo: <b class="mono">${esc(o.transferRef)}</b><br>` : ''}${o.receiptPath ? '<a id="rcpt-link" target="_blank" rel="noopener"><img id="rcpt-img" alt="Comprobante" style="max-width:100%;max-height:260px;border-radius:10px;background:#EEF1F5;margin-top:6px" /></a><br>' : ''}<a href="https://www.banxico.org.mx/cep/" target="_blank" rel="noopener">Verificar en Banxico (CEP)</a> con la clave, la fecha y el monto.${o.transferReportedAt ? `<br>Reportado: ${esc(fmtDate(o.transferReportedAt))}` : ''}</dd>` : ''}
      ${o.deliveredBy ? `<dt>Entregado por</dt><dd>${o.deliveredBy === 'customer' ? 'El cliente marcó "Ya recibí mi ropa"' : 'El socio'}${o.deliveryVerified === 'pin' ? ' · <span class="badge ok">verificado con PIN</span>' : ''}${o.deliveryVerified === 'photo' ? ` · <span class="badge warn">con foto, sin PIN${o.deliveryReviewed ? ' · revisado' : ''}</span>` : ''}</dd>` : ''}
      <dt>Bolsa</dt><dd class="mono"><b>${esc(bagCode(o.id))}</b></dd>
      ${EVIDENCE.some(([k]) => o[k]) ? `<dt>Evidencia</dt><dd><div style="display:flex;gap:10px;flex-wrap:wrap">${EVIDENCE.filter(([k]) => o[k]).map(([k, label]) => `<a id="ev-a-${k}" target="_blank" rel="noopener" class="hint" style="text-align:center"><img id="ev-${k}" alt="Foto: ${label}" style="width:110px;height:110px;object-fit:cover;border-radius:10px;background:#EEF1F5;display:block" />${label}</a>`).join('')}</div>
        ${o.deliveryVerified === 'photo' && !o.deliveryReviewed ? `<button type="button" class="btn small ok" style="margin-top:8px" data-act="delivery-reviewed" data-id="${esc(o.id)}">Marcar entrega como revisada</button>` : ''}
        <div class="hint">Fotos de la bolsa cerrada; se borran solas a los 90 días.</div></dd>` : ''}
      <dt>ID</dt><dd class="mono">${esc(o.id)}</dd>
      <dt>Conversación</dt><dd><div id="adm-chat" class="adm-chat">Cargando mensajes…</div></dd>
    </dl>
    <div class="toolbar" style="margin-top:6px">
      <button type="button" class="btn ghost small" data-act="prov-view" data-id="${esc(o.providerId)}">Ver local</button>
      <button type="button" class="btn ghost small" data-act="user-view" data-id="${esc(o.customerId)}">Ver cliente</button>
      ${S.data.providers.find((p) => p.id === o.providerId)?.status === 'approved' ? `<button type="button" class="btn small" data-act="prov-review" data-id="${esc(o.providerId)}">Socio a revisión</button>` : ''}
      ${S.data.users.find((u) => u.id === o.customerId)?.status === 'active' ? `<button type="button" class="btn small" data-act="user-review" data-id="${esc(o.customerId)}">Cliente a revisión</button>` : ''}
    </div>
    <form data-form="order" data-id="${esc(id)}">
      <label class="f">Corregir estado</label>
      <select class="in" name="status">${opts}</select>
      <label class="f">Nota interna (obligatoria al cambiar)</label>
      <textarea class="in" name="note" rows="2" maxlength="500" placeholder="Ej. El cliente pidió cancelar por teléfono.">${esc(o.adminNote || '')}</textarea>
      <div class="hint">Úsalo solo para resolver problemas: el cliente y el proveedor ven el nuevo estado en la app.</div>
      ${typeof o.amountDue === 'number' ? `<label class="f">Estado del pago</label>
      <select class="in" name="paymentStatus">${Object.entries(PAY_LABEL).map(([k, v]) => `<option value="${k}" ${k === (o.paymentStatus || 'pending') ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>
      <div class="hint">Solo para resolver problemas (p. ej. marcar "Reembolsado" después de devolver el dinero en Stripe).</div>` : ''}
      ${o.status === 'delivered' ? `<label class="f">Total cobrado (corregir)</label>
      <input class="in" name="finalPrice" inputmode="decimal" maxlength="9" value="${typeof o.finalPrice === 'number' ? esc(o.finalPrice) : ''}" placeholder="Ej. 150" />
      <div class="hint">Solo si el socio se equivocó. Se usa ${commissionLabel(o.commissionPct ?? S.cfg.pct, o.commissionIvaPct ?? S.cfg.ivaPct)} de comisión.</div>` : ''}
      <div class="foot"><button type="button" class="btn ghost" data-act="close">Cerrar</button><button class="btn" type="submit">Guardar</button></div>
    </form>`);
  // Conversación completa del pedido (en vivo mientras esté abierta esta ventana).
  if (modalUnsub) { try { modalUnsub(); } catch { /* nada */ } }
  modalUnsub = onSnapshot(query(collection(db, 'orders', id, 'messages'), orderBy('createdAt', 'asc')), (snap) => {
    const box = document.getElementById('adm-chat'); if (!box) return;
    const msgs = snap.docs.map((d) => d.data({ serverTimestamps: 'estimate' }));
    box.innerHTML = msgs.length ? msgs.map((m) => `<div class="adm-msg ${m.senderRole === 'provider' ? 'prov' : ''}"><b>${m.senderRole === 'provider' ? esc(o.providerName || 'Socio') : esc(o.customerName || 'Cliente')}</b> <span class="hint">${esc(fmtDate(m.createdAt))}</span><div>${esc(m.text)}</div></div>`).join('') : '<span class="hint">Sin mensajes.</span>';
  }, (e) => { const box = document.getElementById('adm-chat'); if (box) box.textContent = 'No se pudo leer la conversación: ' + friendly(e); });
  EVIDENCE.filter(([k]) => o[k]).forEach(([k]) => {
    getDownloadURL(storageRef(storage, o[k])).then((url) => {
      const img = document.getElementById(`ev-${k}`); const a = document.getElementById(`ev-a-${k}`);
      if (img) img.src = url; if (a) a.href = url;
    }).catch(() => { const img = document.getElementById(`ev-${k}`); if (img) img.alt = 'No se pudo cargar (¿más de 90 días?)'; });
  });
  if (o.receiptPath) {
    getDownloadURL(storageRef(storage, o.receiptPath)).then((url) => {
      const img = document.getElementById('rcpt-img'); const a = document.getElementById('rcpt-link');
      if (img) img.src = url; if (a) a.href = url;
    }).catch(() => { const img = document.getElementById('rcpt-img'); if (img) img.alt = 'No se pudo cargar el comprobante'; });
  }
}

// ───────────── Solicitudes ─────────────
function solicitudes() {
  const all = S.data.requests;
  const f = S.filter.requests;
  const st = (s) => all.filter((r) => requestState(r) === s).length;
  const list = all.filter((r) => (f === 'all' || requestState(r) === f) && matches(r.colonia, (r.services || []).join(' '), r.description, r.whenText, r.id));
  return head('Solicitudes', 'Pedidos publicados para recibir ofertas (30 minutos). Aquí ves cuáles se asignaron y cuáles vencieron.')
    + errBox('requests')
    + chips('requests', [['all', 'Todas', all.length], ['open', 'Recibiendo ofertas', st('open')], ['assigned', 'Asignadas', st('assigned')], ['expired', 'Vencidas', st('expired')], ['cancelled', 'Canceladas', st('cancelled')]])
    + loadingOr('requests', list.length ? `<div class="list">${list.map(requestRow).join('')}</div>` : '<div class="empty">No hay solicitudes en este filtro.</div>');
}
function requestRow(r) {
  const s = requestState(r);
  const sum = [(r.services || []).join(', '), r.quantityText, r.description].filter(Boolean).join(' · ');
  return `<div class="row clickable" data-act="req-view" data-id="${esc(r.id)}"><div>
      <div class="t">${esc(catName(r.categoryId))} · 📍 ${esc(r.colonia || '—')} ${badge(REQUEST_STATE, s)}</div>
      <div class="m">${esc(sum || '—')}<br>${esc(MODES[r.fulfillmentMode] || '')}${r.whenText ? ' · ' + esc(r.whenText) : ''} · ${esc(timeAgo(r.createdAt))}${r.chosenProviderId ? ' · eligió a ' + esc(providerName(r.chosenProviderId)) : ''}</div>
    </div><div class="acts"><button class="btn ghost small" data-act="req-view" data-id="${esc(r.id)}">Ver</button></div></div>`;
}
async function requestDetail(id) {
  const r = S.data.requests.find((x) => x.id === id);
  if (!r) return;
  const s = requestState(r);
  const u = usersById()[r.customerId];
  const body = (offersHtml) => `<h3>Solicitud ${badge(REQUEST_STATE, s)}</h3>
    <dl class="kv" style="margin-top:14px">
      <dt>Servicio</dt><dd>${esc(catName(r.categoryId))}</dd>
      <dt>Pide</dt><dd>${esc([(r.services || []).join(', '), r.quantityText].filter(Boolean).join(' · ') || '—')}</dd>
      <dt>Descripción</dt><dd>${esc(r.description || '—')}</dd>
      <dt>Colonia</dt><dd>${esc(r.colonia || '—')} · ${esc(zoneName(r.zoneId))}</dd>
      <dt>Modalidad</dt><dd>${esc(MODES[r.fulfillmentMode] || '—')}</dd>
      <dt>Cuándo</dt><dd>${esc(r.whenText || '—')}</dd>
      <dt>Cliente</dt><dd>${esc(u?.displayName || '—')} ${u?.email ? '· ' + esc(u.email) : ''}</dd>
      <dt>Publicada</dt><dd>${esc(fmtDate(r.createdAt))}</dd>
      <dt>Vence</dt><dd>${esc(fmtDate(r.expiresAt))}</dd>
      ${r.chosenProviderId ? `<dt>Elegido</dt><dd>${esc(providerName(r.chosenProviderId))}</dd>` : ''}
      <dt>ID</dt><dd class="mono">${esc(r.id)}</dd>
    </dl>
    <div class="section-title">Ofertas</div>${offersHtml}
    <div class="foot">
      ${r.status === 'open' ? `<button class="btn danger" data-act="req-cancel" data-id="${esc(id)}">Cancelar solicitud</button>` : ''}
      ${r.orderId ? `<button class="btn ghost" data-act="order-view" data-id="${esc(r.orderId)}">Ver pedido</button>` : ''}
      <button class="btn ghost" data-act="close">Cerrar</button>
    </div>`;
  openModal(body('<div class="hint">Cargando ofertas…</div>'));
  try {
    const snap = await getDocs(collection(db, 'requests', id, 'offers'));
    const offers = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
    const html = offers.length ? `<div class="list">${offers.map((o) => `<div class="card" style="padding:10px 12px">
        <b>${esc(o.providerName || providerName(o.providerId))}</b> ${o.id === r.chosenProviderId ? '<span class="badge ok">Elegida</span>' : ''} ${o.kind === 'accept' ? '<span class="badge">👍 Aceptó su horario</span>' : ''}
        <div class="hint">${typeof o.priceFrom === 'number' ? '$' + esc(o.priceFrom) + ' · ' : ''}${esc([o.pickupText, o.readyText].filter(Boolean).join(' · '))}${o.message ? '<br>“' + esc(o.message) + '”' : ''} · ${esc(timeAgo(o.createdAt))}</div></div>`).join('')}</div>`
      : '<div class="hint">Nadie ofertó.</div>';
    if (document.querySelector('.modal')) openModal(body(html));
  } catch (e) {
    if (document.querySelector('.modal')) openModal(body(`<div class="notice err">${esc(friendly(e))}</div>`));
  }
}

// ───────────── Usuarios ─────────────
function usuarios() {
  const all = S.data.users;
  const f = S.filter.users;
  const prov = Object.fromEntries(S.data.providers.map((p) => [p.id, p]));
  const list = all.filter((u) => (f === 'all' || u.status === f || (f === 'providers' && prov[u.id])) && matches(u.displayName, u.email, u.phone, u.colonia, u.id));
  return head('Usuarios', `Cuentas registradas en ${BRAND}. Suspender impide publicar pedidos, ofertar y reservar.`)
    + errBox('users')
    + chips('users', [['all', 'Todos', all.length], ['active', 'Activos', all.filter((u) => u.status === 'active').length], ['providers', 'Con perfil de proveedor', all.filter((u) => prov[u.id]).length], ['review', 'En revisión', all.filter((u) => u.status === 'review').length], ['suspended', 'Suspendidos', all.filter((u) => u.status === 'suspended').length]])
    + (all.length >= LIST_LIMIT ? `<div class="notice">Se muestran los ${LIST_LIMIT} más recientes.</div>` : '')
    + loadingOr('users', list.length ? `<div class="list">${list.map((u) => `<div class="row"><div>
        <div class="t">${esc(u.displayName || '(sin nombre)')} ${badge(USER_STATUS, u.status)} ${prov[u.id] ? badge(PROVIDER_STATUS, prov[u.id].status).replace('">', '">Proveedor: ') : ''}</div>
        <div class="m">${esc(u.email || '')}${u.phone ? ' · ' + esc(u.phone) : ''}${u.colonia ? ' · 📍 ' + esc(u.colonia) : ''} · modo ${u.activeMode === 'provider' ? 'proveedor' : 'cliente'} · desde ${esc(fmtDate(u.createdAt, false))}
        ${u.statusNote ? '<br>Nota: ' + esc(u.statusNote) : ''}</div></div>
        <div class="acts"><button class="btn ghost small" data-act="user-view" data-id="${esc(u.id)}">Ver</button>${u.status === 'active'
          ? `<button class="btn small" data-act="user-review" data-id="${esc(u.id)}">Revisión</button><button class="btn danger small" data-act="user-suspend" data-id="${esc(u.id)}">Suspender</button>`
          : `<button class="btn ok small" data-act="user-activate" data-id="${esc(u.id)}">Reactivar</button>`}</div></div>`).join('')}</div>` : '<div class="empty">No hay usuarios en este filtro.</div>');
}
async function setUserStatus(id, status, note) {
  const u = S.data.users.find((x) => x.id === id);
  await commitWithAudit(doc(db, 'users', id), { status, statusNote: clamp(note, 300), updatedAt: serverTimestamp() },
    { action: `user.${status}`, targetType: 'user', targetId: id, details: { from: u?.status || '', to: status, note: clamp(note, 300), email: u?.email || '' } });
}

// ───────────── Categorías ─────────────
function categorias() {
  const list = S.data.categories;
  return head('Categorías', 'Activa nuevas categorías cuando tengas proveedores. Solo las activas aparecen en la app.',
    '<button class="btn" data-act="cat-new">+ Nueva categoría</button>')
    + errBox('categories')
    + loadingOr('categories', list.length ? `<div class="list">${list.map((c) => {
      const provs = S.data.providers.filter((p) => p.status === 'approved' && (p.categoryIds || []).includes(c.id)).length;
      return `<div class="row"><div class="with-icon"><div class="cat-icon">${esc(c.icon || '•')}</div><div>
          <div class="t">${esc(c.name)} ${c.active ? '<span class="badge ok">Activa</span>' : '<span class="badge mute">Inactiva</span>'}</div>
          <div class="m">${esc(c.description || '')}<br>Opciones: ${esc((c.serviceOptions || []).join(', ') || '— (usa las predeterminadas)')} · ${provs} proveedor${provs === 1 ? '' : 'es'} aprobado${provs === 1 ? '' : 's'} · orden ${esc(c.order ?? '—')}</div>
        </div></div><div class="acts"><button class="btn ghost small" data-act="cat-edit" data-id="${esc(c.id)}">Editar</button></div></div>`;
    }).join('')}</div>` : '<div class="empty">No hay categorías. Cárgalas desde la app (Perfil → Herramientas de administrador) o crea una aquí.</div>');
}
function categoryForm(c) {
  const isNew = !c;
  c = c || { name: '', icon: '', description: '', active: false, order: S.data.categories.length + 1, serviceOptions: [] };
  openModal(`<h3>${isNew ? 'Nueva categoría' : 'Editar ' + esc(c.name)}</h3>
    <form data-form="category" data-id="${isNew ? '' : esc(c.id)}">
      <label class="f">Nombre</label><input class="in" name="name" required minlength="2" maxlength="60" value="${esc(c.name)}" />
      ${isNew ? '<div class="hint">El identificador se crea solo a partir del nombre y no se puede cambiar después.</div>' : `<div class="hint mono">ID: ${esc(c.id)}</div>`}
      <label class="f">Ícono (emoji)</label><input class="in" name="icon" maxlength="16" value="${esc(c.icon || '')}" placeholder="🧺" />
      <label class="f">Descripción</label><input class="in" name="description" maxlength="200" value="${esc(c.description || '')}" />
      <label class="f">Opciones de servicio (una por línea)</label>
      <textarea class="in" name="serviceOptions" rows="4" placeholder="Lavar&#10;Doblar&#10;Planchar">${esc((c.serviceOptions || []).join('\n'))}</textarea>
      <div class="hint">Son los botones que el cliente elige al publicar un pedido. Máximo 12.</div>
      <label class="f">Orden en la lista</label><input class="in" name="order" type="number" min="1" max="99" value="${esc(c.order ?? 1)}" />
      <label class="f switch"><input type="checkbox" name="active" ${c.active ? 'checked' : ''} /> Activa (visible en la app)</label>
      <div class="foot"><button type="button" class="btn ghost" data-act="close">Cancelar</button><button class="btn" type="submit">Guardar</button></div>
    </form>`);
}

// ───────────── Pagos a socios y comisiones ─────────────
// Con tarjeta: BÜBÜ cobra (Stripe) y cada semana le deposita al socio total − comisión.
// En efectivo: el socio cobra y le debe la comisión a BÜBÜ (se descuenta del depósito).
// balance > 0 → BÜBÜ le debe al socio; balance < 0 → el socio le debe a BÜBÜ.
const paidByCard = (o) => o?.paymentStatus === 'paid';
const PAY_LABEL = { pending: 'Por pagar', cash: 'Efectivo', transfer: 'Transferencia al socio (sin confirmar)', transfer_ok: 'Transferencia al socio (recibida)', paid: 'Pagado con tarjeta', review: 'En revisión', refunded: 'Reembolsado' };
// Efectivo: el socio debe la comisión y la cuota de servicio que cobró al cliente.
const netForProvider = (o) => (typeof o.finalPrice === 'number'
  ? round2(paidByCard(o) ? o.finalPrice - commissionOf(o) : -commissionOf(o) - (typeof o.serviceFee === 'number' ? o.serviceFee : 0)) : 0);
// Corte: sábado 00:00 → viernes 23:59; depósito el martes siguiente.
function weekStart() { const d = new Date(); const back = (d.getDay() + 1) % 7; return new Date(d.getFullYear(), d.getMonth(), d.getDate() - back).getTime(); }
function weekLabel() {
  const a = new Date(weekStart()); const b = new Date(a.getTime() + 6 * 86400000);
  const f = (d) => d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  return `Corte ${f(a)} – ${f(b)}`;
}
const paydayLabel = () => new Date(weekStart() + 10 * 86400000).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' });
function commissionByProvider() {
  const wk = weekStart();
  const rows = {};
  const row = (id) => (rows[id] = rows[id] || { id, name: providerName(id), weekCount: 0, weekCard: 0, weekCash: 0, weekFee: 0, weekNet: 0, weekCashFees: 0, owed: 0, net: 0, paid: 0, received: 0, missing: 0, blocked: S.data.blocks.some((b) => b.id === id) });
  S.data.delivered.filter((o) => o.status === 'delivered').forEach((o) => {
    const r = row(o.providerId);
    if (typeof o.finalPrice !== 'number') { r.missing += 1; return; }
    const fee = commissionOf(o); r.owed += fee; r.net += netForProvider(o);
    if (toMillis(o.statusChangedAt || o.updatedAt) >= wk) {
      r.weekCount += 1; r.weekFee += fee; r.weekNet += netForProvider(o);
      if (paidByCard(o)) r.weekCard += o.finalPrice; else { r.weekCash += o.finalPrice; r.weekCashFees += typeof o.serviceFee === 'number' ? o.serviceFee : 0; }
    }
  });
  S.data.payments.forEach((p) => { if (typeof p.amount === 'number') row(p.providerId).paid += p.amount; });
  S.data.payouts.forEach((p) => { if (typeof p.amount === 'number') row(p.providerId).received += p.amount; });
  return Object.values(rows).map((r) => ({
    ...r, weekCard: round2(r.weekCard), weekCash: round2(r.weekCash), weekFee: round2(r.weekFee), weekNet: round2(r.weekNet),
    owed: round2(r.owed), paid: round2(r.paid), received: round2(r.received), balance: round2(r.net - r.received + r.paid),
  })).sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
}
function comisiones() {
  const rows = commissionByProvider().filter((r) => matches(r.name, r.id));
  const tot = rows.reduce((a, r) => ({ card: a.card + r.weekCard, fee: a.fee + r.weekFee, toSocios: a.toSocios + Math.max(0, r.balance), fromSocios: a.fromSocios + Math.max(0, -r.balance) }), { card: 0, fee: 0, toSocios: 0, fromSocios: 0 });
  const missing = rows.reduce((a, r) => a + r.missing, 0);
  const review = S.data.orders.filter((o) => o.paymentStatus === 'review');
  const stat = (n, l, hot) => `<div class="stat ${hot ? 'hot' : ''}"><div class="n">${n}</div><div class="l">${esc(l)}</div></div>`;
  const moves = [...S.data.payouts.map((p) => ({ ...p, kind: 'payout' })), ...S.data.payments.map((p) => ({ ...p, kind: 'payment' }))]
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
  return head('Pagos a socios', `${esc(weekLabel())} (sábado a viernes) · depósito el <b>${esc(paydayLabel())}</b> · Comisión: <b>${esc(commissionLabel(S.cfg.pct, S.cfg.ivaPct))}</b> · Cuota de servicio: <b>${money2(S.cfg.serviceFee)}</b> · Límite de adeudo: <b>${money2(S.cfg.debtLimit)}</b>. Con tarjeta, ${BRAND} cobra y deposita a cada socio su parte; en efectivo, el socio te debe la comisión y la cuota, y se descuentan de su depósito.`,
    isSuper() ? '<button class="btn" data-act="commission-rate">Configurar</button>' : '<span class="badge mute">Solo el dueño cambia la configuración</span>')
    + ['delivered', 'payments', 'payouts', 'config'].map(errBox).join('')
    + `<div class="notice">${S.cfg.cardEnabled ? 'Pago con tarjeta <b>visible</b> para clientes (Stripe; en modo de prueba hasta que actives los pagos reales).' : 'Pago con tarjeta <b>apagado</b>: los clientes pagan en efectivo o por transferencia directa a la cuenta del socio. BÜBÜ no recibe ese dinero; el socio te debe la comisión y la cuota.'} Los depósitos o pagos entre tú y los socios los haces desde tu banco y aquí solo los registras.${S.cfg.serverOn ? '' : ' <b>Servidor apagado</b> (sin plan Blaze): no hay fotos ni PIN de entrega, ni pausa automática por adeudo; si un socio pasa el límite, ponlo en revisión a mano.'}</div>`
    + alertsHtml()
    + (review.length ? `<div class="notice err">${review.length} pago${review.length === 1 ? '' : 's'} en revisión (monto distinto o pago duplicado). Ábrelo en Pedidos y resuélvelo en Stripe (Pagos → Reembolsar).</div>` : '')
    + (missing ? `<div class="notice warn">${missing} pedido${missing === 1 ? '' : 's'} entregado${missing === 1 ? '' : 's'} sin total anotado (de antes de esta función). Puedes capturarlo en Pedidos → Ver → Total cobrado.</div>` : '')
    + `<div class="stats">
        ${stat(money2(round2(tot.toSocios)), 'Por depositar a socios', true)}
        ${stat(money2(round2(tot.fromSocios)), 'Por cobrar a socios (efectivo)')}
        ${stat(money2(round2(tot.card)), 'Cobrado con tarjeta (corte actual)')}
        ${stat(money2(round2(tot.fee)), 'Comisión con IVA (corte actual)')}
      </div>
      <div class="section-title">Corte por socio</div>
      ${loadingOr('delivered', rows.length || S.search ? `<div class="toolbar"><input id="search" class="search" type="search" placeholder="Buscar socio…" value="${esc(S.search)}" /></div>
        <div class="list">${rows.map((r) => `<div class="row"><div>
          <div class="t">${esc(r.name)} ${r.blocked ? '<span class="badge err">Pausado por adeudo</span>' : ''} ${r.balance > 0 ? `<span class="badge ok">Depositarle ${money2(r.balance)}</span>` : r.balance < 0 ? `<span class="badge warn">Te debe ${money2(-r.balance)}</span>` : '<span class="badge mute">Al corriente</span>'}</div>
          <div class="m">Corte actual: ${r.weekCount} entregado${r.weekCount === 1 ? '' : 's'} · tarjeta ${money2(r.weekCard)} · efectivo ${money2(r.weekCash)} · comisión ${money2(r.weekFee)}${r.weekCashFees ? ` · cuotas cobradas en efectivo ${money2(r.weekCashFees)}` : ''}<br>
          Histórico: comisiones ${money2(r.owed)} · le depositaste ${money2(r.received)} · te pagó ${money2(r.paid)}${r.missing ? ` · ${r.missing} sin total` : ''}</div>
        </div><div class="acts">
          ${isSuper() ? `<button class="btn ok small" data-act="commission-payout" data-id="${esc(r.id)}">Registrar depósito</button>
          <button class="btn ghost small" data-act="commission-pay" data-id="${esc(r.id)}">Registrar pago del socio</button>` : ''}
          <button class="btn ghost small" data-act="prov-view" data-id="${esc(r.id)}">Ver local</button>
        </div></div>`).join('')}</div>`
        : '<div class="empty">Todavía no hay pedidos entregados.</div>')}
      <div class="section-title">Movimientos</div>
      ${loadingOr('payments', moves.length ? `<div class="list">${moves.map((p) => `<div class="row"><div>
          <div class="t">${p.kind === 'payout' ? `Depositaste a ${esc(p.providerName || providerName(p.providerId))}` : `${esc(p.providerName || providerName(p.providerId))} te pagó`}: ${money2(p.amount)}</div>
          <div class="m">${esc([p.method, p.period, p.note].filter(Boolean).join(' · ') || '—')} · ${esc(fmtDate(p.createdAt))}</div>
        </div><div class="acts">${isSuper() ? `<button class="btn danger small" data-act="${p.kind === 'payout' ? 'commission-payout-del' : 'commission-pay-del'}" data-id="${esc(p.id)}">Borrar</button>` : ''}</div></div>`).join('')}</div>`
        : '<div class="empty">Aún no hay movimientos.</div>')}`;
}
// kind: 'payout' (BÜBÜ → socio) o 'payment' (socio → BÜBÜ)
function paymentForm(providerId, kind = 'payment') {
  const r = commissionByProvider().find((x) => x.id === providerId);
  const suggested = r ? (kind === 'payout' ? Math.max(0, r.balance) : Math.max(0, -r.balance)) : 0;
  const isOut = kind === 'payout';
  openModal(`<h3>${isOut ? 'Depósito a' : 'Pago de'} ${esc(providerName(providerId))}</h3>
    <p class="hint" style="font-size:14px">${r ? (r.balance > 0 ? `Le debes <b>${money2(r.balance)}</b>.` : r.balance < 0 ? `Te debe <b>${money2(-r.balance)}</b>.` : 'Está al corriente.') : ''}
      ${isOut ? 'Registra la transferencia <b>después</b> de hacerla desde tu banco.' : 'Registra solo dinero que ya recibiste.'}</p>
    <form data-form="${isOut ? 'payout' : 'payment'}" data-id="${esc(providerId)}">
      <label class="f">Monto (pesos)</label><input class="in" name="amount" inputmode="decimal" maxlength="10" required value="${suggested > 0 ? esc(suggested) : ''}" />
      <label class="f">Forma</label>
      <select class="in" name="method"><option>Transferencia</option><option>Efectivo</option><option>Depósito</option><option>Otro</option></select>
      ${isOut ? `<label class="f">Periodo</label><input class="in" name="period" maxlength="60" value="${esc(weekLabel())}" />` : ''}
      <label class="f">Nota (opcional)</label><textarea class="in" name="note" rows="2" maxlength="300" placeholder="${isOut ? 'Ej. Referencia SPEI 123456' : 'Ej. Pago de comisiones en efectivo'}"></textarea>
      <div class="foot"><button type="button" class="btn ghost" data-act="close">Cancelar</button><button class="btn ok" type="submit">${isOut ? 'Registrar depósito' : 'Registrar pago'}</button></div>
    </form>`);
}
function rateForm() {
  const c = S.cfg;
  openModal(`<h3>Comisión, cuota y límite de adeudo</h3>
    <p class="hint" style="font-size:14px">Aplica a los pedidos que se entreguen <b>desde ahora</b>. Los ya entregados conservan lo que tenían. Avísales a tus socios antes de cambiarlo.</p>
    <form data-form="rate">
      <label class="f">Comisión al socio (%, 0 a 40)</label><input class="in" name="pct" inputmode="decimal" maxlength="5" required value="${esc(c.pct)}" />
      <label class="f">IVA sobre la comisión (%, 0 a 16)</label><input class="in" name="ivaPct" inputmode="decimal" maxlength="5" required value="${esc(c.ivaPct)}" />
      <label class="f">Cuota de servicio que paga el cliente (pesos, 0 a 200)</label><input class="in" name="serviceFee" inputmode="decimal" maxlength="6" required value="${esc(c.serviceFee)}" />
      <label class="f">Límite de adeudo antes de pausar al socio (pesos; 0 = nunca)</label><input class="in" name="debtLimit" inputmode="decimal" maxlength="8" required value="${esc(c.debtLimit)}" />
      <label class="f switch"><input type="checkbox" name="cardEnabled" ${c.cardEnabled ? 'checked' : ''} /> Mostrar "Pagar con tarjeta" a los clientes (Stripe)</label>
      <div class="hint">Déjalo apagado en el piloto: los clientes pagan en efectivo o por transferencia directa al socio. Enciéndelo solo cuando tengas Stripe configurado y el visto bueno de tu contador.</div>
      <label class="f switch"><input type="checkbox" name="serverOn" ${c.serverOn ? 'checked' : ''} /> Servidor activo: fotos de la bolsa y PIN de entrega</label>
      <div class="hint">Enciéndelo SOLO cuando el plan Blaze esté activo y ya estén subidos Storage y las funciones del servidor. Apagado: el socio entrega como antes, sin fotos ni PIN.</div>
      <div class="hint">Ejemplo con un servicio de $100: comisión ${money2(feeFor(100, c.pct, c.ivaPct))}; el cliente paga $${100 + c.serviceFee}.</div>
      <div class="foot"><button type="button" class="btn ghost" data-act="close">Cancelar</button><button class="btn" type="submit">Guardar</button></div>
    </form>`);
}

// ───────────── Reseñas ─────────────
function resenas() {
  const all = S.data.reviews;
  const f = S.filter.reviews;
  const groups = { all: () => true, low: (r) => (r.stars || 0) <= 2, hidden: (r) => r.hidden };
  const users = usersById();
  const list = all.filter((r) => groups[f](r) && matches(r.comment, r.customerName, providerName(r.providerId), users[r.customerId]?.email));
  return head('Reseñas', 'Calificaciones reales de clientes con pedidos entregados. No se pueden editar; solo ocultar las ofensivas.')
    + errBox('reviews')
    + chips('reviews', [['all', 'Todas', all.length], ['low', '1–2 estrellas', all.filter(groups.low).length], ['hidden', 'Ocultas', all.filter(groups.hidden).length]])
    + loadingOr('reviews', list.length ? `<div class="list">${list.map((r) => `<div class="row"><div>
        <div class="t"><span class="stars">${starsTxt(r.stars)}</span> ${esc(providerName(r.providerId))} ${r.hidden ? '<span class="badge mute">Oculta</span>' : ''}</div>
        <div class="m">${r.comment ? '“' + esc(r.comment) + '”<br>' : ''}${esc(r.customerName || 'Cliente')}${users[r.customerId]?.email ? ' · ' + esc(users[r.customerId].email) : ''} · ${esc(fmtDate(r.createdAt))}
        ${r.hidden && r.hiddenNote ? '<br>Motivo: ' + esc(r.hiddenNote) : ''}</div></div>
        <div class="acts">${r.hidden
          ? `<button class="btn ok small" data-act="review-show" data-id="${esc(r.id)}">Mostrar</button>`
          : `<button class="btn danger small" data-act="review-hide" data-id="${esc(r.id)}">Ocultar</button>`}
          <button class="btn ghost small" data-act="order-view" data-id="${esc(r.orderId || r.id)}">Pedido</button></div></div>`).join('')}</div>`
      : '<div class="empty">Aún no hay reseñas. Aparecen cuando un cliente califica un pedido entregado.</div>');
}

// ───────────── Mapa (Leaflet + OpenStreetMap, sin llaves) ─────────────
const GZ = { lat: 25.8853, lng: -100.1086 }; // General Zuazua, N.L.
const distKm = (a, b) => { const R = 6371; const r = (x) => (x * Math.PI) / 180; const dLat = r(b.lat - a.lat); const dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const hasArea = (a) => a && typeof a.lat === 'number' && typeof a.lng === 'number' && typeof a.radiusKm === 'number';
// ¿El círculo del socio toca alguna zona activa con cobertura?
const providerCovered = (p) => !hasArea(p.serviceArea) || !S.data.zones.some((z) => z.active && hasArea(z.coverage))
  || S.data.zones.some((z) => z.active && hasArea(z.coverage) && distKm(p.serviceArea, z.coverage) <= z.coverage.radiusKm + p.serviceArea.radiusKm);
function newMap(elId, center, zoom = 12) {
  if (!window.L) { const el = document.getElementById(elId); if (el) el.innerHTML = '<div class="empty">No se pudo cargar el mapa (revisa tu internet).</div>'; return null; }
  const map = window.L.map(elId).setView([center.lat, center.lng], zoom);
  window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap', referrerPolicy: 'strict-origin-when-cross-origin' }).addTo(map);
  return map;
}
// Editar la cobertura de una zona: arrastra el centro y escribe el radio.
function zoneCoverageForm(z) {
  const c = hasArea(z.coverage) ? z.coverage : { ...GZ, radiusKm: 8 };
  openModal(`<h3>Cobertura de ${esc(z.name)}</h3>
    <p class="hint" style="font-size:14px">Arrastra el punto al centro de la zona (o haz clic en el mapa) y elige el radio. Los clientes fuera de los círculos verán "Aún no llegamos a tu colonia o ciudad".</p>
    <div id="zmap" class="map-box"></div>
    <form data-form="zonecov" data-id="${esc(z.id)}">
      <input type="hidden" name="lat" value="${c.lat}" /><input type="hidden" name="lng" value="${c.lng}" />
      <label class="f">Radio (km)</label><input class="in" name="radiusKm" id="zr" type="number" min="0.5" max="50" step="0.5" value="${c.radiusKm}" required />
      <div class="foot">${hasArea(z.coverage) ? '<button type="button" class="btn ghost" data-act="zone-cov-clear" data-id="' + esc(z.id) + '">Quitar cobertura</button>' : ''}<button type="button" class="btn ghost" data-act="close">Cancelar</button><button class="btn" type="submit">Guardar cobertura</button></div>
    </form>`);
  const map = newMap('zmap', c, 12); if (!map) return;
  const L = window.L; const form = $modal.querySelector('form[data-form=zonecov]');
  S.data.zones.filter((o) => o.id !== z.id && hasArea(o.coverage)).forEach((o) => L.circle([o.coverage.lat, o.coverage.lng], { radius: o.coverage.radiusKm * 1000, color: '#00D1C1', weight: 1, fillOpacity: 0.06 }).addTo(map));
  const mk = L.marker([c.lat, c.lng], { draggable: true }).addTo(map);
  const ci = L.circle([c.lat, c.lng], { radius: c.radiusKm * 1000, color: '#0066FF', fillOpacity: 0.15 }).addTo(map);
  const move = (ll) => { mk.setLatLng(ll); ci.setLatLng(ll); form.lat.value = ll.lat.toFixed(5); form.lng.value = ll.lng.toFixed(5); };
  mk.on('dragend', () => move(mk.getLatLng())); map.on('click', (e) => move(e.latlng));
  form.radiusKm.addEventListener('input', () => { const r = Number(form.radiusKm.value); if (r > 0) ci.setRadius(r * 1000); });
  setTimeout(() => { map.invalidateSize(); try { map.fitBounds(ci.getBounds(), { padding: [20, 20] }); } catch { /* nada */ } }, 50);
}
// Vista general: zonas con cobertura (turquesa) y zonas de servicio de los socios (azul / rojo si están fuera).
function coverageOverview() {
  openModal(`<h3>Mapa de cobertura</h3><p class="hint" style="font-size:14px">Turquesa: zonas con servicio. Azul: socios aprobados. Rojo: socios fuera de cobertura.</p><div id="cmap" class="map-box" style="height:460px"></div>
    <div class="foot"><button class="btn ghost" data-act="close">Cerrar</button></div>`);
  const first = S.data.zones.find((z) => hasArea(z.coverage))?.coverage || GZ;
  const map = newMap('cmap', first, 11); if (!map) return;
  const L = window.L;
  S.data.zones.filter((z) => hasArea(z.coverage)).forEach((z) => L.circle([z.coverage.lat, z.coverage.lng], { radius: z.coverage.radiusKm * 1000, color: '#00D1C1', fillOpacity: z.active ? 0.12 : 0.03, dashArray: z.active ? null : '6' }).addTo(map).bindTooltip(`${z.name}${z.active ? '' : ' (inactiva)'}`));
  S.data.providers.filter((p) => hasArea(p.serviceArea)).forEach((p) => L.circle([p.serviceArea.lat, p.serviceArea.lng], { radius: p.serviceArea.radiusKm * 1000, color: providerCovered(p) ? '#0066FF' : '#D92D20', weight: 1, fillOpacity: 0.05 }).addTo(map).bindTooltip(`${p.businessName} · ${p.serviceArea.radiusKm} km`));
  setTimeout(() => map.invalidateSize(), 50);
}

// ───────────── Zonas y colonias ─────────────
function zonas() {
  const list = S.data.zones;
  return head('Zonas y colonias', 'La zona es la ciudad o municipio. Dibuja su cobertura en el mapa: los clientes fuera de cobertura pueden registrarse, pero verán "Aún no llegamos a tu colonia o ciudad".',
    '<div class="toolbar"><button class="btn ghost" data-act="cov-map">Ver mapa de cobertura</button><button class="btn" data-act="zone-new">+ Nueva zona</button></div>')
    + (!S.data.zones.some((z) => z.active && hasArea(z.coverage)) ? '<div class="notice warn">Todavía no hay cobertura dibujada: la app funciona como antes (sin mapa). En cuanto dibujes la primera, se empieza a revisar la ubicación de los clientes.</div>' : '')
    + errBox('zones')
    + '<div class="notice">Nota: por ahora la app pide al cliente escribir su colonia. Usar esta lista como selector dentro de la app es un cambio pendiente.</div>'
    + loadingOr('zones', list.length ? `<div class="list">${list.map((z) => {
      const provs = S.data.providers.filter((p) => p.status === 'approved' && (p.zoneIds || []).includes(z.id)).length;
      const col = z.colonias || [];
      return `<div class="row"><div>
          <div class="t">📍 ${esc(z.name)} ${z.active ? '<span class="badge ok">Activa</span>' : '<span class="badge mute">Inactiva</span>'}</div>
          <div class="m">${esc([z.municipality, z.state].filter(Boolean).join(', '))} · ${provs} proveedor${provs === 1 ? '' : 'es'} aprobado${provs === 1 ? '' : 's'} · ${col.length} colonia${col.length === 1 ? '' : 's'}
          ${col.length ? '<br>' + esc(col.slice(0, 12).join(', ')) + (col.length > 12 ? '…' : '') : ''}</div>
          <br>${hasArea(z.coverage) ? `🗺️ Cobertura: ${esc(z.coverage.radiusKm)} km alrededor de ${esc(z.coverage.lat.toFixed(3))}, ${esc(z.coverage.lng.toFixed(3))}` : '🗺️ Sin cobertura en el mapa'}
        </div><div class="acts"><button class="btn small" data-act="zone-map" data-id="${esc(z.id)}">Cobertura</button><button class="btn ghost small" data-act="zone-edit" data-id="${esc(z.id)}">Editar</button></div></div>`;
    }).join('')}</div>` : '<div class="empty">No hay zonas. Cárgalas desde la app o crea una aquí.</div>');
}
function zoneForm(z) {
  const isNew = !z;
  z = z || { name: '', municipality: '', state: 'Nuevo León', colonias: [], active: false };
  openModal(`<h3>${isNew ? 'Nueva zona' : 'Editar ' + esc(z.name)}</h3>
    <form data-form="zone" data-id="${isNew ? '' : esc(z.id)}">
      <label class="f">Nombre</label><input class="in" name="name" required minlength="2" maxlength="80" value="${esc(z.name)}" />
      ${isNew ? '' : `<div class="hint mono">ID: ${esc(z.id)}</div>`}
      <label class="f">Municipio</label><input class="in" name="municipality" maxlength="80" value="${esc(z.municipality || '')}" />
      <label class="f">Estado</label><input class="in" name="state" maxlength="80" value="${esc(z.state || '')}" />
      <label class="f">Colonias (una por línea)</label>
      <textarea class="in" name="colonias" rows="8" placeholder="Centro&#10;…">${esc((z.colonias || []).join('\n'))}</textarea>
      <div class="hint">Máximo 300. Se quitan las repetidas.</div>
      <label class="f switch"><input type="checkbox" name="active" ${z.active ? 'checked' : ''} /> Activa (los clientes de esta zona pueden publicar)</label>
      <div class="foot"><button type="button" class="btn ghost" data-act="close">Cancelar</button><button class="btn" type="submit">Guardar</button></div>
    </form>`);
}

// ───────────── Colaboradores (equipo del panel) ─────────────
// El dueño (superadmin) agrega trabajadores con su cuenta de BÜBÜ ya creada.
// Un colaborador puede revisar pedidos y chats, aprobar, poner en revisión y
// suspender; NO puede tocar dinero, la configuración ni la lista de colaboradores.
function equipo() {
  const list = [...S.data.admins].sort((a, b) => (a.role === 'superadmin' ? -1 : 1) - (b.role === 'superadmin' ? -1 : 1));
  const users = usersById();
  return head('Colaboradores', 'Personas que pueden entrar a este panel con su propia cuenta de BÜBÜ. Todo lo que hacen queda en la bitácora con su nombre.')
    + errBox('admins')
    + (isSuper() ? `<form class="card" data-form="staff" style="padding:16px;margin-bottom:16px">
        <label class="f">Correo de la cuenta de BÜBÜ del colaborador</label>
        <div class="toolbar"><input class="in" name="email" type="email" required placeholder="trabajador@correo.com" style="flex:1;min-width:220px" /><button class="btn" type="submit">Agregar colaborador</button></div>
        <div class="hint">Primero debe crear su cuenta en la app o en la web de BÜBÜ con ese correo. Podrá revisar pedidos y chats, aprobar y poner en revisión, pero no tocar dinero ni configuración.</div>
      </form>` : '<div class="notice">Solo el dueño puede agregar o quitar colaboradores.</div>')
    + loadingOr('admins', `<div class="list">${list.map((a) => {
      const u = users[a.id];
      return `<div class="row"><div>
        <div class="t">${esc(u?.displayName || a.name || a.email || a.id)} <span class="badge ${a.role === 'superadmin' ? 'ok' : ''}">${a.role === 'superadmin' ? 'Dueño' : 'Colaborador'}</span>${a.id === S.user?.uid ? ' <span class="badge mute">Tú</span>' : ''}</div>
        <div class="m">${esc(u?.email || a.email || '')}${a.createdAt ? ' · desde ' + esc(fmtDate(a.createdAt, false)) : ''}</div></div>
        <div class="acts">${isSuper() && a.role === 'staff' ? `<button class="btn danger small" data-act="staff-remove" data-id="${esc(a.id)}">Quitar</button>` : ''}</div></div>`;
    }).join('')}</div>`);
}

// ───────────── Bitácora ─────────────
function bitacora() {
  const list = S.data.audit;
  return head('Bitácora', 'Cada acción del panel queda registrada. Nadie puede editarla ni borrarla.')
    + errBox('audit')
    + loadingOr('audit', list.length ? `<div class="list">${list.map((a) => {
      const d = a.details || {};
      const extra = [d.name, d.email, d.from && d.to ? `${d.from} → ${d.to}` : '', d.note].filter(Boolean).join(' · ');
      return `<div class="row"><div><div class="t">${esc(AUDIT_LABELS[a.action] || a.action)}</div>
        <div class="m">${esc(a.targetType)} <span class="mono">${esc(a.targetId || '')}</span>${extra ? ' · ' + esc(extra) : ''}<br>${esc(fmtDate(a.createdAt))} · ${a.adminId === S.user?.uid ? 'tú' : `<span class="mono">${esc(a.adminId)}</span>`}</div></div></div>`;
    }).join('')}</div>` : '<div class="empty">Aún no hay acciones registradas.</div>');
}

// ───────────── Ventanas ─────────────
function openModal(html) {
  if (modalUnsub) { try { modalUnsub(); } catch { /* nada */ } modalUnsub = null; }
  $modal.innerHTML = `<div class="overlay" data-act="overlay"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  const first = $modal.querySelector('input, textarea, select');
  if (first && !first.value) first.focus();
}
let modalUnsub = null; // chat en vivo del pedido abierto
function closeModal() { $modal.innerHTML = ''; if (modalUnsub) { try { modalUnsub(); } catch { /* nada */ } modalUnsub = null; } }
const isSuper = () => S.role === 'superadmin';
// Pide una nota y confirma. Devuelve el texto o null si se cancela.
function askNote({ title, text, label, required, okLabel, danger }) {
  return new Promise((resolve) => {
    openModal(`<h3>${esc(title)}</h3><p class="hint" style="font-size:14px">${text}</p>
      <form data-form="ask">
        <label class="f">${esc(label)}${required ? '' : ' (opcional)'}</label>
        <textarea class="in" name="note" rows="3" maxlength="300" ${required ? 'required' : ''}></textarea>
        <div class="foot"><button type="button" class="btn ghost" data-act="ask-cancel">Cancelar</button>
        <button class="btn ${danger ? 'danger' : 'ok'}" type="submit">${esc(okLabel)}</button></div>
      </form>`);
    askResolver = (v) => { askResolver = null; closeModal(); resolve(v); };
  });
}
let askResolver = null;

async function run(fn, okMsg) {
  try {
    await fn();
    if (okMsg) toast(okMsg);
    return true;
  } catch (e) {
    console.warn(e);
    toast(friendly(e), true);
    return false;
  }
}

// ───────────── Eventos ─────────────
document.addEventListener('click', async (ev) => {
  const pageBtn = ev.target.closest('[data-page]');
  if (pageBtn) { S.page = pageBtn.dataset.page; S.search = ''; closeModal(); render(); window.scrollTo(0, 0); return; }
  const fBtn = ev.target.closest('[data-filter]');
  if (fBtn) { S.filter[fBtn.dataset.filter] = fBtn.dataset.value; render(); return; }
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  const id = el.dataset.id;
  if (act === 'overlay' && ev.target !== el) return; // clic dentro de la ventana
  // Un clic en un botón dentro de una fila "clickable" no abre la fila dos veces.
  if (el.classList.contains('row') && ev.target.closest('button')) return;

  switch (act) {
    case 'overlay': case 'close': if (askResolver) askResolver(null); else closeModal(); break;
    case 'ask-cancel': if (askResolver) askResolver(null); break;
    case 'logout': await signOut(auth); break;
    case 'reset': {
      const email = document.getElementById('email')?.value.trim();
      if (!email) { S.loginError = 'Escribe tu correo arriba y vuelve a presionar.'; render(); break; }
      if (await run(() => sendPasswordResetEmail(auth, email))) { S.loginError = ''; render(); toast('Te enviamos un correo para cambiar la contraseña.'); }
      break;
    }
    case 'prov-view': providerDetail(id); break;
    case 'prov-approve': {
      const p = S.data.providers.find((x) => x.id === id);
      const note = await askNote({ title: `Aprobar a ${p?.businessName || ''}`, text: 'Podrá activar "Estoy disponible", ver pedidos de su zona y mandar ofertas.', label: 'Nota para el proveedor', required: false, okLabel: 'Aprobar' });
      if (note !== null) await run(() => setProviderStatus(id, 'approved', note), 'Proveedor aprobado ✓');
      break;
    }
    case 'prov-reject': {
      const p = S.data.providers.find((x) => x.id === id);
      const note = await askNote({ title: `Rechazar a ${p?.businessName || ''}`, text: 'El proveedor verá la nota en su app y podrá corregir y reenviar.', label: 'Motivo (lo verá el proveedor)', required: true, okLabel: 'Rechazar', danger: true });
      if (note) await run(() => setProviderStatus(id, 'rejected', note), 'Solicitud rechazada');
      break;
    }
    case 'prov-suspend': {
      const p = S.data.providers.find((x) => x.id === id);
      const note = await askNote({ title: `Suspender a ${p?.businessName || ''}`, text: 'Dejará de aparecer a los clientes y no podrá mandar ofertas. Puedes reactivarlo después con "Aprobar".', label: 'Motivo', required: true, okLabel: 'Suspender', danger: true });
      if (note) await run(() => setProviderStatus(id, 'suspended', note), 'Proveedor suspendido');
      break;
    }
    case 'user-suspend': {
      const u = S.data.users.find((x) => x.id === id);
      if (u?.id === S.user.uid) { toast('No puedes suspender tu propia cuenta.', true); break; }
      const note = await askNote({ title: `Suspender a ${u?.displayName || u?.email || ''}`, text: 'No podrá publicar pedidos, reservar ni mandar ofertas hasta que la reactives.', label: 'Motivo', required: true, okLabel: 'Suspender', danger: true });
      if (note) await run(() => setUserStatus(id, 'suspended', note), 'Usuario suspendido');
      break;
    }
    case 'user-view': userDetail(id); break;
    case 'staff-remove': {
      const a = S.data.admins.find((x) => x.id === id); const u = usersById()[id];
      const note = await askNote({ title: `Quitar a ${u?.displayName || a?.email || 'colaborador'}`, text: 'Ya no podrá entrar al panel. Su cuenta de BÜBÜ sigue funcionando normal.', label: 'Motivo (queda en la bitácora)', required: false, okLabel: 'Quitar', danger: true });
      if (note !== null) await run(() => commitWithAudit(doc(db, 'admins', id), null, { action: 'staff.remove', targetType: 'admin', targetId: id, details: { email: u?.email || a?.email || '', note: clamp(note, 300) } }, 'delete'), 'Colaborador quitado');
      break;
    }
    case 'user-review': {
      const u = S.data.users.find((x) => x.id === id);
      if (u?.id === S.user.uid) { toast('No puedes poner tu propia cuenta en revisión.', true); break; }
      const note = await askNote({ title: `Poner en revisión a ${u?.displayName || u?.email || ''}`, text: 'No podrá hacer pedidos nuevos mientras lo revisas. Verá un aviso de "Cuenta en revisión".', label: 'Motivo (lo verá el usuario)', required: true, okLabel: 'Poner en revisión' });
      if (note) await run(() => setUserStatus(id, 'review', note), 'Usuario en revisión');
      break;
    }
    case 'prov-review': {
      const p = S.data.providers.find((x) => x.id === id);
      const note = await askNote({ title: `Poner en revisión a ${p?.businessName || ''}`, text: 'Deja de recibir pedidos nuevos (puede terminar los que tiene). Para regresarlo, usa "Aprobar".', label: 'Motivo (lo verá el socio)', required: true, okLabel: 'Poner en revisión' });
      if (note) await run(() => setProviderStatus(id, 'pending', note), 'Socio en revisión');
      break;
    }
    case 'user-activate': {
      const u = S.data.users.find((x) => x.id === id);
      const note = await askNote({ title: `Reactivar a ${u?.displayName || u?.email || ''}`, text: 'Podrá volver a usar la app normalmente.', label: 'Nota', required: false, okLabel: 'Reactivar' });
      if (note !== null) await run(() => setUserStatus(id, 'active', note), 'Usuario reactivado ✓');
      break;
    }
    case 'delivery-reviewed': {
      const ok = await run(() => commitWithAudit(doc(db, 'orders', id), { deliveryReviewed: true, updatedAt: serverTimestamp() },
        { action: 'order.deliveryReviewed', targetType: 'order', targetId: id, details: { bag: bagCode(id) } }), 'Entrega marcada como revisada ✓');
      if (ok) orderDetail(id);
      break;
    }
    case 'order-view': if (S.data.orders.some((o) => o.id === id)) orderDetail(id); else toast('Ese pedido no está entre los cargados.', true); break;
    case 'review-hide': {
      const note = await askNote({ title: 'Ocultar reseña', text: 'Dejará de contar en el promedio y no la verán los clientes. El texto no se borra.', label: 'Motivo (queda en la bitácora)', required: true, okLabel: 'Ocultar', danger: true });
      if (note) await run(() => commitWithAudit(doc(db, 'reviews', id), { hidden: true, hiddenNote: note, hiddenBy: S.user.uid, hiddenAt: serverTimestamp() },
        { action: 'review.hide', targetType: 'review', targetId: id, details: { note } }), 'Reseña oculta');
      break;
    }
    case 'review-show': {
      const note = await askNote({ title: 'Volver a mostrar reseña', text: 'Volverá a contar en el promedio del proveedor.', label: 'Nota', required: false, okLabel: 'Mostrar' });
      if (note !== null) await run(() => commitWithAudit(doc(db, 'reviews', id), { hidden: false, hiddenNote: note, hiddenBy: S.user.uid, hiddenAt: serverTimestamp() },
        { action: 'review.show', targetType: 'review', targetId: id, details: { note } }), 'Reseña visible de nuevo');
      break;
    }
    case 'req-view': requestDetail(id); break;
    case 'commission-rate': rateForm(); break;
    case 'commission-pay': paymentForm(id, 'payment'); break;
    case 'commission-payout': paymentForm(id, 'payout'); break;
    case 'commission-payout-del': {
      const p = S.data.payouts.find((x) => x.id === id); if (!p) break;
      const note = await askNote({ title: 'Borrar depósito', text: `Se borrará el depósito de ${esc(money2(p.amount))} a ${esc(p.providerName || providerName(p.providerId))}. Úsalo solo si se capturó mal.`, label: 'Motivo (queda en la bitácora)', required: true, okLabel: 'Borrar depósito', danger: true });
      if (note) await run(() => commitWithAudit(doc(db, 'payouts', id), null,
        { action: 'payout.deleted', targetType: 'payout', targetId: id, details: { providerId: p.providerId, amount: p.amount, note: clamp(note, 300) } }, 'delete'), 'Depósito borrado');
      break;
    }
    case 'commission-pay-del': {
      const p = S.data.payments.find((x) => x.id === id); if (!p) break;
      const note = await askNote({ title: 'Borrar pago', text: `Se borrará el pago de ${esc(money2(p.amount))} de ${esc(p.providerName || providerName(p.providerId))} y su saldo volverá a subir. Úsalo solo si se capturó mal.`, label: 'Motivo (queda en la bitácora)', required: true, okLabel: 'Borrar pago', danger: true });
      if (note) await run(() => commitWithAudit(doc(db, 'commissionPayments', id), null,
        { action: 'commission.paymentDeleted', targetType: 'commissionPayment', targetId: id, details: { providerId: p.providerId, amount: p.amount, note: clamp(note, 300) } }, 'delete'), 'Pago borrado');
      break;
    }
    case 'req-cancel': {
      const note = await askNote({ title: 'Cancelar solicitud', text: 'Dejará de recibir ofertas. El cliente la verá como cancelada.', label: 'Motivo (queda en la bitácora)', required: true, okLabel: 'Cancelar solicitud', danger: true });
      if (note) await run(() => commitWithAudit(doc(db, 'requests', id), { status: 'cancelled', updatedAt: serverTimestamp() },
        { action: 'request.status', targetType: 'request', targetId: id, details: { from: 'open', to: 'cancelled', note: clamp(note, 300) } }), 'Solicitud cancelada');
      break;
    }
    case 'cat-new': categoryForm(null); break;
    case 'cat-edit': categoryForm(S.data.categories.find((c) => c.id === id)); break;
    case 'zone-new': zoneForm(null); break;
    case 'zone-edit': zoneForm(S.data.zones.find((z) => z.id === id)); break;
    case 'zone-map': zoneCoverageForm(S.data.zones.find((z) => z.id === id)); break;
    case 'cov-map': coverageOverview(); break;
    case 'zone-cov-clear': {
      const z = S.data.zones.find((x) => x.id === id); if (!z) break;
      const { coverage, ...rest } = z; // eslint-disable-line no-unused-vars
      const { id: _id, ...data } = rest; // eslint-disable-line no-unused-vars
      if (await run(() => commitWithAudit(doc(db, 'zones', id), { ...data, updatedAt: serverTimestamp() }, { action: 'zone.coverage', targetType: 'zone', targetId: id, details: { name: z.name, note: 'Quitó cobertura' } }, 'set'), 'Cobertura quitada')) closeModal();
      break;
    }
    default: break;
  }
});

document.addEventListener('input', (ev) => {
  if (ev.target.id === 'search') { S.search = ev.target.value; render(); }
});

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && $modal.innerHTML) { if (askResolver) askResolver(null); else closeModal(); }
});

document.addEventListener('submit', async (ev) => {
  const form = ev.target.closest('form[data-form]');
  if (!form) return;
  ev.preventDefault();
  const kind = form.dataset.form;
  const fd = new FormData(form);
  const btn = form.querySelector('button[type="submit"]');

  if (kind === 'login') {
    S.busy = true; S.loginError = ''; render();
    try { await signInWithEmailAndPassword(auth, String(fd.get('email')).trim(), String(fd.get('password'))); }
    catch (e) { S.loginError = friendly(e); }
    S.busy = false;
    if (S.phase === 'login') render();
    return;
  }
  if (kind === 'ask') { if (askResolver) askResolver(clamp(fd.get('note'), 300)); return; }

  if (btn) btn.disabled = true;
  let ok = false;
  if (kind === 'order') {
    const id = form.dataset.id;
    const o = S.data.orders.find((x) => x.id === id);
    const status = String(fd.get('status'));
    const note = clamp(fd.get('note'), 500);
    if (status !== o?.status && !note) { toast('Escribe una nota explicando el cambio.', true); if (btn) btn.disabled = false; return; }
    const data = { adminNote: note, updatedAt: serverTimestamp() };
    if (status !== o?.status) { data.status = status; data.statusChangedAt = serverTimestamp(); }
    const fpRaw = fd.get('finalPrice');
    let action = 'order.status';
    if (fpRaw !== null && String(fpRaw).trim() !== '') {
      const fp = parseMoney(fpRaw);
      if (!fp) { toast('El total cobrado debe ser un número mayor a 0.', true); if (btn) btn.disabled = false; return; }
      if (fp !== o?.finalPrice) {
        if (!note) { toast('Escribe una nota explicando la corrección.', true); if (btn) btn.disabled = false; return; }
        if (status !== 'delivered') { toast('El total solo se corrige en pedidos entregados.', true); if (btn) btn.disabled = false; return; }
        data.finalPrice = fp; data.commissionPct = typeof o?.commissionPct === 'number' ? o.commissionPct : S.cfg.pct;
        data.commissionIvaPct = typeof o?.commissionIvaPct === 'number' ? o.commissionIvaPct : S.cfg.ivaPct;
        if (status === o?.status) action = 'order.finalPrice';
      }
    }
    const ps = fd.get('paymentStatus');
    if (ps !== null && ps !== (o?.paymentStatus || 'pending')) {
      if (!note) { toast('Escribe una nota explicando el cambio de pago.', true); if (btn) btn.disabled = false; return; }
      data.paymentStatus = String(ps);
      if (action === 'order.status' && status === o?.status) action = 'order.payment';
    }
    ok = await run(() => commitWithAudit(doc(db, 'orders', id), data,
      { action, targetType: 'order', targetId: id, details: { from: action === 'order.finalPrice' ? String(o?.finalPrice ?? '—') : o?.status || '', to: action === 'order.finalPrice' ? String(data.finalPrice) : status, note: clamp(note, 300) } }), 'Pedido actualizado ✓');
  }
  if (kind === 'rate') {
    const num = (k) => Number(String(fd.get(k) ?? '').replace(/[%$,\s]/g, ''));
    const v = { pct: num('pct'), ivaPct: num('ivaPct'), serviceFee: num('serviceFee'), debtLimit: num('debtLimit') };
    const cardEnabled = fd.get('cardEnabled') === 'on';
    const serverOn = fd.get('serverOn') === 'on';
    const bad = (!Number.isFinite(v.pct) || v.pct < 0 || v.pct > 40) ? 'La comisión debe ir de 0 a 40 %.'
      : (!Number.isFinite(v.ivaPct) || v.ivaPct < 0 || v.ivaPct > 16) ? 'El IVA debe ir de 0 a 16 %.'
        : (!Number.isFinite(v.serviceFee) || v.serviceFee < 0 || v.serviceFee > 200) ? 'La cuota de servicio debe ir de $0 a $200.'
          : (!Number.isFinite(v.debtLimit) || v.debtLimit < 0 || v.debtLimit > 100000) ? 'El límite de adeudo debe ir de $0 a $100,000.' : '';
    if (bad) { toast(bad, true); if (btn) btn.disabled = false; return; }
    Object.keys(v).forEach((k) => { v[k] = round2(v[k]); });
    const from = S.cfg;
    ok = await run(() => commitWithAudit(doc(db, 'config', 'commission'), { ...v, cardEnabled, serverOn, updatedAt: serverTimestamp(), updatedBy: S.user.uid },
      { action: 'commission.rate', targetType: 'config', targetId: 'commission', details: { from: `${from.pct} % + IVA ${from.ivaPct} %, cuota $${from.serviceFee}, límite $${from.debtLimit}`, to: `${v.pct} % + IVA ${v.ivaPct} %, cuota $${v.serviceFee}, límite $${v.debtLimit}, tarjeta ${cardEnabled ? 'sí' : 'no'}, servidor ${serverOn ? 'sí' : 'no'}` } }, 'set'), 'Configuración guardada ✓');
  }
  if (kind === 'payout') {
    const providerId = form.dataset.id;
    const amount = parseMoney(fd.get('amount'));
    if (!amount) { toast('Escribe el monto depositado (mayor a 0).', true); if (btn) btn.disabled = false; return; }
    const data = { providerId, providerName: clamp(providerName(providerId), 80), amount, method: clamp(fd.get('method'), 40), period: clamp(fd.get('period'), 60), note: clamp(fd.get('note'), 300), createdAt: serverTimestamp(), createdBy: S.user.uid };
    const ref = doc(collection(db, 'payouts'));
    ok = await run(() => commitWithAudit(ref, data,
      { action: 'payout.create', targetType: 'payout', targetId: ref.id, details: { providerId, name: data.providerName, amount, note: data.period } }, 'set'), 'Depósito registrado ✓');
  }
  if (kind === 'payment') {
    const providerId = form.dataset.id;
    const amount = parseMoney(fd.get('amount'));
    if (!amount) { toast('Escribe el monto recibido (mayor a 0).', true); if (btn) btn.disabled = false; return; }
    const data = { providerId, providerName: clamp(providerName(providerId), 80), amount, method: clamp(fd.get('method'), 40), note: clamp(fd.get('note'), 300), createdAt: serverTimestamp(), createdBy: S.user.uid };
    const ref = doc(collection(db, 'commissionPayments'));
    ok = await run(() => commitWithAudit(ref, data,
      { action: 'commission.payment', targetType: 'commissionPayment', targetId: ref.id, details: { providerId, name: data.providerName, amount, note: data.note } }, 'set'), 'Pago registrado ✓');
  }
  if (kind === 'staff') {
    const email = String(fd.get('email') || '').trim().toLowerCase();
    try {
      const q = await getDocs(query(collection(db, 'users'), where('email', '==', email), limit(1)));
      if (q.empty) { toast('No hay ninguna cuenta de BÜBÜ con ese correo. Pídele que se registre primero.', true); if (btn) btn.disabled = false; return; }
      const target = q.docs[0];
      if (S.data.admins.some((a) => a.id === target.id)) { toast('Esa persona ya es colaboradora.', true); if (btn) btn.disabled = false; return; }
      const name = clamp(target.data().displayName || '', 80);
      ok = await run(() => commitWithAudit(doc(db, 'admins', target.id), { role: 'staff', email, name, createdAt: serverTimestamp(), createdBy: S.user.uid },
        { action: 'staff.add', targetType: 'admin', targetId: target.id, details: { email, name } }, 'set'), 'Colaborador agregado ✓');
      if (ok) form.reset();
    } catch (e) { toast(friendly(e), true); }
    if (btn) btn.disabled = false;
    return;
  }
  if (kind === 'zonecov') {
    const id = form.dataset.id; const z = S.data.zones.find((x) => x.id === id);
    const coverage = { lat: Math.round(Number(fd.get('lat')) * 100000) / 100000, lng: Math.round(Number(fd.get('lng')) * 100000) / 100000, radiusKm: Math.round(Number(fd.get('radiusKm')) * 10) / 10 };
    if (!(coverage.radiusKm >= 0.5 && coverage.radiusKm <= 50) || !Number.isFinite(coverage.lat) || !Number.isFinite(coverage.lng)) { toast('Elige un punto en el mapa y un radio de 0.5 a 50 km.', true); if (btn) btn.disabled = false; return; }
    ok = await run(() => commitWithAudit(doc(db, 'zones', id), { coverage, updatedAt: serverTimestamp() },
      { action: 'zone.coverage', targetType: 'zone', targetId: id, details: { name: z?.name || id, note: `${coverage.radiusKm} km` } }), 'Cobertura guardada ✓');
  }
  if (kind === 'category') {
    const id = form.dataset.id;
    const name = clamp(fd.get('name'), 60);
    if (name.length < 2) { toast('El nombre necesita al menos 2 letras.', true); if (btn) btn.disabled = false; return; }
    const data = {
      name, icon: clamp(fd.get('icon'), 16), description: clamp(fd.get('description'), 200),
      serviceOptions: linesToList(fd.get('serviceOptions'), 12, 40),
      order: Math.max(1, Math.min(99, Number(fd.get('order')) || 99)), active: fd.get('active') === 'on', updatedAt: serverTimestamp(),
    };
    if (id) {
      ok = await run(() => commitWithAudit(doc(db, 'categories', id), data, { action: 'category.update', targetType: 'category', targetId: id, details: { name, active: data.active } }), 'Categoría guardada ✓');
    } else {
      const newId = slug(name);
      if (!newId) { toast('Usa letras o números en el nombre.', true); if (btn) btn.disabled = false; return; }
      if (S.data.categories.some((c) => c.id === newId)) { toast('Ya existe una categoría con ese nombre.', true); if (btn) btn.disabled = false; return; }
      ok = await run(() => commitWithAudit(doc(db, 'categories', newId), { ...data, createdAt: serverTimestamp() }, { action: 'category.create', targetType: 'category', targetId: newId, details: { name, active: data.active } }, 'set'), 'Categoría creada ✓');
    }
  }
  if (kind === 'zone') {
    const id = form.dataset.id;
    const name = clamp(fd.get('name'), 80);
    if (name.length < 2) { toast('El nombre necesita al menos 2 letras.', true); if (btn) btn.disabled = false; return; }
    const data = {
      name, municipality: clamp(fd.get('municipality'), 80), state: clamp(fd.get('state'), 80),
      colonias: linesToList(String(fd.get('colonias') || '').replace(/,/g, '\n'), 300, 80).sort((a, b) => a.localeCompare(b, 'es')),
      active: fd.get('active') === 'on', updatedAt: serverTimestamp(),
    };
    if (id) {
      ok = await run(() => commitWithAudit(doc(db, 'zones', id), data, { action: 'zone.update', targetType: 'zone', targetId: id, details: { name, colonias: data.colonias.length, active: data.active } }), 'Zona guardada ✓');
    } else {
      const newId = slug(name);
      if (!newId) { toast('Usa letras o números en el nombre.', true); if (btn) btn.disabled = false; return; }
      if (S.data.zones.some((z) => z.id === newId)) { toast('Ya existe una zona con ese nombre.', true); if (btn) btn.disabled = false; return; }
      ok = await run(() => commitWithAudit(doc(db, 'zones', newId), { ...data, createdAt: serverTimestamp() }, { action: 'zone.create', targetType: 'zone', targetId: newId, details: { name } }, 'set'), 'Zona creada ✓');
    }
  }
  if (ok) closeModal(); else if (btn) btn.disabled = false;
});
