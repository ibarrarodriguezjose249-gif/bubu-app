// Pantallas de estado: configuración faltante, cuenta sin perfil, cuenta suspendida.
import React, { useState } from 'react';
import { Text } from 'react-native';
import { Button, Card, Notice, Screen, styles } from './ui';
import { useAuth } from './AuthContext';
import { logout } from './users';
import { friendlyError } from './errors';
import { BRAND_NAME } from './brand';

export function ConfigMissingScreen({ missing }) {
  return (
    <Screen>
      <Text style={styles.title}>{BRAND_NAME}: falta configurar Firebase</Text>
      <Card>
        <Text style={styles.text}>Crea el archivo mobile/.env (copia mobile/.env.example) y llena estas variables con los datos de la app web BUBI-Web de tu proyecto de Firebase:</Text>
        {missing.map((m) => (
          <Text key={m} style={[styles.muted, { fontFamily: 'monospace' }]}>• {m}</Text>
        ))}
        <Text style={styles.muted}>Después detén y vuelve a iniciar Expo con: npx expo start --clear</Text>
      </Card>
    </Screen>
  );
}

export function ProfileMissingScreen() {
  const { repairProfile, error } = useAuth();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  async function repair() {
    setBusy(true);
    setMsg('');
    try { await repairProfile(); } catch (e) { setMsg(friendlyError(e)); } finally { setBusy(false); }
  }
  return (
    <Screen>
      <Text style={styles.title}>Preparando tu cuenta…</Text>
      <Card>
        <Text style={styles.muted}>Si esta pantalla no desaparece en unos segundos, tu perfil no se terminó de crear.</Text>
        <Button title="Completar mi perfil" onPress={repair} loading={busy} />
        <Notice tone="error">{msg || (error ? friendlyError(error) : '')}</Notice>
        <Button title="Cerrar sesión" variant="outline" onPress={() => logout()} />
      </Card>
    </Screen>
  );
}

export function SuspendedScreen() {
  const { profile } = useAuth();
  const review = profile?.status === 'review';
  return (
    <Screen>
      <Text style={styles.title}>{review ? 'Cuenta en revisión' : 'Cuenta suspendida'}</Text>
      <Notice tone={review ? 'warn' : 'error'}>{review
        ? `El equipo de ${BRAND_NAME} está revisando tu cuenta por una actividad reportada. Mientras tanto no puedes hacer pedidos nuevos. Te contactaremos pronto.`
        : `Tu cuenta está suspendida. Contacta al equipo de ${BRAND_NAME}.`}</Notice>
      {!!profile?.statusNote && <Notice tone="info">Nota del equipo: {profile.statusNote}</Notice>}
      <Button title="Cerrar sesión" variant="outline" onPress={() => logout()} />
    </Screen>
  );
}
