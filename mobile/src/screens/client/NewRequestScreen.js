// Publicar pedido: el cliente dice qué necesita y recibe ofertas por 30 minutos.
// No se publica su nombre, teléfono ni dirección: solo la colonia.
import React, { useState } from 'react';
import { Text } from 'react-native';
import { Button, Card, Field, Notice, Screen, styles } from '../../components/ui';
import { ChipGroup, WhenPicker, whenToData } from '../../components/cards';
import ColoniaField from '../../components/ColoniaField';
import LocationField from '../../components/LocationField';
import { approx } from '../../lib/geo';
import { useAuth } from '../../context/AuthContext';
import { useCatalog } from '../../context/CatalogContext';
import { FULFILLMENT_MODES } from '../../constants/catalog';
import { ASAP, OFFER_WINDOW_MIN, QUANTITY_OPTIONS, serviceOptionsFor } from '../../constants/requests';
import { createRequest } from '../../services/requests';
import { friendlyError } from '../../lib/errors';
import { LIMITS } from '../../lib/validation';

export default function NewRequestScreen({ navigation, route }) {
  const { user, profile } = useAuth();
  const { categoryById } = useCatalog();
  const categoryId = route?.params?.categoryId || 'lavanderia';
  const category = categoryById(categoryId);
  const serviceOptions = serviceOptionsFor(category, categoryId);
  const [form, setForm] = useState({
    services: serviceOptions.slice(0, 1),
    quantityText: QUANTITY_OPTIONS[0],
    when: { day: ASAP, slot: '' },
    fulfillmentMode: 'pickup_delivery',
    colonia: profile?.colonia || '',
    description: '',
  });
  const [loc, setLoc] = useState({ point: null, zone: null, covered: true, configured: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    if (!form.services.length && form.description.trim().length < 3) return setError('Elige al menos un servicio o describe lo que necesitas.');
    if (form.colonia.trim().length < 2) return setError('Escribe tu colonia para que te encuentren las lavanderías cercanas.');
    if (loc.configured && !loc.point) return setError('Indica dónde estás (tu ubicación o un pin en el mapa).');
    if (loc.configured && !loc.zone) return setError('Aún no llegamos a tu colonia o ciudad.');
    setBusy(true);
    setError('');
    try {
      const zoneId = loc.zone?.id || profile?.zoneId || 'general-zuazua';
      const ref = await createRequest(user.uid, { ...form, ...whenToData(form.when), categoryId, zoneId, ...(loc.point ? { approxGeo: approx(loc.point) } : {}) });
      navigation.replace('RequestDetail', { id: ref.id, justCreated: true });
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.title}>Publicar pedido</Text>
      <Text style={styles.muted}>Las lavanderías disponibles de tu zona te mandarán su precio y horario durante {OFFER_WINDOW_MIN} minutos. Tú eliges la que más te guste.</Text>

      <Text style={[styles.label, { marginTop: 20 }]}>¿Qué necesitas?</Text>
      {serviceOptions.length > 0 && <ChipGroup options={serviceOptions} values={form.services} onChange={set('services')} />}

      <Text style={[styles.label, { marginTop: 14 }]}>¿Cuánta ropa?</Text>
      <ChipGroup options={QUANTITY_OPTIONS} value={form.quantityText} onChange={set('quantityText')} />

      <Text style={[styles.label, { marginTop: 14 }]}>¿Para cuándo?</Text>
      <WhenPicker value={form.when} onChange={set('when')} />

      <Text style={[styles.label, { marginTop: 14 }]}>¿Cómo la entregas?</Text>
      <ChipGroup
        options={Object.keys(FULFILLMENT_MODES)}
        labels={Object.fromEntries(Object.entries(FULFILLMENT_MODES).map(([k, m]) => [k, m.label]))}
        value={form.fulfillmentMode}
        onChange={set('fulfillmentMode')}
      />

      <LocationField uid={user?.uid} onResult={setLoc} />
      <ColoniaField zoneId={loc.zone?.id || profile?.zoneId || 'general-zuazua'} value={form.colonia} onChange={set('colonia')} hint="Solo se muestra la colonia. Tu dirección y teléfono se comparten únicamente con la lavandería que elijas." />
      <Field label="Detalles (opcional)" value={form.description} onChangeText={set('description')} multiline maxLength={LIMITS.description} placeholder="Ej. ropa de bebé con jabón neutro, 2 cobijas matrimoniales…" />

      <Card>
        <Text style={styles.text}>BÜBÜ no cobra dentro de la app. El precio de cada oferta es un estimado y el pago se acuerda directo con la lavandería.</Text>
      </Card>
      <Notice tone="error">{error}</Notice>
      <Button title="Publicar y recibir ofertas" onPress={submit} loading={busy} disabled={loc.configured && !!loc.point && !loc.zone} />
    </Screen>
  );
}
