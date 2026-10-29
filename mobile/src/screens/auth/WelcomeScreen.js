// Bienvenida (sin sesión): logo, lema y accesos. Si ya hay sesión activa,
// RootNavigator entra directo a la app y esta pantalla no se muestra.
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/ui';
import Icon from '../../components/Icon';
import { BRAND_NAME, BRAND_SLOGAN, LAUNCH_ZONE_LABEL, colors, fonts } from '../../constants/brand';
import { IS_SOCIOS } from '../../constants/variant';
import SociosTag from '../../components/SociosTag';

export default function WelcomeScreen({ navigation }) {
  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.waveA} />
      <View style={s.waveB} />
      <ScrollView contentContainerStyle={s.page}>
        <View style={s.top}>
          <Text style={s.logo} accessibilityRole="header">{BRAND_NAME}</Text>
          <SociosTag style={{ marginBottom: 8 }} />
          <Text style={s.slogan}>{IS_SOCIOS ? 'Recibe pedidos de tu comunidad' : BRAND_SLOGAN}</Text>
        </View>

        {/* Ilustración hecha con íconos: casa + ubicación + destellos */}
        <View style={s.art} accessible accessibilityLabel="Servicios locales en tu comunidad">
          <View style={s.artCircle}>
            <Icon name={IS_SOCIOS ? 'storefront-outline' : 'home-outline'} size={92} color={colors.blue} />
          </View>
          <View style={s.pin}><Icon name="location" size={30} color={colors.blue} /></View>
          <Icon name="sparkles" size={22} color={colors.turquoise} style={s.sparkL} />
          <Icon name="sparkles" size={18} color={colors.turquoise} style={s.sparkR} />
        </View>
        <Text style={s.zone}>{IS_SOCIOS ? `Para lavanderías y personas que lavan desde casa en ${LAUNCH_ZONE_LABEL}` : `Comenzamos con lavanderías en ${LAUNCH_ZONE_LABEL}`}</Text>

        <View style={s.actions}>
          <Button title="Iniciar sesión" onPress={() => navigation.navigate('Login')} />
          <Button title="Registrarse" variant="outline" onPress={() => navigation.navigate('Register')} />
          <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={s.forgot} accessibilityRole="button">
            <Text style={s.forgotText}>¿Olvidaste tu contraseña?</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  waveA: { position: 'absolute', top: -140, right: -120, width: 360, height: 300, borderRadius: 180, backgroundColor: '#E6FAF8' },
  waveB: { position: 'absolute', bottom: -160, left: -120, width: 420, height: 320, borderRadius: 200, backgroundColor: '#EAF2FF' },
  page: { flexGrow: 1, justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 48, paddingBottom: 24, width: '100%', maxWidth: 520, alignSelf: 'center' },
  top: { alignItems: 'center' },
  logo: { fontFamily: fonts.black, fontSize: 64, color: colors.blue, letterSpacing: 1 },
  slogan: { fontFamily: fonts.medium, fontSize: 20, color: colors.ink, textAlign: 'center', marginTop: 4, lineHeight: 27 },
  art: { alignSelf: 'center', width: 200, height: 190, alignItems: 'center', justifyContent: 'center', marginTop: 28 },
  artCircle: { width: 160, height: 160, borderRadius: 80, backgroundColor: '#F0F6FF', alignItems: 'center', justifyContent: 'center' },
  pin: { position: 'absolute', top: 2, backgroundColor: colors.white, borderRadius: 22, padding: 4 },
  sparkL: { position: 'absolute', left: 8, top: 48 },
  sparkR: { position: 'absolute', right: 10, top: 64 },
  zone: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: 8 },
  actions: { marginTop: 28 },
  forgot: { alignSelf: 'center', padding: 14 },
  forgotText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.blue },
});
