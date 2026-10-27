// Formulario de solicitud para ser proveedor (crear o editar).
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Chip, Field, Notice, Screen, styles } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useCatalog } from '../../context/CatalogContext';
import { submitProviderApplication, updateProviderApplication } from '../../services/providers';
import { FULFILLMENT_MODES } from '../../constants/catalog';
import { friendlyError } from '../../lib/errors';
import { LIMITS, validateName } from '../../lib/validation';

function toggle(list, value) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function ProviderApplicationScreen({ navigation }) {
  const { user, provider } = useAuth();
  const { activeCategories, activeZones, loading } = useCatalog();
  const [form, setForm] = useState({
    businessName: provider?.businessName || '',
    description: provider?.description || '',
    categoryIds: provider?.categoryIds || [],
    zoneIds: provider?.zoneIds || [],
    fulfillmentModes: provider?.fulfillmentModes || ['dropoff'],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    const nameErr = validateName(form.businessName, LIMITS.businessName);
    if (nameErr) return setError(`Nombre del negocio: ${nameErr}`);
    if (form.categoryIds.length === 0) return setError('Elige al menos una categoría.');
    if (form.zoneIds.length === 0) return setError('Elige al menos una zona donde das servicio.');
    if (form.fulfillmentModes.length === 0) return setError('Elige al menos una modalidad.');
    setBusy(true);
    setError('');
    try {
      if (provider) await updateProviderApplication(user.uid, form, provider.status);
      else await submitProviderApplication(user.uid, form);
      navigation.goBack();
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.title}>{provider ? 'Editar solicitud' : 'Solicitud de proveedor'}</Text>
      <Text style={styles.muted}>Tu perfil se publicará solo cuando el equipo lo apruebe.</Text>

      <Field label="Nombre del negocio o tu nombre comercial" value={form.businessName} onChangeText={(v) => setForm({ ...form, businessName: v })} maxLength={LIMITS.businessName} placeholder="Ej. Lavandería Lupita" />
      <Field
        label="Describe tu servicio"
        value={form.description}
        onChangeText={(v) => setForm({ ...form, description: v })}
        maxLength={LIMITS.description}
        multiline
        placeholder="Qué haces, horarios, tiempos de entrega…"
        hint={`${form.description.length}/${LIMITS.description}`}
      />

      <Text style={[styles.label, { marginTop: 18 }]}>Categorías</Text>
      {loading && <Text style={styles.muted}>Cargando…</Text>}
      {!loading && activeCategories.length === 0 && <Notice tone="warn">No hay categorías activas todavía.</Notice>}
      <View style={styles.wrap}>
        {activeCategories.map((c) => (
          <Chip key={c.id} label={`${c.icon || ''} ${c.name}`} selected={form.categoryIds.includes(c.id)} onPress={() => setForm({ ...form, categoryIds: toggle(form.categoryIds, c.id) })} />
        ))}
      </View>

      <Text style={[styles.label, { marginTop: 10 }]}>Zonas donde das servicio</Text>
      {!loading && activeZones.length === 0 && <Notice tone="warn">No hay zonas activas todavía.</Notice>}
      <View style={styles.wrap}>
        {activeZones.map((z) => (
          <Chip key={z.id} label={`📍 ${z.name}`} selected={form.zoneIds.includes(z.id)} onPress={() => setForm({ ...form, zoneIds: toggle(form.zoneIds, z.id) })} />
        ))}
      </View>

      <Text style={[styles.label, { marginTop: 10 }]}>Modalidad</Text>
      <View style={styles.wrap}>
        {Object.entries(FULFILLMENT_MODES).map(([key, m]) => (
          <Chip key={key} label={`${m.icon} ${m.providerLabel}`} selected={form.fulfillmentModes.includes(key)} onPress={() => setForm({ ...form, fulfillmentModes: toggle(form.fulfillmentModes, key) })} />
        ))}
      </View>

      <Notice tone="info">
        Más adelante se pedirá verificación de identidad y documentos. Por ahora no subas identificaciones ni datos bancarios.
      </Notice>
      <Notice tone="error">{error}</Notice>
      <Button title={provider ? 'Guardar cambios' : 'Enviar solicitud'} onPress={submit} loading={busy} />
    </Screen>
  );
}
