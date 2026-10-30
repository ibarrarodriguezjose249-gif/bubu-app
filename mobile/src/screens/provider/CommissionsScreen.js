// Pagos y comisiones del socio: corte semanal (sábado a viernes, depósito el martes),
// saldo con BÜBÜ, bloqueo por adeudo y movimientos.
// Con tarjeta: BÜBÜ cobra y le deposita al socio (total − comisión con IVA).
// En efectivo: el socio cobra; la comisión y la cuota de servicio se descuentan de su depósito.
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, IconLine, Loading, Notice, Screen, styles } from '../../components/ui';
import { StatPill } from '../../components/cards';
import { useAuth } from '../../context/AuthContext';
import { subscribeMyOrders } from '../../services/orders';
import { commissionLabel, commissionOf, commissionSummary, money2, paidByCard, subscribeCommissionConfig, subscribeMyCommissionPayments, subscribeMyDebtBlock, subscribeMyPayouts, weekStart } from '../../services/commission';
import { colors, fonts } from '../../constants/brand';
import { timeAgo, useNow } from '../../lib/time';
import { friendlyError } from '../../lib/errors';

export default function CommissionsScreen({ navigation }) {
  const { user } = useAuth();
  const [orders, setOrders] = useState(null);
  const [payments, setPayments] = useState(null);
  const [payouts, setPayouts] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [debtBlock, setDebtBlock] = useState(null);
  const [error, setError] = useState('');
  const now = useNow(60000);

  useEffect(() => (user ? subscribeMyOrders(user.uid, 'provider', setOrders, (e) => setError(friendlyError(e))) : undefined), [user]);
  useEffect(() => (user ? subscribeMyCommissionPayments(user.uid, setPayments, (e) => { setPayments([]); setError(friendlyError(e)); }) : undefined), [user]);
  useEffect(() => (user ? subscribeMyPayouts(user.uid, setPayouts, (e) => { setPayouts([]); setError(friendlyError(e)); }) : undefined), [user]);
  useEffect(() => subscribeCommissionConfig(setCfg), []);
  useEffect(() => (user ? subscribeMyDebtBlock(user.uid, setDebtBlock) : undefined), [user]);

  if (orders === null || payments === null || payouts === null) return <Loading />;
  const sum = commissionSummary(orders, payments, now, payouts);
  const moves = [
    ...payouts.map((p) => ({ ...p, kind: 'in', label: 'BÜBÜ te depositó' })),
    ...payments.map((p) => ({ ...p, kind: 'out', label: 'Pagaste a BÜBÜ' })),
  ].sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
  const monthName = new Date(now).toLocaleDateString('es-MX', { month: 'long' });
  const fmt = (ms) => new Date(ms).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
  const ws = weekStart(now);
  const cutLabel = `${fmt(ws)} → ${fmt(ws + 6 * 86400000)}`;
  const payday = fmt(ws + 10 * 86400000); // martes siguiente al viernes de corte

  return (
    <Screen>
      <Text style={styles.title}>Pagos y comisiones</Text>
      <Notice tone="error">{error}</Notice>

      <View style={s.hero}>
        <Text style={s.heroLabel}>{sum.balance > 0 ? 'BÜBÜ te va a depositar' : sum.balance < 0 ? 'Le debes a BÜBÜ' : 'Estás al corriente'}</Text>
        <Text style={s.heroValue}>{money2(Math.abs(sum.balance))}</Text>
        <Text style={s.heroSub}>Comisión: {cfg ? commissionLabel(cfg.pct, cfg.ivaPct) : '…'} por pedido entregado. Corte los viernes a las 23:59; depósito los martes.</Text>
      </View>

      {debtBlock && (
        <Notice tone="error">Tu cuenta está pausada por un adeudo de {money2(debtBlock.debt)} (límite {money2(debtBlock.debtLimit)}). No te llegan pedidos nuevos hasta que lo pagues al equipo de BÜBÜ; en cuanto lo registren, se desbloquea solo.</Notice>
      )}

      <Card>
        <Text style={styles.section}>Corte actual</Text>
        <Text style={styles.muted}>{cutLabel} · depósito el {payday}</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <StatPill value={money2(sum.weekCard)} label="cobrado con tarjeta" tone="success" />
          <StatPill value={money2(sum.weekCash)} label="cobrado en efectivo" />
          <StatPill value={money2(sum.weekCommission)} label="comisión" />
        </View>
        {sum.weekCashFees > 0 && <Text style={[styles.muted, { marginTop: 10 }]}>Cuotas de servicio cobradas en efectivo: {money2(sum.weekCashFees)} (son de BÜBÜ)</Text>}
        <Text style={[styles.muted, { marginTop: 10 }]}>Neto del corte: {sum.weekNet >= 0 ? `BÜBÜ te deposita ${money2(sum.weekNet)}` : `debes ${money2(-sum.weekNet)}`}</Text>
      </Card>

      <Card>
        <Text style={styles.section}>Este mes ({monthName})</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <StatPill value={sum.monthCount} label="pedidos entregados" />
          <StatPill value={money2(sum.monthSales)} label="cobraste" tone="success" />
          <StatPill value={money2(sum.monthCommission)} label="comisión" />
        </View>
      </Card>

      <Card>
        <Text style={styles.section}>Depósitos y pagos</Text>
        {moves.length === 0 && <Text style={styles.muted}>Todavía no hay movimientos.</Text>}
        {moves.map((p) => (
          <View key={p.kind + p.id} style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle}>{p.label}: {money2(p.amount)}</Text>
              <Text style={styles.muted}>{[p.method, p.period, p.note].filter(Boolean).join(' · ')}</Text>
            </View>
            <Text style={styles.muted}>{timeAgo(p.createdAt, now)}</Text>
          </View>
        ))}
        <IconLine icon="information-circle-outline" style={{ marginTop: 10 }}>
          Con tarjeta: BÜBÜ cobra y te deposita tu parte el martes, sin la comisión. En efectivo: tú cobras el servicio y la cuota de servicio; la comisión y la cuota se descuentan de tu depósito. Si tu adeudo pasa el límite, se pausan tus pedidos hasta que pagues.
        </IconLine>
      </Card>

      <Card>
        <Text style={styles.section}>Últimos pedidos entregados</Text>
        {sum.recent.length === 0 && <Text style={styles.muted}>Cuando entregues un pedido y anotes el total, aparecerá aquí.</Text>}
        {sum.recent.map((o) => (
          <Pressable key={o.id} onPress={() => navigation.navigate('OrderDetail', { id: o.id })} style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle} numberOfLines={1}>{o.customerName || 'Cliente'} · {o.colonia}</Text>
              <Text style={styles.muted}>{paidByCard(o) ? 'Tarjeta' : 'Efectivo'} {money2(o.finalPrice)} · {timeAgo(o.statusChangedAt || o.updatedAt, now)}</Text>
            </View>
            <Text style={s.fee}>{money2(commissionOf(o))}</Text>
          </Pressable>
        ))}
      </Card>
      <Text style={styles.disclaimer}>Comisiones totales: {money2(sum.owed)} · BÜBÜ te ha depositado: {money2(sum.received)} · Tú has pagado: {money2(sum.paid)}</Text>
    </Screen>
  );
}

const s = StyleSheet.create({
  hero: { backgroundColor: colors.blue, borderRadius: 22, padding: 20, marginTop: 12 },
  heroLabel: { fontFamily: fonts.semibold, color: '#DCE8FF', fontSize: 13 },
  heroValue: { fontFamily: fonts.black, color: colors.white, fontSize: 38, marginTop: 4 },
  heroSub: { fontFamily: fonts.regular, color: '#DCE8FF', fontSize: 12, marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowTitle: { fontFamily: fonts.bold, color: colors.ink, fontSize: 14 },
  fee: { fontFamily: fonts.extra, color: colors.blue, fontSize: 14 },
});
