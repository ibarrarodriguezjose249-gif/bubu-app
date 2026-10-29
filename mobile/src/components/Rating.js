// Estrellas: insignia de promedio, selector de 1 a 5 y lista corta de reseñas.
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/brand';
import { timeAgo } from '../lib/time';

const GOLD = '#f5a623';

export function Stars({ value = 0, size = 14 }) {
  const full = Math.round(value);
  return (
    <Text style={{ fontSize: size, color: GOLD, letterSpacing: 1 }} accessibilityLabel={`${value} de 5 estrellas`}>
      {'★'.repeat(full)}<Text style={{ color: '#d5dbe6' }}>{'★'.repeat(5 - full)}</Text>
    </Text>
  );
}

// "⭐ 4.8 (12)" o "Nuevo" si aún no tiene reseñas reales.
export function RatingBadge({ summary, style }) {
  if (!summary) {
    return <Text style={[s.badge, s.badgeNew, style]}>✨ Nuevo</Text>;
  }
  return (
    <Text style={[s.badge, style]} accessibilityLabel={`${summary.avg} estrellas, ${summary.count} reseñas`}>
      <Text style={{ color: GOLD }}>★</Text> {summary.avg.toFixed(1)} <Text style={s.count}>({summary.count})</Text>
    </Text>
  );
}

export function StarPicker({ value, onChange, disabled }) {
  return (
    <View style={s.picker} accessibilityRole="adjustable">
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => onChange(n)} disabled={disabled} hitSlop={6} accessibilityLabel={`${n} estrellas`} style={({ pressed }) => [pressed && { transform: [{ scale: 0.9 }] }]}>
          <Text style={[s.pickStar, { color: n <= value ? GOLD : '#d5dbe6' }]}>★</Text>
        </Pressable>
      ))}
    </View>
  );
}

export const STAR_WORDS = ['', 'Muy mal', 'Mal', 'Regular', 'Bien', '¡Excelente!'];

// Hasta `max` reseñas con comentario, con botón para ver más.
export function ReviewList({ reviews, max = 2, now }) {
  const [open, setOpen] = useState(false);
  const withText = (reviews || []).filter((r) => !r.hidden && r.comment);
  if (!withText.length) return null;
  const shown = open ? withText.slice(0, 10) : withText.slice(0, max);
  return (
    <View style={{ marginTop: 8 }}>
      {shown.map((r) => (
        <View key={r.id} style={s.review}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Stars value={r.stars} size={12} />
            <Text style={s.who}>{r.customerName || 'Cliente'} · {timeAgo(r.createdAt, now)}</Text>
          </View>
          <Text style={s.comment}>“{r.comment}”</Text>
        </View>
      ))}
      {withText.length > max && (
        <Pressable onPress={() => setOpen(!open)}>
          <Text style={s.more}>{open ? 'Ver menos' : `Ver ${Math.min(withText.length, 10) - max} reseña(s) más`}</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  badge: { fontSize: 13, fontWeight: '800', color: colors.ink, backgroundColor: '#fff6e5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, overflow: 'hidden', alignSelf: 'flex-start' },
  badgeNew: { backgroundColor: '#eaf2ff', color: colors.blue, fontSize: 12 },
  count: { color: colors.muted, fontWeight: '600' },
  picker: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 8 },
  pickStar: { fontSize: 40 },
  review: { backgroundColor: '#f7f9fd', borderRadius: 12, padding: 10, marginTop: 6 },
  who: { fontSize: 12, color: colors.muted },
  comment: { fontSize: 13, color: colors.ink, marginTop: 4, lineHeight: 18 },
  more: { fontSize: 13, color: colors.blue, fontWeight: '800', marginTop: 8 },
});
