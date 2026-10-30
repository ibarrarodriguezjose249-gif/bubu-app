import React, { useState } from 'react';
import { ScrollView, Text, View, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AuthHeader from './AuthHeader';
import { Button, Field, Notice } from './ui';
import { resetPassword } from './users';
import { friendlyError } from './errors';
import { validateEmail } from './validation';
import { colors } from './brand';
import { authStyles } from './LoginScreen';

export default function ForgotPasswordScreen({ route, navigation }) {
  const [email, setEmail] = useState(route?.params?.email || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ tone: 'info', text: '' });

  async function submit() {
    const err = validateEmail(email);
    if (err) return setMsg({ tone: 'error', text: err });
    setBusy(true);
    try {
      await resetPassword(email);
      // Mensaje neutro: no revela si el correo tiene cuenta o no.
      setMsg({ tone: 'success', text: 'Si existe una cuenta con ese correo, te enviamos un enlace para cambiar la contraseña. Revisa también la carpeta de spam.' });
    } catch (e) {
      setMsg({ tone: 'error', text: friendlyError(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={authStyles.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={{ backgroundColor: colors.white }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
          <AuthHeader subtitle="Recupera tu contraseña" onBack={navigation?.canGoBack() ? () => navigation.goBack() : null} />
          <View style={authStyles.form}>
            <Text style={authStyles.muted}>Escribe tu correo y te enviaremos un enlace para crear una contraseña nueva.</Text>
            <Field icon="mail-outline" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Correo electrónico" accessibilityLabel="Correo electrónico" />
            <Notice tone={msg.tone}>{msg.text}</Notice>
            <Button title="Enviar enlace" onPress={submit} loading={busy} />
            <Button title="Volver a iniciar sesión" variant="ghost" onPress={() => navigation.navigate('Login')} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
