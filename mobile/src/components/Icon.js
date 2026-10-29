// Íconos de línea uniformes (@expo/vector-icons, incluido con Expo).
// Usa nombres de Ionicons; los que no existen ahí vienen de MaterialCommunityIcons.
import React from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../constants/brand';

const MCI = new Set(['hanger', 'broom', 'truck-outline', 'washing-machine', 'tshirt-crew-outline']);

export default function Icon({ name, size = 20, color = colors.ink, style }) {
  if (MCI.has(name)) return <MaterialCommunityIcons name={name} size={size} color={color} style={style} />;
  return <Ionicons name={name} size={size} color={color} style={style} />;
}

// Ícono por categoría (el campo "icon" de Firestore es un emoji; aquí se usa uno de línea).
const CATEGORY_ICONS = {
  lavanderia: 'hanger',
  limpieza: 'broom',
  reparaciones: 'construct-outline',
  jardineria: 'leaf-outline',
  mudanzas: 'truck-outline',
  mascotas: 'paw-outline',
};
export function categoryIcon(id) {
  return CATEGORY_ICONS[id] || 'sparkles-outline';
}

// Íconos de modalidad.
export const MODE_ICONS = { dropoff: 'storefront-outline', pickup_delivery: 'car-outline' };
