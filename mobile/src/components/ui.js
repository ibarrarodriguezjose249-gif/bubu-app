// Componentes visuales reutilizables con el estilo del prototipo original.
import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../constants/brand';

export function Screen({ children, scroll = true, edges = ['top', 'left', 'right'], contentStyle }) {
  const body = scroll ? (
    <ScrollView contentContainerStyle={[styles.page, contentStyle]} keyboardShouldPersistTaps="handled">{children}</ScrollView>
  ) : (
    <View style={[styles.page, { flex: 1 }, contentStyle]}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {body}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Button({ title, onPress, variant = 'primary', loading = false, disabled = false, style }) {
  const isDisabled = disabled || loading;
  const v = variantStyles[variant] || variantStyles.primary;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [styles.btn, v.box, pressed && { opacity: 0.85 }, isDisabled && { opacity: 0.55 }, style]}
    >
      {loading ? <ActivityIndicator color={v.text.color} /> : <Text style={[styles.btnText, v.text]}>{title}</Text>}
    </Pressable>
  );
}

const variantStyles = {
  primary: { box: { backgroundColor: colors.blue }, text: { color: colors.white } },
  outline: { box: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border }, text: { color: colors.ink } },
  soft: { box: { backgroundColor: '#e5efff' }, text: { color: colors.blue } },
  light: { box: { backgroundColor: colors.white }, text: { color: colors.blue } },
  danger: { box: { backgroundColor: colors.errorBg }, text: { color: colors.errorText } },
};

export function Field({ label, error, hint, style, multiline, ...inputProps }) {
  return (
    <View style={styles.field}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        placeholderTextColor={colors.muted}
        multiline={multiline}
        style={[styles.input, multiline && { minHeight: 96, textAlignVertical: 'top' }, !!error && { borderColor: colors.errorText }, style]}
        {...inputProps}
      />
      {!!error && <Text style={styles.fieldError}>{error}</Text>}
      {!error && !!hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const toneStyles = {
  success: { backgroundColor: colors.successBg, color: colors.successText },
  warn: { backgroundColor: colors.warnBg, color: colors.warnText },
  error: { backgroundColor: colors.errorBg, color: colors.errorText },
  info: { backgroundColor: colors.blueSoft, color: colors.blue },
};

export function Notice({ tone = 'info', children, style }) {
  if (!children) return null;
  const t = toneStyles[tone] || toneStyles.info;
  return <Text style={[styles.notice, { backgroundColor: t.backgroundColor, color: t.color }, style]}>{children}</Text>;
}

export function Badge({ tone = 'info', children }) {
  const t = toneStyles[tone] || toneStyles.info;
  return <Text style={[styles.badge, { backgroundColor: t.backgroundColor, color: t.color }]}>{children}</Text>;
}

export function Chip({ label, selected, onPress, disabled }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: !!selected, disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={[styles.chip, selected && styles.chipOn, disabled && { opacity: 0.45 }]}
    >
      <Text style={[styles.chipText, selected && { color: colors.blue }]}>{label}</Text>
    </Pressable>
  );
}

export function SectionTitle({ children, subtitle }) {
  return (
    <View style={{ marginTop: 22, marginBottom: 12 }}>
      <Text style={styles.section}>{children}</Text>
      {!!subtitle && <Text style={styles.muted}>{subtitle}</Text>}
    </View>
  );
}

export function Loading({ text = 'Cargando…' }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.blue} />
      <Text style={[styles.muted, { marginTop: 12 }]}>{text}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.bg },
  btn: { paddingVertical: 13, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 12, minHeight: 48 },
  btnText: { fontWeight: '800', fontSize: 15 },
  field: { marginTop: 14 },
  label: { fontSize: 13, fontWeight: '700', color: colors.ink, marginBottom: 7 },
  input: { backgroundColor: colors.white, borderWidth: 1, borderColor: '#dce4ef', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 12, fontSize: 15, color: colors.ink },
  fieldError: { color: colors.errorText, fontSize: 12, marginTop: 5 },
  hint: { color: colors.muted, fontSize: 12, marginTop: 5 },
  card: { backgroundColor: colors.white, padding: 18, borderRadius: 17, borderWidth: 1, borderColor: colors.border, marginTop: 14 },
  notice: { padding: 12, borderRadius: 11, marginTop: 12, fontSize: 13, lineHeight: 19, overflow: 'hidden' },
  badge: { alignSelf: 'flex-start', fontSize: 11, fontWeight: '800', paddingVertical: 5, paddingHorizontal: 9, borderRadius: 20, overflow: 'hidden' },
  chip: { paddingVertical: 9, paddingHorizontal: 13, borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, marginRight: 8, marginBottom: 8 },
  chipOn: { borderColor: colors.blue, backgroundColor: '#eff5ff' },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  section: { fontSize: 19, fontWeight: '800', color: colors.ink },
  title: { fontSize: 24, fontWeight: '900', color: colors.ink },
  muted: { fontSize: 13, color: colors.muted, marginTop: 5, lineHeight: 19 },
  text: { fontSize: 15, color: colors.ink, lineHeight: 21 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  disclaimer: { fontSize: 11, color: '#8793a5', textAlign: 'center', marginTop: 25, lineHeight: 17 },
});
