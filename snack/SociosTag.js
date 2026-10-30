// Etiqueta "SOCIOS" junto al logo, solo en la app BÜBÜ Socios.
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { colors, fonts } from './brand';
import { IS_SOCIOS } from './variant';

export default function SociosTag({ light = false, style }) {
  if (!IS_SOCIOS) return null;
  return <Text style={[s.tag, light ? s.light : s.dark, style]}>SOCIOS</Text>;
}

const s = StyleSheet.create({
  tag: { fontFamily: fonts.extra, fontSize: 11, letterSpacing: 2, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden', alignSelf: 'center' },
  light: { backgroundColor: colors.turquoise, color: colors.navy },
  dark: { backgroundColor: colors.blue, color: colors.white },
});
