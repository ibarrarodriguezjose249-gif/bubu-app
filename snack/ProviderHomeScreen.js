// Inicio del proveedor, estilo app de viajes ("modo Uber").
// - Sin aprobar: estado de su solicitud.
// - Aprobado y DESCONECTADO: botón grande "Conectarme" + sus números reales.
// - Aprobado y CONECTADO: radar "Buscando pedidos…". Cuando llega un pedido de su
//   zona sube una tarjeta grande y el teléfono vibra. Si el cliente lo elige,
//   aparece "¡Te eligieron!". Todo con datos reales de Firestore.
// Limitación: solo avisa con la app abierta (las notificaciones push son otra etapa).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Hero from './Hero';
import Radar from './Radar';
import ModeSwitchModal from './ModeSwitchModal';
import { CAN_SWITCH_MODE, IS_SOCIOS } from './variant';
import { Badge, Button, Card, Notice, styles } from './ui';
import { RequestCard, StatPill } from './cards';
import { RatingBadge } from './Rating';
import Icon from './Icon';
import { IconLine } from './ui';
import { useAuth } from './AuthContext';
import { useCatalog } from './CatalogContext';
import { PROVIDER_STATUS, heartbeat, setAvailability } from './providers';
import { acceptRequest, getMyOffer, requestState, requestSummary, subscribeZoneRequests } from './services_requests';
import { subscribeMyOrders } from './orders';
import { ratingSummary, subscribeMyProviderReviews } from './reviews';
import { FULFILLMENT_MODES } from './constants_catalog';
import { HEARTBEAT_MS, MISSED_WINDOW_DAYS, PROVIDER_TYPES } from './constants_requests';
import { BRAND_NAME, colors, fonts } from './brand';
import { countdown, toMillis, timeAgo, useNow } from './time';
import { friendlyError } from './errors';
import { keepScreenOn } from './keepAwake';
import { notifyLocal, openNotificationSettings, registerPushToken } from './notifications';
import { money2, subscribeMyDebtBlock } from './commission';
import { areaCovers, coverageConfigured } from './geo';

const ACTIVE_ORDER = ['requested', 'accepted', 'in_progress', 'ready'];
const vibrate = (pattern) => { try { Vibration.vibrate(pattern); } catch (e) { /* sin vibración */ } };

function ApplicationStatus({ provider, navigation }) {
  const { categoryById, zoneById } = useCatalog();
  if (!provider) {
    return (
      <Card>
        <Text style={styles.section}>Ofrece tus servicios en {BRAND_NAME}</Text>
        <Text style={styles.muted}>Envía tu solicitud. El equipo de {BRAND_NAME} la revisa y, cuando la apruebe, podrás recibir pedidos y mandar ofertas.</Text>
        <Button title="Comenzar solicitud" onPress={() => navigation.navigate('ProviderApplication')} />
      </Card>
    );
  }
  const st = PROVIDER_STATUS[provider.status] || PROVIDER_STATUS.pending;
  return (
    <Card>
      <View style={styles.row}>
        <Text style={[styles.section, { flex: 1 }]} numberOfLines={2}>{provider.businessName}</Text>
        <Badge tone={st.tone}>{st.label}</Badge>
      </View>
      {provider.status !== 'approved' && <Notice tone={st.tone}>{st.text}</Notice>}
      {!!provider.reviewNote && <Notice tone="info">Nota del equipo: {provider.reviewNote}</Notice>}
      <Text style={[styles.muted, { marginTop: 12 }]}>
        {(provider.categoryIds || []).map((id) => categoryById(id)?.name || id).join(', ')} · {(provider.zoneIds || []).map((id) => zoneById(id)?.name || id).join(', ')}
      </Text>
      <Text style={styles.muted}>{(provider.fulfillmentModes || []).map((m) => FULFILLMENT_MODES[m]?.providerLabel || m).join(' · ')}</Text>
      {!!PROVIDER_TYPES[provider.providerType] && <Text style={styles.muted}>{PROVIDER_TYPES[provider.providerType].badge}</Text>}
      {provider.status !== 'suspended' && (
        <Button title={provider.status === 'rejected' ? 'Corregir y reenviar' : 'Editar perfil de proveedor'} variant="outline" onPress={() => navigation.navigate('ProviderApplication')} />
      )}
    </Card>
  );
}

