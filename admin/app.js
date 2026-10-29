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
  getFirestore, doc, collection, getDoc, getDocs, onSnapshot, query, orderBy, limit,
  writeBatch, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';
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
const USER_STATUS = { active: { label: 'Activo', tone: 'ok' }, suspended: { label: 'Suspendido', tone: 'err' } };
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
  'provider.pending': 'Regresó a revisión', 'user.suspended': 'Suspendió usuario', 'user.active': 'Reactivó usuario',
  'order.status': 'Cambió estado de pedido', 'request.status': 'Cambió solicitud', 'category.create': 'Creó categoría',
  'category.update': 'Editó categoría', 'review.hide': 'Ocultó reseña', 'review.show': 'Volvió a mostrar reseña', 'zone.create': 'Creó zona', 'zone.update': 'Editó zona', 'seedCatalog': 'Cargó catálogo inicial',
};

// ───────────── Firebase ─────────────
const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
auth.languageCode = 'es';
const db = getFirestore(fbApp);

// ───────────── Utilidades ─────────────
const $app = document.getElementById('app');
const $modal = document.getElementById('modal-root');
const $toast = document.getElementById('toast');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (t, max) => String(t ?? '').trim().slice(0, max);
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
  data: { providers: [], users: [], orders: [], requests: [], categories: [], zones: [], audit: [], reviews: [] },
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
  if (mode === 'set') batch.set(ref, data); else batch.update(ref, data);
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
  ['solicitudes', '📣', 'Solicitudes'],
  ['usuarios', '👥', 'Usuarios'],
  ['categorias', '🗂️', 'Categorías'],
  ['resenas', '⭐', 'Reseñas'],
  ['zonas', '📍', 'Zonas y colonias'],
  ['bitacora', '📝', 'Bitácora'],
];

function shellView() {
  const pending = S.data.providers.filter((p) => p.status === 'pending').length;
  const nav = PAGES.map(([id, ic, label]) => `<button class="nav-btn ${S.page === id ? 'on' : ''}" data-page="${id}">
      <span>${ic}</span>${esc(label)}${id === 'proveedores' && pending ? `<span class="count">${pending}</span>` : ''}</button>`).join('');
  const views = { resumen, proveedores, pedidos, solicitudes, usuarios, categorias, resenas, zonas, bitacora };
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
      <div class="t">${p.status === 'approved' ? `<span class="dot ${isOnline(p) ? 'on' : ''}" title="${isOnline(p) ? 'Conectado ahora' : 'No conectado'}"></span>` : ''}${esc(p.businessName || '(sin nombre)')} ${badge(PROVIDER_STATUS, p.status)} ${ratingHtml(p.id)}</div>
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
      <dt>Disponible</dt><dd>${isOnline(p) ? '<span class="dot on"></span>Conectado ahora' : p.isAvailable ? 'Activó "Disponible", sin señal reciente' : 'No'} · última señal ${esc(timeAgo(p.lastSeenAt))}</dd>
      <dt>Titular</dt><dd>${esc(u?.displayName || '—')}<br>${esc(u?.email || '')}${u?.phone ? '<br>' + esc(u.phone) : ''}</dd>
      <dt>Pedidos</dt><dd>${orders.length} en total · ${delivered} entregados</dd>
      <dt>Calificación</dt><dd>${ratingOf(id) ? `★ ${ratingOf(id).avg.toFixed(1)} de 5 · ${ratingOf(id).count} reseña(s) visibles` : 'Sin reseñas'}</dd>
      <dt>Enviada</dt><dd>${esc(fmtDate(p.createdAt))}</dd>
      <dt>Revisada</dt><dd>${p.reviewedAt ? esc(fmtDate(p.reviewedAt)) : '—'}</dd>
      <dt>Nota</dt><dd>${esc(p.reviewNote || '—')}</dd>
      <dt>UID</dt><dd class="mono">${esc(p.id)}</dd>
    </dl>
    <div class="foot">
      ${p.status !== 'approved' ? `<button class="btn ok" data-act="prov-approve" data-id="${esc(id)}">Aprobar</button>` : ''}
      ${p.status === 'pending' ? `<button class="btn danger" data-act="prov-reject" data-id="${esc(id)}">Rechazar</button>` : ''}
      ${p.status === 'approved' ? `<button class="btn danger" data-act="prov-suspend" data-id="${esc(id)}">Suspender</button>` : ''}
      <button class="btn ghost" data-act="close">Cerrar</button>
    </div>`);
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
      <dt>Origen</dt><dd>${o.requestId ? 'Oferta elegida' : 'Reserva directa'}</dd>
      <dt>Creado</dt><dd>${esc(fmtDate(o.createdAt))}</dd>
      <dt>Último cambio</dt><dd>${esc(fmtDate(o.statusChangedAt || o.updatedAt))}</dd>
      ${o.cancelReason ? `<dt>Motivo</dt><dd>${esc(o.cancelReason)}</dd>` : ''}
      ${o.adminNote ? `<dt>Nota admin</dt><dd>${esc(o.adminNote)}</dd>` : ''}
      <dt>ID</dt><dd class="mono">${esc(o.id)}</dd>
    </dl>
    <form data-form="order" data-id="${esc(id)}">
      <label class="f">Corregir estado</label>
      <select class="in" name="status">${opts}</select>
      <label class="f">Nota interna (obligatoria al cambiar)</label>
      <textarea class="in" name="note" rows="2" maxlength="500" placeholder="Ej. El cliente pidió cancelar por teléfono.">${esc(o.adminNote || '')}</textarea>
      <div class="hint">Úsalo solo para resolver problemas: el cliente y el proveedor ven el nuevo estado en la app.</div>
      <div class="foot"><button type="button" class="btn ghost" data-act="close">Cerrar</button><button class="btn" type="submit">Guardar</button></div>
    </form>`);
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
    + chips('users', [['all', 'Todos', all.length], ['active', 'Activos', all.filter((u) => u.status === 'active').length], ['providers', 'Con perfil de proveedor', all.filter((u) => prov[u.id]).length], ['suspended', 'Suspendidos', all.filter((u) => u.status === 'suspended').length]])
    + (all.length >= LIST_LIMIT ? `<div class="notice">Se muestran los ${LIST_LIMIT} más recientes.</div>` : '')
    + loadingOr('users', list.length ? `<div class="list">${list.map((u) => `<div class="row"><div>
        <div class="t">${esc(u.displayName || '(sin nombre)')} ${badge(USER_STATUS, u.status)} ${prov[u.id] ? badge(PROVIDER_STATUS, prov[u.id].status).replace('">', '">Proveedor: ') : ''}</div>
        <div class="m">${esc(u.email || '')}${u.phone ? ' · ' + esc(u.phone) : ''}${u.colonia ? ' · 📍 ' + esc(u.colonia) : ''} · modo ${u.activeMode === 'provider' ? 'proveedor' : 'cliente'} · desde ${esc(fmtDate(u.createdAt, false))}
        ${u.statusNote ? '<br>Nota: ' + esc(u.statusNote) : ''}</div></div>
        <div class="acts">${u.status === 'suspended'
          ? `<button class="btn ok small" data-act="user-activate" data-id="${esc(u.id)}">Reactivar</button>`
          : `<button class="btn danger small" data-act="user-suspend" data-id="${esc(u.id)}">Suspender</button>`}</div></div>`).join('')}</div>` : '<div class="empty">No hay usuarios en este filtro.</div>');
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

