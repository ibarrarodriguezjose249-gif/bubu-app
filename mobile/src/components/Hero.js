// Cabecera azul del diseño original (logo, zona, título y buscador).
import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BRAND_NAME, LAUNCH_ZONE_LABEL, colors } from '../constants/brand';

export default function Hero({ title, intro, eyebrow = 'SERVICIOS LOCALES, MÁS FÁCILES', search, onSearch, modeLabel, onModePress }) {
  return (
    <View style={s.hero}>
      <View style={s.nav}>
        <Text style={s.logo} accessibilityRole="header">
          {BRAND_NAME}<Text style={s.dot}>.</Text>
        </Text>
        {modeLabel ? (
          <Pressable onPress={onModePress} style={s.pill} accessibilityRole="button" accessibilityLabel="Cambiar de modo">
            <Text style={s.pillText}>{modeLabel} ▾</Text>
          </Pressable>
        ) : (
          <Text style={[s.pill, s.pillText]}>📍 {LAUNCH_ZONE_LABEL}</Text>
        )}
      </View>
      <Text style={s.eyebrow}>{eyebrow}</Text>
      <Text style={s.heading}>{title}</Text>
      {!!intro && <Text style={s.intro}>{intro}</Text>}
      {onSearch && (
        <TextInput
          value={search}
          onChangeText={onSearch}
          placeholder="Buscar un servicio..."
          placeholderTextColor={colors.muted}
          style={s.search}
          returnKeyType="search"
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  hero: { backgroundColor: colors.blue, paddingHorizontal: 22, paddingTop: 18, paddingBottom: 28, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  logo: { fontSize: 28, fontWeight: '900', color: colors.white, letterSpacing: -1 },
  dot: { color: colors.turquoiseSoft },
  pill: { backgroundColor: '#ffffff25', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, overflow: 'hidden' },
  pillText: { fontSize: 12, color: colors.white, fontWeight: '700' },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, color: '#d8efff' },
  heading: { fontSize: 34, lineHeight: 40, fontWeight: '900', color: colors.white, marginTop: 10 },
  intro: { fontSize: 15, lineHeight: 22, color: '#e3f1ff', marginTop: 10, marginBottom: 16 },
  search: { backgroundColor: colors.white, borderRadius: 13, paddingHorizontal: 15, paddingVertical: 13, fontSize: 15, color: colors.ink, marginTop: 6 },
});
