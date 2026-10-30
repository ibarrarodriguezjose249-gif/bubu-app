// Detalle de un pedido para cliente y proveedor: estado, datos de contacto y acciones.
import React, { useEffect, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge, Button, Card, Field, IconLine, Loading, Notice, Screen, styles } from './ui';
import Icon from './Icon';
import { StatusPill } from './cards';
import { STAR_WORDS, StarPicker, Stars } from './Rating';
import { REVIEW_COMMENT_MAX, getReview, submitReview } from './reviews';
import { useAuth } from './AuthContext';
import { colors, fonts } from './brand';
import { FULFILLMENT_MODES } from './constants_catalog';
import { CUSTOMER_TRANSITIONS, ORDER_STATUS, PROVIDER_TRANSITIONS } from './orderStatus';
import { changeOrderStatus, subscribeOrder } from './orders';
import { formatMoney, timeAgo, useNow } from './time';
import { friendlyError } from './errors';
import { commissionLabel, commissionOf, feeFor, money2, subscribeCommissionConfig } from './commission';
import { chatIsOpen } from './chat';
import { bagCode, deliverWithPhoto, deliverWithPin, evidenceUrl, getDeliveryPin, takeEvidencePhoto, uploadEvidence } from './evidence';
import { PAYMENT_STATUS, choosePayment, confirmTransfer, customerDeliver, getPayInfo, parseAmount, payWithCard, paymentStatusOf, pickReceipt, receiptUrl, reportTransfer, setAmountDue, transferInfoFrom } from './payments';

const STEPS = ['requested', 'accepted', 'in_progress', 'ready', 'delivered'];

const ACTION_LABELS = {
  provider: {
    accepted: 'Aceptar pedido',
    rejected: 'Rechazar',
    in_progress: 'Recibí la ropa / Empecé',
    ready: 'Marcar como listo',
    delivered: 'Marcar como entregado',
    cancelled: 'Cancelar pedido',
  },
  customer: { cancelled: 'Cancelar pedido' },
};
const DANGER = ['rejected', 'cancelled'];

