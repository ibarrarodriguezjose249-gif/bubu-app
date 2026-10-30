// Categorías en cuadrícula (3 por fila) con íconos de línea.
// Las inactivas se ven atenuadas con la etiqueta "Pronto".
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from './brand';
import Icon, { categoryIcon } from './Icon';

export default function CategoryList({ categories, onPress }) {
  return (
    <View style={s.grid}>
      {categories.map((c) => (
        <Pressable
          key={c.id}
          onPress={() => onPress && onPress(c)}
          style={({ pressed }) => [s.tile, pressed && { transform: [{ scale: 0.97 }] }]}
          accessibilityRole="button"
          accessibilityLabel={`${c.name}${c.active ? '' : ', próximamente'}`}
        >
          <View style={[s.circle, !c.active && s.circleOff]}>
            <Icon name={categoryIcon(c.id)} size={28} color={c.active ? colors.blue : '#8A96A8'} />
          </View>
          <Text style={[s.name, !c.active && { color: colors.muted }]} numberOfLines={2}>{c.name}</Text>
          {!c.active && <Text style={s.soon}>Pronto</Text>}
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  tile: { width: '33.33%', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 10 },
  circle: { width: 66, height: 66, borderRadius: 33, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' },
  circleOff: { backgroundColor: colors.surface },
  name: { fontFamily: fonts.semibold, fontSize: 12, color: colors.ink, textAlign: 'center', marginTop: 8 },
  soon: { fontFamily: fonts.bold, fontSize: 10, color: colors.muted, marginTop: 2 },
});
