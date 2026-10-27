// Pantallas de estado: configuración faltante, cuenta sin perfil, cuenta suspendida.
import React, { useState } from 'react';
import { Text } from 'react-native';
import { Button, Card, Notice, Screen, styles } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { logout } from '../../services/users';
import { friendlyError } from '../../lib/errors';
import { BRAND_NAME } from '../../constants/brand';

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
  return (
    <Screen>
      <Text style={styles.title}>Cuenta suspendida</Text>
      <Notice tone="error">Tu cuenta está suspendida. Contacta al equipo de {BRAND_NAME}.</Notice>
      <Button title="Cerrar sesión" variant="outline" onPress={() => logout()} />
    </Screen>
  );
}
