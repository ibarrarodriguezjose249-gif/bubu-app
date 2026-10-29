// Tarjetas de la Etapa 4: ofertas, proveedores, pedidos publicados y pedidos.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, shadow } from '../constants/brand';
import { FULFILLMENT_MODES } from '../constants/catalog';
import { ORDER_STATUS } from '../constants/orderStatus';
import { ASAP, PROVIDER_TYPES, REQUEST_STATE, TIME_SLOTS, nextDays, whenLabel } from '../constants/requests';
import { countdown, formatMoney, timeAgo } from '../lib/time';
import { isOnline } from '../services/providers';
import { requestSummary } from '../services/requests';
import { Badge, Button, Chip, IconLine, styles as ui } from './ui';
import Icon from './Icon';
import { RatingBadge, ReviewList } from './Rating';
import { ratingSummary } from '../services/reviews';

// Grupo de chips: selección única (value) o múltiple (values).
export function ChipGroup({ options, value, values, onChange, labels }) {
  const multi = Array.isArray(values);
  return (
    <View style={ui.wrap}>
      {options.map((opt) => {
        const selected = multi ? values.includes(opt) : value === opt;
        return (
          <Chip
            key={opt}
            label={labels ? labels[opt] : opt}
            selected={selected}
            onPress={() => {
              if (multi) onChange(selected ? values.filter((v) => v !== opt) : [...values, opt]);
              else onChange(opt);
            }}
          />
        );
      })}
    </View>
  );
}

export function OnlineDot({ online }) {
  return (
    <View style={s.dotRow}>
      <View style={[s.dot, { backgroundColor: online ? colors.success : '#b7c0cf' }]} />
      <Text style={[s.small, { color: online ? colors.successText : colors.muted }]}>{online ? 'Disponible ahora' : 'No conectado'}</Text>
    </View>
  );
}

export function OfferCard({ offer, tags = [], onChoose, chosen, disabled, reviews, now }) {
  return (
    <View style={[s.card, chosen && s.cardChosen]}>
      <View style={ui.row}>
        <Text style={s.title} numberOfLines={1}>{offer.providerName}</Text>
        {typeof offer.priceFrom === 'number' ? <Text style={s.price}>{formatMoney(offer.priceFrom)}</Text> : <Text style={s.small}>Precio a acordar</Text>}
      </View>
      {reviews !== undefined && <RatingBadge summary={ratingSummary(reviews)} style={{ marginTop: 8 }} />}
      {(tags.length > 0 || offer.kind === 'accept' || PROVIDER_TYPES[offer.providerType]) && (
        <View style={[ui.wrap, { gap: 6, marginTop: 8 }]}>
          {offer.kind === 'accept' && <Badge tone="success" icon="thumbs-up-outline">Acepta tu horario</Badge>}
          {tags.map((t) => <Badge key={t.label} tone="success" icon={t.icon}>{t.label}</Badge>)}
          <ProviderTypeBadge type={offer.providerType} />
        </View>
      )}
      {!!offer.pickupText && <IconLine icon="car-outline" color={colors.ink}>Recoge / recibe: <Text style={s.strong}>{offer.pickupText}</Text></IconLine>}
      {!!offer.readyText && <IconLine icon="checkmark-circle-outline" color={colors.ink}>Listo: <Text style={s.strong}>{offer.readyText}</Text></IconLine>}
      {!!offer.message && <Text style={s.msg}>“{offer.message}”</Text>}
      {reviews !== undefined && <ReviewList reviews={reviews} max={1} now={now} />}
      {chosen ? (
        <Badge tone="success">Elegiste esta oferta</Badge>
      ) : onChoose ? (
        <Button title="Elegir esta oferta" onPress={onChoose} disabled={disabled} />
      ) : null}
    </View>
  );
}

export function ProviderCard({ provider, onBook, now, reviews }) {
  const modes = (provider.fulfillmentModes || []).map((m) => FULFILLMENT_MODES[m]?.providerLabel || m);
  return (
    <View style={s.card}>
      <View style={ui.row}>
        <Text style={s.title} numberOfLines={1}>{provider.businessName}</Text>
        <OnlineDot online={isOnline(provider, now)} />
      </View>
      <View style={[ui.wrap, { gap: 6, marginTop: 8 }]}>
        {reviews !== undefined && <RatingBadge summary={ratingSummary(reviews)} />}
        <ProviderTypeBadge type={provider.providerType} />
      </View>
      {!!provider.description && <Text style={s.line} numberOfLines={3}>{provider.description}</Text>}
      <IconLine icon="swap-horizontal-outline">{modes.join('  ·  ')}</IconLine>
      {reviews !== undefined && <ReviewList reviews={reviews} max={2} now={now} />}
      {onBook && <Button title="Reservar directo" variant="outline" onPress={onBook} />}
    </View>
  );
}

