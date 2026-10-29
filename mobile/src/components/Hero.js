// Encabezado azul (logo, ubicación, modo, título y buscador).
import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BRAND_NAME, LAUNCH_ZONE_LABEL, colors, fonts } from '../constants/brand';
import Icon from './Icon';
import { CAN_SWITCH_MODE } from '../constants/variant';
import SociosTag from './SociosTag';

export default function Hero({ title, intro, eyebrow, search, onSearch, modeLabel, modeIcon = 'swap-horizontal', onModePress, zoneLabel = LAUNCH_ZONE_LABEL }) {
  return (
    <View style={s.hero}>
      <View style={s.inner}>
        <View style={s.nav}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={s.logo} accessibilityRole="header">{BRAND_NAME}</Text>
            <SociosTag light />
          </View>
          {!!modeLabel && CAN_SWITCH_MODE && (
            <Pressable onPress={onModePress} style={s.pill} accessibilityRole="button" accessibilityLabel="Cambiar de modo">
              <Icon name={modeIcon} size={14} color={colors.white} />
              <Text style={s.pillText}>{modeLabel}</Text>
              <Icon name="chevron-down" size={14} color={colors.white} />
            </Pressable>
          )}
        </View>
        <View style={s.zone}>
          <Icon name="location-outline" size={15} color={colors.white} />
          <Text style={s.zoneText}>{zoneLabel}</Text>
        </View>
        {!!eyebrow && <Text style={s.eyebrow}>{eyebrow}</Text>}
        {!!title && <Text style={s.heading}>{title}</Text>}
        {!!intro && <Text style={s.intro}>{intro}</Text>}
        {onSearch && (
          <View style={s.searchBox}>
            <Icon name="search" size={18} color={colors.muted} />
            <TextInput
              value={search}
              onChangeText={onSearch}
              placeholder="¿Qué servicio necesitas hoy?"
              placeholderTextColor="#94A0B3"
              style={s.search}
              returnKeyType="search"
            />
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  hero: { backgroundColor: colors.blue, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 24, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  inner: { width: '100%', maxWidth: 640, alignSelf: 'center' },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logo: { fontFamily: fonts.black, fontSize: 30, color: colors.white, letterSpacing: 0.5 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFFFFF26', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20 },
  pillText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.white },
  zone: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  zoneText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.white },
  eyebrow: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.4, color: colors.turquoiseSoft, marginTop: 18 },
  heading: { fontFamily: fonts.extra, fontSize: 28, lineHeight: 34, color: colors.white, marginTop: 14 },
  intro: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: '#E3EEFF', marginTop: 8 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.white, borderRadius: 16, paddingHorizontal: 14, marginTop: 18 },
  search: { flex: 1, paddingVertical: 13, fontSize: 14, color: colors.ink, fontFamily: fonts.medium },
});
