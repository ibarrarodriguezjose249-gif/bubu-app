// Estados de pedido/reserva y transiciones permitidas.
// IMPORTANTE: esta misma tabla está replicada en firebase/firestore.rules.
// Si cambias una, cambia la otra (las pruebas de reglas lo verifican).

export const ORDER_STATUS = {
  requested: { label: 'Solicitado', color: '#0066FF', bg: '#EAF2FF', icon: 'paper-plane-outline' },
  accepted: { label: 'Aceptado', color: '#00897F', bg: '#DDF7F4', icon: 'checkmark-circle-outline' },
  rejected: { label: 'Rechazado', color: '#B42318', bg: '#FFECEC', icon: 'close-circle-outline' },
  in_progress: { label: 'En proceso', color: '#9A6200', bg: '#FFF6DD', icon: 'sync-outline' },
  ready: { label: 'Listo', color: '#0E7A4B', bg: '#E3F8EE', icon: 'bag-check-outline' },
  delivered: { label: 'Entregado', color: '#0E7A4B', bg: '#E3F8EE', icon: 'checkmark-done-outline' },
  cancelled: { label: 'Cancelado', color: '#5B6B82', bg: '#EEF1F5', icon: 'ban-outline' },
  disputed: { label: 'En revisión', color: '#B42318', bg: '#FFECEC', icon: 'alert-circle-outline' },
};

// Quién puede mover el pedido de un estado a otro.
export const PROVIDER_TRANSITIONS = {
  requested: ['accepted', 'rejected'],
  accepted: ['in_progress', 'cancelled'],
  in_progress: ['ready'],
  ready: ['delivered'],
};

export const CUSTOMER_TRANSITIONS = {
  requested: ['cancelled'],
  accepted: ['cancelled'],
};

export function canTransition(role, from, to) {
  const table = role === 'provider' ? PROVIDER_TRANSITIONS : role === 'customer' ? CUSTOMER_TRANSITIONS : null;
  if (!table) return false;
  return Array.isArray(table[from]) && table[from].includes(to);
}

export const FINAL_STATUSES = ['rejected', 'delivered', 'cancelled'];