export function RequestCard({ request, state, now, offersCount, onPress, footer }) {
  const st = REQUEST_STATE[state] || REQUEST_STATE.closed;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.card, pressed && { opacity: 0.9 }]} accessibilityRole="button">
      <View style={ui.row}>
        <Badge tone={st.tone}>{st.label}</Badge>
        {state === 'open' ? <View style={s.timerRow}><Icon name="time-outline" size={15} color={colors.blue} /><Text style={s.timer}>{countdown(request.expiresAt, now)}</Text></View> : <Text style={s.small}>{timeAgo(request.createdAt, now)}</Text>}
      </View>
      <Text style={[s.title, { marginTop: 10 }]} numberOfLines={2}>{requestSummary(request) || 'Pedido'}</Text>
      <IconLine icon="location-outline">{request.colonia} · {FULFILLMENT_MODES[request.fulfillmentMode]?.label}{request.whenText ? ` · ${request.whenText}` : ''}</IconLine>
      {typeof offersCount === 'number' && (
        <Text style={[s.line, { color: colors.blue, fontFamily: fonts.extra }]}>
          {offersCount === 0 ? 'Esperando ofertas…' : `${offersCount} ${offersCount === 1 ? 'oferta recibida' : 'ofertas recibidas'} ›`}
        </Text>
      )}
      {footer}
    </Pressable>
  );
}

export function OrderRow({ order, role, onPress, now }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.card, pressed && { opacity: 0.9 }]} accessibilityRole="button">
      <View style={ui.row}>
        <Text style={s.title} numberOfLines={1}>{role === 'provider' ? order.customerName : order.providerName}</Text>
        <StatusPill status={order.status} />
      </View>
      <Text style={s.line} numberOfLines={2}>{order.details}</Text>
      <IconLine icon="location-outline">{order.colonia} · {timeAgo(order.createdAt, now)}{typeof order.priceEstimate === 'number' ? ` · ${formatMoney(order.priceEstimate)} aprox.` : ''}</IconLine>
    </Pressable>
  );
}

// Estado del pedido con color e ícono.
export function StatusPill({ status }) {
  const st = ORDER_STATUS[status] || { label: status, color: colors.muted, bg: colors.surface, icon: 'ellipse-outline' };
  return (
    <View style={[s.statusRow, { backgroundColor: st.bg }]}>
      <Icon name={st.icon} size={13} color={st.color} />
      <Text style={[s.status, { color: st.color }]}>{st.label}</Text>
    </View>
  );
}

export function StatPill({ value, label, tone = 'info' }) {
  return (
    <View style={[s.stat, tone === 'success' && { backgroundColor: colors.successBg }]}>
      <Text style={[s.statValue, tone === 'success' && { color: colors.successText }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: 20, padding: 16, marginTop: 12, borderWidth: 1, borderColor: colors.border, ...shadow },
  cardChosen: { borderColor: colors.success, borderWidth: 2 },
  title: { fontSize: 16, fontFamily: fonts.extra, color: colors.ink, flexShrink: 1 },
  price: { fontSize: 20, fontFamily: fonts.black, color: colors.blue },
  line: { fontFamily: fonts.regular, fontSize: 14, color: colors.ink, marginTop: 8, lineHeight: 20 },
  strong: { fontFamily: fonts.extra },
  msg: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, marginTop: 8, fontStyle: 'italic', lineHeight: 20 },
  small: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 6 },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timer: { fontSize: 13, fontFamily: fonts.extra, color: colors.blue },
  dotRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  status: { fontSize: 11, fontFamily: fonts.bold },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: 16, padding: 12 },
  statValue: { fontSize: 22, fontFamily: fonts.black, color: colors.blue },
  statLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
});

// Selector de fecha y horario: "Lo antes posible" o un día de los próximos 7 + franja.
// value = { day: 'Lo antes posible' | 'Hoy' | 'Mañana' | 'Jue 30 oct', slot: 'Tarde (12–6)' | '' }
export function WhenPicker({ value, onChange }) {
  const days = nextDays(7);
  const dayOptions = [ASAP, ...days.map((d) => d.label)];
  return (
    <View>
      <ChipGroup options={dayOptions} value={value.day} onChange={(day) => onChange({ day, slot: day === ASAP ? '' : (value.slot || TIME_SLOTS[1]) })} />
      {value.day !== ASAP && (
        <>
          <Text style={[s.small, { marginTop: 4, marginBottom: 6 }]}>Horario</Text>
          <ChipGroup options={TIME_SLOTS} value={value.slot} onChange={(slot) => onChange({ ...value, slot })} />
        </>
      )}
    </View>
  );
}

// Convierte la selección en lo que se guarda: texto corto + fecha (inicio del día).
export function whenToData(value) {
  const day = nextDays(7).find((d) => d.label === value.day);
  return { whenText: whenLabel(value.day, value.slot), preferredDate: day ? day.date : null };
}

export function ProviderTypeBadge({ type }) {
  if (!PROVIDER_TYPES[type]) return null;
  return <Badge tone="info" icon={PROVIDER_TYPES[type].icon}>{PROVIDER_TYPES[type].badge}</Badge>;
}
