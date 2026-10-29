// Opciones del formulario "Publicar pedido" y tiempos del sistema de ofertas.

export const OFFER_WINDOW_MIN = 30;        // minutos que un pedido recibe ofertas
export const ONLINE_WINDOW_MIN = 15;       // "conectado ahora" si dio señal en estos minutos
export const HEARTBEAT_MS = 4 * 60 * 1000; // cada cuánto el proveedor disponible avisa que sigue ahí
export const MISSED_WINDOW_DAYS = 7;       // "te perdiste" muestra la última semana

// Servicios por categoría (lavandería primero; las demás se agregan aquí).
export const SERVICE_OPTIONS = {
  lavanderia: ['Lavar', 'Secar', 'Doblar', 'Planchar', 'Edredones / cobijas'],
};
// Las opciones de servicio pueden venir de la categoría en Firebase (campo
// "serviceOptions"); si no existe, se usan estas. Así una categoría nueva no
// requiere cambiar código.
export function serviceOptionsFor(category, categoryId) {
  if (Array.isArray(category?.serviceOptions) && category.serviceOptions.length) return category.serviceOptions;
  return SERVICE_OPTIONS[categoryId] || [];
}

export const PROVIDER_TYPES = {
  business: { label: 'Negocio establecido', badge: '🏪 Negocio' },
  home: { label: 'Trabajo desde casa', badge: '🏠 Desde casa' },
};

// Fecha y horario del servicio.
export const ASAP = 'Lo antes posible';
export const TIME_SLOTS = ['Temprano (8–12)', 'Tarde (12–6)', 'Noche (6–9)'];
const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// Próximos 7 días: [{ label: 'Hoy' | 'Mañana' | 'Jue 30 oct', date: Date (00:00) }]
export function nextDays(n = 7, from = new Date()) {
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    const label = i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
    out.push({ label, date: d });
  }
  return out;
}

// Texto corto que se guarda y se muestra (máx. 40 caracteres).
export function whenLabel(dayLabel, slot) {
  if (!dayLabel || dayLabel === ASAP) return ASAP;
  return slot ? `${dayLabel} · ${slot}` : dayLabel;
}

export const QUANTITY_OPTIONS = ['1 bolsa o carga', '2–3 bolsas', '4 o más', 'Pocas prendas'];

export const REQUEST_STATE = {
  open: { label: 'Recibiendo ofertas', tone: 'info' },
  expired: { label: 'Sin elegir — venció', tone: 'warn' },
  assigned: { label: 'Proveedor elegido', tone: 'success' },
  cancelled: { label: 'Cancelado', tone: 'error' },
  closed: { label: 'Cerrado', tone: 'info' },
};
