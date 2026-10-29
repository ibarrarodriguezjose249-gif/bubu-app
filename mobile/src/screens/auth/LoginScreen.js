// Inicio de sesión con Firebase Authentication (correo y contraseña).
// La sesión se guarda en el teléfono: la próxima vez entra directo.
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AuthHeader from '../../components/AuthHeader';
import { Button, Field, Notice } from '../../components/ui';
import { loginWithEmail } from '../../services/users';
import { friendlyError } from '../../lib/errors';
import { validateEmail } from '../../lib/validation';
import { colors, fonts } from '../../constants/brand';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    const emailErr = validateEmail(email);
    if (emailErr) return setError(emailErr);
    if (!password) return setError('Escribe tu contraseña.');
    setBusy(true);
    setError('');
    try {
      await loginWithEmail(email, password);
      // Al iniciar sesión, la navegación cambia sola a la app principal.
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={authStyles.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={{ backgroundColor: colors.white }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
          <AuthHeader subtitle="Inicia sesión para continuar" onBack={navigation.canGoBack() ? () => navigation.goBack() : null} />
          <View style={authStyles.form}>
            <Field icon="mail-outline" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" placeholder="Correo electrónico" accessibilityLabel="Correo electrónico" />
            <Field icon="lock-closed-outline" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" placeholder="Contraseña" accessibilityLabel="Contraseña" onSubmitEditing={submit} />
            <Pressable onPress={() => navigation.navigate('ForgotPassword', { email })} style={authStyles.linkRight} accessibilityRole="button">
              <Text style={authStyles.link}>¿Olvidaste tu contraseña?</Text>
            </Pressable>
            <Notice tone="error">{error}</Notice>
            <Button title="Iniciar sesión" onPress={submit} loading={busy} />
            <View style={authStyles.bottom}>
              <Text style={authStyles.bottomText}>¿No tienes una cuenta? </Text>
              <Pressable onPress={() => navigation.replace('Register')} accessibilityRole="button">
                <Text style={authStyles.link}>Regístrate</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export const authStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.blue },
  form: { backgroundColor: colors.white, paddingHorizontal: 22, paddingTop: 4, width: '100%', maxWidth: 520, alignSelf: 'center', flexGrow: 1 },
  linkRight: { alignSelf: 'flex-end', paddingVertical: 10 },
  link: { fontFamily: fonts.semibold, fontSize: 13, color: colors.blue },
  bottom: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 22 },
  bottomText: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  title: { fontFamily: fonts.extra, fontSize: 22, color: colors.ink, marginTop: 4 },
  muted: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 4, lineHeight: 19 },
});
