// Reserva directa con un proveedor de la lista (el proveedor acepta o rechaza).
import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { doc, getDoc } from '@firebase/firestore';
import { Button, Card, Field, Loading, Notice, Screen, styles } from './ui';
import { ChipGroup, OnlineDot, ProviderTypeBadge, WhenPicker, whenToData } from './cards';
import { useAuth } from './AuthContext';
import { db } from './bubuFirebase';
import { FULFILLMENT_MODES } from './constants_catalog';
import { ASAP, QUANTITY_OPTIONS, serviceOptionsFor } from './constants_requests';
import { useCatalog } from './CatalogContext';
import { createDirectOrder } from './orders';
import { isOnline } from './providers';
import { friendlyError } from './errors';
import { LIMITS, validatePhoneOptional } from './validation';
import ColoniaField from './ColoniaField';
import LocationField from './LocationField';
import { areaCovers } from './geo';

export default function DirectBookingScreen({ navigation, route }) {
  const { providerId, categoryId = 'lavanderia' } = route.params || {};
  const { user, profile } = useAuth();
  const [provider, setProvider] = useState(undefined);
  const { categoryById } = useCatalog();
  const serviceOptions = serviceOptionsFor(categoryById(categoryId), categoryId);
  const [form, setForm] = useState({
    services: serviceOptions.slice(0, 1), quantityText: QUANTITY_OPTIONS[0], when: { day: ASAP, slot: '' },
    fulfillmentMode: '', colonia: profile?.colonia || '', address: '', customerPhone: profile?.phone || '', description: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loc, setLoc] = useState({ point: null, zone: null, covered: true, configured: false });
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    getDoc(doc(db, 'providers', providerId))
      .then((s) => {
        const p = s.exists() ? { id: s.id, ...s.data() } : null;
        setProvider(p);
        if (p) setForm((f) => ({ ...f, fulfillmentMode: (p.fulfillmentModes || [])[0] || 'dropoff' }));
      })
      .catch(() => setProvider(null));
  }, [providerId]);

  if (provider === undefined) return <Loading />;
  if (!provider) return <Screen><Notice tone="error">Este proveedor no está disponible.</Notice></Screen>;

  async function submit() {
    const details = [form.services.join(', '), form.quantityText, form.description.trim()].filter(Boolean).join(' · ');
    if (details.length < 3) return setError('Cuéntanos qué necesitas.');
    if (form.colonia.trim().length < 2) return setError('Escribe tu colonia.');
    if (loc.configured && !loc.point) return setError('Indica dónde estás (tu ubicación o un pin en el mapa).');
    if (loc.configured && !loc.zone) return setError('Aún no llegamos a tu colonia o ciudad.');
    if (loc.point && provider?.serviceArea && !areaCovers(provider.serviceArea, loc.point)) return setError(`${provider.businessName} no da servicio hasta tu ubicación. Busca otra lavandería más cerca.`);
    if (form.fulfillmentMode === 'pickup_delivery' && form.address.trim().length < 5) return setError('Escribe tu dirección para que pasen por tu ropa.');
    const pErr = validatePhoneOptional(form.customerPhone);
    if (pErr) return setError(pErr);
    setBusy(true);
    setError('');
    try {
      const ref = await createDirectOrder({ uid: user.uid, profile, provider, f: { ...form, whenText: whenToData(form.when).whenText, details, categoryId, zoneId: loc.zone?.id || profile?.zoneId || 'general-zuazua' } });
      navigation.replace('OrderDetail', { id: ref.id, fresh: true });
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  const modes = provider.fulfillmentModes || [];
  return (
    <Screen>
      <Text style={styles.title}>Reservar con {provider.businessName}</Text>
      <OnlineDot online={isOnline(provider)} />
      <ProviderTypeBadge type={provider.providerType} />
      {!!provider.description && <Text style={styles.muted}>{provider.description}</Text>}

      <Text style={[styles.label, { marginTop: 20 }]}>¿Qué necesitas?</Text>
      {serviceOptions.length > 0 && <ChipGroup options={serviceOptions} values={form.services} onChange={set('services')} />}
      <Text style={[styles.label, { marginTop: 14 }]}>¿Cuánta ropa?</Text>
      <ChipGroup options={QUANTITY_OPTIONS} value={form.quantityText} onChange={set('quantityText')} />
      <Text style={[styles.label, { marginTop: 14 }]}>¿Para cuándo?</Text>
      <WhenPicker value={form.when} onChange={set('when')} />
      <Text style={[styles.label, { marginTop: 14 }]}>Entrega</Text>
      <ChipGroup
        options={modes}
        labels={Object.fromEntries(modes.map((k) => [k, FULFILLMENT_MODES[k]?.label]))}
        value={form.fulfillmentMode}
        onChange={set('fulfillmentMode')}
      />
      <Field label="Detalles (opcional)" value={form.description} onChangeText={set('description')} multiline maxLength={LIMITS.description} />
      <LocationField uid={user?.uid} onResult={setLoc} />
      <ColoniaField zoneId={loc.zone?.id || profile?.zoneId || 'general-zuazua'} value={form.colonia} onChange={set('colonia')} />
      {form.fulfillmentMode === 'pickup_delivery' && (
        <Field label="Dirección para recoger y entregar" value={form.address} onChangeText={set('address')} maxLength={200} placeholder="Calle, número y referencias" />
      )}
      <Field label="Tu teléfono (opcional)" value={form.customerPhone} onChangeText={set('customerPhone')} keyboardType="phone-pad" maxLength={LIMITS.phone} />
      <Card>
        <Text style={styles.text}>La lavandería debe aceptar tu reserva. Tus datos de contacto solo los verá {provider.businessName}. El pago se acuerda directo con ella.</Text>
      </Card>
      <Notice tone="error">{error}</Notice>
      <Button title="Enviar reserva" onPress={submit} loading={busy} />
    </Screen>
  );
}
