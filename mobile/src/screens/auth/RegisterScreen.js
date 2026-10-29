import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AuthHeader from '../../components/AuthHeader';
import { Button, Field, Notice, styles } from '../../components/ui';
import { registerWithEmail } from '../../services/users';
import { friendlyError } from '../../lib/errors';
import { LIMITS, validateEmail, validateName, validatePassword, validatePhoneOptional } from '../../lib/validation';
import { BRAND_NAME, colors } from '../../constants/brand';
import { authStyles } from './LoginScreen';

export default function RegisterScreen({ navigation }) {
  const [form, setForm] = useState({ displayName: '', email: '', password: '', password2: '', phone: '', colonia: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  function validate() {
    const e = {
      displayName: validateName(form.displayName),
      email: validateEmail(form.email),
      password: validatePassword(form.password),
      password2: form.password !== form.password2 ? 'Las contraseñas no coinciden.' : null,
      phone: validatePhoneOptional(form.phone),
    };
    Object.keys(e).forEach((k) => !e[k] && delete e[k]);
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit() {
    if (!validate()) return;
    setBusy(true);
    setError('');
    try {
      await registerWithEmail(form);
      // La navegación cambia sola a la app principal.
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={authStyles.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={{ backgroundColor: colors.white }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
          <AuthHeader subtitle="Crea tu cuenta" onBack={navigation.canGoBack() ? () => navigation.goBack() : null} />
          <View style={authStyles.form}>
            <Text style={authStyles.muted}>Tu cuenta de {BRAND_NAME} sirve para contratar y también para ofrecer servicios.</Text>
            <Field icon="person-outline" label="Nombre completo" value={form.displayName} onChangeText={set('displayName')} error={errors.displayName} maxLength={LIMITS.name} autoComplete="name" textContentType="name" />
            <Field icon="mail-outline" label="Correo electrónico" value={form.email} onChangeText={set('email')} error={errors.email} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
            <Field icon="lock-closed-outline" label="Contraseña" value={form.password} onChangeText={set('password')} error={errors.password} secureTextEntry autoComplete="new-password" textContentType="newPassword" hint="Mínimo 8 caracteres, con letras y números." />
            <Field icon="lock-closed-outline" label="Repite la contraseña" value={form.password2} onChangeText={set('password2')} error={errors.password2} secureTextEntry />
            <Field icon="call-outline" label="Teléfono (opcional)" value={form.phone} onChangeText={set('phone')} error={errors.phone} keyboardType="phone-pad" maxLength={LIMITS.phone} hint="10 dígitos. Solo se comparte con quien atienda tus pedidos." />
            <Field icon="location-outline" label="Colonia en General Zuazua (opcional)" value={form.colonia} onChangeText={set('colonia')} maxLength={LIMITS.colonia} />
            <Notice tone="error">{error}</Notice>
            <Button title="Registrarse" onPress={submit} loading={busy} />
            <Text style={styles.disclaimer}>
              Al crear tu cuenta aceptas el aviso de privacidad y los términos de {BRAND_NAME} (documentos pendientes de redactar antes del lanzamiento).
            </Text>
            <View style={authStyles.bottom}>
              <Text style={authStyles.bottomText}>¿Ya tienes cuenta? </Text>
              <Pressable onPress={() => navigation.replace('Login')} accessibilityRole="button">
                <Text style={authStyles.link}>Inicia sesión</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