function elapsed(ms) {
  const m = Math.max(0, Math.floor(ms / 60000));
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

export default function ProviderHomeScreen({ navigation }) {
  const { user, provider, profile } = useAuth();
  const { zoneById, zones } = useCatalog();
  const [accepting, setAccepting] = useState('');
  const [modeOpen, setModeOpen] = useState(false);
  const [requests, setRequests] = useState([]);
  const [myOffers, setMyOffers] = useState({}); // requestId -> oferta mía
  const [offerChecked, setOfferChecked] = useState({}); // requestId -> true cuando ya se consultó
  const [orders, setOrders] = useState([]);
  const [reviews, setReviews] = useState(null);
  const [error, setError] = useState('');
  const [toggling, setToggling] = useState(false);
  const [dismissed, setDismissed] = useState({}); // "Ahora no" (solo en esta sesión)
  const [justSent, setJustSent] = useState(null); // tarjeta "Oferta enviada"
  const [celebrated, setCelebrated] = useState(null); // ids de "Te eligieron" ya mostrados
  const [onlineSince, setOnlineSince] = useState(null);
  const now = useNow(1000);
  const focused = useIsFocused();
  const approved = provider?.status === 'approved';
  // Bloqueo por adeudo (lo pone el servidor): no ve ni recibe pedidos nuevos hasta pagar.
  const [debtBlock, setDebtBlock] = useState(null);
  useEffect(() => (approved && user ? subscribeMyDebtBlock(user.uid, setDebtBlock) : undefined), [approved, user?.uid]);
  const blocked = !!debtBlock;
  const available = !!provider?.isAvailable;
  const checked = useRef(new Set());
  const lastIncoming = useRef('');
  const knownOrders = useRef(null); // ids de pedidos ya vistos (para avisar de reservas nuevas)
  const [pushPermission, setPushPermission] = useState('');
  const celebrateKey = user ? `bubu:celebrated:${user.uid}` : '';

  // Pedidos de mi zona (abiertos y pasados).
  useEffect(() => {
    if (!approved || blocked) { setRequests([]); return undefined; }
    return subscribeZoneRequests(provider, setRequests, (e) => setError(friendlyError(e)));
  }, [approved, blocked, provider?.categoryIds?.join(), provider?.zoneIds?.join()]);

  // Mis pedidos como proveedor (en curso, entregados hoy) y mis calificaciones.
  useEffect(() => (approved && user ? subscribeMyOrders(user.uid, 'provider', setOrders, () => {}) : undefined), [approved, user]);
  useEffect(() => (approved && user ? subscribeMyProviderReviews(user.uid, setReviews, () => setReviews(null)) : undefined), [approved, user]);

  // Avisos al teléfono: pide permiso y guarda el token para las notificaciones push.
  useEffect(() => {
    if (!approved || !user) return;
    registerPushToken(user.uid).then((r) => setPushPermission(r.permission)).catch(() => {});
  }, [approved, user?.uid]);

  // Reserva directa nueva (un cliente me eligió sin pasar por oferta): suena.
  useEffect(() => {
    const ids = new Set(orders.map((o) => o.id));
    if (knownOrders.current) {
      const fresh = orders.find((o) => o.status === 'requested' && !knownOrders.current.has(o.id));
      if (fresh) {
        vibrate([0, 400, 200, 400]);
        notifyLocal({ title: 'Nueva reserva', body: `Un cliente te reservó en ${fresh.colonia || 'tu zona'}. Acepta o rechaza.`, data: { type: 'direct_order', orderId: fresh.id } });
      }
    }
    knownOrders.current = ids;
  }, [orders]);

  // Mis ofertas: se consulta una vez por pedido reciente.
  useEffect(() => {
    if (!user) return;
    const limit = Date.now() - MISSED_WINDOW_DAYS * 86400000;
    requests.filter((r) => toMillis(r.createdAt) > limit && !checked.current.has(r.id)).forEach((r) => {
      checked.current.add(r.id);
      getMyOffer(r.id, user.uid)
        .then((o) => { if (o) setMyOffers((m) => ({ ...m, [r.id]: o })); })
        .catch(() => {})
        .finally(() => setOfferChecked((c) => ({ ...c, [r.id]: true })));
    });
  }, [requests, user]);

  // Señal de "sigo conectado" + pantalla encendida mientras esté conectado.
  useEffect(() => {
    if (!approved || !available || !user) return undefined;
    setOnlineSince((t) => t || Date.now());
    keepScreenOn(true);
    heartbeat(user.uid).catch(() => {});
    const t = setInterval(() => heartbeat(user.uid).catch(() => {}), HEARTBEAT_MS);
    return () => { clearInterval(t); keepScreenOn(false); };
  }, [approved, available, user]);
  useEffect(() => { if (!available) setOnlineSince(null); }, [available]);

  // "Te eligieron" ya mostrados (se guardan en el teléfono para no repetirlos).
  useEffect(() => {
    if (!celebrateKey) return;
    AsyncStorage.getItem(celebrateKey)
      .then((v) => setCelebrated(new Set(JSON.parse(v || '[]'))))
      .catch(() => setCelebrated(new Set()));
  }, [celebrateKey]);

  // Solo pedidos dentro de su zona de servicio (si la marcó en el mapa).
  const nearRequests = useMemo(() => requests.filter((r) => areaCovers(provider?.serviceArea, r.approxGeo)), [requests, provider?.serviceArea]);
  const groups = useMemo(() => {
    const weekAgo = now - MISSED_WINDOW_DAYS * 86400000;
    const mine = (r) => r.customerId === user?.uid;
    const open = nearRequests.filter((r) => !mine(r) && requestState(r, now) === 'open');
    const won = requests.filter((r) => r.status === 'assigned' && r.chosenProviderId === user?.uid);
    const recent = nearRequests.filter((r) => !mine(r) && toMillis(r.createdAt) > weekAgo);
    const takenByOthers = recent.filter((r) => r.status === 'assigned' && r.chosenProviderId !== user?.uid);
    const expiredNoChoice = recent.filter((r) => requestState(r, now) === 'expired');
    const missed = [...takenByOthers, ...expiredNoChoice].filter((r) => !myOffers[r.id]);
    const lostWithOffer = takenByOthers.filter((r) => myOffers[r.id]);
    return { open, won, missed, takenByOthers: takenByOthers.filter((r) => !myOffers[r.id]), expiredNoChoice: expiredNoChoice.filter((r) => !myOffers[r.id]), lostWithOffer };
  }, [nearRequests, requests, now, user, myOffers]);

  const canServe = (r) => (provider?.fulfillmentModes || []).includes(r.fulfillmentMode);

  // Pedido que "sube" en pantalla: abierto, que puedo atender, sin oferta mía y no descartado.
  // La vibración avisa aunque estés en otra pantalla; la tarjeta se muestra al estar en Inicio.
  const incomingAny = available && approved && !blocked
    ? groups.open.find((r) => canServe(r) && offerChecked[r.id] && !myOffers[r.id] && !dismissed[r.id])
    : null;
  const incoming = focused && !modeOpen ? incomingAny : null;
  useEffect(() => {
    if (incomingAny && incomingAny.id !== lastIncoming.current) {
      vibrate([0, 400, 200, 400]);
      notifyLocal({ title: 'Nuevo pedido en tu zona', body: `${requestSummary(incomingAny) || 'Pedido'} · ${incomingAny.colonia || ''}`.trim(), data: { type: 'new_request', requestId: incomingAny.id } });
    }
    lastIncoming.current = incomingAny ? incomingAny.id : '';
  }, [incomingAny?.id]);

  // "¡Te eligieron!" que todavía no se ha mostrado.
  // Solo pedidos asignados en las últimas 24 h (para no festejar pedidos viejos).
  const chosenAny = approved && celebrated
    ? groups.won.find((r) => !celebrated.has(r.id) && toMillis(r.updatedAt) > now - 86400000
      && orders.some((o) => o.id === r.orderId && ACTIVE_ORDER.includes(o.status)))
    : null;
  const chosen = focused && !modeOpen ? chosenAny : null;
  useEffect(() => {
    if (!chosenAny) return;
    vibrate([0, 200, 100, 200, 100, 500]);
    notifyLocal({ title: '¡Te eligieron!', body: 'El cliente eligió tu oferta. Abre el pedido para ver los datos.', data: { type: 'chosen', orderId: chosenAny.orderId } });
  }, [chosenAny?.id]);
  function closeChosen(goToOrder) {
    const r = chosen;
    const next = new Set(celebrated);
    next.add(r.id);
    setCelebrated(next);
    AsyncStorage.setItem(celebrateKey, JSON.stringify([...next].slice(-200))).catch(() => {});
    if (goToOrder && r.orderId) navigation.navigate('OrderDetail', { id: r.orderId });
  }

  const activeOrders = orders.filter((o) => ACTIVE_ORDER.includes(o.status));
  // "Te eligieron" en pantalla: solo los que siguen en curso (los terminados están en Pedidos).
  const activeOrderIds = new Set(activeOrders.map((o) => o.id));
  const wonActive = groups.won.filter((r) => activeOrderIds.has(r.orderId));
  const toAccept = orders.filter((o) => o.status === 'requested');
  const startOfDay = new Date(now).setHours(0, 0, 0, 0);
  const deliveredToday = orders.filter((o) => o.status === 'delivered' && toMillis(o.statusChangedAt || o.updatedAt) >= startOfDay).length;
  const rating = ratingSummary(reviews);
  const zoneLabel = (provider?.zoneIds || []).map((id) => zoneById(id)?.name || id).join(', ') || 'tu zona';

  async function toggle(v) {
    setToggling(true);
    setError('');
    try { await setAvailability(user.uid, v); if (v) vibrate(80); } catch (e) { setError(friendlyError(e)); } finally { setToggling(false); }
  }

  // "Acepto": un toque, en el horario que pidió el cliente.
  async function quickAccept(r) {
    setAccepting(r.id);
    setError('');
    try {
      await acceptRequest(r, user.uid, provider, profile);
      const o = await getMyOffer(r.id, user.uid);
      if (o) setMyOffers((m) => ({ ...m, [r.id]: o }));
      setJustSent(r);
      setTimeout(() => setJustSent((cur) => (cur && cur.id === r.id ? null : cur)), 2600);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setAccepting('');
    }
  }

  function openRequestFooter(r) {
    const offered = myOffers[r.id];
    if (!canServe(r)) return <Text style={styles.muted}>No ofreces esta modalidad.</Text>;
    if (offered) return <Badge tone="success">{offered.kind === 'accept' ? 'Aceptaste — el cliente decide' : `Ya ofertaste${typeof offered.priceFrom === 'number' ? ` $${offered.priceFrom}` : ''} — toca para editar`}</Badge>;
    if (!available) return null;
    return (
      <View>
        <Button icon="thumbs-up-outline" title={`Acepto · ${r.whenText || 'su horario'}`} onPress={() => quickAccept(r)} loading={accepting === r.id} disabled={!!accepting} />
        <Button title="Proponer precio u horario" variant="outline" onPress={() => navigation.navigate('MakeOffer', { requestId: r.id })} disabled={!!accepting} />
      </View>
    );
  }

  const ordersBar = activeOrders.length > 0 && (
    <Pressable onPress={() => navigation.navigate('Pedidos')} style={({ pressed }) => [s.ordersBar, pressed && { opacity: 0.9 }]}>
      <Text style={s.ordersBarText}>
        {activeOrders.length} {activeOrders.length === 1 ? 'pedido en curso' : 'pedidos en curso'}
        {toAccept.length > 0 ? ` · ${toAccept.length} por aceptar` : ''}
      </Text>
      <Text style={s.ordersBarText}>›</Text>
    </Pressable>
  );

  const missedCard = approved && (groups.missed.length > 0 || groups.lostWithOffer.length > 0) && (
    <Card style={{ marginTop: 22 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="trending-down" size={20} color={colors.errorText} /><Text style={styles.section}>Te perdiste esta semana</Text></View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
        <StatPill value={groups.takenByOthers.length} label="los tomó otra lavandería" />
        <StatPill value={groups.expiredNoChoice.length} label="vencieron sin respuesta" />
      </View>
      {groups.lostWithOffer.length > 0 && <Text style={styles.muted}>Además, en {groups.lostWithOffer.length} ofertaste pero el cliente eligió otra opción.</Text>}
      {groups.missed.slice(0, 3).map((r) => (
        <Text key={r.id} style={styles.muted}>• {(r.services || []).join(', ') || 'Pedido'} en {r.colonia} · {timeAgo(r.createdAt, now)}</Text>
      ))}
      <IconLine icon="bulb-outline" color={colors.ink} style={{ marginTop: 10 }}>Conéctate y responde rápido: los clientes eligen entre las primeras ofertas.</IconLine>
    </Card>
  );

  // ───────────── CONECTADO: radar ─────────────
  if (approved && available && !blocked) {
    const others = groups.open.filter((r) => !incoming || r.id !== incoming.id);
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.navy }} edges={['top']}>
        <ScrollView style={{ backgroundColor: colors.navy }} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={s.onTop}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><View style={s.onDot} /><Text style={s.onPill}>Conectado</Text></View>
            {CAN_SWITCH_MODE ? <Pressable onPress={() => setModeOpen(true)} style={s.modeBtn}><Icon name="briefcase-outline" size={13} color={colors.white} /><Text style={s.modeText}>Proveedor</Text><Icon name="chevron-down" size={13} color={colors.white} /></Pressable> : <Text style={s.modeText}>{IS_SOCIOS ? 'BÜBÜ Socios' : ''}</Text>}
          </View>
          <View style={{ alignItems: 'center', marginTop: 10 }}>
            <Radar size={250} />
            <Text style={s.onTitle}>Buscando pedidos…</Text>
            <Text style={s.onSub}>en {zoneLabel}</Text>
            <Text style={s.onTime}>Conectado {onlineSince ? elapsed(now - onlineSince) : '0 min'} · la pantalla se mantiene encendida</Text>
            {rating && <RatingBadge summary={rating} style={{ marginTop: 10 }} />}
          </View>

          <View style={styles.page}>
            {ordersBar}
            <Notice tone="error">{error}</Notice>
            {pushPermission === 'denied' && (
              <Pressable onPress={openNotificationSettings}>
                <Notice tone="warn">Las notificaciones están apagadas: no te sonarán los pedidos. Toca aquí para activarlas en Ajustes.</Notice>
              </Pressable>
            )}
            {wonActive.length > 0 && (
              <Pressable onPress={() => navigation.navigate('OrderDetail', { id: wonActive[0].orderId })} style={s.wonBar}>
                <Icon name="trophy-outline" size={18} color={colors.white} /><Text style={s.wonText}>Te eligieron en {wonActive.length} {wonActive.length === 1 ? 'pedido en curso' : 'pedidos en curso'} · ver el último ›</Text>
              </Pressable>
            )}
            {others.length > 0 && (
              <>
                <Text style={[styles.section, { color: colors.white, marginTop: 18 }]}>Pedidos abiertos cerca ({others.length})</Text>
                {others.map((r) => (
                  <RequestCard key={r.id} request={r} state="open" now={now} footer={openRequestFooter(r)}
                    onPress={() => canServe(r) && navigation.navigate('MakeOffer', { requestId: r.id })} />
                ))}
              </>
            )}
            {groups.open.length === 0 && <Text style={s.onHint}>Cuando un cliente de tu zona publique un pedido, aparecerá aquí y te sonará el teléfono.</Text>}
            {missedCard}
            <Button title="Desconectarme" variant="light" onPress={() => toggle(false)} loading={toggling} style={{ marginTop: 26 }} />
            <Text style={[styles.disclaimer, { color: '#8fa9cc' }]}>Te avisamos mientras estés Conectado. Desconéctate para dejar de recibir pedidos. {BRAND_NAME} no procesa pagos.</Text>
          </View>
        </ScrollView>

        {/* Tarjeta de pedido entrante */}
        <Modal visible={!!incoming && !justSent && !chosen} transparent animationType="slide" onRequestClose={() => incoming && setDismissed((d) => ({ ...d, [incoming.id]: true }))}>
          <View style={s.sheetBg}>
            {incoming && (
              <View style={s.sheet}>
                <View style={styles.row}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="notifications" size={16} color={colors.blue} /><Text style={s.newTag}>NUEVO PEDIDO</Text></View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="time-outline" size={16} color={colors.blue} /><Text style={s.sheetTimer}>{countdown(incoming.expiresAt, now)}</Text></View>
                </View>
                <Text style={s.sheetTitle}>{requestSummary(incoming) || 'Pedido'}</Text>
                <IconLine icon="location-outline" color={colors.ink} textStyle={s.sheetText}>{incoming.colonia}</IconLine>
                <IconLine icon={FULFILLMENT_MODES[incoming.fulfillmentMode]?.icon || 'car-outline'} color={colors.ink} textStyle={s.sheetText}>{FULFILLMENT_MODES[incoming.fulfillmentMode]?.label}</IconLine>
                <IconLine icon="calendar-outline" color={colors.ink} textStyle={s.sheetText}>{incoming.whenText || 'Lo antes posible'}</IconLine>
                <Text style={[styles.muted, { marginTop: 10 }]}>Los datos del cliente se comparten solo si te elige.</Text>
                <Button icon="thumbs-up-outline" title={`Acepto · ${incoming.whenText || 'su horario'}`} onPress={() => quickAccept(incoming)} loading={accepting === incoming.id} disabled={!!accepting} style={{ minHeight: 56 }} />
                <Button title="Proponer precio u horario" variant="soft" disabled={!!accepting}
                  onPress={() => { setDismissed((d) => ({ ...d, [incoming.id]: true })); navigation.navigate('MakeOffer', { requestId: incoming.id }); }} />
                <Button title="Ahora no" variant="outline" disabled={!!accepting} onPress={() => setDismissed((d) => ({ ...d, [incoming.id]: true }))} />
              </View>
            )}
          </View>
        </Modal>

        {/* Confirmación breve después de aceptar */}
        <Modal visible={!!justSent && !chosen} transparent animationType="fade" onRequestClose={() => setJustSent(null)}>
          <Pressable style={s.centerBg} onPress={() => setJustSent(null)}>
            <View style={s.sentBox}>
              <Icon name="checkmark-circle" size={56} color={colors.success} />
              <Text style={s.sentTitle}>Oferta enviada</Text>
              <Text style={[styles.muted, { textAlign: 'center' }]}>El cliente está eligiendo… Si te elige, lo verás aquí.</Text>
            </View>
          </Pressable>
        </Modal>

        <ChosenModal chosen={chosen} onClose={closeChosen} />
        <ModeSwitchModal visible={modeOpen} onClose={() => setModeOpen(false)} />
      </SafeAreaView>
    );
  }

  // ───────────── DESCONECTADO o sin aprobar ─────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.blue }} edges={['top']}>
      <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 40 }}>
        <Hero
          eyebrow={IS_SOCIOS ? 'BÜBÜ SOCIOS' : 'MODO PROVEEDOR'}
          title={approved ? 'Estás desconectado.' : 'Ofrece tus servicios.'}
          intro={approved ? 'Conéctate para recibir pedidos de tu zona y mandar tus ofertas.' : 'Registra tu negocio o tu servicio desde casa.'}
          modeLabel="Proveedor"
          modeIcon="briefcase-outline"
          onModePress={() => setModeOpen(true)}
        />
        <View style={styles.page}>
          {approved && !provider?.serviceArea && coverageConfigured(zones) && (
            <Notice tone="info">Marca tu zona de servicio en el mapa para recibir solo pedidos que te quedan cerca. Perfil → Mi zona de servicio.</Notice>
          )}
          {approved && blocked && (
            <Card style={{ borderColor: colors.errorText }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="lock-closed-outline" size={20} color={colors.errorText} /><Text style={styles.section}>Tienes un adeudo con BÜBÜ</Text></View>
              <Text style={[styles.title, { color: colors.errorText, marginTop: 6 }]}>{money2(debtBlock.debt)}</Text>
              <Text style={styles.muted}>Son comisiones de pedidos cobrados en efectivo y pasaste el límite de {money2(debtBlock.debtLimit)}. Mientras tanto no te llegan pedidos nuevos; los que ya tienes sí los puedes terminar. Págalo al equipo de BÜBÜ y se desbloquea solo.</Text>
              <Button icon="cash-outline" title="Ver mis pagos y comisiones" variant="outline" onPress={() => navigation.navigate('Commissions')} />
            </Card>
          )}
          {approved && !blocked && (
            <View style={{ alignItems: 'center', marginTop: 4 }}>
              <Pressable onPress={() => toggle(true)} disabled={toggling} accessibilityRole="button" accessibilityLabel="Conectarme"
                style={({ pressed }) => [s.goBtn, pressed && { transform: [{ scale: 0.96 }] }, toggling && { opacity: 0.6 }]}>
                <Icon name="power" size={46} color={colors.white} />
                <Text style={s.goText}>{toggling ? 'Conectando…' : 'Conectarme'}</Text>
              </Pressable>
              <Text style={[styles.muted, { textAlign: 'center' }]}>
                {groups.open.length > 0
                  ? `Hay ${groups.open.length} ${groups.open.length === 1 ? 'pedido abierto' : 'pedidos abiertos'} en tu zona ahora mismo.`
                  : 'Al conectarte, los clientes te ven "conectado ahora" y te llegan los pedidos.'}
              </Text>
            </View>
          )}
          <Notice tone="error">{error}</Notice>

          {approved && (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <StatPill value={activeOrders.length} label="pedidos en curso" />
              <StatPill value={deliveredToday} label="entregados hoy" tone={deliveredToday > 0 ? 'success' : 'info'} />
              <View style={[s.ratingPill]}>
                <Text style={s.ratingValue}>{rating ? `★ ${rating.avg.toFixed(1)}` : '—'}</Text>
                <Text style={s.ratingLabel}>{rating ? `${rating.count} ${rating.count === 1 ? 'reseña' : 'reseñas'}` : 'sin reseñas'}</Text>
              </View>
            </View>
          )}
          {approved && <View style={{ marginTop: 12 }}>{ordersBar}</View>}

          {approved && wonActive.length > 0 && (
            <>
              <Text style={[styles.section, { marginTop: 22 }]}>¡Te eligieron!</Text>
              {wonActive.slice(0, 3).map((r) => (
                <RequestCard key={r.id} request={r} state="assigned" now={now} onPress={() => navigation.navigate('OrderDetail', { id: r.orderId })}
                  footer={<Text style={[styles.muted, { color: colors.blue, fontFamily: fonts.extra }]}>Ver pedido y datos del cliente ›</Text>} />
              ))}
            </>
          )}

          {approved && groups.open.length > 0 && (
            <>
              <Text style={[styles.section, { marginTop: 22 }]}>Pedidos cerca de ti</Text>
              <Notice tone="warn">Estás desconectado: conéctate para ofertar.</Notice>
              {groups.open.map((r) => (
                <RequestCard key={r.id} request={r} state="open" now={now} footer={openRequestFooter(r)} />
              ))}
            </>
          )}

          {approved && reviews && reviews.filter((r) => r.comment && !r.hidden).length > 0 && (
            <Card>
              <Text style={styles.section}>Lo que dicen tus clientes</Text>
              {reviews.filter((r) => r.comment && !r.hidden).slice(0, 3).map((r) => (
                <Text key={r.id} style={[styles.muted, { marginTop: 8 }]}>{'★'.repeat(r.stars)} “{r.comment}” — {r.customerName || 'Cliente'}</Text>
              ))}
            </Card>
          )}

          {missedCard}
          <ApplicationStatus provider={provider} navigation={navigation} />
          <Text style={styles.disclaimer}>{BRAND_NAME} no procesa pagos. Tus precios son estimados y el pago se acuerda directo con el cliente.</Text>
        </View>
      </ScrollView>
      <ChosenModal chosen={chosen} onClose={closeChosen} />
      <ModeSwitchModal visible={modeOpen} onClose={() => setModeOpen(false)} />
    </SafeAreaView>
  );
}

