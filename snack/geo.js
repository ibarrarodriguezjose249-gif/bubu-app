// Utilidades de mapa: distancias, cobertura de zonas y zona de servicio de socios.
// Mismas reglas en la app, la web de socios, el panel y el servidor.

export const DEFAULT_CENTER = { lat: 25.8853, lng: -100.1086 }; // General Zuazua, N.L.

export function distanceKm(a, b) {
  if (!a || !b) return Infinity;
  const R = 6371; const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat); const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Ubicación APROXIMADA del cliente (2 decimales ≈ 1 km): es lo único que ven los socios.
export const approx = (p) => ({ lat: Math.round(p.lat * 100) / 100, lng: Math.round(p.lng * 100) / 100 });
// Punto del socio (3 decimales ≈ 100 m), para no publicar su domicilio exacto.
export const approxArea = (p, radiusKm) => ({ lat: Math.round(p.lat * 1000) / 1000, lng: Math.round(p.lng * 1000) / 1000, radiusKm: Math.round(radiusKm * 10) / 10 });

const validArea = (a) => a && typeof a.lat === 'number' && typeof a.lng === 'number' && typeof a.radiusKm === 'number';

// ¿Ya dibujó el admin la cobertura de alguna zona? Si no, la app funciona como antes (sin mapa).
export const coverageConfigured = (zones) => (zones || []).some((z) => z.active && validArea(z.coverage));

// Zona activa cuya cobertura contiene el punto (la más cercana), o null si no hay cobertura.
export function zoneForPoint(zones, point) {
  if (!point) return null;
  const inside = (zones || []).filter((z) => z.active && validArea(z.coverage) && distanceKm(point, z.coverage) <= z.coverage.radiusKm);
  inside.sort((a, b) => distanceKm(point, a.coverage) - distanceKm(point, b.coverage));
  return inside[0] || null;
}

// Zonas activas que toca el círculo de servicio del socio.
export function zonesForArea(zones, area) {
  if (!validArea(area)) return [];
  return (zones || []).filter((z) => z.active && validArea(z.coverage) && distanceKm(area, z.coverage) <= z.coverage.radiusKm + area.radiusKm);
}

// ¿Le queda cerca este pedido al socio? (+1.2 km de tolerancia por la ubicación aproximada).
// Si el socio o el pedido no tienen mapa, se usa solo la zona, como antes.
export function areaCovers(area, point) {
  if (!validArea(area) || !point || typeof point.lat !== 'number') return true;
  return distanceKm(area, point) <= area.radiusKm + 1.2;
}