export default function OrderDetailScreen({ route, navigation }) {
  const { id, fresh } = route.params || {};
  const { user, profile } = useAuth();
  const [order, setOrder] = useState(undefined);
  const [busy, setBusy] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState('');
  const now = useNow(30000);

  useEffect(() => subscribeOrder(id, setOrder, (e) => setMsg(friendlyError(e))), [id]);

  // Total cobrado al entregar (para la comisión de BÜBÜ).
  const [priceText, setPriceText] = useState('');
  const [cfg, setCfg] = useState(null); // % de comisión, IVA y cuota de servicio vigentes
  const canDeliver = order?.status === 'ready' && order?.providerId === user?.uid;
  useEffect(() => subscribeCommissionConfig(setCfg), []);
  // Si ya hay total a pagar, se propone como total cobrado.
  useEffect(() => { if (canDeliver && typeof order?.amountDue === 'number') setPriceText((t) => t || String(order.amountDue)); }, [canDeliver, order?.amountDue]);

  // Cuenta del socio para transferencias (se copia al pedido al anotar el total).
  const [payInfo, setPayInfo] = useState(undefined);
  const isMineAsProvider = !!order && order.providerId === user?.uid;
  const focused = useIsFocused(); // al regresar de registrar la cuenta, se vuelve a leer
  useEffect(() => {
    if (!focused || !isMineAsProvider || !['accepted', 'in_progress', 'ready'].includes(order?.status)) return;
    getPayInfo(user.uid).then(setPayInfo).catch(() => setPayInfo(null));
  }, [focused, isMineAsProvider, order?.status, user?.uid]);

  // Total a pagar (lo anota el socio al recibir y pesar la ropa).
  const [amountText, setAmountText] = useState('');
  const [payBusy, setPayBusy] = useState('');
  const [payMsg, setPayMsg] = useState({ tone: 'info', text: '' });

  // Fotos de la bolsa (báscula obligatoria al anotar el total; recolección opcional).
  const [weightImg, setWeightImg] = useState(null);
  const [pickupImg, setPickupImg] = useState(null);

  // PIN de entrega: el cliente lo ve y se lo dice al socio al recibir su ropa.
  const [pinDoc, setPinDoc] = useState(undefined);
  const isMineAsCustomer = !!order && order.customerId === user?.uid;
  const pinOpen = ['requested', 'accepted', 'in_progress', 'ready'].includes(order?.status);
  useEffect(() => {
    if (!focused || !isMineAsCustomer || !pinOpen) return;
    getDeliveryPin(id).then(setPinDoc).catch(() => setPinDoc(null));
  }, [focused, isMineAsCustomer, pinOpen, id]);

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

  const paidCard = order?.paymentStatus === 'paid';
  // Sin servidor (antes de activar Blaze) no hay fotos ni PIN: se entrega como antes.
  const serverOn = !!cfg?.serverOn;
  // Si ya hay total a pagar (el que vio el cliente), ESE es el total: no se puede bajar al entregar.
  const lockedTotal = typeof order?.amountDue === 'number';
  const price = (paidCard || lockedTotal) ? order.amountDue : Number(String(priceText).replace(/[$,\s]/g, ''));
  const priceOk = Number.isFinite(price) && price > 0 && price <= 100000;
  const amount = parseAmount(amountText);

  async function doAction(to) {
    if (to === 'in_progress' && role === 'provider' && !amount) { setMsg('Escribe el total que va a pagar el cliente (por ejemplo 150).'); return; }
    if (to === 'in_progress' && role === 'provider' && serverOn && !weightImg) { setMsg('Toma la foto de la bolsa en la báscula. Es obligatoria para anotar el total.'); return; }
    if (to === 'delivered' && !priceOk) { setMsg('Escribe cuánto le cobraste al cliente (por ejemplo 150).'); return; }
    if (to === 'delivered' && cfg === null) { setMsg('Cargando el % de comisión… intenta de nuevo en un momento.'); return; }
    if (DANGER.includes(to) && confirm !== to) { setConfirm(to); return; }
    setBusy(to);
    setMsg('');
    try {
      const extra = {};
      if (role === 'provider' && to === 'accepted' && profile?.phone) extra.providerPhone = profile.phone;
      if (to === 'delivered') {
        extra.finalPrice = price; extra.commissionPct = cfg.pct; extra.commissionIvaPct = cfg.ivaPct; extra.deliveredBy = 'provider';
        if (!paidCard) extra.serviceFee = cfg.serviceFee;
      }
      if (to === 'in_progress') {
        extra.amountDue = amount; const ti = transferInfoFrom(payInfo); if (ti) extra.transferInfo = ti;
        if (serverOn && weightImg) extra.weightPhotoPath = await uploadEvidence(order.id, 'weight', weightImg);
        if (serverOn && pickupImg) extra.pickupPhotoPath = await uploadEvidence(order.id, 'pickup', pickupImg);
      }
      await changeOrderStatus(order.id, to, extra);
      if (to === 'in_progress') { setWeightImg(null); setPickupImg(null); }
      setConfirm('');
    } catch (e) {
      setMsg(e?.code ? friendlyError(e) : (e?.message || friendlyError(e)));
    } finally {
      setBusy('');
    }
  }

  async function snap(setter) {
    setMsg('');
    try { const img = await takeEvidencePhoto(); if (img) setter(img); } catch (e) { setMsg(e?.message || friendlyError(e)); }
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
        <StatusPill status={order.status} />
      </View>
      <Text style={styles.muted}>Pedido {timeAgo(order.createdAt, now)} · Bolsa <Text style={s.bag}>{bagCode(order.id)}</Text></Text>

      {role === 'customer' && pinOpen && pinDoc && serverOn && (
        <Card style={{ borderColor: colors.blue }}>
          <Text style={styles.section}>Tu PIN de entrega</Text>
          <Text style={s.pin}>{pinDoc.pin}</Text>
          <Text style={styles.muted}>Dáselo a {order.providerName || 'la lavandería'} SOLO cuando tengas tu ropa en la mano. No lo compartas por mensaje ni antes de recibirla. Tu bolsa dice {bagCode(order.id)}.</Text>
        </Card>
      )}

      {/* Línea de avance */}
      {stepIndex >= 0 && (
        <View style={s.steps}>
          {STEPS.map((k, i) => (
            <View key={k} style={s.stepWrap}>
              {i > 0 && <View style={[s.line, i <= stepIndex && { backgroundColor: colors.blue }]} />}
              <View style={[s.dot, i <= stepIndex && s.dotOn, i === stepIndex && s.dotNow]}>
                <Icon name={ORDER_STATUS[k].icon} size={16} color={i <= stepIndex ? colors.white : '#9AA6B8'} />
              </View>
              <Text style={[s.stepText, i <= stepIndex && { color: colors.blue, fontFamily: fonts.bold }]} numberOfLines={1}>{ORDER_STATUS[k].label}</Text>
            </View>
          ))}
        </View>
      )}

      <Card>
        <Text style={styles.section}>Pedido</Text>
        <Text style={styles.text}>{order.details}</Text>
        <IconLine icon={FULFILLMENT_MODES[order.fulfillmentMode]?.icon || 'swap-horizontal-outline'}>{FULFILLMENT_MODES[order.fulfillmentMode]?.label}{order.whenText ? ` · ${order.whenText}` : ''}</IconLine>
        {!!order.agreedPickup && <IconLine icon="car-outline">Recoge / recibe: {order.agreedPickup}</IconLine>}
        {!!order.agreedReady && <IconLine icon="checkmark-circle-outline">Listo: {order.agreedReady}</IconLine>}
        {typeof order.priceEstimate === 'number' && <Text style={[styles.text, { marginTop: 8, fontFamily: fonts.extra }]}>Precio estimado: {formatMoney(order.priceEstimate)}</Text>}
        {typeof order.finalPrice === 'number' && <Text style={[styles.text, { marginTop: 8, fontFamily: fonts.extra }]}>Servicio: {money2(order.finalPrice)}{typeof order.serviceFee === 'number' && order.serviceFee > 0 ? ` + cuota de servicio ${money2(order.serviceFee)}` : ''}</Text>}
        {typeof order.finalPrice === 'number' && role === 'provider' && (
          <Text style={styles.muted}>Comisión BÜBÜ ({commissionLabel(order.commissionPct ?? 30, order.commissionIvaPct)}): {money2(commissionOf(order))}</Text>
        )}
        <Text style={styles.muted}>Al recibir tu ropa, el socio anota el total. Puedes pagarlo con tarjeta en la app o en efectivo al entregar.</Text>
      </Card>

      {/* Total a pagar: el socio lo anota al recibir y pesar la ropa */}
      {role === 'provider' && order.status === 'accepted' && (
        <Card style={{ borderColor: colors.blue }}>
          <Text style={styles.section}>Total a pagar</Text>
          <Text style={styles.muted}>Al recibir y pesar la ropa, anota cuánto es. El cliente te paga en efectivo{payInfo ? ' o por transferencia a tu cuenta' : ''}.</Text>
          <Field icon="cash-outline" label="Total (pesos)" value={amountText} onChangeText={setAmountText} keyboardType="decimal-pad" maxLength={9} placeholder="Ej. 150" />
          {payInfo === null && <Button icon="swap-horizontal-outline" title="Registrar mi cuenta para transferencias" variant="soft" onPress={() => navigation.navigate('PayoutAccount')} />}
          {!!payInfo && <Text style={styles.muted}>Tu cliente verá tu cuenta {payInfo.bank ? `${payInfo.bank} ` : ''}…{String(payInfo.account).slice(-4)} para transferirte.</Text>}
          {serverOn ? (
            <>
              <Text style={[styles.section, { marginTop: 14 }]}>Fotos de la bolsa cerrada</Text>
              <Text style={styles.muted}>Escribe {bagCode(order.id)} en la bolsa. Toma la foto de la bolsa CERRADA, no de la ropa.</Text>
              <PhotoPick label="Báscula con el peso (obligatoria)" img={weightImg} onPick={() => snap(setWeightImg)} onClear={() => setWeightImg(null)} />
              <PhotoPick label="Bolsa al recolectar (opcional)" img={pickupImg} onPick={() => snap(setPickupImg)} onClear={() => setPickupImg(null)} />
            </>
          ) : (
            <Text style={[styles.muted, { marginTop: 10 }]}>Escribe <Text style={s.bag}>{bagCode(order.id)}</Text> en la bolsa.</Text>
          )}
        </Card>
      )}

      {(typeof order.amountDue === 'number' || role === 'provider') && ['in_progress', 'ready', 'delivered'].includes(order.status) && (
        <PaymentCard order={order} role={role} busy={payBusy} msg={payMsg} serviceFee={cfg ? cfg.serviceFee : null} cardEnabled={!!cfg?.cardEnabled} allowPhoto={serverOn}
          onReport={async (data) => {
            setPayBusy('report'); setPayMsg({ tone: 'info', text: '' });
            try { await reportTransfer(order.id, data); setPayMsg({ tone: 'success', text: 'Listo. Le avisamos a la lavandería para que revise su banco y lo confirme.' }); return true; }
            catch (e) { setPayMsg({ tone: 'error', text: e?.code ? friendlyError(e) : (e?.message || friendlyError(e)) }); return false; }
            finally { setPayBusy(''); }
          }}
          onConfirmTransfer={async () => {
            setPayBusy('confirm'); setPayMsg({ tone: 'info', text: '' });
            try { await confirmTransfer(order.id); } catch (e) { setPayMsg({ tone: 'error', text: friendlyError(e) }); } finally { setPayBusy(''); }
          }}
          onPay={async () => {
            setPayBusy('card'); setPayMsg({ tone: 'info', text: '' });
            try {
              const r = await payWithCard(order.id);
              setPayMsg({ tone: 'info', text: r.test ? 'MODO DE PRUEBA: usa la tarjeta de prueba 4242 4242 4242 4242 (cualquier fecha futura y cualquier CVC). Al terminar, regresa a la app; el pago se confirma solo.' : 'Al terminar de pagar, regresa a la app; el pago se confirma solo.' });
            } catch (e) { setPayMsg({ tone: 'error', text: e?.message && !String(e.code || '').includes('internal') ? e.message : friendlyError(e) }); }
            finally { setPayBusy(''); }
          }}
          onChoose={async (choice) => {
            setPayBusy(choice); setPayMsg({ tone: 'info', text: '' });
            try { await choosePayment(order.id, choice); } catch (e) { setPayMsg({ tone: 'error', text: friendlyError(e) }); } finally { setPayBusy(''); }
          }}
          onAmount={async (v) => {
            setPayBusy('amount'); setPayMsg({ tone: 'info', text: '' });
            try {
              // Sin foto de báscula todavía (pedidos anteriores): se pide ahora.
              let path = null;
              if (serverOn && !order.weightPhotoPath) {
                const img = await takeEvidencePhoto();
                if (!img) { setPayMsg({ tone: 'error', text: 'Toma la foto de la bolsa en la báscula para anotar el total.' }); return; }
                path = await uploadEvidence(order.id, 'weight', img);
              }
              await setAmountDue(order.id, v, transferInfoFrom(payInfo), path);
              setPayMsg({ tone: 'success', text: 'Total actualizado.' });
            } catch (e) { setPayMsg({ tone: 'error', text: e?.code ? friendlyError(e) : (e?.message || friendlyError(e)) }); } finally { setPayBusy(''); }
          }} />
      )}

      {canDeliver && paidCard && (
        <Notice tone="success">El cliente ya pagó {money2(order.amountDue)} con tarjeta. Al entregar, ese es el total cobrado.</Notice>
      )}
      {canDeliver && !paidCard && lockedTotal && (
        <Notice tone="info">Al entregar, el total del servicio es {money2(order.amountDue)} (el que vio y paga el cliente){cfg ? `; comisión BÜBÜ ${commissionLabel(cfg.pct, cfg.ivaPct)}: ${money2(feeFor(order.amountDue, cfg.pct, cfg.ivaPct))}` : ''}. Si cambió, corrígelo arriba antes de entregar.</Notice>
      )}
      {canDeliver && !paidCard && !lockedTotal && (
        <Card style={{ borderColor: colors.blue }}>
          <Text style={styles.section}>¿Cuánto cobraste por el servicio?</Text>
          <Field icon="cash-outline" label="Total del servicio (pesos, sin la cuota)" value={priceText} onChangeText={setPriceText} keyboardType="decimal-pad" maxLength={9} placeholder="Ej. 150" />
          {priceOk && cfg !== null && (
            <Text style={styles.muted}>Comisión BÜBÜ ({commissionLabel(cfg.pct, cfg.ivaPct)}): {money2(feeFor(price, cfg.pct, cfg.ivaPct))}{cfg.serviceFee ? ` + cuota de servicio que cobraste: ${money2(cfg.serviceFee)}` : ''}. Se descuenta en tu corte semanal.</Text>
          )}
          <Text style={styles.muted}>Se pide al marcar como entregado. Anota el total real: el cliente también lo ve en su pedido.</Text>
        </Card>
      )}

      {canDeliver && serverOn && (
        <DeliveryCard order={order} price={price} priceOk={priceOk} cfg={cfg}
          onPin={async (pin) => {
            const r = await deliverWithPin(order.id, pin, lockedTotal || paidCard ? undefined : price);
            return r;
          }}
          onPhoto={async (img) => {
            const path = await uploadEvidence(order.id, 'delivery', img);
            await deliverWithPhoto(order, cfg, price, path);
          }} />
      )}

      <EvidenceStrip order={order} />

      {chatIsOpen(order, now) && (
        <Button icon="chatbubbles-outline" title={role === 'provider' ? 'Mensajes con el cliente' : `Mensajes con ${order.providerName || 'la lavandería'}`} variant="soft"
          onPress={() => navigation.navigate('OrderChat', { id: order.id })} />
      )}
      <Card>
        <Text style={styles.section}>Contacto</Text>
        <IconLine icon="location-outline">Colonia: {order.colonia}</IconLine>
        {!!order.address && <IconLine icon="home-outline" color={colors.ink}>{order.address}</IconLine>}
        {otherPhone ? (
          <Button icon="call-outline" title={`Llamar al ${otherPhone}`} variant="outline" onPress={() => Linking.openURL(`tel:${otherPhone}`)} />
        ) : (
          <Text style={styles.muted}>{role === 'provider' ? 'El cliente no compartió teléfono.' : 'La lavandería compartirá su teléfono al aceptar.'}</Text>
        )}
      </Card>

      {delivered && role === 'customer' && review === null && (
        <Card style={{ borderColor: '#f5a623' }}>
          <Text style={[styles.section, { textAlign: 'center' }]}>¿Cómo te fue con {order.providerName}?</Text>
          <StarPicker value={stars} onChange={setStars} disabled={rateBusy} />
          <Text style={[styles.muted, { textAlign: 'center', fontFamily: fonts.extra }]}>{STAR_WORDS[stars] || 'Toca una estrella'}</Text>
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

      {role === 'customer' && ['in_progress', 'ready'].includes(order.status) && typeof order.amountDue === 'number' && (
        <Card>
          <Text style={styles.section}>¿Ya tienes tu ropa?</Text>
          <Text style={styles.muted}>Si {order.providerName || 'la lavandería'} ya te la entregó, márcalo aquí para cerrar el pedido y calificar.</Text>
          <Button icon="checkmark-done-outline" title={confirm === 'received' ? 'Toca otra vez para confirmar' : 'Ya recibí mi ropa'} variant="outline" loading={busy === 'received'} disabled={!!busy || !cfg}
            onPress={async () => {
              if (confirm !== 'received') { setConfirm('received'); return; }
              setBusy('received'); setMsg('');
              try { await customerDeliver(order, cfg); setConfirm(''); } catch (e) { setMsg(friendlyError(e)); } finally { setBusy(''); }
            }} />
        </Card>
      )}
      <Notice tone="error">{msg}</Notice>
      {next.filter((to) => !(serverOn && role === 'provider' && to === 'delivered')).map((to) => (
        <Button
          key={to}
          title={confirm === to ? `Toca otra vez para confirmar: ${ACTION_LABELS[role][to] || to}` : (ACTION_LABELS[role][to] || to)}
          variant={DANGER.includes(to) ? 'danger' : 'primary'}
          loading={busy === to}
          disabled={!!busy && busy !== to}
          onPress={() => doAction(to)}
        />
      ))}
      {next.length === 0 && !(canDeliver && serverOn) && <Text style={[styles.muted, { textAlign: 'center', marginTop: 18 }]}>No hay acciones pendientes para ti en este pedido.</Text>}
    </Screen>
  );
}

// Botón para tomar una foto de la bolsa, con vista previa.
function PhotoPick({ label, img, onPick, onClear }) {
  return (
    <View style={s.photoRow}>
      {img ? <Image source={{ uri: img.uri }} style={s.thumb} /> : <View style={[s.thumb, s.thumbEmpty]}><Icon name="camera-outline" size={22} color={colors.muted} /></View>}
      <View style={{ flex: 1 }}>
        <Text style={s.photoLabel}>{label}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={onPick} accessibilityRole="button"><Text style={s.link}>{img ? 'Tomar otra' : 'Tomar foto'}</Text></Pressable>
          {!!img && <Pressable onPress={onClear} accessibilityRole="button"><Text style={[s.link, { color: colors.muted }]}>Quitar</Text></Pressable>}
        </View>
      </View>
    </View>
  );
}

// Entrega: con el PIN que dice el cliente (lo verifica el servidor) o, si no hay PIN,
// con foto de la entrega (queda para revisión del equipo de BÜBÜ).
function DeliveryCard({ order, price, priceOk, cfg, onPin, onPhoto }) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [left, setLeft] = useState(null);
  const [photoMode, setPhotoMode] = useState(false);
  const [img, setImg] = useState(null);
  const errText = (e) => (e?.message && !String(e.code || '').includes('internal') ? e.message : friendlyError(e));
  async function byPin() {
    if (!/^[0-9]{4}$/.test(pin)) return setErr('El PIN son 4 números. Pídeselo al cliente.');
    if (!priceOk) return setErr('Escribe cuánto le cobraste al cliente (por ejemplo 150).');
    setBusy('pin'); setErr('');
    try {
      const r = await onPin(pin);
      if (!r.ok) { setLeft(r.attemptsLeft); setErr(r.attemptsLeft > 0 ? `PIN incorrecto. Te quedan ${r.attemptsLeft} intentos.` : 'PIN incorrecto. Se acabaron los intentos: entrega con foto.'); if (!r.attemptsLeft) setPhotoMode(true); }
    } catch (e) { setErr(errText(e)); if (e?.code === 'functions/failed-precondition' || e?.code === 'functions/resource-exhausted') setPhotoMode(true); }
    finally { setBusy(''); }
  }
  async function byPhoto() {
    if (!img) return setErr('Toma la foto de la bolsa entregada.');
    if (!priceOk) return setErr('Escribe cuánto le cobraste al cliente (por ejemplo 150).');
    if (!cfg) return setErr('Cargando el % de comisión… intenta de nuevo en un momento.');
    setBusy('photo'); setErr('');
    try { await onPhoto(img); } catch (e) { setErr(e?.code ? friendlyError(e) : (e?.message || friendlyError(e))); } finally { setBusy(''); }
  }
  return (
    <Card style={{ borderColor: colors.blue }}>
      <Text style={styles.section}>Entregar la bolsa {bagCode(order.id)}</Text>
      {!photoMode ? (
        <>
          <Text style={styles.muted}>Pídele al cliente su PIN de 4 números cuando tenga la ropa en la mano.</Text>
          <Field icon="key-outline" label="PIN del cliente" value={pin} onChangeText={(t) => setPin(t.replace(/[^0-9]/g, '').slice(0, 4))} keyboardType="number-pad" maxLength={4} placeholder="0000" />
          <Notice tone="error">{err}</Notice>
          <Button icon="checkmark-done-outline" title="Entregar con PIN" onPress={byPin} loading={busy === 'pin'} disabled={!!busy || left === 0} />
          <Pressable onPress={() => { setPhotoMode(true); setErr(''); }} accessibilityRole="button"><Text style={[s.link, { textAlign: 'center', marginTop: 10 }]}>El cliente no tiene su PIN → entregar con foto</Text></Pressable>
        </>
      ) : (
        <>
          <Text style={styles.muted}>Toma una foto de la bolsa cerrada entregada (en la puerta o en manos del cliente, sin mostrar su cara). El pedido queda para revisión del equipo de BÜBÜ.</Text>
          <PhotoPick label="Foto de la entrega (obligatoria)" img={img} onPick={async () => { setErr(''); try { const i = await takeEvidencePhoto(); if (i) setImg(i); } catch (e) { setErr(e?.message || friendlyError(e)); } }} onClear={() => setImg(null)} />
          <Notice tone="error">{err}</Notice>
          <Button icon="camera-outline" title="Entregar con foto" onPress={byPhoto} loading={busy === 'photo'} disabled={!!busy} />
          {left !== 0 && <Pressable onPress={() => { setPhotoMode(false); setErr(''); }} accessibilityRole="button"><Text style={[s.link, { textAlign: 'center', marginTop: 10 }]}>Volver al PIN</Text></Pressable>}
        </>
      )}
    </Card>
  );
}

// Fotos de evidencia del pedido (las ven cliente, socio y admin).
function EvidenceStrip({ order }) {
  const items = [['weightPhotoPath', 'Báscula'], ['pickupPhotoPath', 'Recolección'], ['deliveryPhotoPath', 'Entrega']].filter(([k]) => order[k]);
  const [urls, setUrls] = useState({});
  const key = items.map(([k]) => order[k]).join('|');
  useEffect(() => {
    let alive = true;
    items.forEach(([k]) => evidenceUrl(order[k]).then((u) => alive && setUrls((x) => ({ ...x, [k]: u }))).catch(() => {}));
    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!items.length && !order.deliveryVerified) return null;
  return (
    <Card>
      <Text style={styles.section}>Evidencia de la bolsa {bagCode(order.id)}</Text>
      {order.deliveryVerified === 'pin' && <Badge tone="success">Entregado con PIN</Badge>}
      {order.deliveryVerified === 'photo' && <Badge tone="warn">Entregado con foto (en revisión)</Badge>}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
        {items.map(([k, label]) => (
          <Pressable key={k} onPress={() => urls[k] && Linking.openURL(urls[k])} accessibilityRole="imagebutton" accessibilityLabel={`Foto: ${label}`}>
            {urls[k] ? <Image source={{ uri: urls[k] }} style={s.thumb} /> : <View style={[s.thumb, s.thumbEmpty]}><Icon name="image-outline" size={20} color={colors.muted} /></View>}
            <Text style={[styles.muted, { textAlign: 'center' }]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={[styles.muted, { marginTop: 6 }]}>Las fotos se borran solas a los 90 días.</Text>
    </Card>
  );
}

// Pago del pedido: el cliente elige efectivo, transferencia directa al socio o (si el admin
// lo activó) tarjeta. El socio ve el estado, confirma transferencias y corrige el total.
// Clave de rastreo y foto del comprobante (la ven cliente, socio y admin).
function ReceiptBlock({ order }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!order.receiptPath) return;
    receiptUrl(order.receiptPath).then(setUrl).catch(() => setUrl(''));
  }, [order.receiptPath]);
  if (!order.transferRef && !order.receiptPath) return null;
  return (
    <View style={s.receipt}>
      {!!order.transferRef && <Text selectable style={s.transferLine}>Clave de rastreo: {order.transferRef}</Text>}
      {!!order.receiptPath && (url
        ? <Pressable onPress={() => Linking.openURL(url)} accessibilityRole="imagebutton" accessibilityLabel="Ver comprobante"><Image source={{ uri: url }} style={s.receiptImg} resizeMode="cover" /><Text style={styles.muted}>Toca para ver el comprobante completo</Text></Pressable>
        : <Text style={styles.muted}>{url === '' ? 'No se pudo cargar el comprobante.' : 'Cargando comprobante…'}</Text>)}
      <Text style={styles.muted}>Se puede verificar en banxico.org.mx/cep con la clave de rastreo, la fecha y el monto.</Text>
    </View>
  );
}

// Formulario "Ya transferí" (clave de rastreo + captura del comprobante).
function ReportTransfer({ busy, onReport, again, allowPhoto = true }) {
  const [ref, setRef] = useState('');
  const [img, setImg] = useState(null);
  const [err, setErr] = useState('');
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={styles.section}>{again ? 'Enviar otro comprobante' : '¿Ya transferiste?'}</Text>
      <Field icon="key-outline" label={allowPhoto ? 'Clave de rastreo (opcional)' : 'Clave de rastreo'} value={ref} onChangeText={setRef} maxLength={40} autoCapitalize="characters" placeholder="Viene en el comprobante de tu banco" />
      {img && <Image source={{ uri: img.uri }} style={s.receiptImg} resizeMode="cover" />}
      {allowPhoto && <Button icon="image-outline" title={img ? 'Cambiar captura' : 'Adjuntar captura del comprobante'} variant="soft" disabled={!!busy}
        onPress={async () => { setErr(''); try { const r = await pickReceipt(); if (r) setImg(r); } catch (e) { setErr(e.message); } }} />}
      <Notice tone="error">{err}</Notice>
      <Button icon="checkmark-outline" title="Ya transferí" loading={busy === 'report'} disabled={!!busy || (!ref.trim() && !img)}
        onPress={async () => { if (await onReport({ transferRef: ref, image: img })) { setRef(''); setImg(null); } }} />
    </View>
  );
}

function PaymentCard({ order, role, busy, msg, serviceFee, cardEnabled, allowPhoto, onPay, onChoose, onAmount, onConfirmTransfer, onReport }) {
  const st = paymentStatusOf(order);
  const info = PAYMENT_STATUS[st] || PAYMENT_STATUS.pending;
  const open = ['in_progress', 'ready'].includes(order.status);
  const [edit, setEdit] = useState('');
  const editable = role === 'provider' && open && !['paid', 'review', 'transfer_ok'].includes(st);
  const hasAmount = typeof order.amountDue === 'number';
  const total = hasAmount && serviceFee != null ? order.amountDue + serviceFee : order.amountDue;
  const ti = order.transferInfo;
  const choosing = role === 'customer' && open && hasAmount && ['pending', 'cash', 'transfer'].includes(st);
  return (
    <Card>
      <View style={styles.row}>
        <Text style={styles.section}>Pago</Text>
        <Badge tone={info.tone} icon={info.icon}>{info.label}</Badge>
      </View>
      {hasAmount
        ? <Text style={[styles.title, { marginTop: 6 }]}>{money2(total)}</Text>
        : <Text style={styles.muted}>Falta anotar el total a pagar.</Text>}
      {hasAmount && serviceFee > 0 && st !== 'paid' && (
        <Text style={styles.muted}>Servicio {money2(order.amountDue)} + cuota de servicio {money2(serviceFee)}.</Text>
      )}

      {/* Cliente: cómo va a pagar */}
      {choosing && st === 'transfer' && ti && (
        <View style={s.transfer}>
          <Text style={s.transferTitle}>Transfiere {money2(total)} a:</Text>
          <Text selectable style={s.transferLine}>{ti.holder}</Text>
          {!!ti.bank && <Text selectable style={s.transferLine}>{ti.bank}</Text>}
          <Text selectable style={[s.transferLine, { fontFamily: fonts.extra, letterSpacing: 1 }]}>{ti.account}</Text>
          <Text selectable style={styles.muted}>Concepto: BÜBÜ {order.id.slice(0, 6).toUpperCase()}</Text>
          {!!ti.note && <Text style={styles.muted}>{ti.note}</Text>}
          <Text style={[styles.muted, { marginTop: 6 }]}>Mantén presionado para copiar. El dinero le llega directo a {order.providerName || 'la lavandería'}; cuando lo reciba, lo confirmará aquí.</Text>
        </View>
      )}
      {role === 'customer' && st === 'transfer' && ti && order.transferReportedAt && (
        <Text style={[styles.muted, { marginTop: 8 }]}>Reportaste tu transferencia. Esperando a que {order.providerName || 'la lavandería'} la confirme.</Text>
      )}
      {role === 'customer' && st === 'transfer' && ['in_progress', 'ready', 'delivered'].includes(order.status) && (
        <ReportTransfer busy={busy} onReport={onReport} again={!!order.transferReportedAt} allowPhoto={allowPhoto} />
      )}
      {choosing && (
        <>
          {cardEnabled && <Button icon="card-outline" title={`Pagar ${money2(total)} con tarjeta`} onPress={onPay} loading={busy === 'card'} disabled={!!busy || serviceFee == null} />}
          {ti && st !== 'transfer' && <Button icon="swap-horizontal-outline" title="Pagar por transferencia" variant={cardEnabled ? 'outline' : 'primary'} onPress={() => onChoose('transfer')} loading={busy === 'transfer'} disabled={!!busy} />}
          {st !== 'cash' && <Button icon="cash-outline" title="Pagaré en efectivo al entregar" variant="outline" onPress={() => onChoose('cash')} loading={busy === 'cash'} disabled={!!busy} />}
          {st === 'cash' && <Text style={styles.muted}>Elegiste pagar {money2(total)} en efectivo al entregar.</Text>}
        </>
      )}
      {role === 'customer' && st === 'transfer_ok' && <Text style={styles.muted}>{order.providerName || 'La lavandería'} confirmó que recibió tu transferencia. ¡Gracias!</Text>}
      {role === 'customer' && st === 'paid' && <Text style={styles.muted}>Pagaste {typeof order.paidAmount === 'number' ? money2(order.paidAmount) : ''} con tarjeta{order.serviceFee ? ` (incluye cuota de servicio de ${money2(order.serviceFee)})` : ''}. ¡Gracias!</Text>}

      {/* Socio */}
      {role === 'provider' && st === 'pending' && open && <Text style={styles.muted}>Esperando a que el cliente elija cómo pagar.</Text>}
      {role === 'provider' && st === 'cash' && <Text style={styles.muted}>Cóbrale {money2(total)} en efectivo al entregar (servicio + cuota de servicio). La comisión y la cuota se descuentan de tu saldo con BÜBÜ.</Text>}
      {role === 'provider' && st === 'transfer' && (
        <>
          <Text style={styles.muted}>{order.transferReportedAt ? 'El cliente reportó que ya te transfirió' : 'El cliente va a transferirte'} {money2(total)} a tu cuenta{ti?.account ? ` …${String(ti.account).slice(-4)}` : ''}. Revisa tu banco y confírmalo cuando te llegue.</Text>
          <Button icon="checkmark-done-outline" title="Recibí la transferencia" onPress={onConfirmTransfer} loading={busy === 'confirm'} disabled={!!busy} />
        </>
      )}
      {role === 'provider' && st === 'transfer_ok' && <Text style={styles.muted}>Transferencia recibida. La comisión y la cuota se descuentan de tu saldo con BÜBÜ.</Text>}
      {role === 'provider' && st === 'paid' && <Text style={styles.muted}>Pagado con tarjeta. BÜBÜ te lo deposita el martes en tu corte, ya sin la comisión.</Text>}
      {st === 'review' && <Text style={styles.muted}>El equipo de BÜBÜ está revisando este pago.</Text>}
      {['transfer', 'transfer_ok'].includes(st) && <ReceiptBlock order={order} />}

      {editable && (
        <>
          <Field icon="create-outline" label={hasAmount ? 'Corregir total del servicio' : 'Total del servicio'} value={edit} onChangeText={setEdit} keyboardType="decimal-pad" maxLength={9} placeholder={hasAmount ? String(order.amountDue) : 'Ej. 150'} />
          {!!parseAmount(edit) && <Button title="Guardar total" variant="soft" onPress={() => { onAmount(parseAmount(edit)); setEdit(''); }} loading={busy === 'amount'} disabled={!!busy} />}
        </>
      )}
      <Notice tone={msg.tone}>{msg.text}</Notice>
    </Card>
  );
}

const s = StyleSheet.create({
  bag: { fontFamily: fonts.extra, color: colors.blue },
  pin: { fontFamily: fonts.black, color: colors.blue, fontSize: 40, letterSpacing: 10, textAlign: 'center', marginVertical: 8 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  photoLabel: { fontFamily: fonts.bold, color: colors.ink, fontSize: 13, marginBottom: 4 },
  thumb: { width: 72, height: 72, borderRadius: 12, backgroundColor: colors.surface },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' },
  link: { fontFamily: fonts.bold, color: colors.blue, fontSize: 13 },
  steps: { flexDirection: 'row', marginTop: 18, backgroundColor: colors.surface, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 6 },
  stepWrap: { flex: 1, alignItems: 'center' },
  line: { position: 'absolute', top: 15, right: '50%', width: '100%', height: 3, backgroundColor: '#DCE3EE' },
  dot: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E4E9F1', alignItems: 'center', justifyContent: 'center' },
  dotOn: { backgroundColor: colors.blue },
  dotNow: { backgroundColor: colors.turquoise, transform: [{ scale: 1.1 }] },
  stepText: { fontFamily: fonts.medium, fontSize: 10, color: colors.muted, marginTop: 6 },
  transfer: { backgroundColor: colors.blueSoft, borderRadius: 16, padding: 14, marginTop: 10 },
  receipt: { backgroundColor: colors.surface, borderRadius: 16, padding: 12, marginTop: 10, gap: 6 },
  receiptImg: { width: '100%', height: 220, borderRadius: 12, backgroundColor: '#E4E9F1', marginTop: 6 },
  transferTitle: { fontFamily: fonts.bold, color: colors.blue, fontSize: 14, marginBottom: 6 },
  transferLine: { fontFamily: fonts.semibold, color: colors.ink, fontSize: 15, marginTop: 2 },
});
