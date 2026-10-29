// Pestaña "Pedidos".
// Cliente: pedidos publicados (con ofertas) + pedidos confirmados.
// Proveedor: pedidos recibidos (directos y ganados por oferta).
import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { Notice, Screen, styles } from '../../components/ui';
import { OrderRow, RequestCard } from '../../components/cards';
import { useAuth } from '../../context/AuthContext';
import { subscribeMyOrders } from '../../services/orders';
import { requestState, subscribeMyRequests } from '../../services/requests';
import { FINAL_STATUSES } from '../../constants/orderStatus';
import { useNow } from '../../lib/time';
import { friendlyError } from '../../lib/errors';

export default function OrdersScreen({ navigation }) {
  const { user, mode } = useAuth();
  const [orders, setOrders] = useState(undefined);
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState('');
  const now = useNow(1000);

  useEffect(() => {
    if (!user) return undefined;
    setOrders(undefined);
    return subscribeMyOrders(user.uid, mode, setOrders, (e) => { setError(friendlyError(e)); setOrders([]); });
  }, [user, mode]);
  useEffect(() => (user && mode === 'client' ? subscribeMyRequests(user.uid, setRequests, () => {}) : undefined), [user, mode]);

  const active = (orders || []).filter((o) => !FINAL_STATUSES.includes(o.status));
  const past = (orders || []).filter((o) => FINAL_STATUSES.includes(o.status));
  const visibleRequests = requests.filter((r) => ['open', 'expired'].includes(requestState(r, now))).slice(0, 10);
  const openOrder = (o) => navigation.navigate('OrderDetail', { id: o.id });

  return (
    <Screen>
      <Text style={styles.title}>{mode === 'provider' ? 'Pedidos recibidos' : 'Mis pedidos'}</Text>
      <Notice tone="error">{error}</Notice>

      {mode === 'client' && visibleRequests.length > 0 && (
        <>
          <Text style={[styles.section, { marginTop: 18 }]}>Publicados</Text>
          {visibleRequests.map((r) => (
            <RequestCard key={r.id} request={r} state={requestState(r, now)} now={now} onPress={() => navigation.navigate('RequestDetail', { id: r.id })} />
          ))}
        </>
      )}

      <Text style={[styles.section, { marginTop: 18 }]}>En curso</Text>
      {orders === undefined && <Text style={styles.muted}>Cargando…</Text>}
      {orders !== undefined && active.length === 0 && (
        <Text style={styles.muted}>
          {mode === 'provider'
            ? 'Aún no tienes pedidos. Activa "Estoy disponible" en Inicio y manda ofertas a los pedidos de tu zona.'
            : 'No tienes pedidos en curso. Publica uno desde Inicio.'}
        </Text>
      )}
      {active.map((o) => <OrderRow key={o.id} order={o} role={mode} now={now} onPress={() => openOrder(o)} />)}

      {past.length > 0 && (
        <>
          <Text style={[styles.section, { marginTop: 22 }]}>Historial</Text>
          {past.slice(0, 20).map((o) => <OrderRow key={o.id} order={o} role={mode} now={now} onPress={() => openOrder(o)} />)}
        </>
      )}
    </Screen>
  );
}
