// Ventana para cambiar entre modo cliente y modo proveedor (misma cuenta).
// En las apps separadas (BÜBÜ y BÜBÜ Socios) no se cambia de modo: explica cuál app usar.
// Se usa Modal en lugar de Alert porque Alert no funciona en la versión web.
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text } from 'react-native';
import { colors, fonts } from './brand';
import { CAN_SWITCH_MODE, IS_SOCIOS, SOCIOS_APP_NAME } from './variant';
import { useAuth } from './AuthContext';
import { friendlyError } from './errors';
import { Button, Notice } from './ui';

export default function ModeSwitchModal({ visible, onClose }) {
  const { mode, switchMode } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function choose(next) {
    if (next === mode) return onClose();
    setBusy(true);
    setError('');
    try {
      await switchMode(next);
      onClose();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.bg} onPress={onClose}>
        <Pressable style={s.modal} onPress={() => {}}>
          {CAN_SWITCH_MODE ? (
            <>
              <Text style={s.title}>Cambiar de modo</Text>
              <Text style={s.muted}>Con la misma cuenta puedes contratar u ofrecer servicios.</Text>
              <Button icon={mode === 'client' ? 'checkmark-circle' : 'person-outline'} title="Contratar servicios" variant={mode === 'client' ? 'primary' : 'outline'} onPress={() => choose('client')} disabled={busy} />
              <Button icon={mode === 'provider' ? 'checkmark-circle' : 'briefcase-outline'} title="Ofrecer servicios" variant={mode === 'provider' ? 'primary' : 'outline'} onPress={() => choose('provider')} disabled={busy} />
              <Notice tone="error">{error}</Notice>
            </>
          ) : (
            <>
              <Text style={s.title}>{IS_SOCIOS ? '¿Quieres pedir un servicio?' : '¿Ofreces servicios?'}</Text>
              <Text style={s.muted}>
                {IS_SOCIOS
                  ? 'Instala la app BÜBÜ e inicia sesión con esta misma cuenta para pedir servicios como cliente.'
                  : `Instala la app ${SOCIOS_APP_NAME} e inicia sesión con esta misma cuenta. Ahí registras tu negocio, te conectas y recibes pedidos.`}
              </Text>
            </>
          )}
          <Button title="Cerrar" variant="soft" onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#06142ab0', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal: { backgroundColor: colors.white, borderRadius: 24, padding: 22, width: '100%', maxWidth: 480 },
  title: { fontSize: 20, fontFamily: fonts.extra, color: colors.ink },
  muted: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, marginTop: 6, marginBottom: 6, lineHeight: 20 },
});
