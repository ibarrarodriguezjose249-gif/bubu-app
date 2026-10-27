import React, { useState } from 'react';
import { Text } from 'react-native';
import { Button, Field, Notice, Screen, styles } from '../../components/ui';
import { resetPassword } from '../../services/users';
import { friendlyError } from '../../lib/errors';
import { validateEmail } from '../../lib/validation';

export default function ForgotPasswordScreen({ route }) {
  const [email, setEmail] = useState(route?.params?.email || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ tone: 'info', text: '' });

  async function submit() {
    const err = validateEmail(email);
    if (err) return setMsg({ tone: 'error', text: err });
    setBusy(true);
    try {
      await resetPassword(email);
      // Mensaje neutro: no revela si el correo tiene cuenta o no.
      setMsg({ tone: 'success', text: 'Si existe una cuenta con ese correo, te enviamos un enlace para cambiar la contraseña. Revisa también la carpeta de spam.' });
    } catch (e) {
      setMsg({ tone: 'error', text: friendlyError(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.title}>Recuperar contraseña</Text>
      <Text style={styles.muted}>Te enviaremos un enlace a tu correo.</Text>
      <Field label="Correo" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Notice tone={msg.tone}>{msg.text}</Notice>
      <Button title="Enviar enlace" onPress={submit} loading={busy} />
    </Screen>
  );
}
