// El proveedor manda (o edita) su oferta a un pedido abierto.
import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { Button, Card, Field, IconLine, Loading, Notice, Screen, styles } from '../../components/ui';
import { colors } from '../../constants/brand';
import { ChipGroup } from '../../components/cards';
import { useAuth } from '../../context/AuthContext';
import { FULFILLMENT_MODES } from '../../constants/catalog';
import { getMyOffer, requestState, requestSummary, sendOffer, subscribeRequest, updateOffer } from '../../services/requests';
import { countdown, useNow } from '../../lib/time';
import { friendlyError } from '../../lib/errors';
import { LIMITS, validatePhoneOptional } from '../../lib/validation';

const PICKUP_OPTIONS = ['En 1 hora', 'Hoy en la tarde', 'Hoy en la noche', 'Mañana temprano'];
const READY_OPTIONS = ['El mismo día', 'En 24 horas', 'En 48 horas'];

export default function MakeOfferScreen({ navigation, route }) {
  const { requestId } = route.params || {};
  const { user, profile, provider } = useAuth();
  const [request, setRequest] = useState(undefined);
  const [existing, setExisting] = useState(undefined);
  const [form, setForm] = useState({ price: '', pickupText: PICKUP_OPTIONS[1], readyText: READY_OPTIONS[1], message: '', providerPhone: profile?.phone || '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const now = useNow(1000);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => subscribeRequest(requestId, setRequest, (e) => setError(friendlyError(e))), [requestId]);
  useEffect(() => {
    getMyOffer(requestId, user.uid).then((o) => {
      setExisting(o);
      if (o) setForm({
        price: typeof o.priceFrom === 'number' ? String(o.priceFrom) : '',
        pickupText: o.pickupText || '', readyText: o.readyText || '', message: o.message || '', providerPhone: o.providerPhone || '',
      });
    }).catch(() => setExisting(null));
  }, [requestId, user]);

  if (request === undefined || existing === undefined) return <Loading />;
  if (!request) return <Screen><Notice tone="error">Este pedido ya no está disponible.</Notice></Screen>;
  const state = requestState(request, now);

  async function submit() {
    const pErr = validatePhoneOptional(form.providerPhone);
    if (pErr) return setError(pErr);
    if (form.price && Number.isNaN(Number(form.price.replace(/[^0-9.]/g, '')))) return setError('El precio debe ser un número.');
    setBusy(true);
    setError('');
    try {
      if (existing) await updateOffer(requestId, user.uid, form);
      else await sendOffer(requestId, user.uid, provider, { ...form, kind: 'offer' });
      navigation.goBack();
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.title}>{existing ? 'Editar mi oferta' : 'Mandar oferta'}</Text>
      {state === 'open' ? <IconLine icon="time-outline" color={colors.blue}>Quedan {countdown(request.expiresAt, now)} para ofertar</IconLine> : <Notice tone="warn">Este pedido ya no recibe ofertas.</Notice>}
      {!provider?.isAvailable && !existing && <Notice tone="warn">Toca "Conectarme" en Inicio para poder ofertar.</Notice>}

      <Card>
        <Text style={styles.section}>{requestSummary(request)}</Text>
        <IconLine icon="location-outline">{request.colonia} · {FULFILLMENT_MODES[request.fulfillmentMode]?.label}{request.whenText ? ` · ${request.whenText}` : ''}</IconLine>
        <Text style={styles.muted}>Los datos de contacto del cliente se comparten solo si te elige.</Text>
      </Card>

      <Field label="Precio estimado (MXN, opcional)" value={form.price} onChangeText={set('price')} keyboardType="numeric" maxLength={7} placeholder="Ej. 120" hint="Es una referencia; el pago se acuerda directo con el cliente." />
      <Text style={[styles.label, { marginTop: 14 }]}>{request.fulfillmentMode === 'pickup_delivery' ? '¿Cuándo pasas por la ropa?' : '¿Cuándo puede llevarla?'}</Text>
      <ChipGroup options={PICKUP_OPTIONS} value={form.pickupText} onChange={set('pickupText')} />
      <Text style={[styles.label, { marginTop: 14 }]}>¿Cuándo estará lista?</Text>
      <ChipGroup options={READY_OPTIONS} value={form.readyText} onChange={set('readyText')} />
      <Field label="Mensaje para el cliente (opcional)" value={form.message} onChangeText={set('message')} multiline maxLength={LIMITS.description} placeholder="Ej. Uso suavizante hipoalergénico, entrego doblado en bolsa." />
      <Field label="Tu teléfono (opcional)" hint="El cliente lo verá junto con tu oferta." value={form.providerPhone} onChangeText={set('providerPhone')} keyboardType="phone-pad" maxLength={LIMITS.phone} />
      <Notice tone="error">{error}</Notice>
      <Button title={existing ? 'Guardar cambios' : 'Enviar oferta'} onPress={submit} loading={busy} disabled={state !== 'open' || (!existing && !provider?.isAvailable)} />
    </Screen>
  );
}
