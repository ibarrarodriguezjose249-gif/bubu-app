// Ventana para cambiar entre modo cliente y modo proveedor (misma cuenta).
// Se usa Modal en lugar de Alert porque Alert no funciona en la versión web.
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../constants/brand';
import { useAuth } from '../context/AuthContext';
import { friendlyError } from '../lib/errors';
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
          <Text style={s.title}>Cambiar de modo</Text>
          <Text style={s.muted}>Con la misma cuenta puedes contratar u ofrecer servicios.</Text>
          <Button icon={mode === 'client' ? 'checkmark-circle' : 'person-outline'} title="Contratar servicios" variant={mode === 'client' ? 'primary' : 'outline'} onPress={() => choose('client')} disabled={busy} />
          <Button icon={mode === 'provider' ? 'checkmark-circle' : 'briefcase-outline'} title="Ofrecer servicios" variant={mode === 'provider' ? 'primary' : 'outline'} onPress={() => choose('provider')} disabled={busy} />
          <Notice tone="error">{error}</Notice>
          <Button title="Cerrar" variant="soft" onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#06142ab0', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal: { backgroundColor: colors.white, borderRadius: 24, padding: 22, width: '100%', maxWidth: 480 },
  title: { fontSize: 20, fontFamily: fonts.black, color: colors.ink },
  muted: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 6, marginBottom: 6 },
});
