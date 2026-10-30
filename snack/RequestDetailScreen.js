// Detalle de un pedido publicado: contador, ofertas en vivo y elegir la favorita.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { Badge, Button, Card, Field, IconLine, Loading, Notice, Screen, styles } from './ui';
import Icon from './Icon';
import { OfferCard } from './cards';
import Radar from './Radar';
import { subscribeReviewsFor } from './reviews';
import { isOnline, subscribeApprovedProviders } from './providers';
import { useAuth } from './AuthContext';
import { colors, fonts } from './brand';
import { FULFILLMENT_MODES } from './constants_catalog';
import { REQUEST_STATE } from './constants_requests';
import { cancelRequest, chooseOffer, republishRequest, requestState, requestSummary, subscribeOffers, subscribeRequest } from './services_requests';
import { countdown, toMillis, useNow } from './time';
import { friendlyError } from './errors';
import { LIMITS, validatePhoneOptional } from './validation';

function tagsFor(offers) {
  const tags = {};
  const priced = offers.filter((o) => typeof o.priceFrom === 'number');
  if (priced.length > 1) {
    const min = Math.min(...priced.map((o) => o.priceFrom));
    priced.filter((o) => o.priceFrom === min).forEach((o) => { (tags[o.id] = tags[o.id] || []).push({ icon: 'cash-outline', label: 'Mejor precio' }); });
  }
  if (offers.length > 1) {
    const first = offers.reduce((a, b) => (toMillis(a.createdAt) <= toMillis(b.createdAt) ? a : b));
    (tags[first.id] = tags[first.id] || []).push({ icon: 'flash-outline', label: 'Respondió primero' });
  }
  return tags;
}

