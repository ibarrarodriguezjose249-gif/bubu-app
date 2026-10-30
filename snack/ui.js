// Componentes visuales reutilizables (diseño v0.3: blanco, azul eléctrico, turquesa, Montserrat).
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, shadow } from './brand';
import Icon from './Icon';

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

// icon: nombre de ícono opcional a la izquierda del texto.
export function Button({ title, onPress, variant = 'primary', loading = false, disabled = false, style, icon }) {
  const isDisabled = disabled || loading;
  const v = variantStyles[variant] || variantStyles.primary;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [styles.btn, v.box, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }, isDisabled && { opacity: 0.5 }, style]}
    >
      {loading ? <ActivityIndicator color={v.text.color} /> : (
        <View style={styles.btnRow}>
          {!!icon && <Icon name={icon} size={18} color={v.text.color} />}
          <Text style={[styles.btnText, v.text]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const variantStyles = {
  primary: { box: { backgroundColor: colors.blue }, text: { color: colors.white } },
  outline: { box: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.blue }, text: { color: colors.blue } },
  soft: { box: { backgroundColor: colors.blueSoft }, text: { color: colors.blue } },
  light: { box: { backgroundColor: colors.white }, text: { color: colors.blue } },
  danger: { box: { backgroundColor: colors.errorBg }, text: { color: colors.errorText } },
  ghost: { box: { backgroundColor: 'transparent', minHeight: 40 }, text: { color: colors.blue } },
};

// icon: ícono a la izquierda. Si es contraseña, muestra el ojo para ver/ocultar.
export function Field({ label, error, hint, style, multiline, icon, secureTextEntry, ...inputProps }) {
  const [hidden, setHidden] = useState(!!secureTextEntry);
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputBox, focused && styles.inputFocus, !!error && { borderColor: colors.errorText }, multiline && { alignItems: 'flex-start' }]}>
        {!!icon && <Icon name={icon} size={18} color={colors.muted} style={{ marginRight: 8, marginTop: multiline ? 12 : 0 }} />}
        <TextInput
          placeholderTextColor="#94A0B3"
          multiline={multiline}
          secureTextEntry={hidden}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, multiline && { minHeight: 96, textAlignVertical: 'top' }, style]}
          {...inputProps}
        />
        {!!secureTextEntry && (
          <Pressable onPress={() => setHidden(!hidden)} hitSlop={10} accessibilityRole="button" accessibilityLabel={hidden ? 'Mostrar contraseña' : 'Ocultar contraseña'}>
            <Icon name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.muted} />
          </Pressable>
        )}
      </View>
      {!!error && <Text style={styles.fieldError}>{error}</Text>}
      {!error && !!hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const toneStyles = {
  success: { backgroundColor: colors.successBg, color: colors.successText, icon: 'checkmark-circle-outline' },
  warn: { backgroundColor: colors.warnBg, color: colors.warnText, icon: 'alert-circle-outline' },
  error: { backgroundColor: colors.errorBg, color: colors.errorText, icon: 'close-circle-outline' },
  info: { backgroundColor: colors.blueSoft, color: colors.blue, icon: 'information-circle-outline' },
};

export function Notice({ tone = 'info', children, style }) {
  if (!children) return null;
  const t = toneStyles[tone] || toneStyles.info;
  return (
    <View style={[styles.notice, { backgroundColor: t.backgroundColor }, style]}>
      <Icon name={t.icon} size={18} color={t.color} style={{ marginTop: 1 }} />
      <Text style={[styles.noticeText, { color: t.color }]}>{children}</Text>
    </View>
  );
}

export function Badge({ tone = 'info', children, icon }) {
  const t = toneStyles[tone] || toneStyles.info;
  if (!icon) return <Text style={[styles.badge, { backgroundColor: t.backgroundColor, color: t.color }]}>{children}</Text>;
  return (
    <View style={[styles.badgeRow, { backgroundColor: t.backgroundColor }]}>
      <Icon name={icon} size={12} color={t.color} />
      <Text style={[styles.badgeText, { color: t.color }]}>{children}</Text>
    </View>
  );
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
      {selected && <Icon name="checkmark" size={14} color={colors.blue} style={{ marginRight: 4 }} />}
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

// Fila con ícono + texto (reemplaza los emojis 📍 🚗 🗓 de antes).
export function IconLine({ icon, children, color = colors.muted, style, textStyle }) {
  return (
    <View style={[styles.iconLine, style]}>
      <Icon name={icon} size={15} color={color} style={{ marginTop: 2 }} />
      <Text style={[styles.iconLineText, { color }, textStyle]}>{children}</Text>
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
  page: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, width: '100%', maxWidth: 640, alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.bg },
  btn: { paddingVertical: 14, paddingHorizontal: 18, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 12, minHeight: 52 },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { fontFamily: fonts.bold, fontSize: 15 },
  field: { marginTop: 14 },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink, marginBottom: 7 },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 14 },
  inputFocus: { borderColor: colors.blue },
  input: { flex: 1, paddingVertical: 13, fontSize: 15, color: colors.ink, fontFamily: fonts.medium },
  fieldError: { fontFamily: fonts.medium, color: colors.errorText, fontSize: 12, marginTop: 5 },
  hint: { fontFamily: fonts.regular, color: colors.muted, fontSize: 12, marginTop: 5, lineHeight: 17 },
  card: { backgroundColor: colors.white, padding: 18, borderRadius: 20, borderWidth: 1, borderColor: colors.border, marginTop: 14, ...shadow },
  notice: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 14, marginTop: 12 },
  noticeText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 19 },
  badge: { alignSelf: 'flex-start', fontFamily: fonts.bold, fontSize: 11, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 20, overflow: 'hidden' },
  badgeRow: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 20 },
  badgeText: { fontFamily: fonts.bold, fontSize: 11 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white, marginRight: 8, marginBottom: 8 },
  chipOn: { borderColor: colors.blue, backgroundColor: colors.blueSoft },
  chipText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  section: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink },
  title: { fontFamily: fonts.extra, fontSize: 24, color: colors.ink },
  muted: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 5, lineHeight: 19 },
  text: { fontFamily: fonts.regular, fontSize: 15, color: colors.ink, lineHeight: 22 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  iconLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 6 },
  iconLineText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 19 },
  disclaimer: { fontFamily: fonts.regular, fontSize: 11, color: '#7B879A', textAlign: 'center', marginTop: 25, lineHeight: 17 },
});
