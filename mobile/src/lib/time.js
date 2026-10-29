// Utilidades de tiempo (Firestore Timestamp → milisegundos, textos "hace 5 min").
import { useEffect, useState } from 'react';

export function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  return 0;
}

// Re-dibuja el componente cada `ms` (para contadores y "hace X min").
export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function timeAgo(ts, now = Date.now()) {
  const m = toMillis(ts);
  if (!m) return '';
  const s = Math.max(0, Math.round((now - m) / 1000));
  if (s < 60) return 'hace un momento';
  const min = Math.round(s / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}

export function countdown(ts, now = Date.now()) {
  const left = toMillis(ts) - now;
  if (left <= 0) return '0:00';
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatMoney(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return '';
  return `$${n.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;
}
