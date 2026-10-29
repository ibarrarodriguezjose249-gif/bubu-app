// Detalle de un pedido para cliente y proveedor: estado, datos de contacto y acciones.
import React, { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Field, Loading, Notice, Screen, styles } from '../../components/ui';
import { STAR_WORDS, StarPicker, Stars } from '../../components/Rating';
import { REVIEW_COMMENT_MAX, getReview, submitReview } from '../../services/reviews';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../constants/brand';
import { FULFILLMENT_MODES } from '../../constants/catalog';
import { CUSTOMER_TRANSITIONS, ORDER_STATUS, PROVIDER_TRANSITIONS } from '../../constants/orderStatus';
import { changeOrderStatus, subscribeOrder } from '../../services/orders';
import { formatMoney, timeAgo, useNow } from '../../lib/time';
import { friendlyError } from '../../lib/errors';

const STEPS = ['requested', 'accepted', 'in_progress', 'ready', 'delivered'];

const ACTION_LABELS = {
  provider: {
    accepted: '✓ Aceptar pedido',
    rejected: 'Rechazar',
    in_progress: '🧺 Recibí la ropa / Empecé',
    ready: '✅ Marcar como listo',
    delivered: '📦 Marcar como entregado',
    cancelled: 'Cancelar pedido',
  },
  customer: { cancelled: 'Cancelar pedido' },
};
const DANGER = ['rejected', 'cancelled'];