export default function RequestDetailScreen({ navigation, route }) {
  const { id, justCreated } = route.params || {};
  const { user, profile } = useAuth();
  const [request, setRequest] = useState(undefined);
  const [offers, setOffers] = useState([]);
  const [choosing, setChoosing] = useState(null); // oferta seleccionada para confirmar
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ tone: 'info', text: '' });
  const now = useNow(1000);

  useEffect(() => subscribeRequest(id, setRequest, (e) => setMsg({ tone: 'error', text: friendlyError(e) })), [id]);
  useEffect(() => subscribeOffers(id, setOffers, () => {}), [id]);
  const tags = useMemo(() => tagsFor(offers), [offers]);

  // Calificaciones de quienes ofertaron.
  const [reviewsBy, setReviewsBy] = useState(null);
  const offerIds = offers.map((o) => o.id).join(',');
  useEffect(() => subscribeReviewsFor(offerIds ? offerIds.split(',') : [], setReviewsBy, () => setReviewsBy(null)), [offerIds]);

  // Lavanderías conectadas ahora en la zona del pedido (dato real, para el radar).
  const [providers, setProviders] = useState([]);
  useEffect(() => subscribeApprovedProviders(setProviders, () => setProviders([])), []);

  // Vibración corta cuando llega una oferta nueva con la pantalla abierta.
  const seenOffers = useRef(null);
  useEffect(() => {
    if (seenOffers.current === null) { seenOffers.current = offers.length; return; }
    if (offers.length > seenOffers.current) { try { Vibration.vibrate(300); } catch (e) { /* sin vibración */ } }
    seenOffers.current = offers.length;
  }, [offers.length]);

  if (request === undefined) return <Loading />;
  if (request === null) return <Screen><Notice tone="error">Este pedido ya no existe.</Notice></Screen>;

  const state = requestState(request, now);
  const st = REQUEST_STATE[state];
  const canChoose = state === 'open' || state === 'expired';
  const needsAddress = request.fulfillmentMode === 'pickup_delivery';

  async function confirmChoice() {
    if (needsAddress && address.trim().length < 5) return setMsg({ tone: 'error', text: 'Escribe tu dirección para que pasen por tu ropa.' });
    const phoneErr = validatePhoneOptional(phone);
    if (phoneErr) return setMsg({ tone: 'error', text: phoneErr });
    setBusy(true);
    setMsg({ tone: 'info', text: '' });
    try {
      const orderId = await chooseOffer({ request, offer: choosing, uid: user.uid, profile, address, customerPhone: phone });
      setChoosing(null);
      navigation.replace('OrderDetail', { id: orderId, fresh: true });
    } catch (e) {
      setMsg({ tone: 'error', text: friendlyError(e) });
    } finally {
      setBusy(false);
    }
  }

  async function onCancel() {
    setBusy(true);
    try { await cancelRequest(id); } catch (e) { setMsg({ tone: 'error', text: friendlyError(e) }); } finally { setBusy(false); }
  }

  async function onRepublish() {
    setBusy(true);
    try {
      const ref = await republishRequest(user.uid, request);
      navigation.replace('RequestDetail', { id: ref.id, justCreated: true });
    } catch (e) {
      setMsg({ tone: 'error', text: friendlyError(e) });
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={styles.row}>
        <Badge tone={st.tone}>{st.label}</Badge>
        {state === 'open' && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="time-outline" size={17} color={colors.blue} /><Text style={s.timer}>{countdown(request.expiresAt, now)}</Text></View>}
      </View>
      {justCreated && state === 'open' && offers.length === 0 && (
        <Notice tone="success">¡Listo! Tu pedido ya lo ven las lavanderías disponibles de tu zona. Las ofertas aparecen aquí solas.</Notice>
      )}

      <Card>
        <Text style={styles.section}>{requestSummary(request)}</Text>
        <IconLine icon="location-outline">{request.colonia} · {FULFILLMENT_MODES[request.fulfillmentMode]?.label}{request.whenText ? ` · ${request.whenText}` : ''}</IconLine>
      </Card>

      {state === 'assigned' && (
        <Card>
          <Text style={styles.section}>Ya elegiste</Text>
          <Text style={styles.muted}>Tu pedido está con {offers.find((o) => o.id === request.chosenProviderId)?.providerName || 'la lavandería elegida'}.</Text>
          <Button title="Ver mi pedido" onPress={() => navigation.navigate('OrderDetail', { id: request.orderId })} />
        </Card>
      )}

      <Text style={[styles.section, { marginTop: 22 }]}>
        {offers.length === 0 ? 'Ofertas' : `${offers.length} ${offers.length === 1 ? 'oferta' : 'ofertas'}`}
      </Text>
      {state === 'open' && (() => {
        const online = providers.filter((p) => p.id !== user?.uid && isOnline(p, now)
          && (p.zoneIds || []).includes(request.zoneId) && (p.categoryIds || []).includes(request.categoryId)).length;
        return (
          <View style={[s.radarBox, offers.length > 0 && s.radarSmall]}>
            {offers.length === 0 && <Radar size={190} />}
            <Text style={s.radarTitle}>{offers.length === 0 ? 'Buscando lavanderías cerca de ti…' : 'Siguen llegando ofertas…'}</Text>
            <Text style={s.radarText}>
              {online > 0 ? `${online} ${online === 1 ? 'conectada' : 'conectadas'} ahora en tu zona` : 'Ahora no hay lavanderías conectadas; tu pedido les aparecerá en cuanto se conecten.'}
            </Text>
            {offers.length === 0 && <Text style={s.radarHint}>Puedes cerrar esta pantalla: tus ofertas te esperan en Pedidos.</Text>}
          </View>
        );
      })()}
      {offers.length === 0 && state === 'expired' && (
        <Notice tone="warn">Nadie respondió a tiempo. Puedes publicarlo de nuevo o reservar directo con una lavandería de la lista.</Notice>
      )}
      {state === 'expired' && offers.length > 0 && (
        <Notice tone="info">Ya no llegan más ofertas, pero todavía puedes elegir una de estas.</Notice>
      )}
      {offers.map((o) => (
        <OfferCard
          key={o.id}
          offer={o}
          tags={tags[o.id] || []}
          chosen={request.chosenProviderId === o.id}
          onChoose={canChoose ? () => { setChoosing(o); setMsg({ tone: 'info', text: '' }); } : null}
          disabled={busy}
          reviews={reviewsBy ? (reviewsBy[o.id] || []) : undefined}
          now={now}
        />
      ))}

      <Notice tone={msg.tone}>{!choosing ? msg.text : ''}</Notice>
      {state === 'open' && <Button title="Cancelar pedido" variant="danger" onPress={onCancel} loading={busy} style={{ marginTop: 22 }} />}
      {state === 'expired' && offers.length === 0 && (
        <>
          <Button title="Publicar de nuevo" onPress={onRepublish} loading={busy} />
          <Button title="Ver lavanderías y reservar directo" variant="outline" onPress={() => navigation.navigate('CategoryProviders', { categoryId: request.categoryId })} />
        </>
      )}

      {/* Confirmación al elegir: aquí (y solo aquí) se comparte dirección y teléfono */}
      <Modal visible={!!choosing} transparent animationType="fade" onRequestClose={() => setChoosing(null)}>
        <Pressable style={s.bg} onPress={() => !busy && setChoosing(null)}>
          <Pressable style={s.modal} onPress={() => {}}>
            <Text style={styles.section}>Elegir a {choosing?.providerName}</Text>
            <Text style={styles.muted}>Tus datos de contacto solo los verá esta lavandería.</Text>
            {needsAddress && (
              <Field label="Dirección para recoger y entregar" value={address} onChangeText={setAddress} maxLength={200} placeholder="Calle, número y referencias" />
            )}
            <Field label="Tu teléfono (opcional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={LIMITS.phone} hint="Para que te avisen cuando pasen o esté lista." />
            <Notice tone={msg.tone}>{choosing ? msg.text : ''}</Notice>
            <Button title="Confirmar" onPress={confirmChoice} loading={busy} />
            <Button title="Volver" variant="soft" onPress={() => setChoosing(null)} disabled={busy} />
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const s = StyleSheet.create({
  timer: { fontSize: 16, fontFamily: fonts.black, color: colors.blue },
  radarBox: { marginTop: 12, paddingVertical: 22, paddingHorizontal: 18, borderRadius: 22, backgroundColor: colors.navy, alignItems: 'center', overflow: 'hidden' },
  radarSmall: { paddingVertical: 14 },
  radarTitle: { fontSize: 17, fontFamily: fonts.black, color: colors.white, marginTop: 6, textAlign: 'center' },
  radarText: { fontFamily: fonts.regular, fontSize: 13, color: '#cfe9ff', marginTop: 6, textAlign: 'center', lineHeight: 19 },
  radarHint: { fontFamily: fonts.regular, fontSize: 12, color: '#8fa9cc', marginTop: 8, textAlign: 'center' },
  bg: { flex: 1, backgroundColor: '#06142ab0', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal: { backgroundColor: colors.white, borderRadius: 20, padding: 22, width: '100%', maxWidth: 480 },
});
