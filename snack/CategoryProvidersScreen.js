// Lavanderías (proveedores aprobados) de una categoría en la zona del cliente.
import React, { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, Notice, Screen, styles } from './ui';
import { ProviderCard } from './cards';
import { useAuth } from './AuthContext';
import { useCatalog } from './CatalogContext';
import { isOnline, subscribeApprovedProviders } from './providers';
import { areaCovers, distanceKm } from './geo';
import { loadLastPoint } from './location';
import { subscribeReviewsFor } from './reviews';
import { useNow } from './time';
import { friendlyError } from './errors';

export default function CategoryProvidersScreen({ navigation, route }) {
  const categoryId = route?.params?.categoryId || 'lavanderia';
  const { user, profile } = useAuth();
  const { categoryById, zoneById } = useCatalog();
  const [providers, setProviders] = useState(undefined);
  const [error, setError] = useState('');
  const now = useNow(30000);
  const zoneId = profile?.zoneId || 'general-zuazua';

  useEffect(() => subscribeApprovedProviders(setProviders, (e) => { setError(friendlyError(e)); setProviders([]); }), []);

  const [myPoint, setMyPoint] = useState(null);
  useEffect(() => { if (user) loadLastPoint(user.uid).then(setMyPoint); }, [user?.uid]);
  const kmTo = (p) => (p.serviceArea ? distanceKm(myPoint, p.serviceArea) : 9999);
  const list = useMemo(() => (providers || [])
    .filter((p) => p.id !== user?.uid && (p.categoryIds || []).includes(categoryId) && (p.zoneIds || []).includes(zoneId))
    .filter((p) => !myPoint || areaCovers(p.serviceArea, myPoint))
    .sort((a, b) => Number(isOnline(b, now)) - Number(isOnline(a, now))
      || (myPoint ? kmTo(a) - kmTo(b) : 0)), [providers, categoryId, zoneId, now, user, myPoint]);

  // Calificaciones reales de los proveedores de la lista (si falla, no se muestran).
  const [reviewsBy, setReviewsBy] = useState(null);
  const ids = list.map((p) => p.id).join(',');
  useEffect(() => subscribeReviewsFor(ids ? ids.split(',') : [], setReviewsBy, () => setReviewsBy(null)), [ids]);

  const cat = categoryById(categoryId);
  return (
    <Screen>
      <Text style={styles.title}>{cat?.name || 'Servicio'}</Text>
      <Text style={styles.muted}>En {zoneById(zoneId)?.name || 'tu zona'} · {list.length} {list.length === 1 ? 'proveedor' : 'proveedores'}</Text>

      <Card>
        <Text style={styles.section}>¿Quieres comparar precios?</Text>
        <Text style={styles.muted}>Publica tu pedido y las lavanderías disponibles te mandan su oferta. Tú eliges.</Text>
        <Button title="Publicar pedido" onPress={() => navigation.navigate('NewRequest', { categoryId })} />
      </Card>

      <Notice tone="error">{error}</Notice>
      {providers === undefined && <Text style={[styles.muted, { marginTop: 16 }]}>Cargando…</Text>}
      {providers !== undefined && list.length === 0 && (
        <Notice tone="info">Todavía no hay proveedores aprobados en tu zona para esta categoría. ¡Estamos sumando más! También puedes publicar tu pedido: lo verán en cuanto se conecten.</Notice>
      )}
      <View>
        {list.map((p) => (
          <ProviderCard key={p.id} provider={p} now={now} reviews={reviewsBy ? (reviewsBy[p.id] || []) : undefined} onBook={() => navigation.navigate('DirectBooking', { providerId: p.id, categoryId })} />
        ))}
      </View>
    </Screen>
  );
}