function ChosenModal({ chosen, onClose }) {
  return (
    <Modal visible={!!chosen} transparent animationType="fade" onRequestClose={() => onClose(false)}>
      <View style={s.centerBg}>
        {chosen && (
          <View style={s.chosenBox}>
            <View style={s.trophy}><Icon name="trophy" size={44} color={colors.white} /></View>
            <Text style={s.chosenTitle}>¡Te eligieron!</Text>
            <Text style={[styles.text, { textAlign: 'center', marginTop: 6 }]}>{requestSummary(chosen) || 'Pedido'}</Text>
            <Text style={[styles.muted, { textAlign: 'center' }]}>{chosen.colonia}{chosen.whenText ? ` · ${chosen.whenText}` : ''}</Text>
            <Button title="Ver pedido y datos del cliente" onPress={() => onClose(true)} style={{ alignSelf: 'stretch' }} />
            <Button title="Después" variant="soft" onPress={() => onClose(false)} style={{ alignSelf: 'stretch' }} />
          </View>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  // Desconectado
  goBtn: { width: 170, height: 170, borderRadius: 85, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center', marginTop: 8, marginBottom: 6,
    borderWidth: 8, borderColor: '#D6E6FF', shadowColor: colors.blue, shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
  goIcon: { fontSize: 42, color: colors.white, fontFamily: fonts.black },
  goText: { fontSize: 18, color: colors.white, fontFamily: fonts.black, marginTop: 4 },
  ratingPill: { flex: 1, backgroundColor: '#FFF6E5', borderRadius: 16, padding: 12 },
  ratingValue: { fontSize: 22, fontFamily: fonts.black, color: '#b26b00' },
  ratingLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  ordersBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.turquoise, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, marginTop: 12 },
  ordersBarText: { fontSize: 15, fontFamily: fonts.bold, color: colors.navy },
  // Conectado
  onTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingTop: 12 },
  onPill: { color: '#7DFFD0', fontFamily: fonts.bold, fontSize: 15 },
  onDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.success },
  modeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#ffffff1f', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  modeText: { color: colors.white, fontFamily: fonts.bold, fontSize: 12 },
  onTitle: { fontSize: 26, fontFamily: fonts.extra, color: colors.white, marginTop: 6 },
  onSub: { fontFamily: fonts.regular, fontSize: 15, color: '#cfe9ff', marginTop: 4 },
  onTime: { fontFamily: fonts.regular, fontSize: 12, color: '#8fa9cc', marginTop: 10, textAlign: 'center', paddingHorizontal: 20 },
  onHint: { fontFamily: fonts.regular, fontSize: 14, color: '#cfe9ff', textAlign: 'center', marginTop: 18, lineHeight: 20 },
  wonBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.success, borderRadius: 16, padding: 14, marginTop: 12 },
  wonText: { flex: 1, color: colors.white, fontFamily: fonts.bold, fontSize: 14 },
  // Tarjeta entrante
  sheetBg: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#06142a99' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 34 },
  newTag: { fontSize: 13, fontFamily: fonts.extra, color: colors.blue, letterSpacing: 1 },
  sheetTimer: { fontSize: 15, fontFamily: fonts.black, color: colors.blue },
  sheetTitle: { fontSize: 24, fontFamily: fonts.extra, color: colors.ink, marginTop: 12 },
  sheetText: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 22 },
  // Ventanas centradas
  centerBg: { flex: 1, backgroundColor: '#06142ab0', alignItems: 'center', justifyContent: 'center', padding: 22 },
  sentBox: { backgroundColor: colors.white, borderRadius: 24, padding: 26, alignItems: 'center', width: '100%', maxWidth: 400 },
  sentTitle: { fontSize: 22, fontFamily: fonts.black, color: colors.ink, marginTop: 6 },
  chosenBox: { backgroundColor: colors.white, borderRadius: 28, padding: 26, alignItems: 'center', width: '100%', maxWidth: 420, borderWidth: 4, borderColor: colors.success },
  chosenTitle: { fontSize: 30, fontFamily: fonts.extra, color: colors.successText, marginTop: 10 },
  trophy: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
});
