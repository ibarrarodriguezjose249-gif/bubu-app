import React, { useState } from 'react';
import { Text } from 'react-native';
import { Button, Field, Notice, Screen, styles } from './ui';
import { useAuth } from './AuthContext';
import { updateMyProfile } from './users';
import { friendlyError } from './errors';
import { LIMITS, validateName, validatePhoneOptional } from './validation';

export default function EditProfileScreen({ navigation }) {
  const { user, profile } = useAuth();
  const [form, setForm] = useState({
    displayName: profile?.displayName || '',
    phone: profile?.phone || '',
    colonia: profile?.colonia || '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    const err = validateName(form.displayName) || validatePhoneOptional(form.phone);
    if (err) return setError(err);
    setBusy(true);
    setError('');
    try {
      await updateMyProfile(user.uid, form);
      navigation.goBack();
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.title}>Editar datos</Text>
      <Field label="Nombre completo" value={form.displayName} onChangeText={(v) => setForm({ ...form, displayName: v })} maxLength={LIMITS.name} />
      <Field label="Teléfono (opcional)" value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} keyboardType="phone-pad" maxLength={LIMITS.phone} hint="10 dígitos." />
      <Field label="Colonia (opcional)" value={form.colonia} onChangeText={(v) => setForm({ ...form, colonia: v })} maxLength={LIMITS.colonia} />
      <Text style={styles.muted}>El correo no se puede cambiar desde aquí todavía.</Text>
      <Notice tone="error">{error}</Notice>
      <Button title="Guardar" onPress={save} loading={busy} />
    </Screen>
  );
}
