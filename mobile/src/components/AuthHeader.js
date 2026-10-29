// Encabezado azul curvo con el logo, para inicio de sesión, registro y recuperar contraseña.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BRAND_NAME, colors, fonts } from '../constants/brand';
import Icon from './Icon';
import SociosTag from './SociosTag';

export default function AuthHeader({ subtitle, onBack }) {
  return (
    <View style={s.wrap}>
      {onBack && (
        <Pressable onPress={onBack} style={s.back} hitSlop={10} accessibilityRole="button" accessibilityLabel="Atrás">
          <Icon name="chevron-back" size={24} color={colors.white} />
        </Pressable>
      )}
      <Text style={s.logo}>{BRAND_NAME}</Text>
      <SociosTag light style={{ marginTop: 4 }} />
      {!!subtitle && <Text style={s.sub}>{subtitle}</Text>}
      <View style={s.curve} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: colors.blue, alignItems: 'center', paddingTop: 36, paddingBottom: 56, overflow: 'hidden' },
  back: { position: 'absolute', left: 14, top: 14, padding: 4 },
  logo: { fontFamily: fonts.black, fontSize: 44, color: colors.white, letterSpacing: 1 },
  sub: { fontFamily: fonts.medium, fontSize: 15, color: '#E3EEFF', marginTop: 6 },
  // Curva inferior blanca (como en la referencia).
  curve: { position: 'absolute', bottom: -60, left: -40, right: -40, height: 100, backgroundColor: colors.white, borderTopLeftRadius: 400, borderTopRightRadius: 80, transform: [{ rotate: '-4deg' }] },
});
