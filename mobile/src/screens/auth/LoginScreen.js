import React, { useState } from 'react';
import { Text } from 'react-native';
import { Button, Field, Notice, Screen, styles } from '../../components/ui';
import { loginWithEmail } from '../../services/users';
import { friendlyError } from '../../lib/errors';
import { validateEmail } from '../../lib/validation';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    const emailErr = validateEmail(email);
    if (emailErr) return setError(emailErr);
    if (!password) return setError('Escribe tu contraseña.');
    setBusy(true);
    setError('');
    try {
      await loginWithEmail(email, password);
      // Al iniciar sesión, la navegación cambia sola a la app principal.
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.title}>Iniciar sesión</Text>
      <Text style={styles.muted}>Entra con tu correo y contraseña.</Text>
      <Field label="Correo" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" placeholder="tucorreo@ejemplo.com" />
      <Field label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" placeholder="Tu contraseña" onSubmitEditing={submit} />
      <Notice tone="error">{error}</Notice>
      <Button title="Entrar" onPress={submit} loading={busy} />
      <Button title="Olvidé mi contraseña" variant="soft" onPress={() => navigation.navigate('ForgotPassword', { email })} />
      <Button title="Crear una cuenta nueva" variant="outline" onPress={() => navigation.replace('Register')} />
    </Screen>
  );
}
