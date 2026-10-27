// Estados de pedido/reserva y transiciones permitidas.
// IMPORTANTE: esta misma tabla está replicada en firebase/firestore.rules.
// Si cambias una, cambia la otra (las pruebas de reglas lo verifican).

export const ORDER_STATUS = {
  requested: { label: 'Solicitado', color: '#1769ff' },
  accepted: { label: 'Aceptado', color: '#0f8f86' },
  rejected: { label: 'Rechazado', color: '#a12626' },
  in_progress: { label: 'En proceso', color: '#a76b00' },
  ready: { label: 'Listo', color: '#126748' },
  delivered: { label: 'Entregado', color: '#126748' },
  cancelled: { label: 'Cancelado', color: '#6e7b91' },
  disputed: { label: 'En revisión', color: '#a12626' },
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
