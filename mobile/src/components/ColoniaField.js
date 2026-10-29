// Campo de colonia con sugerencias de la lista que captura el admin en el panel
// (zones/{id}.colonias). Si la zona no tiene colonias, es un campo normal.
// Siempre se puede escribir otra colonia a mano.
import React from 'react';
import { Text, View } from 'react-native';
import { Chip, Field, styles } from './ui';
import { useCatalog } from '../context/CatalogContext';
import { LIMITS } from '../lib/validation';

const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

export default function ColoniaField({ zoneId = 'general-zuazua', value, onChange, label = 'Tu colonia', hint }) {
  const { zoneById } = useCatalog();
  const list = zoneById(zoneId)?.colonias || [];
  const q = norm(value);
  const exact = list.some((c) => norm(c) === q);
  const matches = exact ? [] : list.filter((c) => !q || norm(c).includes(q)).slice(0, 8);
  return (
    <View>
      <Field icon="location-outline" label={label} value={value} onChangeText={onChange} maxLength={LIMITS.colonia}
        placeholder={list.length ? 'Escribe para buscar tu colonia' : ''} hint={hint} />
      {list.length > 0 && matches.length > 0 && (
        <View style={[styles.wrap, { marginTop: 8 }]}>
          {matches.map((c) => <Chip key={c} label={c} onPress={() => onChange(c)} />)}
        </View>
      )}
      {list.length > 0 && q.length > 1 && !exact && matches.length === 0 && (
        <Text style={styles.hint}>No está en la lista; se usará tal como la escribiste.</Text>
      )}
    </View>
  );
}
