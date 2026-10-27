// Lista de categorías con el estilo de tarjetas del diseño original.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/brand';

export default function CategoryList({ categories, onPress }) {
  return categories.map((c) => (
    <Pressable
      key={c.id}
      onPress={() => onPress && onPress(c)}
      style={({ pressed }) => [s.service, !c.active && s.inactive, pressed && { opacity: 0.85 }]}
      accessibilityRole="button"
      accessibilityLabel={`${c.name}${c.active ? '' : ', próximamente'}`}
    >
      <Text style={s.icon}>{c.icon || '✨'}</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.title}>{c.name}</Text>
        <Text style={s.sub}>{c.active ? c.description : 'Próximamente'}</Text>
      </View>
      <Text style={s.arrow}>{c.active ? '›' : ''}</Text>
    </Pressable>
  ));
}

const s = StyleSheet.create({
  service: { backgroundColor: colors.white, borderRadius: 16, padding: 15, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 13, borderWidth: 1, borderColor: colors.border },
  inactive: { opacity: 0.6 },
  icon: { fontSize: 25, backgroundColor: colors.blueSoft, padding: 10, borderRadius: 13, overflow: 'hidden' },
  title: { fontSize: 15, fontWeight: '800', color: colors.ink },
  sub: { fontSize: 12, color: colors.muted, lineHeight: 18, marginTop: 4 },
  arrow: { fontSize: 26, color: colors.blue, width: 14 },
});
