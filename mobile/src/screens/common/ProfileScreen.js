import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Badge, Button, Card, Notice, Screen, styles } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { logout, resendVerification } from '../../services/users';
import { PROVIDER_STATUS } from '../../services/providers';
import { friendlyError } from '../../lib/errors';
import ModeSwitchModal from '../../components/ModeSwitchModal';

export default function ProfileScreen({ navigation }) {
  const { user, profile, provider, isAdmin, mode } = useAuth();
  const [modeOpen, setModeOpen] = useState(false);
  const [msg, setMsg] = useState({ tone: 'info', text: '' });

  async function resend() {
    try {
      await resendVerification();
      setMsg({ tone: 'success', text: 'Te reenviamos el correo de verificación.' });
    } catch (e) {
      setMsg({ tone: 'error', text: friendlyError(e) });
    }
  }

  return (
    <Screen>
      <Text style={styles.title}>Mi perfil</Text>
      <Card>
        <Text style={styles.section}>{profile?.displayName || 'Sin nombre'}</Text>
        <Text style={styles.muted}>{user?.email}</Text>
        <Text style={styles.muted}>Teléfono: {profile?.phone || 'sin capturar'}</Text>
        <Text style={styles.muted}>Colonia: {profile?.colonia || 'sin capturar'}</Text>
        <View style={[styles.wrap, { marginTop: 10, gap: 6 }]}>
          <Badge tone="info">{mode === 'provider' ? 'Modo proveedor' : 'Modo cliente'}</Badge>
          {provider && <Badge tone={PROVIDER_STATUS[provider.status]?.tone || 'warn'}>Proveedor: {PROVIDER_STATUS[provider.status]?.label || provider.status}</Badge>}
          {isAdmin && <Badge tone="success">Administrador</Badge>}
          {user && !user.emailVerified && <Badge tone="warn">Correo sin verificar</Badge>}
        </View>
        <Button title="Editar datos" variant="outline" onPress={() => navigation.navigate('EditProfile')} />
        <Button title="Cambiar de modo" variant="soft" onPress={() => setModeOpen(true)} />
        {user && !user.emailVerified && <Button title="Reenviar correo de verificación" variant="soft" onPress={resend} />}
        <Notice tone={msg.tone}>{msg.text}</Notice>
      </Card>

      {isAdmin && (
        <Card>
          <Text style={styles.section}>Administración</Text>
          <Text style={styles.muted}>Herramientas básicas. La gestión completa estará en el panel web administrativo.</Text>
          <Button title="Herramientas de administrador" onPress={() => navigation.navigate('AdminTools')} />
        </Card>
      )}

      <Button title="Cerrar sesión" variant="danger" onPress={() => logout()} style={{ marginTop: 24 }} />
      <ModeSwitchModal visible={modeOpen} onClose={() => setModeOpen(false)} />
    </Screen>
  );
}
