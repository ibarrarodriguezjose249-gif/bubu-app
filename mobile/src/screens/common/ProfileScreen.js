import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge, Button, Card, Notice, Screen, styles } from '../../components/ui';
import Icon from '../../components/Icon';
import { useAuth } from '../../context/AuthContext';
import { logout, resendVerification } from '../../services/users';
import { PROVIDER_STATUS } from '../../services/providers';
import { friendlyError } from '../../lib/errors';
import ModeSwitchModal from '../../components/ModeSwitchModal';
import { colors, fonts } from '../../constants/brand';
import { CAN_SWITCH_MODE, IS_SOCIOS, SOCIOS_APP_NAME } from '../../constants/variant';

function MenuItem({ icon, title, subtitle, onPress, last }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.item, !last && s.itemBorder, pressed && { opacity: 0.7 }]} accessibilityRole="button">
      <View style={s.itemIcon}><Icon name={icon} size={20} color={colors.blue} /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.itemTitle}>{title}</Text>
        {!!subtitle && <Text style={s.itemSub}>{subtitle}</Text>}
      </View>
      <Icon name="chevron-forward" size={18} color="#9AA6B8" />
    </Pressable>
  );
}

export default function ProfileScreen({ navigation }) {
  const { user, profile, provider, isAdmin, mode } = useAuth();
  const [modeOpen, setModeOpen] = useState(false);
  const [msg, setMsg] = useState({ tone: 'info', text: '' });
  const initials = (profile?.displayName || '?').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

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
        <View style={s.head}>
          <View style={s.avatar}><Text style={s.avatarText}>{initials}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.section} numberOfLines={1}>{profile?.displayName || 'Sin nombre'}</Text>
            <Text style={styles.muted} numberOfLines={1}>{user?.email}</Text>
          </View>
        </View>
        <View style={s.info}>
          <View style={s.infoRow}><Icon name="call-outline" size={16} color={colors.muted} /><Text style={s.infoText}>{profile?.phone || 'Teléfono sin capturar'}</Text></View>
          <View style={s.infoRow}><Icon name="location-outline" size={16} color={colors.muted} /><Text style={s.infoText}>{profile?.colonia || 'Colonia sin capturar'}</Text></View>
        </View>
        <View style={[styles.wrap, { marginTop: 12, gap: 6 }]}>
          <Badge tone="info" icon={mode === 'provider' ? 'briefcase-outline' : 'person-outline'}>{IS_SOCIOS ? SOCIOS_APP_NAME : mode === 'provider' ? 'Modo proveedor' : 'Modo cliente'}</Badge>
          {provider && <Badge tone={PROVIDER_STATUS[provider.status]?.tone || 'warn'}>Proveedor: {PROVIDER_STATUS[provider.status]?.label || provider.status}</Badge>}
          {isAdmin && <Badge tone="success" icon="shield-checkmark-outline">Administrador</Badge>}
          {user && !user.emailVerified && <Badge tone="warn" icon="mail-unread-outline">Correo sin verificar</Badge>}
        </View>
        {user && !user.emailVerified && <Button title="Reenviar correo de verificación" variant="soft" onPress={resend} />}
        <Notice tone={msg.tone}>{msg.text}</Notice>
      </Card>

      <Card style={{ paddingVertical: 4 }}>
        <MenuItem icon="create-outline" title="Editar datos" subtitle="Nombre, teléfono y colonia" onPress={() => navigation.navigate('EditProfile')} />
        {CAN_SWITCH_MODE
          ? <MenuItem icon="swap-horizontal-outline" title="Cambiar de modo" subtitle={mode === 'provider' ? 'Ahora: ofrecer servicios' : 'Ahora: contratar servicios'} onPress={() => setModeOpen(true)} />
          : <MenuItem icon={IS_SOCIOS ? 'bag-handle-outline' : 'briefcase-outline'} title={IS_SOCIOS ? '¿Quieres pedir un servicio?' : '¿Ofreces servicios?'} subtitle={IS_SOCIOS ? 'Usa la app BÜBÜ con esta misma cuenta' : `Usa la app ${SOCIOS_APP_NAME} con esta misma cuenta`} onPress={() => setModeOpen(true)} />}
        {provider?.status === 'approved' && (mode === 'provider' || IS_SOCIOS) && (
          <>
            <MenuItem icon="cash-outline" title="Pagos y comisiones" subtitle="Tu corte semanal y tu saldo con BÜBÜ" onPress={() => navigation.navigate('Commissions')} />
            <MenuItem icon="swap-horizontal-outline" title="Cuenta para transferencias" subtitle="Para que tus clientes te paguen directo" onPress={() => navigation.navigate('PayoutAccount')} />
            <MenuItem icon="map-outline" title="Mi zona de servicio" subtitle="Tu punto en el mapa y hasta cuántos km atiendes" onPress={() => navigation.navigate('ServiceArea')} />
          </>
        )}
        <MenuItem icon="help-circle-outline" title="Ayuda: ver tutorial" subtitle={mode === 'provider' ? 'Cómo funciona el modo proveedor' : 'Cómo pedir un servicio'} onPress={() => navigation.navigate('Tutorial', { mode, manual: true })} last={!isAdmin} />
        {isAdmin && <MenuItem icon="shield-checkmark-outline" title="Herramientas de administrador" subtitle="La gestión completa está en el panel web" onPress={() => navigation.navigate('AdminTools')} last />}
      </Card>

      <Button title="Cerrar sesión" icon="log-out-outline" variant="danger" onPress={() => logout()} style={{ marginTop: 24 }} />
      <ModeSwitchModal visible={modeOpen} onClose={() => setModeOpen(false)} />
    </Screen>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.extra, fontSize: 20, color: colors.white },
  info: { marginTop: 14, gap: 6 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  itemIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  itemSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
});
