// Catálogo inicial que un ADMIN puede cargar a Firestore desde la app
// (Perfil → Herramientas de administrador). Nadie más puede escribirlo:
// lo impiden las reglas de Firestore.
//
// Para agregar una categoría nueva en el futuro no hay que cambiar código:
// basta con crear un documento en la colección `categories` (desde el panel
// administrativo o la consola de Firebase) y marcarlo `active: true`.

export const INITIAL_CATEGORIES = [
  { id: 'lavanderia', name: 'Lavandería', icon: '🧺', description: 'Lavado, secado, doblado y planchado', active: true, order: 1, serviceOptions: ['Lavar', 'Secar', 'Doblar', 'Planchar', 'Edredones / cobijas'] },
  { id: 'limpieza', name: 'Limpieza', icon: '🧽', description: 'Limpieza de casas y espacios', active: false, order: 2 },
  { id: 'reparaciones', name: 'Reparaciones', icon: '🛠️', description: 'Arreglos y mantenimiento del hogar', active: false, order: 3 },
  { id: 'jardineria', name: 'Jardinería', icon: '🌿', description: 'Cuidado de patios y jardines', active: false, order: 4 },
  { id: 'mudanzas', name: 'Mudanzas', icon: '📦', description: 'Fletes y mudanzas locales', active: false, order: 5 },
  { id: 'mascotas', name: 'Cuidado de mascotas', icon: '🐾', description: 'Paseo y cuidado de mascotas', active: false, order: 6 },
];

// Zona de lanzamiento. Las colonias se dejan vacías a propósito: deben
// capturarse con datos reales desde el panel administrativo.
export const INITIAL_ZONES = [
  {
    id: 'general-zuazua',
    name: 'General Zuazua',
    municipality: 'General Zuazua',
    state: 'Nuevo León',
    colonias: [],
    active: true,
  },
];

export const FULFILLMENT_MODES = {
  dropoff: { label: 'El cliente lo lleva', providerLabel: 'Recibo en mi local / casa', icon: 'storefront-outline' },
  pickup_delivery: { label: 'Recolección y entrega', providerLabel: 'Recojo y entrego', icon: 'car-outline' },
};

export function sortByOrder(list) {
  return [...list].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}