// ───────────── Zonas y colonias ─────────────
function zonas() {
  const list = S.data.zones;
  return head('Zonas y colonias', 'La zona es la ciudad o municipio. Las colonias se capturan aquí con datos reales.',
    '<button class="btn" data-act="zone-new">+ Nueva zona</button>')
    + errBox('zones')
    + '<div class="notice">Nota: por ahora la app pide al cliente escribir su colonia. Usar esta lista como selector dentro de la app es un cambio pendiente.</div>'
    + loadingOr('zones', list.length ? `<div class="list">${list.map((z) => {
      const provs = S.data.providers.filter((p) => p.status === 'approved' && (p.zoneIds || []).includes(z.id)).length;
      const col = z.colonias || [];
      return `<div class="row"><div>
          <div class="t">📍 ${esc(z.name)} ${z.active ? '<span class="badge ok">Activa</span>' : '<span class="badge mute">Inactiva</span>'}</div>
          <div class="m">${esc([z.municipality, z.state].filter(Boolean).join(', '))} · ${provs} proveedor${provs === 1 ? '' : 'es'} aprobado${provs === 1 ? '' : 's'} · ${col.length} colonia${col.length === 1 ? '' : 's'}
          ${col.length ? '<br>' + esc(col.slice(0, 12).join(', ')) + (col.length > 12 ? '…' : '') : ''}</div>
        </div><div class="acts"><button class="btn ghost small" data-act="zone-edit" data-id="${esc(z.id)}">Editar</button></div></div>`;
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
  $modal.innerHTML = `<div class="overlay" data-act="overlay"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  const first = $modal.querySelector('input, textarea, select');
  if (first && !first.value) first.focus();
}
function closeModal() { $modal.innerHTML = ''; }
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
    case 'user-activate': {
      const u = S.data.users.find((x) => x.id === id);
      const note = await askNote({ title: `Reactivar a ${u?.displayName || u?.email || ''}`, text: 'Podrá volver a usar la app normalmente.', label: 'Nota', required: false, okLabel: 'Reactivar' });
      if (note !== null) await run(() => setUserStatus(id, 'active', note), 'Usuario reactivado ✓');
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
    ok = await run(() => commitWithAudit(doc(db, 'orders', id), data,
      { action: 'order.status', targetType: 'order', targetId: id, details: { from: o?.status || '', to: status, note: clamp(note, 300) } }), 'Pedido actualizado ✓');
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