export default function OrderDetailScreen({ route }) {
  const { id, fresh } = route.params || {};
  const { user, profile } = useAuth();
  const [order, setOrder] = useState(undefined);
  const [busy, setBusy] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState('');
  const now = useNow(30000);

  useEffect(() => subscribeOrder(id, setOrder, (e) => setMsg(friendlyError(e))), [id]);

  // Calificación (solo cuando el pedido está entregado).
  const [review, setReview] = useState(undefined);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [rateBusy, setRateBusy] = useState(false);
  const [rateMsg, setRateMsg] = useState({ tone: 'info', text: '' });
  const delivered = order?.status === 'delivered';
  useEffect(() => {
    if (!delivered) return;
    getReview(id).then(setReview).catch(() => setReview(null));
  }, [id, delivered]);

  async function sendReview() {
    if (!stars) return setRateMsg({ tone: 'error', text: 'Toca las estrellas para calificar.' });
    setRateBusy(true);
    setRateMsg({ tone: 'info', text: '' });
    try {
      await submitReview({ order, uid: user.uid, profile, stars, comment });
      setReview(await getReview(id));
      setRateMsg({ tone: 'success', text: '¡Gracias! Tu calificación ayuda a otros vecinos a elegir.' });
    } catch (e) {
      setRateMsg({ tone: 'error', text: friendlyError(e) });
    } finally {
      setRateBusy(false);
    }
  }

  if (order === undefined) return <Loading />;
  if (!order) return <Screen><Notice tone="error">{msg || 'Pedido no encontrado.'}</Notice></Screen>;

  const role = order.providerId === user?.uid ? 'provider' : 'customer';
  const st = ORDER_STATUS[order.status] || { label: order.status, color: colors.muted };
  const next = ((role === 'provider' ? PROVIDER_TRANSITIONS : CUSTOMER_TRANSITIONS)[order.status]) || [];
  const stepIndex = STEPS.indexOf(order.status);
  const otherPhone = role === 'provider' ? order.customerPhone : order.providerPhone;

  async function doAction(to) {
    if (DANGER.includes(to) && confirm !== to) { setConfirm(to); return; }
    setBusy(to);
    setMsg('');
    try {
      const extra = {};
      if (role === 'provider' && to === 'accepted' && profile?.phone) extra.providerPhone = profile.phone;
      await changeOrderStatus(order.id, to, extra);
      setConfirm('');
    } catch (e) {
      setMsg(friendlyError(e));
    } finally {
      setBusy('');
    }
  }

  return (
    <Screen>
      {fresh && role === 'customer' && order.status === 'accepted' && (
        <Notice tone="success">¡Listo! {order.providerName} tiene tu pedido. Te contactará para coordinar.</Notice>
      )}
      {fresh && role === 'customer' && order.status === 'requested' && (
        <Notice tone="success">Reserva enviada. {order.providerName} debe aceptarla; aquí verás el cambio.</Notice>
      )}

      <View style={styles.row}>
        <Text style={styles.title} numberOfLines={1}>{role === 'provider' ? order.customerName : order.providerName}</Text>
        <Text style={[s.status, { color: st.color, borderColor: st.color }]}>{st.label}</Text>
      </View>
      <Text style={styles.muted}>Pedido {timeAgo(order.createdAt, now)}</Text>

      {/* Línea de avance */}
      {stepIndex >= 0 && (
        <View style={s.steps}>
          {STEPS.map((k, i) => (
            <View key={k} style={s.stepWrap}>
              <View style={[s.step, i <= stepIndex && { backgroundColor: colors.blue }]} />
              <Text style={[s.stepText, i <= stepIndex && { color: colors.blue, fontWeight: '800' }]} numberOfLines={1}>{ORDER_STATUS[k].label}</Text>
            </View>
          ))}
        </View>
      )}

      <Card>
        <Text style={styles.section}>Pedido</Text>
        <Text style={styles.text}>{order.details}</Text>
        <Text style={styles.muted}>{FULFILLMENT_MODES[order.fulfillmentMode]?.icon} {FULFILLMENT_MODES[order.fulfillmentMode]?.label}{order.whenText ? ` · ${order.whenText}` : ''}</Text>
        {!!order.agreedPickup && <Text style={styles.muted}>🚗 Recoge / recibe: {order.agreedPickup}</Text>}
        {!!order.agreedReady && <Text style={styles.muted}>✅ Listo: {order.agreedReady}</Text>}
        {typeof order.priceEstimate === 'number' && <Text style={[styles.text, { marginTop: 8, fontWeight: '800' }]}>Precio estimado: {formatMoney(order.priceEstimate)}</Text>}
        <Text style={styles.muted}>El pago se acuerda directo entre ustedes. BÜBÜ no cobra dentro de la app.</Text>
      </Card>

      <Card>
        <Text style={styles.section}>Contacto</Text>
        <Text style={styles.muted}>📍 Colonia: {order.colonia}</Text>
        {!!order.address && <Text style={styles.text}>🏠 {order.address}</Text>}
        {otherPhone ? (
          <Button title={`📞 Llamar al ${otherPhone}`} variant="outline" onPress={() => Linking.openURL(`tel:${otherPhone}`)} />
        ) : (
          <Text style={styles.muted}>{role === 'provider' ? 'El cliente no compartió teléfono.' : 'La lavandería compartirá su teléfono al aceptar.'}</Text>
        )}
      </Card>

      {delivered && role === 'customer' && review === null && (
        <Card style={{ borderColor: '#f5a623' }}>
          <Text style={[styles.section, { textAlign: 'center' }]}>¿Cómo te fue con {order.providerName}?</Text>
          <StarPicker value={stars} onChange={setStars} disabled={rateBusy} />
          <Text style={[styles.muted, { textAlign: 'center', fontWeight: '800' }]}>{STAR_WORDS[stars] || 'Toca una estrella'}</Text>
          <Field label="Comentario (opcional)" value={comment} onChangeText={setComment} multiline maxLength={REVIEW_COMMENT_MAX} placeholder="Ej. Puntuales y la ropa quedó muy bien doblada." hint="Se publica con tu primer nombre. No se puede editar después." />
          <Notice tone={rateMsg.tone}>{rateMsg.text}</Notice>
          <Button title="Enviar calificación" onPress={sendReview} loading={rateBusy} />
        </Card>
      )}
      {delivered && review && (
        <Card>
          <Text style={styles.section}>{role === 'customer' ? 'Tu calificación' : 'Calificación del cliente'}</Text>
          <View style={{ marginTop: 8 }}><Stars value={review.stars} size={22} /></View>
          {!!review.comment && <Text style={[styles.text, { marginTop: 8 }]}>“{review.comment}”</Text>}
          {review.hidden && <Notice tone="warn">El equipo de BÜBÜ ocultó esta reseña.</Notice>}
          {rateMsg.tone === 'success' && <Notice tone="success">{rateMsg.text}</Notice>}
        </Card>
      )}
      {delivered && role === 'provider' && review === null && (
        <Text style={[styles.muted, { textAlign: 'center' }]}>El cliente todavía no califica este pedido.</Text>
      )}

      <Notice tone="error">{msg}</Notice>
      {next.map((to) => (
        <Button
          key={to}
          title={confirm === to ? `Toca otra vez para confirmar: ${ACTION_LABELS[role][to] || to}` : (ACTION_LABELS[role][to] || to)}
          variant={DANGER.includes(to) ? 'danger' : 'primary'}
          loading={busy === to}
          disabled={!!busy && busy !== to}
          onPress={() => doAction(to)}
        />
      ))}
      {next.length === 0 && <Text style={[styles.muted, { textAlign: 'center', marginTop: 18 }]}>No hay acciones pendientes para ti en este pedido.</Text>}
    </Screen>
  );
}

const s = StyleSheet.create({
  status: { fontSize: 12, fontWeight: '800', borderWidth: 1, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5, overflow: 'hidden' },
  steps: { flexDirection: 'row', marginTop: 16, gap: 4 },
  stepWrap: { flex: 1, alignItems: 'center' },
  step: { height: 6, alignSelf: 'stretch', borderRadius: 3, backgroundColor: '#dbe4f2' },
  stepText: { fontSize: 10, color: colors.muted, marginTop: 6 },
});
