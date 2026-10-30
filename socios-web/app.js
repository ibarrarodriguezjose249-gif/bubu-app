// ═══════════════════════════════════════════════════════════════════════════
//  BÜBÜ Socios — portal web para proveedores (laptop / computadora)
//  Misma cuenta, mismos datos y mismas reglas de Firestore que la app BÜBÜ Socios.
//  Sin claves privadas: config.js es la configuración PÚBLICA de Firebase.
//  Avisos: sonido, título de la pestaña y notificación del navegador, con la página abierta.
// ═══════════════════════════════════════════════════════════════════════════
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, sendEmailVerification, updateProfile, signOut,
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import {
  getFirestore, doc, collection, getDoc, setDoc, updateDoc, deleteDoc, addDoc, onSnapshot, query, where, orderBy, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';
import { getStorage, ref as storageRef, getDownloadURL, uploadBytes } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-storage.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-functions.js';
import { firebaseConfig } from './config.js';

// ───────────── Constantes (iguales a la app) ─────────────
const BRAND = 'BÜBÜ';
const ZONE_LABEL = 'General Zuazua, N.L.';
const HEARTBEAT_MS = 4 * 60 * 1000;
const MISSED_DAYS = 7;
const MODES = {
  dropoff: { client: 'El cliente lo lleva', provider: 'Recibo en mi local / casa', icon: 'store' },
  pickup_delivery: { client: 'Recolección y entrega', provider: 'Recojo y entrego', icon: 'car' },
};
const PROVIDER_STATUS = {
  pending: { label: 'En revisión', tone: 'warn', text: `El equipo de ${BRAND} está revisando tu solicitud. Aquí verás el cambio en cuanto la aprueben.` },
  approved: { label: 'Aprobado', tone: 'ok', text: 'Tu negocio está aprobado. Conéctate para recibir pedidos de tu zona.' },
  rejected: { label: 'No aprobado', tone: 'err', text: 'Tu solicitud no fue aprobada. Revisa la nota, corrige tus datos y vuelve a enviarla.' },
  suspended: { label: 'Suspendido', tone: 'err', text: `Tu negocio está suspendido. Contacta a soporte de ${BRAND}.` },
};
const ORDER = {
  requested: { label: 'Por aceptar', color: '#0066FF', bg: '#EAF2FF', icon: 'send' },
  accepted: { label: 'Aceptado', color: '#00897F', bg: '#DDF7F4', icon: 'check' },
  rejected: { label: 'Rechazado', color: '#B42318', bg: '#FFECEC', icon: 'x' },
  in_progress: { label: 'En proceso', color: '#9A6200', bg: '#FFF6DD', icon: 'refresh' },
  ready: { label: 'Listo', color: '#0E7A4B', bg: '#E3F8EE', icon: 'bag' },
  delivered: { label: 'Entregado', color: '#0E7A4B', bg: '#E3F8EE', icon: 'checks' },
  cancelled: { label: 'Cancelado', color: '#5B6B82', bg: '#EEF1F5', icon: 'ban' },
  disputed: { label: 'En revisión', color: '#B42318', bg: '#FFECEC', icon: 'alert' },
};
const STEPS = ['requested', 'accepted', 'in_progress', 'ready', 'delivered'];
const NEXT = { requested: ['accepted', 'rejected'], accepted: ['in_progress', 'cancelled'], in_progress: ['ready'], ready: ['delivered'] };
const ACTION = {
  accepted: { label: 'Aceptar pedido', icon: 'check', cls: '' },
  rejected: { label: 'Rechazar', icon: 'x', cls: 'danger' },
  in_progress: { label: 'Recibí la ropa / Empecé', icon: 'refresh', cls: '' },
  ready: { label: 'Marcar como listo', icon: 'bag', cls: '' },
  delivered: { label: 'Entregar (PIN del cliente)', icon: 'checks', cls: 'ok' },
  cancelled: { label: 'Cancelar pedido', icon: 'ban', cls: 'danger' },
};
const ACTIVE = ['requested', 'accepted', 'in_progress', 'ready'];
// Código corto para escribir en la bolsa (sale del número del pedido; igual que en la app).
const bagCode = (id) => `BÜ-${String(id || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase()}`;
const EVIDENCE = [['weightPhotoPath', 'Báscula'], ['pickupPhotoPath', 'Recolección'], ['deliveryPhotoPath', 'Entrega']];
const PICKUP_OPTIONS = ['En 1 hora', 'Hoy en la tarde', 'Hoy en la noche', 'Mañana temprano'];
const READY_OPTIONS = ['El mismo día', 'En 24 horas', 'En 48 horas'];

// ───────────── Íconos de línea (SVG) ─────────────
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>',
  store: '<path d="M3 9 4.5 4h15L21 9"/><path d="M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M5 13v8h14v-8"/><path d="M10 21v-5h4v5"/>',
  help: '<circle cx="12" cy="12" r="9.5"/><path d="M9.3 9a2.8 2.8 0 0 1 5.4 1c0 2-2.7 2.5-2.7 4"/><path d="M12 17.5h.01"/>',
  logout: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17-5-5 5-5"/><path d="M5 12h12"/>',
  power: '<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/>',
  clock: '<circle cx="12" cy="12" r="9.5"/><path d="M12 7v5l3 2"/>',
  pin: '<path d="M12 21s7-6.1 7-12a7 7 0 0 0-14 0c0 5.9 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  car: '<path d="M5 17h14M3 13l2-6h14l2 6v4a1 1 0 0 1-1 1h-1M4 18H3v-5"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="17" rx="2"/><path d="M8 2.5v4M16 2.5v4M3 10h18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  checks: '<path d="m2 12.5 4.5 4.5L14 9.5"/><path d="m11 16 1 1 9-9.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  phone: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  down: '<path d="m22 17-8.5-8.5-5 5L2 7"/><path d="M16 17h6v-6"/>',
  thumb: '<path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z"/><path d="M7 10l4-8a2.5 2.5 0 0 1 2.5 2.5V8h5.4a2 2 0 0 1 2 2.3l-1.3 8.5a2 2 0 0 1-2 1.7H7"/>',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  refresh: '<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 12A9 9 0 0 1 18.5 5.8L21 8"/><path d="M21 3v5h-5M3 21v-5h5"/>',
  bag: '<path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/><path d="m9.5 14 2 2 3.5-3.5"/>',
  ban: '<circle cx="12" cy="12" r="9.5"/><path d="m5.5 5.5 13 13"/>',
  alert: '<circle cx="12" cy="12" r="9.5"/><path d="M12 7.5v5M12 16.5h.01"/>',
  info: '<circle cx="12" cy="12" r="9.5"/><path d="M12 11v6M12 7.5h.01"/>',
  hanger: '<path d="M12 7.5a2 2 0 1 1 2-2"/><path d="M12 7.5v1.5L3 15.5a1 1 0 0 0 .6 1.8h16.8a1 1 0 0 0 .6-1.8L12 9"/>',
  money: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9.5v5M18 9.5v5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6 8.5 7 8.5-7"/>',
  camera: '<path d="M4 8h3l2-2.5h6L17 8h3a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10.5" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  sound: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
  chart: '<path d="M3 21h18"/><rect x="5" y="11" width="3" height="7"/><rect x="10.5" y="6" width="3" height="12"/><rect x="16" y="13" width="3" height="5"/>',
  shield: '<path d="M12 3 4.5 6v6c0 4.5 3.2 7.7 7.5 9 4.3-1.3 7.5-4.5 7.5-9V6z"/><path d="m9 12 2 2 4-4"/>',
};
const icon = (n, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || P.info}</svg>`;

// ───────────── Firebase ─────────────
const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
auth.languageCode = 'es';
const db = getFirestore(fbApp);
const storage = getStorage(fbApp);
const functions = getFunctions(fbApp, 'us-central1');

// ───────────── Utilidades ─────────────
const $app = document.getElementById('app');
const $modal = document.getElementById('modal-root');
const $incoming = document.getElementById('incoming-root');
const $toast = document.getElementById('toast');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (t, max) => String(t ?? '').trim().slice(0, max);
const normalizePhone = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.length === 12 && d.startsWith('52') ? d.slice(2) : d; };
function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  return typeof ts === 'number' ? ts : 0;
}
function timeAgo(ts) {
  const ms = toMillis(ts); if (!ms) return '';
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return 'hace un momento'; if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60); if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24); return d === 1 ? 'ayer' : `hace ${d} días`;
}
function countdown(ts) {
  const left = toMillis(ts) - Date.now();
  if (left <= 0) return '0:00';
  return `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}`;
}
const fmtElapsed = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`; };
const money = (n) => (typeof n === 'number' ? `$${n.toLocaleString('es-MX', { maximumFractionDigits: 0 })}` : '');
const money2 = (n) => `$${(typeof n === 'number' && !Number.isNaN(n) ? n : 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const round2 = (n) => Math.round(n * 100) / 100;
// Comisión de BÜBÜ estilo DiDi: total × % + IVA sobre esa comisión, se le descuenta al socio.
// Cuota de servicio: la paga todo cliente (tarjeta o efectivo) y es de BÜBÜ.
// Valores por omisión iguales a la app, las reglas y el servidor.
const DEFAULT_CFG = { pct: 30, ivaPct: 16, serviceFee: 10, debtLimit: 300 };
const DEFAULT_COMMISSION_PCT = DEFAULT_CFG.pct;
// serverOn: servidor activo (plan Blaze) → fotos de la bolsa y PIN de entrega. Apagado: se entrega como antes.
const cfgFrom = (d) => ({ ...Object.fromEntries(Object.keys(DEFAULT_CFG).map((k) => [k, d && typeof d[k] === 'number' ? d[k] : DEFAULT_CFG[k]])), cardEnabled: !!(d && d.cardEnabled === true), serverOn: !!(d && d.serverOn === true) });
// Lo que se copia al pedido para que el cliente transfiera DIRECTO al socio.
const transferInfoFrom = (p) => (p && p.holder && p.account ? { holder: p.holder, account: p.account, ...(p.bank ? { bank: p.bank } : {}), ...(p.note ? { note: p.note } : {}) } : null);
const feeFor = (amount, pct, iva) => round2(amount * (pct / 100) * (1 + (iva || 0) / 100));
const commissionLabel = (pct, iva) => `${pct} %${iva ? ' + IVA' : ''}`;
const PAY = {
  pending: { label: 'Por pagar', cls: 'warn' }, cash: { label: 'Pagará en efectivo', cls: 'info' },
  transfer: { label: 'Pagará por transferencia', cls: 'warn' }, transfer_ok: { label: 'Transferencia recibida', cls: 'ok' },
  paid: { label: 'Pagado con tarjeta', cls: 'ok' }, review: { label: 'Pago en revisión', cls: 'warn' }, refunded: { label: 'Reembolsado', cls: 'info' },
};
const paidByCard = (o) => o?.paymentStatus === 'paid';
const commissionOf = (o) => (o?.status === 'delivered' && typeof o.finalPrice === 'number'
  ? feeFor(o.finalPrice, typeof o.commissionPct === 'number' ? o.commissionPct : DEFAULT_COMMISSION_PCT, typeof o.commissionIvaPct === 'number' ? o.commissionIvaPct : 0) : 0);
const summary = (r) => [(r.services || []).join(', '), r.quantityText, r.description].filter(Boolean).join(' · ') || 'Pedido';
const reqState = (r) => (r.status === 'open' ? (toMillis(r.expiresAt) && toMillis(r.expiresAt) <= Date.now() ? 'expired' : 'open') : r.status);
const starsHtml = (n) => `<span class="stars">${'★'.repeat(n)}<span class="off">${'★'.repeat(5 - n)}</span></span>`;
const initials = (name) => (name || '?').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
function friendly(e) {
  const c = e?.code || '';
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found')) return 'Correo o contraseña incorrectos.';
  if (c.includes('email-already-in-use')) return 'Ya existe una cuenta con ese correo. Inicia sesión.';
  if (c.includes('weak-password')) return 'La contraseña es muy débil.';
  if (c.includes('too-many-requests')) return 'Demasiados intentos. Espera unos minutos.';
  if (c.includes('network') || c.includes('unavailable')) return 'Sin conexión. Revisa tu internet.';
  if (c.includes('unauthorized-domain')) return 'Este sitio aún no está autorizado en Firebase (Dominios autorizados).';
  if (c.includes('permission-denied')) return 'Firebase no lo permitió. Revisa que estés conectado y que el pedido siga abierto.';
  return e?.message || 'Ocurrió un error.';
}
let toastT;
function toast(msg, err = false) { $toast.textContent = msg; $toast.className = 'show' + (err ? ' err' : ''); clearTimeout(toastT); toastT = setTimeout(() => { $toast.className = ''; }, 3500); }
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } } };

// ───────────── Avisos: sonido, título y notificación ─────────────
let audioCtx = null;
function unlockAudio() { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch { /* sin audio */ } }
function chime(times = 3) {
  if (!audioCtx || !S.soundOn) return;
  const now = audioCtx.currentTime;
  for (let i = 0; i < times; i += 1) {
    [[880, 0], [1320, 0.16]].forEach(([f, off]) => {
      const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(audioCtx.destination);
      const t = now + i * 0.7 + off;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.start(t); o.stop(t + 0.32);
    });
  }
}
let titleT = null;
function flashTitle(msg) {
  clearInterval(titleT); let on = false;
  titleT = setInterval(() => { document.title = (on = !on) ? msg : 'BÜBÜ Socios'; }, 1000);
}
function stopFlash() { clearInterval(titleT); titleT = null; document.title = 'BÜBÜ Socios'; }
window.addEventListener('focus', stopFlash);
function notify(title, body) {
  try { if ('Notification' in window && Notification.permission === 'granted' && document.hidden) new Notification(title, { body, icon: 'icons/icon-192.png' }); } catch { /* sin notificaciones */ }
}
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { /* el navegador no lo permite */ }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && isOnline()) keepAwake(true); });

// ───────────── Estado ─────────────
const S = {
  phase: 'loading', // loading | auth | ready
  authTab: 'login', authBusy: false, authMsg: null, authForm: { name: '', email: '', password: '', phone: '' },
  user: null, profile: undefined, provider: undefined, categories: [], zones: [],
  requests: [], orders: [], reviews: [],
  myOffers: {}, offerChecked: {}, dismissed: {},
  page: 'inicio', orderTab: 'curso', drawer: null,
  onlineSince: null, toggling: false, soundOn: store.get('bubu:sonido', true),
  celebrated: new Set(), lastIncoming: '', bizForm: null, busy: '',
  cfg: { ...DEFAULT_CFG }, debtBlock: null, payInfo: null, payments: [], payouts: [],
  chat: { orderId: '', msgs: [], unsub: null },
};
let unsubs = []; let reqUnsubs = []; let heartbeatT = null;
const approved = () => S.provider?.status === 'approved';
const blocked = () => !!S.debtBlock; // pausado por adeudo (lo decide el servidor)
const isOnline = () => approved() && !blocked() && !!S.provider?.isAvailable;
const canServe = (r) => (S.provider?.fulfillmentModes || []).includes(r.fulfillmentMode);
const catName = (id) => S.categories.find((c) => c.id === id)?.name || id;
const zoneName = (id) => S.zones.find((z) => z.id === id)?.name || id;

// ───────────── Sesión ─────────────
onAuthStateChanged(auth, (u) => {
  stopAll();
  S.user = u; S.debtBlock = null; S.payInfo = null; S.areaDraft = null; S.profile = undefined; S.provider = undefined; S.requests = []; S.orders = []; S.reviews = []; S.payments = []; S.payouts = []; S.myOffers = {}; S.offerChecked = {}; S.dismissed = {};
  if (!u) { S.phase = 'auth'; render(); return; }
  S.phase = 'ready';
  S.celebrated = new Set(store.get(`bubu:celebrated:${u.uid}`, []));
  listen(doc(db, 'users', u.uid), (s) => { S.profile = s.exists() ? { id: s.id, ...s.data() } : null; render(); });
  listen(doc(db, 'providers', u.uid), (s) => { S.provider = s.exists() ? { id: s.id, ...s.data() } : null; onProviderChange(); render(); });
  listen(collection(db, 'categories'), (s) => { S.categories = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order ?? 99) - (b.order ?? 99)); render(); });
  listen(collection(db, 'zones'), (s) => { S.zones = s.docs.map((d) => ({ id: d.id, ...d.data() })); render(); });
  listen(doc(db, 'config', 'commission'), (s) => { S.cfg = cfgFrom(s.exists() ? s.data() : null); render(); });
  listen(doc(db, 'providerPayInfo', u.uid), (s) => { S.payInfo = s.exists() ? s.data() : null; render(); }, () => { S.payInfo = null; });
  listen(doc(db, 'debtBlocks', u.uid), (s) => { S.debtBlock = s.exists() ? s.data() : null; onProviderChange(); render(); }, () => { S.debtBlock = null; });
  render();
});
function listen(ref, cb, onErr) { unsubs.push(onSnapshot(ref, cb, onErr || ((e) => console.warn(e)))); }
function stopAll() {
  [...unsubs, ...reqUnsubs].forEach((u) => { try { u(); } catch { /* nada */ } });
  unsubs = []; reqUnsubs = []; clearInterval(heartbeatT); heartbeatT = null; keepAwake(false); stopFlash(); $incoming.innerHTML = ''; S.onlineSince = null;
}

// Cuando cambia el perfil de proveedor: suscripciones a pedidos y latido de "conectado".
let subKey = '';
function onProviderChange() {
  const p = S.provider;
  const key = approved() ? `${(p.categoryIds || []).join()}|${(p.zoneIds || []).join()}|${blocked() ? 'pausado' : ''}` : '';
  if (key !== subKey) {
    reqUnsubs.forEach((u) => u()); reqUnsubs = []; subKey = key;
    if (key) {
      const buckets = {};
      if (blocked()) S.requests = [];
      if (!blocked()) (p.categoryIds || []).forEach((c) => (p.zoneIds || []).forEach((z) => {
        reqUnsubs.push(onSnapshot(query(collection(db, 'requests'), where('categoryId', '==', c), where('zoneId', '==', z)), (snap) => {
          buckets[`${c}|${z}`] = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((r) => r.categoryId === c && r.zoneId === z);
          const all = {}; Object.values(buckets).forEach((l) => l.forEach((r) => { all[r.id] = r; }));
          S.requests = Object.values(all).sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
          checkOffers(); render();
        }, (e) => console.warn(e)));
      }));
      const uid = S.user.uid;
      reqUnsubs.push(onSnapshot(query(collection(db, 'orders'), where('providerId', '==', uid)), (snap) => {
        S.orders = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((o) => o.providerId === uid).sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)); render();
        if (S.drawer && $modal.querySelector('.drawer')) orderDrawer(S.drawer);
      }, (e) => console.warn(e)));
      reqUnsubs.push(onSnapshot(query(collection(db, 'reviews'), where('providerId', '==', uid)), (snap) => {
        S.reviews = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((r) => r.providerId === uid).sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)); render();
      }, (e) => console.warn(e)));
      reqUnsubs.push(onSnapshot(query(collection(db, 'commissionPayments'), where('providerId', '==', uid)), (snap) => {
        S.payments = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)); render();
      }, (e) => console.warn(e)));
      reqUnsubs.push(onSnapshot(query(collection(db, 'payouts'), where('providerId', '==', uid)), (snap) => {
        S.payouts = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)); render();
      }, (e) => console.warn(e)));
    } else { S.requests = []; S.orders = []; S.reviews = []; S.payments = []; S.payouts = []; }
  }
  // Latido mientras esté conectado.
  if (isOnline()) {
    if (!S.onlineSince) S.onlineSince = Date.now();
    if (!heartbeatT) { beat(); heartbeatT = setInterval(beat, HEARTBEAT_MS); }
    keepAwake(true);
  } else {
    clearInterval(heartbeatT); heartbeatT = null; S.onlineSince = null; keepAwake(false); $incoming.innerHTML = '';
  }
}
function beat() { if (S.user) updateDoc(doc(db, 'providers', S.user.uid), { lastSeenAt: serverTimestamp(), updatedAt: serverTimestamp() }).catch(() => {}); }

// ¿Ya mandé oferta? Una consulta por pedido reciente.
function checkOffers() {
  const limit = Date.now() - MISSED_DAYS * 86400000;
  S.requests.filter((r) => toMillis(r.createdAt) > limit && !(r.id in S.offerChecked)).forEach((r) => {
    S.offerChecked[r.id] = false;
    getDoc(doc(db, 'requests', r.id, 'offers', S.user.uid))
      .then((s) => { if (s.exists()) S.myOffers[r.id] = { id: s.id, ...s.data() }; })
      .catch(() => {})
      .finally(() => { S.offerChecked[r.id] = true; render(); });
  });
}

// ───────────── Datos derivados ─────────────
// ───────────── Mapa: zona de servicio del socio (punto + radio) ─────────────
const GZ = { lat: 25.8853, lng: -100.1086 }; // General Zuazua, N.L.
const distKm = (a, b) => { const R = 6371; const r = (x) => (x * Math.PI) / 180; const dLat = r(b.lat - a.lat); const dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const hasArea = (a) => a && typeof a.lat === 'number' && typeof a.lng === 'number' && typeof a.radiusKm === 'number';
// ¿Este pedido le queda cerca? (+1.2 km por la ubicación aproximada del cliente). Sin mapa: solo por zona.
const areaCovers = (area, p) => !hasArea(area) || !p || typeof p.lat !== 'number' || distKm(area, p) <= area.radiusKm + 1.2;
const coverageConfigured = () => S.zones.some((z) => z.active && hasArea(z.coverage));
const zonesForArea = (a) => S.zones.filter((z) => z.active && hasArea(z.coverage) && distKm(a, z.coverage) <= z.coverage.radiusKm + a.radiusKm);
let areaMap = null;
function mountAreaMap() {
  const el = document.getElementById('smap'); if (!el || !window.L) { if (el && !window.L) el.innerHTML = '<div class="empty">No se pudo cargar el mapa.</div>'; return; }
  const L = window.L; const a = S.areaDraft;
  areaMap = L.map('smap').setView([a.lat, a.lng], 12);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap', referrerPolicy: 'strict-origin-when-cross-origin' }).addTo(areaMap);
  S.zones.filter((z) => z.active && hasArea(z.coverage)).forEach((z) => L.circle([z.coverage.lat, z.coverage.lng], { radius: z.coverage.radiusKm * 1000, color: '#00D1C1', weight: 1, fillOpacity: 0.06 }).addTo(areaMap));
  const mk = L.marker([a.lat, a.lng], { draggable: true }).addTo(areaMap);
  const ci = L.circle([a.lat, a.lng], { radius: a.radiusKm * 1000, color: '#0066FF', fillOpacity: 0.15 }).addTo(areaMap);
  const move = (ll) => { mk.setLatLng(ll); ci.setLatLng(ll); S.areaDraft = { ...S.areaDraft, lat: ll.lat, lng: ll.lng }; updateAreaInfo(); };
  mk.on('dragend', () => move(mk.getLatLng())); areaMap.on('click', (e) => move(e.latlng));
  const sel = document.getElementById('area-r');
  if (sel) sel.addEventListener('change', () => { S.areaDraft.radiusKm = Number(sel.value); ci.setRadius(S.areaDraft.radiusKm * 1000); updateAreaInfo(); });
  setTimeout(() => { try { areaMap.invalidateSize(); areaMap.fitBounds(ci.getBounds(), { padding: [20, 20] }); } catch { /* nada */ } }, 50);
}
function updateAreaInfo() {
  const el = document.getElementById('area-info'); if (!el) return;
  const z = zonesForArea(S.areaDraft);
  el.innerHTML = !coverageConfigured() ? '' : z.length ? `Con cobertura en: <b>${z.map((x) => esc(x.name)).join(', ')}</b>.` : `<span style="color:var(--err-text)">Tu zona todavía no tiene cobertura de ${BRAND}. Puedes guardarla igual; te avisaremos cuando lleguemos.</span>`;
}
async function saveArea() {
  const a = S.areaDraft;
  const area = { lat: Math.round(a.lat * 1000) / 1000, lng: Math.round(a.lng * 1000) / 1000, radiusKm: a.radiusKm };
  const data = { serviceArea: area, updatedAt: serverTimestamp() };
  const z = zonesForArea(area); if (z.length) data.zoneIds = z.slice(0, 5).map((x) => x.id);
  try { await updateDoc(doc(db, 'providers', S.user.uid), data); toast(z.length || !coverageConfigured() ? 'Zona de servicio guardada ✓' : 'Zona guardada (aún sin cobertura de BÜBÜ ahí)'); } catch (e) { toast(friendly(e), true); }
}
function areaCard() {
  if (!S.areaDraft) { const a = S.provider?.serviceArea; const z = S.zones.find((x) => x.active && hasArea(x.coverage))?.coverage; S.areaDraft = hasArea(a) ? { ...a } : { ...(z || GZ), radiusKm: 3 }; }
  return `<div class="card"><h3>${icon('pin')}Zona de servicio</h3>
    <p class="muted" style="font-size:14px;line-height:1.6">Mueve el pin a tu local (o haz clic en el mapa) y elige hasta cuántos km das servicio. Solo te llegarán pedidos dentro de tu círculo. Los clientes no ven tu domicilio exacto.</p>
    <div id="smap" class="map-box"></div>
    <div class="row" style="gap:10px;align-items:center;flex-wrap:wrap"><label class="f" for="area-r" style="margin:0">Radio</label>
      <select id="area-r" class="field" style="padding:8px 12px">${[1, 2, 3, 5, 8, 10, 15, 20].map((k) => `<option value="${k}" ${k === S.areaDraft.radiusKm ? 'selected' : ''}>${k} km</option>`).join('')}</select>
      <button class="btn" data-act="area-save">${icon('check', 'sm')}Guardar zona</button></div>
    <div id="area-info" class="hint mt"></div>
    ${hasArea(S.provider?.serviceArea) ? '' : '<div class="notice info mt">' + icon('info') + '<div>Todavía no marcas tu zona: te llegan todos los pedidos de tu municipio.</div></div>'}</div>`;
}

function groups() {
  const me = S.user?.uid; const weekAgo = Date.now() - MISSED_DAYS * 86400000;
  const mine = (r) => r.customerId === me;
  const near = S.requests.filter((r) => areaCovers(S.provider?.serviceArea, r.approxGeo));
  const open = near.filter((r) => !mine(r) && reqState(r) === 'open');
  const won = S.requests.filter((r) => r.status === 'assigned' && r.chosenProviderId === me);
  const recent = near.filter((r) => !mine(r) && toMillis(r.createdAt) > weekAgo);
  const taken = recent.filter((r) => r.status === 'assigned' && r.chosenProviderId !== me && !S.myOffers[r.id]);
  const expired = recent.filter((r) => reqState(r) === 'expired' && !S.myOffers[r.id]);
  const lostWithOffer = recent.filter((r) => r.status === 'assigned' && r.chosenProviderId !== me && S.myOffers[r.id]);
  return { open, won, taken, expired, lostWithOffer };
}
function rating() {
  const l = S.reviews.filter((r) => !r.hidden && typeof r.stars === 'number');
  if (!l.length) return null;
  return { avg: Math.round((l.reduce((a, r) => a + r.stars, 0) / l.length) * 10) / 10, count: l.length, list: l };
}
function incomingRequest() {
  if (!isOnline()) return null;
  return groups().open.find((r) => canServe(r) && S.offerChecked[r.id] === true && !S.myOffers[r.id] && !S.dismissed[r.id]) || null;
}
// Solo pedidos que siguen EN CURSO (no entregados ni cancelados), de las últimas 24 h y no vistos.
function chosenToCelebrate() {
  const active = new Set(S.orders.filter((o) => ACTIVE.includes(o.status)).map((o) => o.id));
  return groups().won.find((r) => active.has(r.orderId) && !S.celebrated.has(r.id) && toMillis(r.updatedAt) > Date.now() - 86400000) || null;
}

// ───────────── Render ─────────────
// ───────────── Chat del pedido (cliente ↔ socio) ─────────────
// Visible mientras el pedido está activo y 48 h después de entregado. El equipo de BÜBÜ puede revisarlo.
const CHAT_OPEN = ['requested', 'accepted', 'in_progress', 'ready'];
const chatIsOpen = (o) => !!o && (CHAT_OPEN.includes(o.status) || (o.status === 'delivered' && toMillis(o.statusChangedAt || o.updatedAt) > Date.now() - 48 * 3600 * 1000));
function stopChat() { if (S.chat.unsub) { try { S.chat.unsub(); } catch { /* nada */ } } S.chat = { orderId: '', msgs: [], unsub: null }; }
function chatHtml() {
  const me = S.user?.uid;
  const hour = (ts) => { const d = ts?.toDate ? ts.toDate() : null; return d ? d.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' }) : ''; };
  return S.chat.msgs.length ? S.chat.msgs.map((m) => `<div class="msg ${m.senderId === me ? 'mine' : ''}"><div>${esc(m.text)}</div><small>${hour(m.createdAt)}</small></div>`).join('')
    : '<div class="muted" style="text-align:center;font-size:13px;padding:10px">Escribe para coordinar la entrega, el horario o el pago.</div>';
}
function startChat(orderId) {
  if (S.chat.orderId === orderId) return;
  stopChat();
  S.chat.orderId = orderId;
  S.chat.unsub = onSnapshot(query(collection(db, 'orders', orderId, 'messages'), orderBy('createdAt', 'asc')), (snap) => {
    S.chat.msgs = snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }));
    const box = document.getElementById('chat-list');
    if (box) { box.innerHTML = chatHtml(); box.scrollTop = box.scrollHeight; }
  }, () => { S.chat.msgs = []; });
}

function render() {
  if (!S.drawer && S.chat.unsub) stopChat();
  const a = document.activeElement; const keepId = a && a.id; const caret = a && typeof a.selectionStart === 'number' ? a.selectionStart : null;
  if (S.phase === 'loading') $app.innerHTML = `<div class="boot"><div class="boot-logo">BÜBÜ <span>SOCIOS</span></div></div>`;
  else if (S.phase === 'auth') $app.innerHTML = authView();
  else $app.innerHTML = shellView();
  if (keepId) { const el = document.getElementById(keepId); if (el) { el.focus(); if (caret !== null && el.setSelectionRange) try { el.setSelectionRange(caret, caret); } catch { /* nada */ } } }
  renderIncoming();
  renderCelebration();
  if (S.phase === 'ready' && S.page === 'negocio' && document.getElementById('smap')) { mountAreaMap(); updateAreaInfo(); }
}

function authView() {
  const f = S.authForm; const t = S.authTab;
  const msg = S.authMsg ? `<div class="notice ${S.authMsg.tone}">${icon(S.authMsg.tone === 'ok' ? 'check' : 'alert')}<div>${esc(S.authMsg.text)}</div></div>` : '';
  return `<div class="auth">
    <section class="auth-brand">
      <div class="brand-logo">BÜBÜ <span class="tag">SOCIOS</span></div>
      <div>
        <h1>Recibe pedidos de tu comunidad desde tu computadora.</h1>
        <p class="lead">El portal para lavanderías y personas que lavan desde casa en ${esc(ZONE_LABEL)} Conéctate, recibe solicitudes en vivo y elige cuáles atender.</p>
        <div class="perks">
          <div class="perk">${icon('bell')}<div><b>Pedidos en tiempo real</b><span>Suena un aviso en cuanto un cliente de tu zona publica un pedido.</span></div></div>
          <div class="perk">${icon('tag')}<div><b>Tú pones tu precio</b><span>Acepta el horario del cliente o propón tu precio y tus tiempos.</span></div></div>
          <div class="perk">${icon('star')}<div><b>Crece con buenas calificaciones</b><span>Los clientes ven tus estrellas al elegir. Tu comisión y tu saldo, siempre a la vista.</span></div></div>
        </div>
      </div>
      <div class="auth-foot">Misma cuenta que la app ${BRAND} Socios.</div>
    </section>
    <section class="auth-form"><div class="auth-card">
      ${t === 'reset' ? `
        <h2>Recuperar contraseña</h2><p class="sub">Te enviamos un enlace a tu correo.</p>
        <form data-form="reset">
          <label class="f" for="a-email">Correo electrónico</label>
          <div class="field">${icon('mail')}<input id="a-email" name="email" type="email" autocomplete="email" value="${esc(f.email)}" required /></div>
          ${msg}
          <button class="btn block mt" ${S.authBusy ? 'disabled' : ''}>${S.authBusy ? 'Enviando…' : 'Enviar enlace'}</button>
          <div style="text-align:center;margin-top:14px"><button type="button" class="linkbtn" data-act="tab" data-tab="login">Volver a iniciar sesión</button></div>
        </form>` : `
        <h2>${t === 'login' ? 'Bienvenido de vuelta' : 'Crea tu cuenta de socio'}</h2>
        <p class="sub">${t === 'login' ? 'Inicia sesión para ver tus pedidos.' : 'Después registras tu negocio y el equipo lo aprueba.'}</p>
        <div class="tabs"><button type="button" class="${t === 'login' ? 'on' : ''}" data-act="tab" data-tab="login">Iniciar sesión</button><button type="button" class="${t === 'register' ? 'on' : ''}" data-act="tab" data-tab="register">Registrarse</button></div>
        <form data-form="${t}">
          ${t === 'register' ? `<label class="f" for="a-name">Nombre completo</label><div class="field">${icon('user')}<input id="a-name" name="name" autocomplete="name" maxlength="80" value="${esc(f.name)}" required /></div>` : ''}
          <label class="f" for="a-email">Correo electrónico</label>
          <div class="field">${icon('mail')}<input id="a-email" name="email" type="email" autocomplete="email" value="${esc(f.email)}" required /></div>
          <label class="f" for="a-pass">Contraseña</label>
          <div class="field">${icon('lock')}<input id="a-pass" name="password" type="password" autocomplete="${t === 'login' ? 'current-password' : 'new-password'}" required /></div>
          ${t === 'register' ? `<div class="hint">Mínimo 8 caracteres, con letras y números.</div>
            <label class="f" for="a-phone">Teléfono (opcional)</label><div class="field">${icon('phone')}<input id="a-phone" name="phone" type="tel" maxlength="20" value="${esc(f.phone)}" /></div>` : ''}
          ${t === 'login' ? `<div style="text-align:right"><button type="button" class="linkbtn" data-act="tab" data-tab="reset">¿Olvidaste tu contraseña?</button></div>` : ''}
          ${msg}
          <button class="btn block mt" ${S.authBusy ? 'disabled' : ''}>${S.authBusy ? 'Un momento…' : t === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</button>
        </form>`}
    </div></section>
  </div>`;
}

const PAGES = [['inicio', 'home', 'Inicio'], ['pedidos', 'list', 'Mis pedidos'], ['calificaciones', 'star', 'Calificaciones'], ['comisiones', 'money', 'Pagos y comisiones'], ['negocio', 'store', 'Mi negocio'], ['ayuda', 'help', 'Ayuda']];
function shellView() {
  if (S.profile === undefined || S.provider === undefined) return `<div class="boot"><div class="boot-logo">BÜBÜ <span>SOCIOS</span></div></div>`;
  const active = S.orders.filter((o) => ACTIVE.includes(o.status)).length;
  const nav = PAGES.map(([id, ic, label]) => `<button class="${S.page === id ? 'on' : ''}" data-page="${id}">${icon(ic)}${label}${id === 'pedidos' && active ? `<span class="count">${active}</span>` : ''}</button>`).join('');
  const titles = { inicio: approved() ? 'Panel de hoy' : 'Bienvenido', pedidos: 'Mis pedidos', calificaciones: 'Calificaciones', comisiones: 'Pagos y comisiones', negocio: 'Mi negocio', ayuda: 'Ayuda' };
  const views = { inicio: inicioView, pedidos: pedidosView, calificaciones: calificacionesView, comisiones: comisionesView, negocio: negocioView, ayuda: ayudaView };
  const suspended = S.profile?.status === 'suspended';
  return `<div class="shell">
    <aside class="side">
      <div class="brand-logo">BÜBÜ <span class="tag">SOCIOS</span></div>
      <nav class="nav">${nav}</nav>
      <div class="side-user">
        <div class="avatar">${esc(initials(S.profile?.displayName || S.user?.email))}</div>
        <div class="who"><b>${esc(S.provider?.businessName || S.profile?.displayName || '')}</b><span>${esc(S.user?.email)}</span></div>
        <button data-act="logout" title="Cerrar sesión" aria-label="Cerrar sesión">${icon('logout', 'sm')}</button>
      </div>
    </aside>
    <main>
      <div class="topbar"><h1>${titles[S.page]}</h1>${approved() && !suspended && !blocked() ? onlineToggle() : ''}</div>
      <div class="content">
        ${suspended ? `<div class="notice err">${icon('alert')}<div>Tu cuenta está suspendida. Contacta al equipo de ${BRAND}.</div></div>` : views[S.page]()}
      </div>
    </main>
  </div>`;
}

function onlineToggle() {
  const on = isOnline();
  return `<div class="online ${on ? 'on' : ''}">
    <div class="state"><span class="dot"></span>${on ? 'Conectado' : 'Desconectado'}</div>
    ${on ? `<span class="timer" data-online-timer>${fmtElapsed(Date.now() - (S.onlineSince || Date.now()))}</span>` : ''}
    <button class="btn sm ghost" data-act="sound" title="${S.soundOn ? 'Silenciar avisos' : 'Activar sonido'}">${icon('sound', 'sm')}${S.soundOn ? '' : ' Silenciado'}</button>
    <button class="btn sm ${on ? 'outline' : ''}" data-act="toggle" ${S.toggling ? 'disabled' : ''}>${icon('power', 'sm')}${on ? 'Desconectarme' : 'Conectarme'}</button>
  </div>`;
}

// ───────────── Inicio ─────────────
function inicioView() {
  if (!approved()) return notApprovedView();
  if (blocked()) {
    return `<div class="card"><div class="notice err">${icon('alert')}<div><b>Tu cuenta está pausada por un adeudo de ${money2(S.debtBlock.debt)}</b><br>Son comisiones y cuotas de servicio de pedidos cobrados en efectivo, y pasaste el límite de ${money2(S.debtBlock.debtLimit)}. Mientras tanto no te llegan pedidos nuevos; los que ya tienes sí los puedes terminar. Págalo al equipo de ${BRAND} y se desbloquea solo.</div></div>
      <div class="stack mt"><button class="btn" data-page="comisiones">${icon('money', 'sm')}Ver pagos y comisiones</button><button class="btn outline" data-page="pedidos">${icon('list', 'sm')}Mis pedidos en curso</button></div></div>`;
  }
  const g = groups(); const r = rating();
  const active = S.orders.filter((o) => ACTIVE.includes(o.status));
  const toAccept = S.orders.filter((o) => o.status === 'requested');
  const startDay = new Date().setHours(0, 0, 0, 0);
  const deliveredToday = S.orders.filter((o) => o.status === 'delivered' && toMillis(o.statusChangedAt || o.updatedAt) >= startDay).length;
  const weekAgo = Date.now() - 7 * 86400000;
  const deliveredWeek = S.orders.filter((o) => o.status === 'delivered' && toMillis(o.statusChangedAt || o.updatedAt) >= weekAgo).length;
  const activeIds = new Set(active.map((o) => o.id));
  const wonActive = g.won.filter((w) => activeIds.has(w.orderId));
  const on = isOnline();

  const left = !on ? `
    <div class="card offline-card">
      <button class="power" data-act="toggle" aria-label="Conectarme" ${S.toggling ? 'disabled' : ''}>${icon('power', 'xl')}</button>
      <div><h2>Estás desconectado</h2>
        <p>Conéctate para aparecer como <b>"conectado ahora"</b> ante los clientes y recibir sus pedidos en vivo, con sonido de aviso. Mantén esta pestaña abierta.</p>
        <button class="btn lg" data-act="toggle" ${S.toggling ? 'disabled' : ''}>${icon('power')}Conectarme</button>
        ${g.open.length ? `<div class="notice info">${icon('info')}<div>Hay <b>${g.open.length}</b> ${g.open.length === 1 ? 'pedido abierto' : 'pedidos abiertos'} en tu zona ahora mismo.</div></div>` : ''}
      </div>
    </div>` : `
    <div class="section-head"><h2>Solicitudes en tu zona</h2><span class="live"><i></i>En vivo</span></div>
    ${g.open.length ? g.open.map(reqCard).join('') : `
      <div class="waiting"><div class="radar"><i></i><i></i><i></i><div class="core">${icon('hanger', 'lg')}</div></div>
        <h3>Buscando pedidos…</h3><p>en ${esc((S.provider.zoneIds || []).map(zoneName).join(', '))}. Te avisaremos con sonido en cuanto llegue uno.</p></div>`}`;

  const right = `
    ${wonActive.length ? `<div class="card" style="border-color:#12b76a66">
      <h3>${icon('trophy')}¡Te eligieron!</h3><div class="sub">Pedidos en curso donde el cliente te eligió.</div>
      ${wonActive.slice(0, 4).map((w) => `<div class="row between mt"><div><b>${esc(summary(w))}</b><div class="muted" style="font-size:12px">${esc([w.colonia, w.whenText].filter(Boolean).join(' · '))}</div></div><button class="btn sm soft" data-act="order" data-id="${esc(w.orderId)}">Ver</button></div>`).join('')}
    </div>` : ''}
    ${toAccept.length ? `<div class="card"><h3>${icon('send')}Reservas por aceptar</h3><div class="sub">Clientes que te reservaron directo.</div>
      ${toAccept.map((o) => `<div class="row between mt"><div><b>${esc(o.customerName)}</b><div class="muted" style="font-size:12px">${esc(o.details)}</div></div><button class="btn sm" data-act="order" data-id="${esc(o.id)}">Revisar</button></div>`).join('')}</div>` : ''}
    <div class="card"><h3>${icon('down')}Tu semana</h3>
      <div class="sub">Pedidos de tu zona que no llegaste a tomar.</div>
      <div class="row mt" style="gap:12px">
        <div style="flex:1;background:var(--bg);border-radius:14px;padding:12px"><div style="font-size:22px;font-weight:800">${g.taken.length}</div><div class="muted" style="font-size:12px">los tomó otra lavandería</div></div>
        <div style="flex:1;background:var(--bg);border-radius:14px;padding:12px"><div style="font-size:22px;font-weight:800">${g.expired.length}</div><div class="muted" style="font-size:12px">vencieron sin respuesta</div></div>
      </div>
      ${g.lostWithOffer.length ? `<div class="sub mt">En ${g.lostWithOffer.length} ofertaste pero el cliente eligió otra opción.</div>` : ''}
      <div class="notice info">${icon('info')}<div>Responde rápido: los clientes suelen elegir entre las primeras ofertas.</div></div>
    </div>`;

  return `
    <div class="kpis">
      ${kpi('list', active.length, 'Pedidos en curso')}
      ${kpi('checks', deliveredToday, 'Entregados hoy', 'ok')}
      ${kpi('chart', deliveredWeek, 'Entregados en 7 días', 'turq')}
      ${kpi('star', r ? r.avg.toFixed(1) : '—', r ? `${r.count} ${r.count === 1 ? 'reseña' : 'reseñas'}` : 'Sin reseñas aún', 'gold')}
    </div>
    <div class="grid2"><div>${left}</div><div class="stack">${right}</div></div>`;
}
const kpi = (ic, n, l, tone = '') => `<div class="kpi ${tone}"><div class="ic">${icon(ic)}</div><div><div class="n">${esc(n)}</div><div class="l">${esc(l)}</div></div></div>`;

function reqCard(r) {
  const offered = S.myOffers[r.id];
  const serve = canServe(r);
  const exp = toMillis(r.expiresAt);
  return `<div class="req">
    <div>
      <div class="row wrap" style="gap:8px"><span class="countdown ${exp - Date.now() < 5 * 60000 ? 'low' : ''}" data-exp="${exp}">${icon('clock', 'sm')}<span>${countdown(r.expiresAt)}</span></span><span class="muted" style="font-size:12px">${timeAgo(r.createdAt)}</span></div>
      <div class="t" style="margin-top:10px">${esc(summary(r))}</div>
      <div class="meta">
        <span>${icon('pin', 'sm')}${esc(r.colonia)}</span>
        <span>${icon(MODES[r.fulfillmentMode]?.icon || 'car', 'sm')}${esc(MODES[r.fulfillmentMode]?.client || '')}</span>
        <span>${icon('calendar', 'sm')}${esc(r.whenText || 'Lo antes posible')}</span>
      </div>
    </div>
    <div class="acts">
      ${!serve ? `<span class="badge mute">No ofreces esta modalidad</span>`
        : offered ? `<span class="badge ok">${icon('check', 'sm')}${offered.kind === 'accept' ? 'Aceptaste — el cliente decide' : `Ofertaste${typeof offered.priceFrom === 'number' ? ` ${money(offered.priceFrom)}` : ''}`}</span><button class="btn sm ghost" data-act="offer" data-id="${esc(r.id)}">Editar</button>`
        : `<button class="btn" data-act="accept" data-id="${esc(r.id)}" ${S.busy === r.id ? 'disabled' : ''}>${icon('thumb', 'sm')}Acepto</button><button class="btn outline" data-act="offer" data-id="${esc(r.id)}">${icon('tag', 'sm')}Proponer precio</button>`}
    </div>
  </div>`;
}

function notApprovedView() {
  const p = S.provider;
  if (!p) {
    return `<div class="card" style="max-width:760px">
      <h3>${icon('store')}Registra tu negocio en ${BRAND}</h3>
      <p class="sub" style="font-size:14px;line-height:1.6">Cuéntanos quién eres, en qué zona trabajas y cómo entregas. El equipo de ${BRAND} revisa tu solicitud; en cuanto te aprueben podrás conectarte y recibir pedidos.</p>
      <button class="btn lg mt" data-page="negocio">${icon('store')}Registrar mi negocio</button>
    </div>`;
  }
  const st = PROVIDER_STATUS[p.status] || PROVIDER_STATUS.pending;
  return `<div class="card" style="max-width:760px">
    <div class="row between"><h3>${icon('shield')}${esc(p.businessName)}</h3><span class="badge ${st.tone}">${st.label}</span></div>
    <div class="notice ${st.tone}">${icon(st.tone === 'ok' ? 'check' : 'alert')}<div>${esc(st.text)}</div></div>
    ${p.reviewNote ? `<div class="notice info">${icon('info')}<div>Nota del equipo: ${esc(p.reviewNote)}</div></div>` : ''}
    ${p.status !== 'suspended' ? `<button class="btn outline" data-page="negocio">${icon('store')}${p.status === 'rejected' ? 'Corregir y reenviar' : 'Ver o editar mi negocio'}</button>` : ''}
  </div>`;
}

// ───────────── Mis pedidos ─────────────
function pedidosView() {
  if (!approved()) return notApprovedView();
  const tabs = { curso: (o) => ACTIVE.includes(o.status), aceptar: (o) => o.status === 'requested', historial: (o) => !ACTIVE.includes(o.status) };
  const list = S.orders.filter(tabs[S.orderTab]);
  const n = (k) => S.orders.filter(tabs[k]).length;
  return `<div class="card">
    <div class="tabs" style="max-width:520px">
      <button class="${S.orderTab === 'curso' ? 'on' : ''}" data-act="otab" data-tab="curso">En curso (${n('curso')})</button>
      <button class="${S.orderTab === 'aceptar' ? 'on' : ''}" data-act="otab" data-tab="aceptar">Por aceptar (${n('aceptar')})</button>
      <button class="${S.orderTab === 'historial' ? 'on' : ''}" data-act="otab" data-tab="historial">Historial (${n('historial')})</button>
    </div>
    ${list.length ? `<table class="table"><thead><tr><th>Cliente</th><th>Servicio</th><th>Colonia</th><th>Estado</th><th>Fecha</th><th></th></tr></thead><tbody>
      ${list.map((o) => `<tr class="click" data-act="order" data-id="${esc(o.id)}">
        <td><div class="strong">${esc(o.customerName || 'Cliente')}</div><div class="muted">${o.requestId ? 'Desde ofertas' : 'Reserva directa'}</div></td>
        <td><div>${esc(o.details)}</div>${typeof o.priceEstimate === 'number' ? `<div class="muted">${money(o.priceEstimate)} aprox.</div>` : ''}</td>
        <td>${esc(o.colonia)}</td><td>${pill(o.status)}</td><td class="muted">${timeAgo(o.createdAt)}</td>
        <td style="text-align:right">${icon('chev', 'sm')}</td></tr>`).join('')}
    </tbody></table>` : `<div class="empty"><div class="bubble">${icon('inbox', 'lg')}</div>${S.orderTab === 'historial' ? 'Aún no tienes pedidos terminados.' : 'No hay pedidos aquí. Conéctate en Inicio para recibir solicitudes.'}</div>`}
  </div>`;
}
const pill = (st) => { const o = ORDER[st] || { label: st, color: '#5B6B82', bg: '#EEF1F5', icon: 'info' }; return `<span class="pill" style="color:${o.color};background:${o.bg}">${icon(o.icon, 'sm')}${esc(o.label)}</span>`; };

function orderDrawer(id) {
  const o = S.orders.find((x) => x.id === id);
  if (!o) { toast('Ese pedido ya no está disponible.', true); return; }
  S.drawer = id;
  const draft = document.getElementById('chat-input')?.value || '';
  const chatOn = chatIsOpen(o);
  if (chatOn) startChat(id); else if (S.chat.orderId) stopChat();
  const idx = STEPS.indexOf(o.status);
  const next = NEXT[o.status] || [];
  $modal.innerHTML = `<div class="drawer-bg" data-act="close"></div><aside class="drawer" role="dialog" aria-modal="true">
    <button class="btn sm ghost close" data-act="close" aria-label="Cerrar">${icon('x', 'sm')}</button>
    <div class="muted" style="font-size:12px;font-weight:700">PEDIDO · ${timeAgo(o.createdAt)}</div>
    <h3 style="font-size:22px;margin:6px 0 8px;font-weight:800">${esc(o.customerName || 'Cliente')}</h3>
    ${pill(o.status)} <span class="badge" title="Escríbelo en la bolsa">Bolsa ${esc(bagCode(o.id))}</span>
    ${idx >= 0 ? `<div class="steps">${STEPS.map((k, i) => `<div class="st ${i <= idx ? 'done' : ''} ${i === idx ? 'now' : ''}"><div class="b">${icon(ORDER[k].icon, 'sm')}</div>${ORDER[k].label}</div>`).join('')}</div>` : ''}
    <div class="kv">
      ${icon('hanger')}<div><b>${esc(o.details)}</b>${typeof o.priceEstimate === 'number' ? `<small>Precio estimado: ${money(o.priceEstimate)} · se paga directo</small>` : ''}</div>
      ${typeof o.finalPrice === 'number' ? `${icon('money')}<div><b>Servicio: ${money2(o.finalPrice)}${typeof o.serviceFee === 'number' && o.serviceFee > 0 ? ` + cuota ${money2(o.serviceFee)}` : ''}</b><small>Comisión ${BRAND} (${commissionLabel(o.commissionPct ?? DEFAULT_COMMISSION_PCT, o.commissionIvaPct)}): ${money2(commissionOf(o))}</small></div>` : ''}
      ${icon(MODES[o.fulfillmentMode]?.icon || 'car')}<div>${esc(MODES[o.fulfillmentMode]?.client || '')}<small>${esc(o.whenText || '')}</small></div>
      ${o.agreedPickup || o.agreedReady ? `${icon('clock')}<div>${o.agreedPickup ? `Recoge / recibe: ${esc(o.agreedPickup)}` : ''}${o.agreedReady ? `<small>Listo: ${esc(o.agreedReady)}</small>` : ''}</div>` : ''}
      ${icon('pin')}<div>${esc(o.colonia)}${o.address ? `<small>${esc(o.address)}</small>` : ''}</div>
      ${icon('phone')}<div>${o.customerPhone ? `<a href="tel:${esc(o.customerPhone)}" style="color:var(--blue);font-weight:700">${esc(o.customerPhone)}</a>` : '<span class="muted">El cliente no compartió teléfono.</span>'}</div>
    </div>
    ${['in_progress', 'ready', 'delivered'].includes(o.status) ? payBox(o) : ''}
    ${o.transferRef || o.receiptPath ? `<div class="card" style="padding:14px;margin-top:10px"><b>${icon('checks', 'sm')} Comprobante del cliente</b>
      ${o.transferRef ? `<div class="mt" style="font-family:monospace;font-size:14px">Clave de rastreo: <b>${esc(o.transferRef)}</b></div>` : ''}
      ${o.receiptPath ? `<a id="rcpt-link" target="_blank" rel="noopener" style="display:block;margin-top:8px"><img id="rcpt-img" alt="Comprobante de transferencia" style="width:100%;max-height:320px;object-fit:contain;border-radius:12px;background:#EEF1F5" /></a>` : ''}
      <div class="muted" style="font-size:12px;margin-top:6px">Verifícalo en <a href="https://www.banxico.org.mx/cep/" target="_blank" rel="noopener">banxico.org.mx/cep</a> con la clave de rastreo, la fecha y el monto.</div></div>` : ''}
    ${EVIDENCE.some(([k]) => o[k]) || o.deliveryVerified ? `<div class="card" style="padding:14px;margin-top:10px"><b>${icon('checks', 'sm')} Evidencia de la bolsa ${esc(bagCode(o.id))}</b>
      ${o.deliveryVerified === 'pin' ? '<div class="mt"><span class="badge ok">Entregado con PIN</span></div>' : o.deliveryVerified === 'photo' ? '<div class="mt"><span class="badge warn">Entregado con foto (en revisión)</span></div>' : ''}
      <div class="row mt" style="gap:10px;flex-wrap:wrap">${EVIDENCE.filter(([k]) => o[k]).map(([k, label]) => `<a id="ev-a-${k}" target="_blank" rel="noopener" style="text-align:center;font-size:12px" class="muted"><img id="ev-${k}" alt="Foto: ${label}" style="width:96px;height:96px;object-fit:cover;border-radius:12px;background:#EEF1F5;display:block" />${label}</a>`).join('')}</div>
      <div class="muted" style="font-size:11px;margin-top:6px">Fotos de la bolsa cerrada. Se borran solas a los 90 días.</div></div>` : ''}
    ${o.cancelReason ? `<div class="notice warn">${icon('info')}<div>Motivo: ${esc(o.cancelReason)}</div></div>` : ''}
    ${chatOn ? `<div class="card chat" style="padding:12px;margin-top:10px"><b>${icon('send', 'sm')} Mensajes con el cliente</b>
      <div id="chat-list" class="chat-list">${chatHtml()}</div>
      <form data-form="chat" data-id="${esc(id)}" class="chat-form"><input id="chat-input" name="text" maxlength="1000" autocomplete="off" placeholder="Escribe un mensaje…" /><button class="btn sm">${icon('send', 'sm')}</button></form>
      <div class="muted" style="font-size:11px;margin-top:6px">Chat de este pedido. El equipo de ${BRAND} puede revisarlo por seguridad.</div></div>` : ''}
    <div class="stack mt">${next.map((to) => `<button class="btn ${ACTION[to].cls} block" data-act="status" data-id="${esc(o.id)}" data-to="${to}">${icon(ACTION[to].icon, 'sm')}${to === 'delivered' && !S.cfg.serverOn ? 'Marcar como entregado' : ACTION[to].label}</button>`).join('') || '<div class="muted" style="text-align:center">No hay acciones pendientes en este pedido.</div>'}</div>
    <p class="muted" style="font-size:12px;margin-top:18px">En efectivo o por transferencia a tu cuenta, tú cobras el servicio y la cuota; la comisión y la cuota se descuentan de tu saldo con ${BRAND}.</p>
  </aside>`;
  if (chatOn) {
    const inp = document.getElementById('chat-input'); if (inp && draft) inp.value = draft;
    const box = document.getElementById('chat-list'); if (box) box.scrollTop = box.scrollHeight;
  }
  EVIDENCE.filter(([k]) => o[k]).forEach(([k]) => {
    getDownloadURL(storageRef(storage, o[k])).then((url) => {
      const img = document.getElementById(`ev-${k}`); const a = document.getElementById(`ev-a-${k}`);
      if (img) img.src = url; if (a) a.href = url;
    }).catch(() => {});
  });
  if (o.receiptPath) {
    getDownloadURL(storageRef(storage, o.receiptPath)).then((url) => {
      const img = document.getElementById('rcpt-img'); const a = document.getElementById('rcpt-link');
      if (img) img.src = url; if (a) a.href = url;
    }).catch(() => { const img = document.getElementById('rcpt-img'); if (img) img.alt = 'No se pudo cargar el comprobante'; });
  }
}

function payBox(o) {
  const st = o.paymentStatus || 'pending'; const p = PAY[st] || PAY.pending;
  const open = ['in_progress', 'ready'].includes(o.status);
  const editable = open && !['paid', 'review', 'transfer_ok'].includes(st);
  const fee = S.cfg.serviceFee; const withFee = typeof o.amountDue === 'number' ? money2(o.amountDue + fee) : '';
  const acct = o.transferInfo?.account ? ` …${String(o.transferInfo.account).slice(-4)}` : '';
  const hint = { pending: `Esperando a que el cliente elija cómo pagar. Total para el cliente: ${withFee} (incluye cuota de servicio ${money2(fee)}).`,
    transfer: `${o.transferReportedAt ? 'El cliente reportó que ya te transfirió' : 'El cliente va a transferirte'} ${withFee} a tu cuenta${acct}. Revisa tu banco y confírmalo cuando te llegue.`,
    transfer_ok: 'Transferencia recibida. La comisión y la cuota se descuentan de tu saldo.', cash: `Cóbrale ${withFee} en efectivo al entregar (servicio + cuota de servicio ${money2(fee)}). La comisión y la cuota se descuentan de tu depósito.`, paid: `Pagado con tarjeta. ${BRAND} te lo deposita el martes en tu corte, sin la comisión.`, review: `El equipo de ${BRAND} está revisando este pago.`, refunded: 'Este pago se reembolsó al cliente.' }[st] || '';
  return `<div class="notice ${p.cls}">${icon('money')}<div><b>${typeof o.amountDue === 'number' ? money2(o.amountDue) : 'Falta anotar el total'} · ${esc(p.label)}</b><br>${esc(typeof o.amountDue === 'number' ? hint : 'Anótalo para que el cliente pueda pagar.')}
    ${st === 'transfer' ? `<div style="margin-top:8px"><button class="btn sm ok" data-act="transferok" data-id="${esc(o.id)}">${icon('checks', 'sm')}Recibí la transferencia</button></div>` : ''}
    ${editable ? `<div style="margin-top:8px"><button class="btn sm outline" data-act="amount" data-id="${esc(o.id)}">${typeof o.amountDue === 'number' ? 'Corregir total' : 'Anotar total'}</button></div>` : ''}</div></div>`;
}
async function editAmount(id) {
  const o = S.orders.find((x) => x.id === id); if (!o) return;
  const needPhoto = S.cfg.serverOn && !o.weightPhotoPath; // pedidos anteriores: se pide la foto de la báscula
  const r = await priceModal({ title: 'Total a pagar', text: 'El cliente verá el nuevo total. Solo se puede cambiar mientras no haya pagado con tarjeta.', label: 'Total (pesos)', ok: 'Guardar total', value: typeof o.amountDue === 'number' ? String(o.amountDue) : '',
    photos: needPhoto ? [{ name: 'weight', label: `Foto de la bolsa ${bagCode(o.id)} en la báscula (obligatoria)`, required: true }] : null });
  if (r !== null) {
    const v = needPhoto ? r.v : r;
    const upd = { amountDue: v, updatedAt: serverTimestamp() }; const ti = transferInfoFrom(S.payInfo); if (ti) upd.transferInfo = ti;
    try {
      if (needPhoto) upd.weightPhotoPath = await uploadEvidence(id, 'weight', r.files.weight);
      await updateDoc(doc(db, 'orders', id), upd); toast('Total actualizado ✓');
    } catch (e) { toast(friendly(e), true); }
  }
  orderDrawer(id);
}

// ───────────── Calificaciones ─────────────
function calificacionesView() {
  if (!approved()) return notApprovedView();
  const r = rating();
  if (!r) return `<div class="card"><div class="empty"><div class="bubble">${icon('star', 'lg')}</div>Aún no tienes calificaciones. Cuando un cliente califique un pedido entregado, aparecerá aquí.</div></div>`;
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: r.list.filter((x) => x.stars === n).length }));
  return `<div class="grid2">
    <div class="card"><h3>${icon('list')}Lo que dicen tus clientes</h3>
      <div class="mt">${r.list.map((v) => `<div class="review">${starsHtml(v.stars)}<div class="who">${esc(v.customerName || 'Cliente')} · ${timeAgo(v.createdAt)}</div>${v.comment ? `<p>“${esc(v.comment)}”</p>` : ''}</div>`).join('')}</div>
    </div>
    <div class="card"><h3>${icon('star')}Tu calificación</h3>
      <div class="big-rating mt"><div><div class="n">${r.avg.toFixed(1)}</div>${starsHtml(Math.floor(r.avg))}<div class="muted" style="font-size:12px;margin-top:4px">${r.count} ${r.count === 1 ? 'reseña' : 'reseñas'}</div></div>
        <div class="bars">${dist.map((d) => `<div class="bar"><span>${d.n}★</span><div class="track"><div class="fill" style="width:${(d.c / r.count) * 100}%"></div></div><span>${d.c}</span></div>`).join('')}</div></div>
      ${S.reviews.some((x) => x.hidden) ? `<div class="notice warn">${icon('info')}<div>El equipo de ${BRAND} ocultó alguna reseña por no cumplir las reglas; no cuenta en tu promedio.</div></div>` : ''}
    </div>
  </div>`;
}

// ───────────── Comisiones ─────────────
// Corte: sábado 00:00 → viernes 23:59; depósito el martes siguiente.
function weekStart() { const d = new Date(); const back = (d.getDay() + 1) % 7; return new Date(d.getFullYear(), d.getMonth(), d.getDate() - back).getTime(); }
const fmtDay = (ms) => new Date(ms).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
// Neto para el socio: tarjeta → BÜBÜ le debe (total − comisión); efectivo → el socio debe la comisión + la cuota que cobró.
const netForProvider = (o) => (o.status === 'delivered' && typeof o.finalPrice === 'number'
  ? round2(paidByCard(o) ? o.finalPrice - commissionOf(o) : -commissionOf(o) - (typeof o.serviceFee === 'number' ? o.serviceFee : 0)) : 0);
function commissionSummary() {
  const delivered = S.orders.filter((o) => o.status === 'delivered' && typeof o.finalPrice === 'number');
  const when = (o) => toMillis(o.statusChangedAt || o.updatedAt);
  const d = new Date(); const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime(); const wk = weekStart();
  const month = delivered.filter((o) => when(o) >= monthStart); const week = delivered.filter((o) => when(o) >= wk);
  const sum = (l, f) => round2(l.reduce((a, x) => a + f(x), 0)); const amt = (p) => (typeof p.amount === 'number' ? p.amount : 0);
  const owed = sum(delivered, commissionOf); const paid = sum(S.payments, amt); const received = sum(S.payouts, amt);
  return {
    monthCount: month.length, monthSales: sum(month, (o) => o.finalPrice), monthCommission: sum(month, commissionOf),
    weekCard: sum(week.filter(paidByCard), (o) => o.finalPrice), weekCash: sum(week.filter((o) => !paidByCard(o)), (o) => o.finalPrice),
    weekCommission: sum(week, commissionOf), weekNet: sum(week, netForProvider),
    owed, paid, received, balance: round2(sum(delivered, netForProvider) - received + paid), recent: [...delivered].sort((a, b) => when(b) - when(a)).slice(0, 30),
  };
}
function comisionesView() {
  if (!approved()) return notApprovedView();
  const c = commissionSummary();
  const month = new Date().toLocaleDateString('es-MX', { month: 'long' });
  const label = c.balance > 0 ? `${BRAND} te va a depositar` : c.balance < 0 ? `Le debes a ${BRAND}` : 'Estás al corriente';
  const moves = [...S.payouts.map((p) => ({ ...p, label: `${BRAND} te depositó` })), ...S.payments.map((p) => ({ ...p, label: `Pagaste a ${BRAND}` }))]
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
  return `<div class="kpis">
      ${kpi('money', money2(Math.abs(c.balance)), label, c.balance < 0 ? 'gold' : 'ok')}
      ${kpi('chart', money2(c.weekCard), 'Corte actual: con tarjeta', 'turq')}
      ${kpi('store', money2(c.weekCash), 'Corte actual: en efectivo', '')}
      ${kpi('tag', money2(c.weekCommission), 'Comisión del corte (con IVA)', '')}
    </div>
    ${S.debtBlock ? `<div class="notice err">${icon('alert')}<div><b>Cuenta pausada por adeudo: ${money2(S.debtBlock.debt)}</b> (límite ${money2(S.debtBlock.debtLimit)}). No te llegan pedidos nuevos hasta que lo pagues al equipo de ${BRAND}; en cuanto lo registren se desbloquea solo.</div></div>` : ''}
    <div class="notice ${c.weekNet >= 0 ? 'ok' : 'warn'}">${icon('info')}<div>Corte actual (${esc(fmtDay(weekStart()))} → ${esc(fmtDay(weekStart() + 6 * 86400000))}, depósito el ${esc(fmtDay(weekStart() + 10 * 86400000))}): ${c.weekNet >= 0 ? `${BRAND} te deposita <b>${money2(c.weekNet)}</b>` : `debes <b>${money2(-c.weekNet)}</b>`}. Con tarjeta, ${BRAND} cobra y te deposita tu parte sin la comisión; en efectivo, la comisión y la cuota de servicio se descuentan de tu depósito. En ${esc(month)}: ${c.monthCount} entregados, comisión ${money2(c.monthCommission)}.</div></div>
    <div class="grid2 mt">
      <div class="card"><h3>${icon('list')}Pedidos entregados</h3>
        ${c.recent.length ? `<table class="table"><thead><tr><th>Cliente</th><th>Cobrado</th><th>Pago</th><th>Comisión</th><th>Fecha</th></tr></thead><tbody>
          ${c.recent.map((o) => `<tr class="click" data-act="order" data-id="${esc(o.id)}"><td><div class="strong">${esc(o.customerName || 'Cliente')}</div><div class="muted">${esc(o.colonia || '')}</div></td>
            <td>${money2(o.finalPrice)}</td><td>${paidByCard(o) ? 'Tarjeta' : 'Efectivo'}</td><td class="strong">${money2(commissionOf(o))}</td><td class="muted">${timeAgo(o.statusChangedAt || o.updatedAt)}</td></tr>`).join('')}
        </tbody></table>` : `<div class="empty"><div class="bubble">${icon('money', 'lg')}</div>Cuando entregues un pedido y anotes el total cobrado, aparecerá aquí.</div>`}
      </div>
      <div class="card"><h3>${icon('checks')}Depósitos y pagos</h3>
        ${moves.length ? moves.map((p) => `<div class="review"><b>${esc(p.label)}: ${money2(p.amount)}</b><div class="who">${esc([p.method, p.period].filter(Boolean).join(' · '))}${p.method || p.period ? ' · ' : ''}${timeAgo(p.createdAt)}</div>${p.note ? `<p>${esc(p.note)}</p>` : ''}</div>`).join('') : '<p class="muted">Todavía no hay movimientos.</p>'}
        <div class="notice info mt">${icon('info')}<div>Comisión: <b>${commissionLabel(S.cfg.pct, S.cfg.ivaPct)}</b> por pedido entregado. Cuota de servicio al cliente: <b>${money2(S.cfg.serviceFee)}</b>. Corte los viernes 23:59, depósito los martes. Si tu adeudo pasa de ${money2(S.cfg.debtLimit)}, se pausan tus pedidos hasta que pagues.</div></div>
        <p class="muted" style="font-size:12px">Comisiones totales: ${money2(c.owed)} · ${BRAND} te ha depositado: ${money2(c.received)} · Tú has pagado: ${money2(c.paid)}</p>
      </div>
    </div>`;
}

// ───────────── Mi negocio ─────────────
function negocioView() {
  const p = S.provider;
  if (!S.bizForm) {
    S.bizForm = {
      providerType: p?.providerType || 'business', businessName: p?.businessName || '', description: p?.description || '',
      categoryIds: [...(p?.categoryIds || [])], zoneIds: [...(p?.zoneIds || [])], fulfillmentModes: [...(p?.fulfillmentModes || [])],
    };
  }
  const f = S.bizForm;
  const st = p ? PROVIDER_STATUS[p.status] || PROVIDER_STATUS.pending : null;
  const cats = S.categories.filter((c) => c.active || f.categoryIds.includes(c.id));
  const zones = S.zones.filter((z) => z.active || f.zoneIds.includes(z.id));
  const locked = p?.status === 'suspended';
  const chip = (group, val, label) => `<button type="button" class="chip ${f[group].includes(val) ? 'on' : ''}" data-act="bizchip" data-group="${group}" data-val="${esc(val)}" ${locked ? 'disabled' : ''}>${f[group].includes(val) ? icon('check', 'sm') : ''}${esc(label)}</button>`;
  return `<div class="grid2">
    <form class="card" data-form="biz">
      <h3>${icon('store')}${p ? 'Datos de tu negocio' : 'Registra tu negocio'}</h3>
      <div class="sub">${p ? 'Lo que ven los clientes en tus ofertas.' : `El equipo de ${BRAND} revisará tu solicitud.`}</div>
      <label class="f">¿Cómo trabajas?</label>
      <div class="chips">
        <button type="button" class="chip ${f.providerType === 'business' ? 'on' : ''}" data-act="biztype" data-val="business" ${locked ? 'disabled' : ''}>${icon('store', 'sm')}Negocio establecido</button>
        <button type="button" class="chip ${f.providerType === 'home' ? 'on' : ''}" data-act="biztype" data-val="home" ${locked ? 'disabled' : ''}>${icon('home', 'sm')}Trabajo desde casa</button>
      </div>
      <label class="f" for="b-name">Nombre del negocio</label>
      <div class="field">${icon('store')}<input id="b-name" data-biz="businessName" maxlength="80" value="${esc(f.businessName)}" ${locked ? 'disabled' : ''} /></div>
      <label class="f" for="b-desc">Descripción (opcional)</label>
      <div class="field"><textarea id="b-desc" data-biz="description" maxlength="500" placeholder="Ej. Lavado, secado y doblado. Entrego en 24 horas." ${locked ? 'disabled' : ''}>${esc(f.description)}</textarea></div>
      <label class="f">Servicios</label><div class="chips">${cats.map((c) => chip('categoryIds', c.id, c.name)).join('') || '<span class="muted">Cargando…</span>'}</div>
      <label class="f">Zona</label><div class="chips">${zones.map((z) => chip('zoneIds', z.id, z.name)).join('') || '<span class="muted">Cargando…</span>'}</div>
      <label class="f">¿Cómo entregas?</label><div class="chips">${Object.entries(MODES).map(([k, m]) => chip('fulfillmentModes', k, m.provider)).join('')}</div>
      ${locked ? '' : `<button class="btn lg mt" ${S.busy === 'biz' ? 'disabled' : ''}>${S.busy === 'biz' ? 'Guardando…' : p ? (p.status === 'rejected' ? 'Corregir y reenviar' : 'Guardar cambios') : 'Enviar solicitud'}</button>`}
    </form>
    <div class="stack">
      ${st ? `<div class="card"><div class="row between"><h3>${icon('shield')}Estado</h3><span class="badge ${st.tone}">${st.label}</span></div>
        <div class="notice ${st.tone}">${icon(st.tone === 'ok' ? 'check' : 'alert')}<div>${esc(st.text)}</div></div>
        ${p.reviewNote ? `<div class="notice info">${icon('info')}<div>Nota del equipo: ${esc(p.reviewNote)}</div></div>` : ''}</div>` : ''}
      ${p && p.status === 'approved' ? areaCard() : ''}
      ${p && p.status === 'approved' ? `<form class="card" data-form="payinfo"><h3>${icon('money')}Cuenta para transferencias</h3>
        <p class="muted" style="font-size:14px;line-height:1.6">Tus clientes te podrán pagar por transferencia <b>directo a tu cuenta</b>; ${BRAND} no recibe ese dinero. La comisión y la cuota se suman a tu saldo, igual que en efectivo.</p>
        <label class="f" for="pi-holder">Nombre del titular</label><div class="field">${icon('user')}<input id="pi-holder" name="holder" maxlength="80" value="${esc(S.payInfo?.holder || '')}" required /></div>
        <label class="f" for="pi-bank">Banco o app (opcional)</label><div class="field">${icon('store')}<input id="pi-bank" name="bank" maxlength="40" placeholder="Ej. BBVA, Mercado Pago" value="${esc(S.payInfo?.bank || '')}" /></div>
        <label class="f" for="pi-account">CLABE, tarjeta o número de cuenta</label><div class="field">${icon('money')}<input id="pi-account" name="account" maxlength="40" inputmode="numeric" placeholder="18 dígitos de tu CLABE" value="${esc(S.payInfo?.account || '')}" required /></div>
        <label class="f" for="pi-note">Nota para el cliente (opcional)</label><div class="field">${icon('info')}<input id="pi-note" name="note" maxlength="100" placeholder="Ej. Pon tu nombre en el concepto" value="${esc(S.payInfo?.note || '')}" /></div>
        <div class="row mt" style="gap:8px"><button class="btn">${icon('check', 'sm')}Guardar cuenta</button>${S.payInfo ? `<button type="button" class="btn ghost" data-act="payinfo-del">Quitar</button>` : ''}</div>
        <div class="hint">Solo tú y el equipo de ${BRAND} la ven aquí; cada cliente la ve solo dentro de su pedido.</div>
      </form>` : ''}
      <div class="card"><h3>${icon('user')}Tu cuenta</h3>
        <div class="kv">${icon('user')}<div>${esc(S.profile?.displayName || '')}</div>${icon('mail')}<div>${esc(S.user?.email)}</div>${icon('phone')}<div>${esc(S.profile?.phone || 'Sin teléfono')}<small>Se comparte con el cliente cuando aceptas su pedido.</small></div></div>
      </div>
    </div>
  </div>`;
}

function ayudaView() {
  const item = (ic, t, d) => `<div class="row" style="align-items:flex-start;gap:14px;margin-top:16px"><div class="kpi" style="padding:0;border:0;box-shadow:none"><div class="ic">${icon(ic)}</div></div><div><b>${t}</b><div class="muted" style="font-size:14px;line-height:1.6;margin-top:4px">${d}</div></div></div>`;
  return `<div class="grid2"><div class="card"><h3>${icon('help')}Cómo funciona ${BRAND} Socios</h3>
    ${item('store', '1. Registra tu negocio', 'En "Mi negocio" llena tus datos. El equipo revisa y aprueba tu solicitud.')}
    ${item('power', '2. Conéctate', 'Presiona "Conectarme". Los clientes te ven como conectado y te llegan sus pedidos. Mantén esta pestaña abierta.')}
    ${item('bell', '3. Recibe solicitudes', 'Suena un aviso y aparece una tarjeta con lo que necesita el cliente, su colonia y su horario.')}
    ${item('tag', '4. Manda tu oferta', '"Acepto" toma el pedido en el horario del cliente. "Proponer precio" te deja poner precio y tiempos.')}
    ${item('list', '5. Atiende el pedido', 'Si te eligen, verás dirección y teléfono. Avanza: Recibí la ropa → Listo → Entregado.')}
    ${item('star', '6. Gana estrellas', 'El cliente califica cuando el pedido está entregado. Tus estrellas aparecen en tus ofertas.')}
  </div>
  <div class="stack"><div class="card"><h3>${icon('sound')}Avisos en la computadora</h3>
    <p class="muted" style="font-size:14px;line-height:1.6">Los avisos funcionan con esta página abierta (puede estar en otra pestaña). Si el navegador lo pide, permite las notificaciones. Si cierras la página, dejarás de recibir pedidos y en unos minutos aparecerás como no conectado.</p>
    <button class="btn soft" data-act="testsound">${icon('sound', 'sm')}Probar sonido</button></div>
    <div class="card"><h3>${icon('money')}Pagos</h3><p class="muted" style="font-size:14px;line-height:1.6">${BRAND} no cobra dentro de la plataforma. El precio de tu oferta es un estimado y el pago se acuerda directo con el cliente.</p></div>
  </div></div>`;
}

// ───────────── Pedido entrante y "¡Te eligieron!" ─────────────
function renderIncoming() {
  const r = S.phase === 'ready' ? incomingRequest() : null;
  if (!r) { $incoming.innerHTML = ''; S.lastIncoming = ''; return; }
  if (r.id !== S.lastIncoming) {
    S.lastIncoming = r.id;
    chime(3); flashTitle('🔔 Nuevo pedido'); notify('Nuevo pedido en BÜBÜ', `${summary(r)} · ${r.colonia}`);
  }
  if ($incoming.dataset.id === r.id && $incoming.innerHTML) { // solo actualizar el contador
    const c = $incoming.querySelector('[data-exp] span'); if (c) c.textContent = countdown(r.expiresAt); return;
  }
  $incoming.dataset.id = r.id;
  $incoming.innerHTML = `<div class="incoming" role="alertdialog" aria-label="Nuevo pedido">
    <div class="bar-top"><span class="row" style="gap:8px">${icon('bell', 'sm')}NUEVO PEDIDO</span><span class="row" data-exp="${toMillis(r.expiresAt)}" style="gap:6px">${icon('clock', 'sm')}<span>${countdown(r.expiresAt)}</span></span></div>
    <div class="body">
      <div class="t">${esc(summary(r))}</div>
      <div class="meta"><span>${icon('pin', 'sm')}${esc(r.colonia)}</span><span>${icon(MODES[r.fulfillmentMode]?.icon || 'car', 'sm')}${esc(MODES[r.fulfillmentMode]?.client || '')}</span><span>${icon('calendar', 'sm')}${esc(r.whenText || 'Lo antes posible')}</span></div>
      <div class="muted" style="font-size:12px;margin-top:10px">Los datos del cliente se comparten solo si te elige.</div>
      <div class="acts">
        <button class="btn lg" data-act="accept" data-id="${esc(r.id)}">${icon('thumb')}Acepto · ${esc(r.whenText || 'su horario')}</button>
        <div class="row" style="gap:8px"><button class="btn outline" style="flex:1" data-act="offer" data-id="${esc(r.id)}">${icon('tag', 'sm')}Proponer precio</button><button class="btn ghost" style="flex:1" data-act="dismiss" data-id="${esc(r.id)}">Ahora no</button></div>
      </div>
    </div>
  </div>`;
}

function renderCelebration() {
  if (S.phase !== 'ready' || $modal.innerHTML) return;
  const w = approved() ? chosenToCelebrate() : null;
  if (!w) return;
  chime(2); flashTitle('🎉 ¡Te eligieron!'); notify('¡Te eligieron!', `${summary(w)} · ${w.colonia}`);
  $modal.innerHTML = `<div class="overlay"><div class="modal" style="text-align:center;border:4px solid var(--ok)">
    <div style="width:84px;height:84px;border-radius:50%;background:var(--ok);color:#fff;display:grid;place-items:center;margin:0 auto">${icon('trophy', 'xl')}</div>
    <h3 style="font-size:28px;margin-top:14px;color:var(--ok-text)">¡Te eligieron!</h3>
    <p style="font-size:16px;margin:8px 0 2px"><b>${esc(summary(w))}</b></p><p class="muted">${esc(w.colonia)}${w.whenText ? ` · ${esc(w.whenText)}` : ''}</p>
    <div class="foot" style="justify-content:center"><button class="btn ghost" data-act="celebrated" data-id="${esc(w.id)}">Después</button><button class="btn lg" data-act="celebrated" data-id="${esc(w.id)}" data-order="${esc(w.orderId || '')}">Ver pedido y datos del cliente</button></div>
  </div></div>`;
}

function offerModal(id) {
  const r = S.requests.find((x) => x.id === id);
  if (!r) return;
  const o = S.myOffers[id];
  $modal.innerHTML = `<div class="overlay" data-act="overlay"><form class="modal" data-form="offer" data-id="${esc(id)}">
    <h3>${o ? 'Editar mi oferta' : 'Proponer precio y horario'}</h3>
    <div class="muted" style="margin-top:6px">${esc(summary(r))} · ${esc(r.colonia)} · ${esc(r.whenText || '')}</div>
    <label class="f" for="o-price">Precio estimado (MXN, opcional)</label>
    <div class="field">${icon('money')}<input id="o-price" name="price" inputmode="numeric" maxlength="7" placeholder="Ej. 120" value="${typeof o?.priceFrom === 'number' ? o.priceFrom : ''}" /></div>
    <div class="hint">Es una referencia; el pago se acuerda directo con el cliente.</div>
    <label class="f">${r.fulfillmentMode === 'pickup_delivery' ? '¿Cuándo pasas por la ropa?' : '¿Cuándo puede llevarla?'}</label>
    <div class="field"><select name="pickupText">${PICKUP_OPTIONS.map((p) => `<option ${(o?.pickupText || PICKUP_OPTIONS[1]) === p ? 'selected' : ''}>${p}</option>`).join('')}</select></div>
    <label class="f">¿Cuándo estará lista?</label>
    <div class="field"><select name="readyText">${READY_OPTIONS.map((p) => `<option ${(o?.readyText || READY_OPTIONS[1]) === p ? 'selected' : ''}>${p}</option>`).join('')}</select></div>
    <label class="f" for="o-msg">Mensaje para el cliente (opcional)</label>
    <div class="field"><textarea id="o-msg" name="message" maxlength="500" placeholder="Ej. Uso suavizante hipoalergénico.">${esc(o?.message || '')}</textarea></div>
    <label class="f" for="o-phone">Tu teléfono (opcional)</label>
    <div class="field">${icon('phone')}<input id="o-phone" name="providerPhone" maxlength="20" value="${esc(o?.providerPhone ?? S.profile?.phone ?? '')}" /></div>
    <div class="hint">El cliente lo verá junto con tu oferta.</div>
    <div class="foot"><button type="button" class="btn ghost" data-act="close">Cancelar</button><button class="btn">${o ? 'Guardar cambios' : 'Enviar oferta'}</button></div>
  </form></div>`;
}

function confirmModal({ title, text, ok, danger, withReason }) {
  return new Promise((resolve) => {
    $modal.innerHTML = `<div class="overlay"><form class="modal" data-form="confirm">
      <h3>${esc(title)}</h3><p class="muted" style="line-height:1.6">${esc(text)}</p>
      ${withReason ? `<label class="f" for="c-reason">Motivo (lo verá el cliente)</label><div class="field"><textarea id="c-reason" name="reason" maxlength="300"></textarea></div>` : ''}
      <div class="foot"><button type="button" class="btn ghost" data-act="cancel-confirm">Volver</button><button class="btn ${danger ? 'danger' : ''}">${esc(ok)}</button></div>
    </form></div>`;
    confirmResolver = (v) => { confirmResolver = null; $modal.innerHTML = ''; resolve(v); };
  });
}
let confirmResolver = null;

// Al entregar: cuánto se cobró (para la comisión). Devuelve el número o null si se cancela.
function priceModal({ title = '¿Cuánto le cobraste al cliente?', text, label = 'Total cobrado (pesos)', ok = 'Marcar como entregado', value = '', photos = null } = {}) {
  return new Promise((resolve) => {
    const { pct, ivaPct, serviceFee } = S.cfg; const delivering = !text;
    $modal.innerHTML = `<div class="overlay"><form class="modal" data-form="price" ${photos ? `data-photos="${esc(photos.filter((x) => x.required).map((x) => x.name).join(','))}" data-allphotos="${esc(photos.map((x) => x.name).join(','))}"` : ''}>
      <h3>${esc(title)}</h3>
      <p class="muted" style="line-height:1.6">${esc(text || `Anota el total del servicio, sin la cuota de servicio: el cliente también lo ve en su pedido. Comisión de ${BRAND}: ${commissionLabel(pct, ivaPct)}.`)}</p>
      <label class="f" for="p-total">${esc(label)}</label>
      <div class="field">${icon('money')}<input id="p-total" name="total" inputmode="decimal" autocomplete="off" maxlength="9" placeholder="Ej. 150" value="${esc(value)}" required /></div>
      <div class="hint" id="p-fee"></div>
      ${photos ? `<div class="hint" style="margin-top:10px">Toma la foto de la bolsa CERRADA (no de la ropa). Escribe en la bolsa su código.</div>${photos.map((x) => photoInput(x.name, x.label)).join('')}` : ''}
      <div class="foot"><button type="button" class="btn ghost" data-act="cancel-confirm">Volver</button><button class="btn ok">${icon('checks', 'sm')}${esc(ok)}</button></div>
    </form></div>`;
    const input = document.getElementById('p-total'); const fee = document.getElementById('p-fee');
    const showFee = () => { const v = parseMoney(input.value); fee.textContent = v && delivering ? `Comisión ${BRAND}: ${money2(feeFor(v, pct, ivaPct))}${serviceFee ? ` + cuota de servicio que cobraste: ${money2(serviceFee)}` : ''}` : (v ? `El cliente pagará ${money2(v + serviceFee)} (incluye cuota de servicio ${money2(serviceFee)}).` : ''); };
    input.addEventListener('input', showFee); showFee();
    input.focus();
    confirmResolver = (v) => { confirmResolver = null; $modal.innerHTML = ''; resolve(v); };
  });
}
// Campo para tomar/elegir una foto (en el celular abre la cámara).
const photoInput = (name, label) => `<label class="f" for="ph-${name}">${esc(label)}</label>
  <div class="field">${icon('camera')}<input id="ph-${name}" name="${name}" type="file" accept="image/*" capture="environment" /></div>`;

// Sube una foto de evidencia y devuelve su ruta (evidence/{pedido}/{tipo}-{fecha}.jpg).
async function uploadEvidence(orderId, kind, file) {
  if (!file || !file.size) throw new Error('Falta la foto.');
  if (!/^image\/(jpeg|jpg|png|webp|heic|heif)$/.test(file.type)) throw new Error('La foto debe ser JPG, PNG, WEBP o HEIC.');
  if (file.size > 5 * 1024 * 1024) throw new Error('La foto pesa más de 5 MB. Tómala otra vez con menos resolución.');
  const ext = file.type.split('/')[1].replace('jpeg', 'jpg');
  const path = `evidence/${orderId}/${kind}-${Date.now()}.${ext}`;
  await uploadBytes(storageRef(storage, path), file, { contentType: file.type });
  return path;
}

// Entrega: con el PIN que dice el cliente (lo verifica el servidor) o, sin PIN, con foto (queda para revisión).
function deliverModal(o, mode, err) {
  return new Promise((resolve) => {
    const needTotal = typeof o.amountDue !== 'number';
    $modal.innerHTML = `<div class="overlay"><form class="modal" data-form="deliver" data-mode="${mode}">
      <h3>Entregar la bolsa ${esc(bagCode(o.id))}</h3>
      ${needTotal ? `<label class="f" for="d-total">Total cobrado (pesos, sin la cuota)</label><div class="field">${icon('money')}<input id="d-total" name="total" inputmode="decimal" autocomplete="off" maxlength="9" placeholder="Ej. 150" /></div>` : `<p class="muted">Total del servicio: <b>${money2(o.amountDue)}</b></p>`}
      ${mode === 'pin' ? `<p class="muted" style="line-height:1.6">Pídele al cliente su PIN de 4 números cuando tenga la ropa en la mano.</p>
        <label class="f" for="d-pin">PIN del cliente</label><div class="field">${icon('lock')}<input id="d-pin" name="pin" inputmode="numeric" autocomplete="off" maxlength="4" placeholder="0000" style="letter-spacing:6px;font-weight:800" /></div>
        <div style="text-align:center;margin-top:8px"><button type="button" class="linkbtn" data-act="deliver-mode" data-mode="photo">El cliente no tiene su PIN → entregar con foto</button></div>`
      : `<p class="muted" style="line-height:1.6">Toma una foto de la bolsa cerrada entregada (en la puerta o en manos del cliente, sin mostrar su cara). El pedido queda para revisión del equipo de ${BRAND}.</p>
        ${photoInput('photo', 'Foto de la entrega (obligatoria)')}
        ${err && err.includes('intentos') ? '' : `<div style="text-align:center;margin-top:8px"><button type="button" class="linkbtn" data-act="deliver-mode" data-mode="pin">Volver al PIN</button></div>`}`}
      ${err ? `<div class="notice err">${icon('info')}<div>${esc(err)}</div></div>` : ''}
      <div class="foot"><button type="button" class="btn ghost" data-act="cancel-confirm">Volver</button><button class="btn ok">${icon('checks', 'sm')}${mode === 'pin' ? 'Entregar con PIN' : 'Entregar con foto'}</button></div>
    </form></div>`;
    document.getElementById(mode === 'pin' ? 'd-pin' : (needTotal ? 'd-total' : 'ph-photo'))?.focus();
    confirmResolver = (v) => { confirmResolver = null; $modal.innerHTML = ''; resolve(v); };
  });
}
async function deliverFlow(o) {
  let mode = 'pin'; let err = ''; let total = '';
  for (;;) {
    const r = await deliverModal(o, mode, err);
    if (r === null) return;
    if (r.switch) { mode = r.switch; err = ''; continue; }
    const price = typeof o.amountDue === 'number' ? o.amountDue : parseMoney(r.total);
    if (!price) { err = 'Escribe cuánto le cobraste al cliente (por ejemplo 150).'; continue; }
    total = price;
    if (r.mode === 'pin') {
      if (!/^[0-9]{4}$/.test(r.pin || '')) { err = 'El PIN son 4 números. Pídeselo al cliente.'; continue; }
      try {
        const res = await httpsCallable(functions, 'entregarConPin')({ orderId: o.id, pin: r.pin, ...(typeof o.amountDue === 'number' ? {} : { finalPrice: total }) });
        if (res.data?.ok) { toast('Entregado con PIN ✓'); return; }
        const left = res.data?.attemptsLeft ?? 0;
        if (left > 0) err = `PIN incorrecto. Te quedan ${left} intentos.`;
        else { mode = 'photo'; err = 'PIN incorrecto. Se acabaron los intentos: entrega con foto.'; }
      } catch (e) {
        err = friendly(e);
        if (/failed-precondition|resource-exhausted/.test(e?.code || '')) mode = 'photo';
      }
      continue;
    }
    if (!r.file || !r.file.size) { err = 'Toma la foto de la bolsa entregada.'; continue; }
    try {
      const path = await uploadEvidence(o.id, 'delivery', r.file);
      const data = { status: 'delivered', statusChangedAt: serverTimestamp(), updatedAt: serverTimestamp(), finalPrice: total, commissionPct: S.cfg.pct, commissionIvaPct: S.cfg.ivaPct, deliveredBy: 'provider', deliveryVerified: 'photo', deliveryPhotoPath: path };
      if (!paidByCard(o)) data.serviceFee = S.cfg.serviceFee;
      await updateDoc(doc(db, 'orders', o.id), data);
      toast('Entregado con foto ✓ (queda para revisión)'); return;
    } catch (e) { err = friendly(e); }
  }
}

function parseMoney(t) { const v = Number(String(t || '').replace(/[$,\s]/g, '')); return Number.isFinite(v) && v > 0 && v <= 100000 ? round2(v) : 0; }

// ───────────── Acciones con Firebase (mismos datos que la app) ─────────────
function offerData(r, f, kind) {
  const price = Number(String(f.price || '').replace(/[^0-9.]/g, ''));
  const data = {
    providerId: S.user.uid, providerName: clamp(S.provider.businessName, 80), kind,
    ...(S.provider.providerType ? { providerType: S.provider.providerType } : {}),
    message: clamp(f.message, 500), pickupText: clamp(f.pickupText, 60), readyText: clamp(f.readyText, 60),
    providerPhone: normalizePhone(f.providerPhone), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  };
  if (f.price && !Number.isNaN(price)) data.priceFrom = Math.min(price, 100000);
  return data;
}
async function quickAccept(id) {
  const r = S.requests.find((x) => x.id === id); if (!r) return;
  S.busy = id; render();
  try {
    await setDoc(doc(db, 'requests', id, 'offers', S.user.uid), offerData(r, {
      pickupText: r.whenText || 'En el horario que pediste', readyText: '', message: 'Acepto tu pedido en el horario que pediste.', providerPhone: S.profile?.phone || '',
    }, 'accept'));
    const s = await getDoc(doc(db, 'requests', id, 'offers', S.user.uid));
    if (s.exists()) S.myOffers[id] = { id: s.id, ...s.data() };
    toast('Oferta enviada. El cliente está eligiendo…');
  } catch (e) { toast(friendly(e), true); }
  S.busy = ''; render();
}
async function saveOffer(id, f) {
  const r = S.requests.find((x) => x.id === id); if (!r) return false;
  const existing = S.myOffers[id];
  if (f.price && Number.isNaN(Number(String(f.price).replace(/[^0-9.]/g, '')))) { toast('El precio debe ser un número.', true); return false; }
  const ph = normalizePhone(f.providerPhone);
  if (ph && ph.length !== 10) { toast('El teléfono debe tener 10 dígitos.', true); return false; }
  try {
    if (existing) {
      const price = Number(String(f.price || '').replace(/[^0-9.]/g, ''));
      const upd = { message: clamp(f.message, 500), pickupText: clamp(f.pickupText, 60), readyText: clamp(f.readyText, 60), providerPhone: ph, updatedAt: serverTimestamp() };
      if (f.price && !Number.isNaN(price)) upd.priceFrom = Math.min(price, 100000);
      await updateDoc(doc(db, 'requests', id, 'offers', S.user.uid), upd);
    } else {
      await setDoc(doc(db, 'requests', id, 'offers', S.user.uid), offerData(r, f, 'offer'));
    }
    const s = await getDoc(doc(db, 'requests', id, 'offers', S.user.uid));
    if (s.exists()) S.myOffers[id] = { id: s.id, ...s.data() };
    toast(existing ? 'Oferta actualizada ✓' : 'Oferta enviada. El cliente está eligiendo…');
    return true;
  } catch (e) { toast(friendly(e), true); return false; }
}
async function changeStatus(id, to) {
  const o = S.orders.find((x) => x.id === id); if (!o) return;
  let reason = '';
  if (to === 'rejected' || to === 'cancelled') {
    reason = await confirmModal({ title: to === 'rejected' ? 'Rechazar pedido' : 'Cancelar pedido', text: 'El cliente verá el cambio en su app.', ok: to === 'rejected' ? 'Rechazar' : 'Cancelar pedido', danger: true, withReason: true });
    if (reason === null) { orderDrawer(id); return; }
  }
  let total = 0; let due = 0;
  let files = null;
  if (to === 'in_progress') {
    const r = await priceModal({ title: 'Total a pagar', text: `Al recibir y pesar la ropa, anota cuánto es. El cliente te paga en efectivo${S.payInfo ? ' o por transferencia a tu cuenta' : ' (registra tu cuenta en Mi negocio para recibir transferencias)'}.`, label: 'Total (pesos)', ok: 'Recibí la ropa / Empecé',
      photos: S.cfg.serverOn ? [{ name: 'weight', label: `Bolsa ${bagCode(o.id)} en la báscula (obligatoria)`, required: true }, { name: 'pickup', label: 'Bolsa al recolectar (opcional)' }] : null });
    if (r === null) { orderDrawer(id); return; }
    if (S.cfg.serverOn) { due = r.v; files = r.files; } else due = r;
  }
  if (to === 'delivered' && S.cfg.serverOn) { await deliverFlow(o); orderDrawer(id); return; }
  if (to === 'delivered') {
    // Sin servidor: como antes. Si ya hay total a pagar (el que vio el cliente), ESE es el total.
    if (typeof o.amountDue === 'number') total = o.amountDue;
    else { total = await priceModal(); if (total === null) { orderDrawer(id); return; } }
  }
  const data = { status: to, statusChangedAt: serverTimestamp(), updatedAt: serverTimestamp() };
  if (reason) data.cancelReason = clamp(reason, 300);
  if (to === 'accepted' && S.profile?.phone) data.providerPhone = normalizePhone(S.profile.phone);
  if (to === 'delivered') {
    data.finalPrice = total; data.commissionPct = S.cfg.pct; data.commissionIvaPct = S.cfg.ivaPct; data.deliveredBy = 'provider';
    if (!paidByCard(o)) data.serviceFee = S.cfg.serviceFee; // en efectivo el socio cobró la cuota
  }
  if (to === 'in_progress') { data.amountDue = due; const ti = transferInfoFrom(S.payInfo); if (ti) data.transferInfo = ti; }
  try {
    if (files) {
      data.weightPhotoPath = await uploadEvidence(id, 'weight', files.weight);
      if (files.pickup && files.pickup.size) data.pickupPhotoPath = await uploadEvidence(id, 'pickup', files.pickup);
    }
    await updateDoc(doc(db, 'orders', id), data); toast(`Pedido: ${ORDER[to].label} ✓`); } catch (e) { toast(friendly(e), true); }
  orderDrawer(id);
}
async function toggleOnline() {
  if (!approved() || blocked()) return;
  const on = !isOnline();
  if (on) { unlockAudio(); try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch { /* nada */ } }
  S.toggling = true; render();
  try {
    await updateDoc(doc(db, 'providers', S.user.uid), { isAvailable: on, lastSeenAt: serverTimestamp(), updatedAt: serverTimestamp() });
    toast(on ? 'Conectado. Te avisaremos con sonido cuando llegue un pedido.' : 'Desconectado.');
  } catch (e) { toast(friendly(e), true); }
  S.toggling = false; render();
}
async function saveBusiness() {
  const f = S.bizForm; const p = S.provider;
  const name = clamp(f.businessName, 80);
  if (name.length < 2) return toast('Escribe el nombre de tu negocio.', true);
  if (!f.categoryIds.length) return toast('Elige al menos un servicio.', true);
  if (!f.zoneIds.length) return toast('Elige tu zona.', true);
  if (!f.fulfillmentModes.length) return toast('Elige cómo entregas.', true);
  const data = {
    providerType: f.providerType === 'business' ? 'business' : 'home', businessName: name, description: clamp(f.description, 500),
    categoryIds: [...new Set(f.categoryIds)].slice(0, 10), zoneIds: [...new Set(f.zoneIds)].slice(0, 5),
    fulfillmentModes: [...new Set(f.fulfillmentModes)].filter((m) => m === 'dropoff' || m === 'pickup_delivery'),
  };
  S.busy = 'biz'; render();
  try {
    if (!p) {
      await setDoc(doc(db, 'providers', S.user.uid), { ...data, status: 'pending', reviewNote: '', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      toast('Solicitud enviada. Te avisaremos aquí cuando la aprueben.');
    } else {
      const upd = { ...data, updatedAt: serverTimestamp() };
      if (p.status === 'rejected') upd.status = 'pending';
      await updateDoc(doc(db, 'providers', S.user.uid), upd);
      toast(p.status === 'rejected' ? 'Solicitud reenviada para revisión.' : 'Cambios guardados ✓');
    }
  } catch (e) { toast(friendly(e), true); }
  S.busy = ''; render();
}
function profileData(user, { name, phone } = {}) {
  return {
    displayName: clamp(name || user.displayName || (user.email || '').split('@')[0] || 'Socio', 80),
    email: String(user.email || '').trim().toLowerCase(), phone: normalizePhone(phone), colonia: '', zoneId: 'general-zuazua',
    activeMode: 'client', status: 'active', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  };
}

// ───────────── Eventos ─────────────
document.addEventListener('click', async (ev) => {
  const pageBtn = ev.target.closest('[data-page]');
  if (pageBtn) { S.page = pageBtn.dataset.page; if (S.page !== 'negocio') S.bizForm = null; render(); window.scrollTo(0, 0); return; }
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act; const id = el.dataset.id;
  if (act === 'overlay' && ev.target !== el) return;
  switch (act) {
    case 'tab': S.authTab = el.dataset.tab; S.authMsg = null; render(); break;
    case 'logout': await signOut(auth); break;
    case 'toggle': await toggleOnline(); break;
    case 'sound': S.soundOn = !S.soundOn; store.set('bubu:sonido', S.soundOn); unlockAudio(); if (S.soundOn) chime(1); render(); break;
    case 'testsound': { unlockAudio(); const was = S.soundOn; S.soundOn = true; chime(2); S.soundOn = was; break; }
    case 'accept': unlockAudio(); stopFlash(); await quickAccept(id); break;
    case 'offer': stopFlash(); offerModal(id); break;
    case 'dismiss': S.dismissed[id] = true; stopFlash(); render(); break;
    case 'order': orderDrawer(id); break;
    case 'status': await changeStatus(id, el.dataset.to); break;
    case 'amount': await editAmount(id); break;
    case 'area-save': await saveArea(); break;
    case 'transferok': {
      try { await updateDoc(doc(db, 'orders', id), { paymentStatus: 'transfer_ok', updatedAt: serverTimestamp() }); toast('Transferencia confirmada ✓'); } catch (e) { toast(friendly(e), true); }
      orderDrawer(id); break;
    }
    case 'payinfo-del': {
      try { await deleteDoc(doc(db, 'providerPayInfo', S.user.uid)); toast('Cuenta quitada'); } catch (e) { toast(friendly(e), true); }
      break;
    }
    case 'otab': S.orderTab = el.dataset.tab; render(); break;
    case 'close': case 'overlay': $modal.innerHTML = ''; S.drawer = null; render(); break;
    case 'cancel-confirm': if (confirmResolver) confirmResolver(null); break;
    case 'deliver-mode': if (confirmResolver) confirmResolver({ switch: el.dataset.mode }); break;
    case 'celebrated': {
      S.celebrated.add(id); store.set(`bubu:celebrated:${S.user.uid}`, [...S.celebrated].slice(-200)); stopFlash();
      $modal.innerHTML = '';
      if (el.dataset.order) { S.page = 'pedidos'; render(); orderDrawer(el.dataset.order); } else render();
      break;
    }
    case 'biztype': S.bizForm.providerType = el.dataset.val; render(); break;
    case 'bizchip': { const g = S.bizForm[el.dataset.group]; const v = el.dataset.val; const i = g.indexOf(v); if (i >= 0) g.splice(i, 1); else g.push(v); render(); break; }
    default: break;
  }
});
document.addEventListener('input', (ev) => {
  const k = ev.target.dataset?.biz; if (k && S.bizForm) S.bizForm[k] = ev.target.value;
  const n = ev.target.name; if (S.phase === 'auth' && n && n in S.authForm && n !== 'password') S.authForm[n] = ev.target.value;
});
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && $modal.innerHTML) { if (confirmResolver) confirmResolver(null); else { $modal.innerHTML = ''; S.drawer = null; render(); } } });

document.addEventListener('submit', async (ev) => {
  const form = ev.target.closest('form[data-form]'); if (!form) return;
  ev.preventDefault();
  const kind = form.dataset.form; const fd = Object.fromEntries(new FormData(form).entries());
  if (kind === 'login' || kind === 'register' || kind === 'reset') {
    const email = String(fd.email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { S.authMsg = { tone: 'err', text: 'Escribe un correo válido.' }; render(); return; }
    S.authBusy = true; S.authMsg = null; render();
    try {
      if (kind === 'login') {
        const cred = await signInWithEmailAndPassword(auth, email, fd.password);
        try { const s = await getDoc(doc(db, 'users', cred.user.uid)); if (!s.exists()) await setDoc(doc(db, 'users', cred.user.uid), profileData(cred.user)); } catch { /* no crítico */ }
      } else if (kind === 'register') {
        const name = clamp(fd.name, 80);
        if (name.length < 2) throw Object.assign(new Error('Escribe tu nombre completo.'), { code: 'x' });
        const pw = String(fd.password || '');
        if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) throw Object.assign(new Error('La contraseña necesita al menos 8 caracteres, con letras y números.'), { code: 'x' });
        const ph = normalizePhone(fd.phone);
        if (ph && ph.length !== 10) throw Object.assign(new Error('El teléfono debe tener 10 dígitos.'), { code: 'x' });
        const cred = await createUserWithEmailAndPassword(auth, email, pw);
        await updateProfile(cred.user, { displayName: name });
        await setDoc(doc(db, 'users', cred.user.uid), profileData(cred.user, { name, phone: ph }));
        try { await sendEmailVerification(cred.user); } catch { /* no crítico */ }
        S.page = 'negocio';
      } else {
        await sendPasswordResetEmail(auth, email);
        S.authMsg = { tone: 'ok', text: 'Si existe una cuenta con ese correo, te enviamos un enlace. Revisa también spam.' };
      }
    } catch (e) { S.authMsg = { tone: 'err', text: friendly(e) }; }
    S.authBusy = false; if (S.phase === 'auth') render();
    return;
  }
  if (kind === 'offer') {
    const btn = form.querySelector('button:not([type])'); if (btn) btn.disabled = true;
    if (await saveOffer(form.dataset.id, fd)) { $modal.innerHTML = ''; render(); } else if (btn) btn.disabled = false;
    return;
  }
  if (kind === 'confirm') { if (confirmResolver) confirmResolver(clamp(fd.reason || '', 300)); return; }
  if (kind === 'price') {
    const v = parseMoney(fd.total);
    if (!v) { toast('Escribe cuánto cobraste (por ejemplo 150).', true); return; }
    if (form.dataset.allphotos !== undefined) {
      const files = {}; form.dataset.allphotos.split(',').filter(Boolean).forEach((n) => { if (fd[n] && fd[n].size) files[n] = fd[n]; });
      const missing = (form.dataset.photos || '').split(',').filter(Boolean).find((n) => !files[n]);
      if (missing) { toast('Toma la foto de la bolsa en la báscula. Es obligatoria.', true); return; }
      if (confirmResolver) confirmResolver({ v, files }); return;
    }
    if (confirmResolver) confirmResolver(v); return;
  }
  if (kind === 'deliver') {
    if (confirmResolver) confirmResolver({ mode: form.dataset.mode, pin: String(fd.pin || '').trim(), total: fd.total, file: fd.photo && fd.photo.size ? fd.photo : null });
    return;
  }
  if (kind === 'biz') { await saveBusiness(); }
  if (kind === 'chat') {
    const id = form.dataset.id; const text = clamp(fd.text, 1000);
    if (!text) return;
    try {
      await addDoc(collection(db, 'orders', id, 'messages'), { senderId: S.user.uid, senderRole: 'provider', text, createdAt: serverTimestamp() });
      const inp = document.getElementById('chat-input'); if (inp) { inp.value = ''; inp.focus(); }
    } catch (e) { toast(friendly(e), true); }
    return;
  }
  if (kind === 'payinfo') {
    const holder = clamp(fd.holder, 80); const account = clamp(fd.account, 40).replace(/\s+/g, ' ');
    if (holder.length < 2) { toast('Escribe el nombre del titular.', true); return; }
    if (account.replace(/\s/g, '').length < 6) { toast('Escribe tu CLABE, tarjeta o número de cuenta.', true); return; }
    const data = { holder, account, updatedAt: serverTimestamp() };
    if (clamp(fd.bank, 40)) data.bank = clamp(fd.bank, 40);
    if (clamp(fd.note, 100)) data.note = clamp(fd.note, 100);
    try { await setDoc(doc(db, 'providerPayInfo', S.user.uid), data); toast('Cuenta guardada ✓'); } catch (e) { toast(friendly(e), true); }
  }
});

// Cada segundo: contadores, tiempo conectado y pedidos que vencen.
let lastOpenKey = '';
setInterval(() => {
  if (S.phase !== 'ready') return;
  document.querySelectorAll('[data-exp]').forEach((el) => {
    const ms = Number(el.dataset.exp) - Date.now(); const span = el.querySelector('span');
    if (span) span.textContent = countdown(Number(el.dataset.exp));
    if (ms < 5 * 60000) el.classList.add('low');
  });
  const t = document.querySelector('[data-online-timer]'); if (t && S.onlineSince) t.textContent = fmtElapsed(Date.now() - S.onlineSince);
  const key = groups().open.map((r) => r.id).join();
  if (key !== lastOpenKey) { lastOpenKey = key; if (!$modal.innerHTML || !S.drawer) render(); }
}, 1000);
