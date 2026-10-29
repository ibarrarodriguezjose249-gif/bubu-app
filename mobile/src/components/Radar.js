// Animación de "radar" (ondas que salen del centro), estilo app de viajes.
// Solo es visual: no inventa actividad.
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/brand';

const NATIVE = Platform.OS !== 'web';

export default function Radar({ size = 220, icon = '🧺', color = colors.turquoise, active = true }) {
  const waves = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!active) return undefined;
    const loops = waves.map((v, i) => Animated.loop(
      Animated.sequence([
        Animated.delay(i * 800),
        Animated.timing(v, { toValue: 1, duration: 2400, easing: Easing.out(Easing.ease), useNativeDriver: NATIVE }),
        Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: NATIVE }),
      ])
    ));
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [active, waves]);

  const core = size * 0.36;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {active && waves.map((v, i) => (
        <Animated.View
          key={i}
          style={[
            s.wave,
            {
              width: size, height: size, borderRadius: size / 2, borderColor: color,
              opacity: v.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.6, 0] }),
              transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }],
            },
          ]}
        />
      ))}
      <View style={[s.core, { width: core, height: core, borderRadius: core / 2, shadowColor: color }]}>
        <Text style={{ fontSize: core * 0.45 }}>{icon}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wave: { position: 'absolute', borderWidth: 2, backgroundColor: '#35d8df22' },
  core: { backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.6, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, elevation: 8 },
});
